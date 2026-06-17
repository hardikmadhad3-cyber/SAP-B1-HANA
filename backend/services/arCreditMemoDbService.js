/**
 * AR Credit Memo DB Service - ODBC/Direct SQL for GET operations
 * Reads data directly from SAP B1 SQL Server database
 */
const db = require('./dbService');
const masterDataDbService = require('./masterDataDbService');
const salesOrderDb = require('./salesOrderDbService');
const deliveryDb = require('./deliveryDbService');
const arInvoiceDb = require('./arInvoiceDbService');
const { getHeaderUdfValues, getLineUdfValues, getMarketingDocumentUdfs } = require('./udfMetadataService');
const { buildMarketingDocumentListFilterQuery } = require('./documentListUtils');

const safe = async (promise) => {
  try {
    const r = await promise;
    return r.recordset || [];
  } catch (e) {
    console.error('[AR Credit Memo DB] Error:', e);
    return [];
  }
};

const tableFieldMetadataPromises = new Map();

const getTableFieldMetadata = async (tableName) => {
  const normalizedTableName = String(tableName || '').trim();
  if (!normalizedTableName) return {};

  const databaseName = await db.resolveDatabaseName().catch(() => '');
  const cacheKey = `${databaseName || 'default'}:${normalizedTableName}`;

  if (!tableFieldMetadataPromises.has(cacheKey)) {
    tableFieldMetadataPromises.set(cacheKey, safe(db.query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
    `, { tableName: normalizedTableName })).then((rows) => rows.reduce((acc, row) => {
      acc[row.COLUMN_NAME] = row.DATA_TYPE;
      return acc;
    }, {})));
  }

  return tableFieldMetadataPromises.get(cacheKey);
};

const hasTableField = (metadata, columnName) => {
  const normalizedColumnName = String(columnName || '').trim().toLowerCase();
  if (!metadata || !normalizedColumnName) return false;
  return Object.keys(metadata).some((fieldName) => fieldName.toLowerCase() === normalizedColumnName);
};

const sqlAlias = (alias) => `[${String(alias || '').replace(/]/g, ']]')}]`;

const optionalColumn = (metadata, tableAlias, columnName, alias, fallback = 'NULL') => (
  hasTableField(metadata, columnName)
    ? `${tableAlias}.[${columnName}] AS ${sqlAlias(alias)}`
    : `${fallback} AS ${sqlAlias(alias)}`
);

// ── REFERENCE DATA QUERIES ────────────────────────────────────────────────────

const getCustomers = () => safe(db.query(`
  SELECT CardCode, CardName, CardType, Currency,
         VatGroup, GroupNum AS PayTermsGrpCode
  FROM   OCRD
  WHERE  CardType = 'C'
    AND  frozenFor <> 'Y'
  ORDER  BY CardName
`));

const getItems = () => safe(db.query(`
  SELECT ItemCode, ItemName,
         SalUnitMsr  AS SalesUnit,
         InvntryUom  AS InventoryUOM,
         SUoMEntry   AS UoMGroupEntry,
         DfltWH      AS DefaultWarehouse,
         SWW         AS HSNCode,
         ManBtchNum  AS BatchManaged,
         ManSerNum   AS SerialManaged
  FROM   OITM
  WHERE  SellItem = 'Y'
    AND  validFor  <> 'N'
  ORDER  BY ItemCode
`));

const getWarehouses = () => safe(db.query(`
  SELECT WhsCode, WhsName, Street, Block,
         City, County, State, ZipCode, Country, BPLid AS BranchID
  FROM   OWHS
  WHERE  Inactive <> 'Y'
  ORDER  BY WhsCode
`));

const getPaymentTerms = () => safe(db.query(`
  SELECT GroupNum, PymntGroup
  FROM   OCTG
  ORDER  BY PymntGroup
`));

const getShippingTypes = () => safe(db.query(`
  SELECT TrnspCode, TrnspName
  FROM   OSHP
  ORDER  BY TrnspName
`));

const getSalesEmployees = () => safe(db.query(`
  SELECT SlpCode, SlpName, Memo, Commission, Active
  FROM   OSLP
  ORDER  BY
    CASE WHEN SlpCode = -1 THEN 0 ELSE 1 END,
    SlpName
`));

const getBranches = () => safe(db.query(`
  SELECT BPLId, BPLName, State
  FROM   OBPL where Disabled='N' 
  ORDER  BY BPLName
`));

const getStates = () => safe(db.query(`
  SELECT Code, Name
  FROM   OCST
  WHERE  Country = 'IN'
  ORDER  BY Name
`));

const getTaxCodes = () => masterDataDbService.searchDocumentTaxCodes('', 'sales', 500, 0);

const getUomGroups = () => safe(db.query(`
  SELECT g.UgpEntry AS AbsEntry,
         g.UgpCode  AS Name,
         u.UomCode,
         d.BaseQty AS BaseQty,
         d.AltQty AS AltQty
  FROM   OUGP g
  LEFT JOIN UGP1 d ON d.UgpEntry = g.UgpEntry
  LEFT JOIN OUOM u ON u.UomEntry = d.UomEntry
  WHERE  g.Locked <> 'Y'
  ORDER  BY g.UgpEntry, d.LineNum
`));

const getDecimalSettings = () => safe(db.query(`
  SELECT TOP 1
    DecSep, ThousSep, DateSep, DateFormat,
    PriceDec,
    QtyDec,
    RateDec,
    PercentDec,
    MeasureDec AS MeasurDec,
    SumDec
  FROM OADM
`));

const getCompanyInfo = () => safe(db.query(`
  SELECT TOP 1
    CompnyName,
    CompnyAddr AS Address,
    State
  FROM OADM
`));

// ── CUSTOMER DETAILS ──────────────────────────────────────────────────────────

const getContactsByCustomer = async (cardCode) => {
  const result = await safe(db.query(`
    SELECT 
      T0.CardCode,
      T0.CntctCode,
      T0.Name,
      T0.FirstName,
      T0.LastName,
      T0.E_MailL AS E_Mail,
      T0.Cellolar AS MobilePhone,
      T0.Tel1 AS Phone1
    FROM OCPR T0
    WHERE T0.CardCode = @cardCode
    ORDER BY T0.Name
  `, { cardCode }));

  return result;
};

const getAddressesByCustomer = async (cardCode) => {
  const result = await safe(db.query(`
    SELECT 
      T0.CardCode,
      T0.Address,
      T0.AdresType,
      T0.Street,
      T0.StreetNo,
      T0.Block,
      T0.Building,
      T0.Address2,
      T0.Address3,
      T0.City,
      T0.County,
      T0.State,
      T0.ZipCode,
      T0.Country,
      T0.GSTRegnNo AS GSTIN
    FROM CRD1 T0
    WHERE T0.CardCode = @cardCode
    ORDER BY T0.Address
  `, { cardCode }));

  return result;
};

// ── AR CREDIT MEMO LIST ───────────────────────────────────────────────────────

const getARCreditMemoList = async ({
  query = '',
  openOnly = false,
  docNum = '',
  customerCode = '',
  customerName = '',
  sellerCode = '',
  sellerName = '',
  status = '',
  postingDateFrom = '',
  postingDateTo = '',
  page = 1,
  pageSize = 25,
} = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(200, Math.max(1, Number(pageSize) || 25));
  const skip = (normalizedPage - 1) * normalizedPageSize;
  const { whereClauses, params } = buildMarketingDocumentListFilterQuery({
    query,
    openOnly,
    docNum,
    partnerCode: customerCode,
    partnerName: customerName,
    sellerCode,
    sellerName,
    status,
    postingDateFrom,
    postingDateTo,
  }, { includeSellerFields: true });

  const countRows = await safe(db.query(`
    SELECT COUNT(*) AS total_count
    FROM ORIN T0
    WHERE ${whereClauses.join('\n      AND ')}
  `, params));

  const totalCount = Number(countRows?.[0]?.total_count || 0);

  const result = await safe(db.query(`
    SELECT
      T0.DocEntry AS doc_entry,
      T0.DocNum AS doc_num,
      T0.CardCode AS customer_code,
      T0.CardName AS customer_name,
      T0.U_Seller_Code AS seller_code,
      T0.U_Seller_Name AS seller_name,
      T0.DocDate AS posting_date,
      T0.DocDueDate AS delivery_date,
      T0.DocTotal AS total_amount,
      T0.DocCur AS currency,
      CASE T0.DocStatus
        WHEN 'O' THEN 'Open'
        WHEN 'C' THEN 'Closed'
        ELSE T0.DocStatus
      END AS status,
      (
        SELECT COUNT(*)
        FROM RIN1 T1
        WHERE T1.DocEntry = T0.DocEntry
      ) AS line_count
    FROM ORIN T0
    WHERE ${whereClauses.join('\n      AND ')}
    ORDER BY T0.DocEntry DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize }));

  return {
    ar_credit_memos: result.map((row) => ({
      doc_entry: row.doc_entry,
      doc_num: row.doc_num,
      customer_code: row.customer_code,
      customer_name: row.customer_name,
      seller_code: row.seller_code || '',
      seller_name: row.seller_name || '',
      posting_date: row.posting_date ? row.posting_date.toISOString().split('T')[0] : '',
      delivery_date: row.delivery_date ? row.delivery_date.toISOString().split('T')[0] : '',
      total_amount: Number(row.total_amount || 0),
      currency: row.currency || '',
      status: row.status || '',
      line_count: Number(row.line_count || 0),
    })),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / normalizedPageSize)),
    },
  };
};

// ── GET SINGLE AR CREDIT MEMO ─────────────────────────────────────────────────

const getARCreditMemo = async (docEntry) => {
  const headerRows = await safe(db.query(`
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T0.Series,
      NNM.SeriesName,
      NNM.Indicator AS SeriesIndicator,
      T0.CardCode,
      T0.CardName,
      T0.CntctCode AS ContactPersonCode,
      T0.NumAtCard AS CustomerRefNo,
      T0.DocDate AS PostingDate,
      T0.DocDueDate AS DeliveryDate,
      T0.TaxDate AS DocumentDate,
      T0.BPLId AS Branch,
      T0.DocCur AS Currency,
      T0.GroupNum AS PaymentTerms,
      T0.Comments AS Remarks,
      T0.JrnlMemo AS JournalRemark,
      T0.DiscPrcnt AS DiscountPercent,
      T0.TotalExpns AS Freight,
      T0.VatSum AS Tax,
      T0.DocTotal AS TotalPaymentDue,
      T0.SlpCode AS SalesEmployeeCode,
      SLP.SlpName AS SalesEmployeeName,
      CASE T0.DocStatus
        WHEN 'O' THEN 'Open'
        WHEN 'C' THEN 'Closed'
        ELSE T0.DocStatus
      END AS DocumentStatus
    FROM ORIN T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    LEFT JOIN NNM1 NNM ON NNM.ObjectCode = '14' AND NNM.Series = T0.Series
    WHERE T0.DocEntry = @docEntry
  `, { docEntry }));

  if (!headerRows.length) {
    throw new Error(`AR Credit Memo ${docEntry} not found`);
  }

  const header = headerRows[0];
  const lineFieldMetadata = await getTableFieldMetadata('RIN1');
  const lineTaxExpression = hasTableField(lineFieldMetadata, 'TaxCode')
    ? 'T0.TaxCode'
    : hasTableField(lineFieldMetadata, 'VatGroup')
      ? 'T0.VatGroup'
      : "''";
  const lineUomExpression = hasTableField(lineFieldMetadata, 'unitMsr')
    ? 'T0.unitMsr'
    : hasTableField(lineFieldMetadata, 'UomCode')
      ? 'T0.UomCode'
      : "''";
  const [headerUdfs, lineUdfsByLineNum] = await Promise.all([
    getHeaderUdfValues({ tableId: 'ORIN', keyValue: docEntry }),
    getLineUdfValues({ tableId: 'RIN1', keyValue: docEntry }),
  ]);

  const lineRows = await safe(db.query(`
    SELECT 
      T0.LineNum,
      T0.ItemCode,
      COALESCE(NULLIF(LTRIM(RTRIM(T0.Dscription)), ''), ITM.ItemName, '') AS ItemDescription,
      T0.Quantity,
      T0.Price AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent,
      ${lineTaxExpression} AS TaxCode,
      T0.LineTotal,
      ${optionalColumn(lineFieldMetadata, 'T0', 'WTLiable', 'WTLiable', "'N'")},
      T0.WhsCode AS Warehouse,
      ${lineUomExpression} AS UoMCode,
      ${optionalColumn(lineFieldMetadata, 'T0', 'AcctCode', 'GLAccount', "''")},
      ${optionalColumn(lineFieldMetadata, 'T0', 'OcrCode', 'DistributionRule', "''")},
      ${optionalColumn(lineFieldMetadata, 'T0', 'CogsOcrCod', 'COGSDistributionRule', "''")},
      ${optionalColumn(lineFieldMetadata, 'T0', 'CountryOrg', 'CountryOfOrigin', "''")},
      ${optionalColumn(lineFieldMetadata, 'T0', 'LocCode', 'Loc', "''")},
      ${optionalColumn(lineFieldMetadata, 'T0', 'EnSetCost', 'EnableSettingCost', "'N'")},
      ${optionalColumn(lineFieldMetadata, 'T0', 'RetCost', 'ReturnCost', '0')},
      ${optionalColumn(lineFieldMetadata, 'T0', 'AgrNo', 'BlanketAgreementNo', "''")},
      ${optionalColumn(lineFieldMetadata, 'T0', 'StockPrice', 'ItemCost', '0')},
      T0.BaseEntry,
      T0.BaseType,
      T0.BaseLine
    FROM RIN1 T0
    LEFT JOIN OITM ITM ON ITM.ItemCode = T0.ItemCode
    WHERE T0.DocEntry = @docEntry
    ORDER BY T0.LineNum
  `, { docEntry }));

  console.log(`[DB] getARCreditMemo - DocEntry: ${docEntry}, Line rows found: ${lineRows.length}`);

  const itemCodes = lineRows.map(l => l.ItemCode).filter(Boolean);
  let itemInfoMap = {};
  
  if (itemCodes.length > 0) {
    try {
      const itemRows = await safe(db.query(`
        SELECT ItemCode, SWW AS HSNCode, ManBtchNum AS BatchManaged
        FROM OITM
        WHERE ItemCode IN (${itemCodes.map((_, i) => `@item${i}`).join(',')})
      `, itemCodes.reduce((acc, code, i) => ({ ...acc, [`item${i}`]: code }), {})));
      
      itemInfoMap = itemRows.reduce((acc, row) => {
        acc[row.ItemCode] = {
          hsnCode: row.HSNCode || '',
          batchManaged: row.BatchManaged === 'Y'
        };
        return acc;
      }, {});
    } catch (err) {
      console.error('[DB] Error fetching item info:', err);
    }
  }

  // Fetch batch allocations for this credit memo
  const batchRows = await safe(db.query(`
    SELECT BaseLinNum AS BaseLineNum, BatchNum, Quantity
    FROM   IBT1
    WHERE  BaseEntry = @docEntry
      AND  BaseType = 14
    ORDER  BY BaseLinNum, BatchNum
  `, { docEntry }));

  const batchesByLine = {};
  batchRows.forEach(b => {
    if (!batchesByLine[b.BaseLineNum]) {
      batchesByLine[b.BaseLineNum] = [];
    }
    batchesByLine[b.BaseLineNum].push({
      batchNumber: b.BatchNum || '',
      quantity: String(b.Quantity || 0),
      expiryDate: '',
    });
  });

  return {
    ar_credit_memo: {
      doc_entry: header.DocEntry,
      doc_num: header.DocNum,
      header: {
        customer: header.CardCode,
        customerCode: header.CardCode,
        name: header.CardName,
        customerName: header.CardName,
        contactPerson: header.ContactPersonCode ? String(header.ContactPersonCode) : '',
        salesContractNo: header.CustomerRefNo || '',
        branch: header.Branch ? String(header.Branch) : '',
        warehouse: lineRows.length > 0 && lineRows[0].Warehouse ? String(lineRows[0].Warehouse) : '',
        docNo: header.DocNum ? String(header.DocNum) : '',
        status: header.DocumentStatus || 'Open',
        series: header.Series ? String(header.Series) : '',
        seriesName: header.SeriesName || '',
        seriesIndicator: header.SeriesIndicator || '',
        postingDate: header.PostingDate ? header.PostingDate.toISOString().split('T')[0] : '',
        deliveryDate: header.DeliveryDate ? header.DeliveryDate.toISOString().split('T')[0] : '',
        documentDate: header.DocumentDate ? header.DocumentDate.toISOString().split('T')[0] : '',
        journalRemark: header.JournalRemark || '',
        paymentTerms: header.PaymentTerms ? String(header.PaymentTerms) : '',
        paymentTermsCode: header.PaymentTerms ? String(header.PaymentTerms) : '',
        otherInstruction: header.Remarks || '',
        discount: header.DiscountPercent != null ? String(header.DiscountPercent) : '',
        freight: header.Freight != null ? String(header.Freight) : '',
        tax: header.Tax != null ? String(header.Tax) : '',
        totalPaymentDue: header.TotalPaymentDue != null ? String(header.TotalPaymentDue) : '',
        salesEmployee: header.SalesEmployeeCode ? String(header.SalesEmployeeCode) : '',
        purchaser: header.SalesEmployeeName || '',
      },
      lines: lineRows.map((l, idx) => {
        const itemInfo = itemInfoMap[l.ItemCode] || { hsnCode: '', batchManaged: false };
        return {
          baseEntry: l.BaseEntry || null,
          baseType: l.BaseType || null,
          baseLine: l.BaseLine || null,
          itemNo: l.ItemCode || '',
          itemDescription: l.ItemDescription || '',
          hsnCode: itemInfo.hsnCode,
          quantity: l.Quantity != null ? String(l.Quantity) : '',
          unitPrice: l.UnitPrice != null ? String(l.UnitPrice) : '',
          stdDiscount: l.DiscountPercent != null ? String(l.DiscountPercent) : '',
          taxCode: l.TaxCode || '',
          total: l.LineTotal != null ? String(l.LineTotal) : '',
          wTaxLiable: String(l.WTLiable || '').toUpperCase() === 'Y' ? 'Y' : 'N',
          whse: l.Warehouse || '',
          glAccount: l.GLAccount || '',
          distRule: l.DistributionRule || '',
          cogsDistRule: l.COGSDistributionRule || l.DistributionRule || '',
          countryOfOrigin: l.CountryOfOrigin || '',
          loc: l.Loc || '',
          uomCode: l.UoMCode || '',
          uomName: l.UoMCode || '',
          enableSettingCost: String(l.EnableSettingCost || '').toUpperCase() === 'Y' ? 'Y' : 'N',
          returnCost: l.ReturnCost != null ? String(l.ReturnCost) : '',
          blanketAgreementNo: l.BlanketAgreementNo != null ? String(l.BlanketAgreementNo) : '',
          itemCost: l.ItemCost != null ? String(l.ItemCost) : '',
          batchManaged: itemInfo.batchManaged,
          batches: batchesByLine[l.LineNum] || [],
          udf: lineUdfsByLineNum[l.LineNum] || {},
        };
      }),
      header_udfs: headerUdfs,
    }
  };
};

// ── DOCUMENT SERIES ───────────────────────────────────────────────────────────

const getDocumentSeries = async (targetDate = null) => {
  const effectiveTargetDate = targetDate || new Date().toISOString().split('T')[0];
  const result = await safe(db.query(`
   SELECT 
    T0.Series,
    T0.SeriesName,
    T0.Indicator,
    T0.NextNumber,
    T1.Name AS FinancialYear,
    T1.F_RefDate AS FromDate,
    T1.T_RefDate AS ToDate
FROM NNM1 T0
INNER JOIN OFPR T1 
    ON T0.Indicator = T1.Indicator
WHERE T0.ObjectCode = '14'
    AND T0.Locked = 'N'
    AND CAST(@targetDate AS date) BETWEEN T1.F_RefDate AND T1.T_RefDate
ORDER BY T0.SeriesName
  `, { targetDate: effectiveTargetDate }));

  return result.map(s => ({
    Series: s.Series,
    SeriesName: s.SeriesName,
    NextNumber: s.NextNumber,
    Indicator: s.Indicator,
  }));
};

const getNextNumber = async (series) => {
  const result = await safe(db.query(`
    SELECT NextNumber
    FROM NNM1
    WHERE Series = @series
      AND ObjectCode = '14'
  `, { series }));

  if (result.length > 0) {
    return { nextNumber: result[0].NextNumber };
  }

  return { nextNumber: null };
};

// ── STATE FROM ADDRESS/WAREHOUSE ──────────────────────────────────────────────

const getStateFromAddress = async (cardCode, addressCode) => {
  const result = await safe(db.query(`
    SELECT State
    FROM CRD1
    WHERE CardCode = @cardCode
      AND Address = @addressCode
  `, { cardCode, addressCode }));

  if (result.length > 0) {
    return { state: result[0].State || '' };
  }

  return { state: '' };
};

const getWarehouseState = async (whsCode) => {
  const result = await safe(db.query(`
    SELECT State
    FROM OWHS
    WHERE WhsCode = @whsCode
  `, { whsCode }));

  if (result.length > 0) {
    return { state: result[0].State || '' };
  }

  return { state: '' };
};

// ── FREIGHT CHARGES ───────────────────────────────────────────────────────────

const getFreightCharges = (docEntry) => {
  if (!docEntry) {
    // CREATE MODE (New AR Credit Memo)
    return safe(db.query(`
      SELECT 
        T0.ExpnsCode,
        T0.ExpnsName,
        T0.DistrbMthd AS DistributionMethod,
        T0.TaxLiable,
        T0.RevFixSum AS DefaultAmount
      FROM OEXD T0
      ORDER BY T0.ExpnsName
    `));
  }

  // EDIT MODE (Existing AR Credit Memo)
  return safe(db.query(`
    SELECT 
      T0.ExpnsCode,
      T0.ExpnsName,
      T0.DistrbMthd AS DistributionMethod,
      T0.TaxLiable,
      T0.RevFixSum AS DefaultAmount,

      ISNULL(T1.LineTotal, 0) AS LineTotal,
      T1.TaxCode,
      T1.VatSum AS TaxAmount,
      T1.Comments

    FROM OEXD T0
    LEFT JOIN RIN3 T1 
      ON T0.ExpnsCode = T1.ExpnsCode 
     AND T1.DocEntry = @DocEntry

    ORDER BY T0.ExpnsName
  `, { DocEntry: docEntry }));
};

// ── ITEMS FOR MODAL ───────────────────────────────────────────────────────────

const getItemsForModal = () => safe(db.query(`
  SELECT 
    T0.ItemCode,
    T0.ItemName,
    T0.FrgnName AS ForeignName,
    T0.ItmsGrpCod AS ItemGroupCode,
    T1.ItmsGrpNam AS ItemGroup, 
    CAST(T0.OnHand AS DECIMAL(19,2)) AS InStock,
    T0.IsCommited AS Committed,
    T0.OnOrder AS Ordered,
    T0.SalUnitMsr AS SalesUnit,
    T0.InvntryUom AS InventoryUOM,
    T0.SUoMEntry AS UoMGroupEntry,
    CHP.ChapterID AS HSNCode,
    T0.validFor AS Active,
    T0.frozenFor AS Frozen,
    T0.PrchseItem AS PurchaseItem,
    T0.SellItem AS SalesItem,
    T0.InvntItem AS InventoryItem,
    T0.DfltWH AS DefaultWarehouse,
    T0.ManBtchNum AS BatchManaged,
    T0.ManSerNum AS SerialManaged
  FROM OITM T0
  LEFT JOIN OITB T1 ON T0.ItmsGrpCod = T1.ItmsGrpCod 
  LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
  WHERE T0.SellItem = 'Y'
    AND T0.validFor <> 'N'
  ORDER BY T0.ItemCode
`));

// ── BATCHES ───────────────────────────────────────────────────────────────────

const getBatchesByItem = async (itemCode, whsCode) => {
  const result = await safe(db.query(`
    SELECT 
      T0.BatchNum AS BatchNumber,
      T0.Quantity AS AvailableQty,
      T0.ExpDate AS ExpiryDate
    FROM OIBT T0
    WHERE T0.ItemCode = @itemCode
      AND T0.WhsCode = @whsCode
      AND T0.Quantity > 0
    ORDER BY T0.ExpDate
  `, { itemCode, whsCode }));

  return { batches: result };
};

// ── UOM CONVERSION ────────────────────────────────────────────────────────────

const getUomConversionFactor = async (itemCode, uomCode) => {
  const result = await safe(db.query(`
    SELECT 
      T0.ItemCode,
      T0.InvntryUom AS InventoryUOM,
      T0.SUoMEntry AS UoMGroupEntry,
      T0.SalUnitMsr AS SalesUnit,
      T2.BaseQty,
      T2.AltQty,
      T3.UomCode
    FROM OITM T0
    LEFT JOIN OUGP T1 ON T0.SUoMEntry = T1.UgpEntry
    LEFT JOIN UGP1 T2 ON T1.UgpEntry = T2.UgpEntry
    LEFT JOIN OUOM T3 ON T2.UomEntry = T3.UomEntry
    WHERE T0.ItemCode = @itemCode
      AND T3.UomCode = @uomCode
  `, { itemCode, uomCode }));

  if (result.length > 0) {
    const row = result[0];
    const baseQty = parseFloat(row.BaseQty || 1);
    const altQty = parseFloat(row.AltQty || 1);
    const factor = baseQty > 0 ? altQty / baseQty : 1;
    
    return {
      inventoryUOM: row.InventoryUOM,
      uomCode: row.UomCode,
      baseQty,
      altQty,
      factor
    };
  }

  // If not found in UoM Group, check if the UoM code itself is numeric
  const numericFactor = parseFloat(uomCode);
  if (!isNaN(numericFactor) && numericFactor > 0) {
    const itemResult = await safe(db.query(`
      SELECT InvntryUom AS InventoryUOM
      FROM OITM
      WHERE ItemCode = @itemCode
    `, { itemCode }));
    
    const inventoryUOM = itemResult.length > 0 ? itemResult[0].InventoryUOM : '';
    
    return {
      inventoryUOM,
      uomCode: uomCode,
      baseQty: 1,
      altQty: numericFactor,
      factor: numericFactor
    };
  }

  return {
    inventoryUOM: '',
    uomCode: uomCode,
    baseQty: 1,
    altQty: 1,
    factor: 1
  };
};

// ── MAIN REFERENCE DATA FUNCTION ──────────────────────────────────────────────

const AR_CREDIT_MEMO_FORM_ID = '179';
const AR_CREDIT_MEMO_MATRIX_ITEM_ID = '38';
const AR_CREDIT_MEMO_SUPPRESSED_ROW_UDFS = new Set([
  'APIVDOCKEY',
  'APIVDOCNUM',
  'APIVLINENUM',
  'APINVDOCKEY',
  'APINVDOCNUM',
  'APINVLINENUM',
]);

const AR_CREDIT_MEMO_MATRIX_COLUMN_DEFS = [
  { key: 'itemNo', label: 'Item No.', minWidth: 160, sapField: 'ItemCode', sapColumnIds: ['1', 'ItemCode', 'Item No.', 'ItemNo'] },
  { key: 'itemDescription', label: 'Item Description', minWidth: 220, sapField: 'Dscription', sapColumnIds: ['3', 'Dscription', 'ItemDescription', 'Item Description'] },
  { key: 'quantity', label: 'Qty', minWidth: 80, sapField: 'Quantity', sapColumnIds: ['11', 'Quantity', 'Qty'] },
  { key: 'noOfPackages', label: 'No. of Packages', minWidth: 120, sapField: 'PackQty', alternativeFields: ['Packages', 'NumOfPacks'], sapColumnIds: ['13', 'PackQty', 'Packages', 'No. of Packages', 'NumOfPacks'] },
  { key: 'unitPrice', label: 'Unit Price', minWidth: 95, sapField: 'Price', alternativeFields: ['PriceBefDi'], sapColumnIds: ['14', 'Price', 'PriceBefDi', 'UnitPrice', 'Unit Price'] },
  { key: 'stdDiscount', label: 'Disc%', minWidth: 85, sapField: 'DiscPrcnt', sapColumnIds: ['15', 'DiscPrcnt', 'DiscountPercent', 'Discount %', 'Disc%'] },
  { key: 'taxCode', label: 'Tax Code', minWidth: 115, sapField: 'TaxCode', sapColumnIds: ['234000377', '160', 'TaxCode', 'Tax Code'] },
  { key: 'wTaxLiable', label: 'WTax Liable', minWidth: 100, sapField: 'WtLiable', type: 'yesNo', sapColumnIds: ['18', 'WTLiable', 'WtLiable', 'WTax Liable'] },
  { key: 'totalLC', label: 'Total (LC)', minWidth: 110, sapField: 'LineTotal', calculated: true, sapColumnIds: ['160', '17', 'GTotal', 'Total', 'Total (LC)', 'LineTotal'] },
  { key: 'whse', label: 'Whse', minWidth: 90, sapField: 'WhsCode', sapColumnIds: ['174', 'WhsCode', 'Warehouse', 'Whse'] },
  { key: 'glAccount', label: 'G/L Account', minWidth: 135, sapField: 'AcctCode', sapColumnIds: ['234001512', 'AcctCode', 'G/L Account', 'GLAccount'] },
  { key: 'distRule', label: 'Distr. Rule', minWidth: 105, sapField: 'OcrCode', sapColumnIds: ['21', 'OcrCode', 'Distr. Rule', 'DistributionRule'] },
  { key: 'taxLiable', label: 'Tax Liable', minWidth: 95, sapField: 'TaxOnly', type: 'checkbox', sapColumnIds: ['22', 'TaxOnly', 'Tax Liable'] },
  { key: 'weight', label: 'Weight', minWidth: 95, sapField: 'Weight1', alternativeFields: ['Weight'], sapColumnIds: ['23', 'Weight1', 'Weight'] },
  { key: 'taxAmount', label: 'Tax Amount (LC)', minWidth: 125, sapField: 'VatSum', calculated: true, sapColumnIds: ['24', 'VatSum', 'Tax Amount (LC)'] },
  { key: 'uomCode', label: 'UoM Code', minWidth: 105, sapField: 'UomCode', alternativeFields: ['unitMsr', 'UomEntry'], sapColumnIds: ['1470002149', '1470002145', 'UomCode', 'unitMsr', 'UoM Code', 'UoM'] },
  { key: 'uomName', label: 'UoM Name', minWidth: 120, sapField: 'unitMsr', alternativeFields: ['UomCode'], sapColumnIds: ['unitMsr', 'UoM Name'] },
  { key: 'cogsDistRule', label: 'COGS Distr. Rule', minWidth: 135, sapField: 'CogsOcrCod', sapColumnIds: ['29', 'CogsOcrCod', 'COGS Distr. Rule'] },
  { key: 'countryOfOrigin', label: 'Country/Region of Origin', minWidth: 185, sapField: 'CountryOrg', sapColumnIds: ['10002037', 'CountryOrg', 'Country/Region of Origin'] },
  { key: 'loc', label: 'Loc.', source: 'branch', sapColumnIds: ['10002047', 'LocCode', 'Location', 'LOC', 'Loc.'], minWidth: 115 },
  { key: 'branch', label: 'Branch', source: 'branch', sapColumnIds: ['BPLId', 'Branch'], minWidth: 115 },
  { key: 'enableSettingCost', label: 'Enable Setting Cost', minWidth: 140, sapField: 'EnSetCost', alternativeFields: ['EnableSetCost'], type: 'checkbox', sapColumnIds: ['110000310', 'EnSetCost', 'Enable Setting Cost'] },
  { key: 'returnCost', label: 'Return Cost (LC)', minWidth: 125, sapField: 'RetCost', alternativeFields: ['ReturnCost'], sapColumnIds: ['1003', 'RetCost', 'Return Cost (LC)'] },
  { key: 'blanketAgreementNo', label: 'Blanket Agreement No.', minWidth: 170, sapField: 'AgrNo', alternativeFields: ['AgrLineNum'], sapColumnIds: ['1000', 'AgrNo', 'Blanket Agreement No.'] },
  { key: 'hsnCode', label: 'HSN', minWidth: 115, sapField: 'HsnEntry', sapColumnIds: ['254000391', 'HsnEntry', 'HSN', 'HSN/SAC'] },
  { key: 'sacCode', label: 'SAC', minWidth: 95, sapField: 'SacEntry', sapColumnIds: ['254000393', 'SacEntry', 'SAC'] },
];

const truthySapFlag = (value) => ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value ?? '').trim().toUpperCase());
const falsySapFlag = (value) => ['N', 'NO', 'FALSE', '0', 'TNO'].includes(String(value ?? '').trim().toUpperCase());
const sapFlagToBoolean = (value, fallback = true) => {
  if (truthySapFlag(value)) return true;
  if (falsySapFlag(value)) return false;
  return fallback;
};
const normalizePreferenceKey = (value) => String(value || '').trim().toUpperCase().replace(/^U_/, '').replace(/[^A-Z0-9]/g, '');

const resolveSapUserSign = async () => {
  let sapUsername = '';
  try {
    const { getActiveCompanyConfig } = require('./companyConfigService');
    const activeConfig = await getActiveCompanyConfig();
    sapUsername = String(activeConfig.serviceLayer?.username || '').trim();
  } catch (_error) {
    sapUsername = '';
  }
  if (!sapUsername) return null;

  const rows = await safe(db.query(`
    SELECT TOP 1 USERID
    FROM OUSR
    WHERE USER_CODE = @sapUsername
       OR U_NAME = @sapUsername
    ORDER BY CASE WHEN USER_CODE = @sapUsername THEN 0 ELSE 1 END, USERID
  `, { sapUsername }));

  const userSign = Number(rows[0]?.USERID);
  return Number.isFinite(userSign) ? userSign : null;
};

const getARCreditMemoColumnPreferences = async () => {
  const tableRows = await safe(db.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'CPRF'
  `));
  if (!tableRows.length) return { byKey: {}, rows: [], userSign: null };

  const cprfColumns = await safe(db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'CPRF'
  `));
  const columnSet = new Set(cprfColumns.map((row) => String(row.COLUMN_NAME || '').trim()));
  const hasItemUid = columnSet.has('ItemUID');
  const hasTableName = columnSet.has('TableName');
  const userSign = await resolveSapUserSign();
  if (userSign == null) return { byKey: {}, rows: [], userSign: null };

  let rows = await safe(db.query(`
    SELECT
      FormID, ItemID, ColID, Width, VisInForm, VisualIndx, EditInForm,
      VisInExpnd, ExpandIndx, EditInEXP, UserSign, TPLId
      ${hasTableName ? ', TableName' : ", '' AS TableName"}
      ${hasItemUid ? ', ItemUID' : ", '' AS ItemUID"}
    FROM CPRF
    WHERE FormID = @formId
      AND (
        ItemID = @itemId
        ${hasItemUid ? 'OR ItemUID = @itemId' : ''}
      )
      AND UserSign = @userSign
    ORDER BY CASE WHEN TPLId = 0 THEN 0 ELSE 1 END, VisualIndx, ColID
  `, {
    formId: AR_CREDIT_MEMO_FORM_ID,
    itemId: AR_CREDIT_MEMO_MATRIX_ITEM_ID,
    tableName: 'RIN1',
    userSign,
  }));

  if (!rows.length && hasTableName) {
    rows = await safe(db.query(`
      SELECT
        FormID, ItemID, ColID, Width, VisInForm, VisualIndx, EditInForm,
        VisInExpnd, ExpandIndx, EditInEXP, UserSign, TPLId,
        TableName
        ${hasItemUid ? ', ItemUID' : ", '' AS ItemUID"}
      FROM CPRF
      WHERE FormID = @formId
        AND TableName = @tableName
        AND UserSign = @userSign
      ORDER BY CASE WHEN TPLId = 0 THEN 0 ELSE 1 END, VisualIndx, ColID
    `, {
      formId: AR_CREDIT_MEMO_FORM_ID,
      tableName: 'RIN1',
      userSign,
    }));
  }

  const byKey = rows.reduce((acc, row) => {
    [row.ColID, row.TableName, row.ItemUID].map(normalizePreferenceKey).filter(Boolean).forEach((key) => {
      if (!acc[key]) acc[key] = row;
    });
    return acc;
  }, {});

  return { byKey, rows, userSign };
};

const getARCreditMemoLineTableColumns = async () => {
  const rows = await safe(db.query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION,
           NUMERIC_SCALE, IS_NULLABLE, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RIN1'
    ORDER BY ORDINAL_POSITION
  `));

  return rows.reduce((acc, row) => {
    const columnName = String(row.COLUMN_NAME || '').trim();
    if (!columnName) return acc;
    acc[columnName.toUpperCase()] = {
      name: columnName,
      dataType: String(row.DATA_TYPE || '').trim().toLowerCase(),
      maxLength: row.CHARACTER_MAXIMUM_LENGTH,
      precision: row.NUMERIC_PRECISION,
      scale: row.NUMERIC_SCALE,
      nullable: String(row.IS_NULLABLE || '').toUpperCase() === 'YES',
      ordinal: Number(row.ORDINAL_POSITION || 0),
    };
    return acc;
  }, {});
};

const findColumnPreference = (column, preferences = {}) => {
  const candidates = [
    ...(column.sapColumnIds || []),
    column.sapField,
    ...(column.alternativeFields || []),
    column.key,
  ].map(normalizePreferenceKey).filter(Boolean);

  for (const candidate of candidates) {
    if (preferences[candidate]) return preferences[candidate];
  }
  return null;
};

const getColumnMetadata = (column, lineColumns = {}) => {
  const candidates = [column.sapField, ...(column.alternativeFields || [])].filter(Boolean);
  for (const candidate of candidates) {
    const metadata = lineColumns[String(candidate).toUpperCase()];
    if (metadata) return metadata;
  }
  return null;
};

const getARCreditMemoLineFieldMetadata = async () => {
  const [lineColumns, preferencesResult] = await Promise.all([
    getARCreditMemoLineTableColumns(),
    getARCreditMemoColumnPreferences(),
  ]);
  const hasPreferences = preferencesResult.rows.length > 0;

  const matrixColumns = AR_CREDIT_MEMO_MATRIX_COLUMN_DEFS
    .map((column, index) => {
      const metadata = getColumnMetadata(column, lineColumns);
      const exists = Boolean(metadata || column.calculated || column.source);
      if (!exists) return null;

      const preference = findColumnPreference(column, preferencesResult.byKey);
      if (hasPreferences && !preference) return null;
      const visible = preference ? sapFlagToBoolean(preference.VisInForm, true) : true;
      const active = preference ? sapFlagToBoolean(preference.EditInForm, true) : true;
      const width = Number(preference?.Width);

      return {
        key: column.key,
        label: column.label,
        sapField: column.sapField || '',
        source: column.source || (column.calculated ? 'calculated' : 'RIN1'),
        dataType: metadata?.dataType || '',
        maxLength: metadata?.maxLength || undefined,
        precision: metadata?.precision || undefined,
        scale: metadata?.scale || undefined,
        required: metadata ? !metadata.nullable : false,
        readOnly: Boolean(column.calculated),
        visible,
        active,
        minWidth: Number.isFinite(width) && width > 0 ? Math.max(width, column.minWidth || 125) : (column.minWidth || 125),
        order: Number.isFinite(Number(preference?.VisualIndx)) ? Number(preference.VisualIndx) : index + 1,
        sapColumnId: preference?.ColID || '',
      };
    })
    .filter(Boolean)
    .sort((left, right) => (left.order || 0) - (right.order || 0));

  return {
    matrix_columns: matrixColumns,
    sap_form: {
      formId: AR_CREDIT_MEMO_FORM_ID,
      matrixItemId: AR_CREDIT_MEMO_MATRIX_ITEM_ID,
      userSign: preferencesResult.userSign,
      preferenceRows: preferencesResult.rows.length,
    },
    _preferencesByKey: preferencesResult.byKey,
  };
};

const applyLineColumnPreferencesToUdfs = (udfMetadata = {}, preferences = {}) => {
  const hasPreferences = Object.keys(preferences || {}).length > 0;
  const rows = (udfMetadata.rows || []).map((field) => {
    const normalizedFieldKeys = [
      field.key,
      field.sapField,
      field.aliasId,
      field.label,
    ].map(normalizePreferenceKey).filter(Boolean);
    if (normalizedFieldKeys.some((key) => AR_CREDIT_MEMO_SUPPRESSED_ROW_UDFS.has(key))) {
      return null;
    }

    const preference = findColumnPreference({
      key: field.key,
      sapField: field.sapField,
      sapColumnIds: [field.key, field.aliasId, field.label],
    }, preferences);

    if (!preference) return hasPreferences ? null : field;

    return {
      ...field,
      visible: sapFlagToBoolean(preference.VisInForm, true),
      active: sapFlagToBoolean(preference.EditInForm, true),
      minWidth: Number(preference.Width) > 0 ? Number(preference.Width) : field.minWidth,
      order: Number(preference.VisualIndx) || field.order,
      sapColumnId: preference.ColID || field.sapColumnId,
    };
  }).filter(Boolean).sort((left, right) => (left.order || 99999) - (right.order || 99999));

  return { ...udfMetadata, rows };
};

const getReferenceData = async () => {
  const [
    customers,
    items,
    warehouses,
    paymentTerms,
    shippingTypes,
    salesEmployees,
    branches,
    states,
    taxCodes,
    uomGroupsRaw,
    decimalRows,
    companyRows,
    accounts,
    distributionRules,
    udfMetadata,
    lineFieldMetadata,
  ] = await Promise.all([
    getCustomers(),
    getItems(),
    getWarehouses(),
    getPaymentTerms(),
    getShippingTypes(),
    getSalesEmployees(),
    getBranches(),
    getStates(),
    getTaxCodes(),
    getUomGroups(),
    getDecimalSettings(),
    getCompanyInfo(),
    masterDataDbService.searchAccounts('', '', 5000, 0),
    masterDataDbService.lookupDistributionRules(),
    getMarketingDocumentUdfs({ headerTable: 'ORIN', lineTable: 'RIN1' }),
    getARCreditMemoLineFieldMetadata(),
  ]);
  const effectiveUdfMetadata = applyLineColumnPreferencesToUdfs(
    udfMetadata,
    lineFieldMetadata._preferencesByKey || {},
  );

  const uomGroupMap = {};
  uomGroupsRaw.forEach(row => {
    if (!uomGroupMap[row.AbsEntry]) {
      uomGroupMap[row.AbsEntry] = {
        AbsEntry: row.AbsEntry,
        Name: row.Name,
        uomCodes: [],
        conversions: {}
      };
    }
    if (row.UomCode) {
      uomGroupMap[row.AbsEntry].uomCodes.push(row.UomCode);
      const baseQty = parseFloat(row.BaseQty || 1);
      const altQty = parseFloat(row.AltQty || 1);
      const factor = baseQty > 0 ? altQty / baseQty : 1;
      uomGroupMap[row.AbsEntry].conversions[row.UomCode] = {
        baseQty,
        altQty,
        factor
      };
    }
  });
  const uom_groups = Object.values(uomGroupMap);

  const decimalSettings = decimalRows.length > 0 ? {
    QtyDec: decimalRows[0].QtyDec || 2,
    PriceDec: decimalRows[0].PriceDec || 2,
    SumDec: decimalRows[0].SumDec || 2,
    RateDec: decimalRows[0].RateDec || 2,
    PercentDec: decimalRows[0].PercentDec || 2,
  } : {
    QtyDec: 2,
    PriceDec: 2,
    SumDec: 2,
    RateDec: 2,
    PercentDec: 2,
  };

  const companyInfo = companyRows.length > 0 ? {
    name: companyRows[0].CompnyName || 'SAP B1',
    address: companyRows[0].Address || '',
    state: companyRows[0].State || '',
  } : {
    name: 'SAP B1',
    address: '',
    state: '',
  };

  return {
    company: companyInfo.name,
    company_state: companyInfo.state,
    vendors: customers,
    customers,
    contacts: [],
    pay_to_addresses: [],
    items,
    warehouses,
    warehouse_addresses: warehouses,
    company_address: { State: companyInfo.state },
    tax_codes: taxCodes,
    payment_terms: paymentTerms,
    shipping_types: shippingTypes,
    sales_employees: salesEmployees.map(e => ({
      SlpCode: e.SlpCode,
      SlpName: e.SlpName,
      Memo: e.Memo || '',
      Commission: e.Commission,
      Active: e.Active,
    })),
    branches,
    states,
    gl_accounts: accounts
      .filter((account) => account.ActiveAccount !== 'tNO' && account.IsTitleAccount !== 'tYES')
      .map((account) => ({
        code: account.Code,
        name: account.Name,
        accountType: account.AccountType,
        balance: account.Balance ?? 0,
        inactive: account.ActiveAccount === 'tNO' ? 'Yes' : 'No',
      })),
    distribution_rules: distributionRules.map((rule) => ({
      FactorCode: rule.FactorCode || rule.OcrCode || '',
      FactorDescription: rule.FactorDescription || rule.OcrName || '',
    })),
    uom_groups,
    decimal_settings: decimalSettings,
    matrix_columns: lineFieldMetadata.matrix_columns || [],
    line_field_metadata: {
      matrix_columns: lineFieldMetadata.matrix_columns || [],
      sap_form: lineFieldMetadata.sap_form || {},
    },
    udf_metadata: effectiveUdfMetadata,
    warnings: [],
  };
};

const getCustomerDetails = async (customerCode) => {
  if (!customerCode) {
    return {
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
    };
  }

  const [contacts, addresses] = await Promise.all([
    getContactsByCustomer(customerCode),
    getAddressesByCustomer(customerCode),
  ]);

  const payToAddresses = addresses.filter(a => 
    a.AdresType === 'B' || a.AdresType === 'bo_BillTo'
  );
  const shipToAddresses = addresses.filter(a =>
    a.AdresType === 'S' || a.AdresType === 'bo_ShipTo'
  );

  return {
    contacts,
    pay_to_addresses: payToAddresses,
    ship_to_addresses: shipToAddresses,
  };
};

// ── COPY FROM FUNCTIONS ───────────────────────────────────────────────────────

// ── COPY FROM FUNCTIONS ───────────────────────────────────────────────────────

const getOpenDeliveries = () => safe(db.query(`
  SELECT TOP 200
    T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate,
    T0.CardCode, T0.CardName, T0.Comments, T0.DocTotal
  FROM ODLN T0
  WHERE T0.DocStatus = 'O' AND T0.CANCELED <> 'Y'
  ORDER BY T0.DocDate DESC, T0.DocNum DESC
`));

const getDeliveryForCopy = async (docEntry) => deliveryDb.getDeliveryForCopy(docEntry);

// A/R invoice copy helpers used by the A/R Credit Memo Copy From flow.
const getOpenARInvoices = (customerCode = null) => {
  const params = customerCode ? { customerCode } : {};
  const query = `
    SELECT TOP 200
    T0.DocEntry,
    T0.DocNum,
    T0.DocDate,
    T0.DocDueDate,
    T0.CardCode,
    T0.CardName,
    T0.Comments,
    T0.DocTotal
FROM OINV T0
WHERE 
    T0.DocStatus = 'O'        -- Open invoices
    AND T0.CANCELED = 'N'     -- Not canceled
    ${customerCode ? "AND T0.CardCode = @customerCode" : ""}
ORDER BY 
    T0.DocDate DESC,
    T0.DocNum DESC;
  `;
  return safe(db.query(query, params));
};

const getARInvoiceForCopy = async (docEntry) => arInvoiceDb.getARInvoiceForCopy(docEntry);

const getARCreditMemoForCopy = async (docEntry) => {
  const result = await getARCreditMemo(docEntry);
  const creditMemo = result?.ar_credit_memo || {};
  const header = creditMemo.header || {};

  return {
    DocEntry: creditMemo.doc_entry || docEntry,
    DocNum: creditMemo.doc_num || header.docNo || '',
    DocDate: header.postingDate || '',
    DocDueDate: header.deliveryDate || '',
    TaxDate: header.documentDate || '',
    CardCode: header.customerCode || header.customer || '',
    CardName: header.customerName || header.name || '',
    CntctCode: header.contactPerson || '',
    NumAtCard: header.salesContractNo || '',
    Comments: header.otherInstruction || '',
    BPLId: header.branch || '',
    BPL_IDAssignedToInvoice: header.branch || '',
    GroupNum: header.paymentTermsCode || header.paymentTerms || '',
    DiscPrcnt: header.discount || 0,
    Freight: header.freight || 0,
    DocumentLines: (creditMemo.lines || []).map((line, index) => ({
      LineNum: line.lineNum ?? line.LineNum ?? index,
      ItemCode: line.itemNo || '',
      ItemDescription: line.itemDescription || '',
      Quantity: line.quantity || 0,
      OpenQty: line.quantity || 0,
      UnitPrice: line.unitPrice || 0,
      DiscountPercent: line.stdDiscount || line.discountPercent || 0,
      WarehouseCode: line.whse || line.warehouse || '',
      TaxCode: line.taxCode || '',
      UomCode: line.uomCode || '',
      UomName: line.uomName || line.uomCode || '',
      HSNCode: line.hsnCode || '',
      BaseEntry: creditMemo.doc_entry || docEntry,
      BaseLine: line.lineNum ?? line.LineNum ?? index,
      BaseType: 14,
    })),
  };
};

const getOpenSalesOrders = () => safe(db.query(`
  
`));

const getSalesOrderForCopy = async (docEntry) => salesOrderDb.getSalesOrderForCopy(docEntry);

const getOpenReturns = (customerCode = null) => {
  const query = `
    // SELECT TOP 200
    //   T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate,
    //   T0.CardCode, T0.CardName, T0.Comments, T0.DocTotal
    // FROM ORIN T0
    // WHERE T0.DocStatus = 'O' AND T0.CANCELED <> 'Y'
    //   ${customerCode ? "AND T0.CardCode = @customerCode" : ""}
    // ORDER BY T0.DocDate DESC, T0.DocNum DESC
  `;
  return safe(db.query(query, customerCode ? { customerCode } : {}));
};

const getReturnForCopy = (docEntry) => safe(db.query(`
  SELECT 
    T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate, T0.TaxDate,
    T0.CardCode, T0.CardName, T0.CntctCode AS ContactPerson,
    T0.NumAtCard AS CustomerRefNo, T0.DocCur AS Currency,
    T0.DocRate AS ExchangeRate, T0.Comments,
    T0.SalesPersonCode, T0.GroupNum AS PaymentTerms,
    T0.DiscPrcnt AS DiscountPercent, T0.DiscSum AS DiscountTotal,
    T0.VatSum AS TaxTotal, T0.DocTotal,
    T0.BPLId AS Branch, T0.IndicatorCode AS PlaceOfSupply,
    T1.LineNum, T1.ItemCode, T1.Dscription AS ItemDescription,
    T1.Quantity, T1.Price AS UnitPrice, T1.Currency AS LineCurrency,
    T1.Rate AS LineRate, T1.DiscPrcnt AS LineDiscountPercent,
    T1.LineTotal, T1.TaxCode, T1.VatPrcnt AS TaxRate,
    T1.VatSum AS LineTaxAmount, T1.GTotal AS LineGrossTotal,
    T1.WhsCode AS WarehouseCode, T1.UomCode,
    T1.U_HSNCode AS HSNCode
  FROM ORIN T0
  LEFT JOIN RIN1 T1 ON T0.DocEntry = T1.DocEntry
  WHERE T0.DocEntry = @docEntry
  ORDER BY T1.LineNum
`, { docEntry }));

const getOpenReturnRequests = (customerCode = null) => {
  const query = `
    SELECT TOP 200
      T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate,
      T0.CardCode, T0.CardName, T0.Comments, T0.DocTotal
    FROM ORDN T0
    WHERE T0.DocStatus = 'O' AND T0.CANCELED <> 'Y'
      ${customerCode ? "AND T0.CardCode = @customerCode" : ""}
    ORDER BY T0.DocDate DESC, T0.DocNum DESC
  `;
  return safe(db.query(query, customerCode ? { customerCode } : {}));
};

const getReturnRequestForCopy = (docEntry) => safe(db.query(`
  SELECT 
    T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate, T0.TaxDate,
    T0.CardCode, T0.CardName, T0.CntctCode AS ContactPerson,
    T0.NumAtCard AS CustomerRefNo, T0.DocCur AS Currency,
    T0.DocRate AS ExchangeRate, T0.Comments,
    T0.SalesPersonCode, T0.GroupNum AS PaymentTerms,
    T0.DiscPrcnt AS DiscountPercent, T0.DiscSum AS DiscountTotal,
    T0.VatSum AS TaxTotal, T0.DocTotal,
    T0.BPLId AS Branch, T0.IndicatorCode AS PlaceOfSupply,
    T1.LineNum, T1.ItemCode, T1.Dscription AS ItemDescription,
    T1.Quantity, T1.Price AS UnitPrice, T1.Currency AS LineCurrency,
    T1.Rate AS LineRate, T1.DiscPrcnt AS LineDiscountPercent,
    T1.LineTotal, T1.TaxCode, T1.VatPrcnt AS TaxRate,
    T1.VatSum AS LineTaxAmount, T1.GTotal AS LineGrossTotal,
    T1.WhsCode AS WarehouseCode, T1.UomCode,
    T1.U_HSNCode AS HSNCode
  FROM ORDN T0
  LEFT JOIN RDN1 T1 ON T0.DocEntry = T1.DocEntry
  WHERE T0.DocEntry = @docEntry
  ORDER BY T1.LineNum
`, { docEntry }));

const getOpenDownPayments = (customerCode = null) => {
  const query = `
    SELECT TOP 200
      T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate,
      T0.CardCode, T0.CardName, T0.Comments, T0.DocTotal
    FROM ODPI T0
    WHERE T0.DocStatus = 'O' AND T0.CANCELED <> 'Y'
      ${customerCode ? "AND T0.CardCode = @customerCode" : ""}
    ORDER BY T0.DocDate DESC, T0.DocNum DESC
  `;
  return safe(db.query(query, customerCode ? { customerCode } : {}));
};

const getDownPaymentForCopy = (docEntry) => safe(db.query(`
  SELECT 
    T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate, T0.TaxDate,
    T0.CardCode, T0.CardName, T0.CntctCode AS ContactPerson,
    T0.NumAtCard AS CustomerRefNo, T0.DocCur AS Currency,
    T0.DocRate AS ExchangeRate, T0.Comments,
    T0.SalesPersonCode, T0.GroupNum AS PaymentTerms,
    T0.DiscPrcnt AS DiscountPercent, T0.DiscSum AS DiscountTotal,
    T0.VatSum AS TaxTotal, T0.DocTotal,
    T0.BPLId AS Branch, T0.IndicatorCode AS PlaceOfSupply,
    T1.LineNum, T1.ItemCode, T1.Dscription AS ItemDescription,
    T1.Quantity, T1.Price AS UnitPrice, T1.Currency AS LineCurrency,
    T1.Rate AS LineRate, T1.DiscPrcnt AS LineDiscountPercent,
    T1.LineTotal, T1.TaxCode, T1.VatPrcnt AS TaxRate,
    T1.VatSum AS LineTaxAmount, T1.GTotal AS LineGrossTotal,
    T1.WhsCode AS WarehouseCode, T1.UomCode,
    T1.U_HSNCode AS HSNCode
  FROM ODPI T0
  LEFT JOIN DPI1 T1 ON T0.DocEntry = T1.DocEntry
  WHERE T0.DocEntry = @docEntry
  ORDER BY T1.LineNum
`, { docEntry }));

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getARCreditMemoList,
  getARCreditMemo,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getWarehouseState,
  getFreightCharges,
  getItemsForModal,
  getBatchesByItem,
  getUomConversionFactor,
  // getOpenDeliveries,
  // getDeliveryForCopy,
  getOpenARInvoices,
  getARInvoiceForCopy,
  getARCreditMemoForCopy,
  // getOpenSalesOrders,
  // getSalesOrderForCopy,
  // getOpenReturns,
  // getReturnForCopy,
  // getOpenReturnRequests,
  // getReturnRequestForCopy,
  // getOpenDownPayments,
  // getDownPaymentForCopy,
};
