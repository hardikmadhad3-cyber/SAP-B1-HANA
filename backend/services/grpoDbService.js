/**
 * Goods Receipt PO DB Service - ODBC/Direct SQL for GET operations
 * Reads data directly from SAP B1 SQL Server database
 */
const db = require('./dbService');
const masterDataDbService = require('./masterDataDbService');
const { getHeaderUdfValues, getLineUdfValues, getMarketingDocumentUdfs } = require('./udfMetadataService');
const { buildMarketingDocumentListFilterQuery } = require('./documentListUtils');

const safe = async (promise) => {
  try {
    const r = await promise;
    return r.recordset || [];
  } catch (e) {
    return [];
  }
};

// ── REFERENCE DATA QUERIES ────────────────────────────────────────────────────

const getVendors = () => safe(db.query(`
  SELECT CardCode, CardName, CardType, Currency,
         VatGroup, GroupNum AS PayTermsGrpCode
  FROM   OCRD
  WHERE  CardType = 'S'
    AND  frozenFor <> 'Y'
  ORDER  BY CardName
`));

const getItems = () => safe(db.query(`
  SELECT T0.ItemCode, T0.ItemName,
         T0.BuyUnitMsr  AS PurchaseUnit,
         T0.InvntryUom  AS InventoryUOM,
         T0.PUoMEntry   AS UoMGroupEntry,
         T0.DfltWH      AS DefaultWarehouse,
         CHP.ChapterID  AS HSNCode,
         T0.ManBtchNum  AS BatchManaged,
         T0.ManSerNum   AS SerialManaged
  FROM   OITM T0
  LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
  WHERE  T0.PrchseItem = 'Y'
    AND  T0.validFor  <> 'N'
  ORDER  BY T0.ItemCode
`));

const getItemsForModal = () => safe(db.query(`
  SELECT
    T0.ItemCode,
    T0.ItemName,
    T0.FrgnName        AS ForeignName,
    T1.ItmsGrpNam      AS ItemGroup,
    CAST(T0.OnHand AS DECIMAL(19,2)) AS InStock,
    T0.BuyUnitMsr      AS PurchaseUnit,
    T0.InvntryUom      AS InventoryUOM,
    T0.PUoMEntry       AS UoMGroupEntry,
    T0.DfltWH          AS DefaultWarehouse,
    CHP.ChapterID      AS HSNCode,
    T0.ManBtchNum      AS BatchManaged,
    T0.ManSerNum       AS SerialManaged
  FROM OITM T0
  LEFT JOIN OITB T1  ON T1.ItmsGrpCod = T0.ItmsGrpCod
  LEFT JOIN OCHP CHP ON CHP.AbsEntry  = T0.ChapterID
  WHERE T0.PrchseItem = 'Y'
    AND T0.validFor  <> 'N'
  ORDER BY T0.ItemCode
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

const getSalesEmployees = () => safe(db.query(`
  SELECT SlpCode, SlpName, Memo, Commission, Active
  FROM   OSLP
  ORDER  BY
    CASE WHEN SlpCode = -1 THEN 0 ELSE 1 END,
    SlpName
`));

const getShippingTypes = () => safe(db.query(`
  SELECT TrnspCode, TrnspName
  FROM   OSHP
  ORDER  BY TrnspName
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

const getTaxCodes = () => masterDataDbService.searchDocumentTaxCodes('', 'purchase', 500, 0);

const getUomGroups = () => safe(db.query(`
  SELECT g.UgpEntry AS AbsEntry,
         g.UgpCode  AS Name,
         u.UomCode
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

// ── VENDOR DETAILS ────────────────────────────────────────────────────────────

const getContactsByVendor = async (cardCode) => {
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

const getAddressesByVendor = async (cardCode) => {
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

// ── PURCHASE ORDERS (FOR COPY FROM) ───────────────────────────────────────────

const getOpenPurchaseOrders = async (vendorCode = null) => {
  const query = vendorCode
    ? `
      SELECT TOP 100
        T0.DocEntry,
        T0.DocNum,
        T0.CardCode,
        T0.CardName,
        T0.DocDate,
        T0.DocDueDate,
        T0.DocTotal
      FROM OPOR T0
      WHERE T0.DocStatus = 'O'
        AND T0.CardCode = @vendorCode
      ORDER BY T0.DocEntry DESC
    `
    : `
      SELECT TOP 100
        T0.DocEntry,
        T0.DocNum,
        T0.CardCode,
        T0.CardName,
        T0.DocDate,
        T0.DocDueDate,
        T0.DocTotal
      FROM OPOR T0
      WHERE T0.DocStatus = 'O'
      ORDER BY T0.DocEntry DESC
    `;

  const result = await safe(
    vendorCode ? db.query(query, { vendorCode }) : db.query(query)
  );

  return { orders: result };
};

const getPurchaseOrderForCopy = async (docEntry) => {
  // Get header
  const headerRows = await safe(db.query(`
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T0.CardCode,
      T0.CardName,
      T0.CntctCode AS ContactPersonCode,
      T0.NumAtCard AS VendorRefNo,
      T0.DocDate AS PostingDate,
      T0.DocDueDate AS DeliveryDate,
      T0.TaxDate AS DocumentDate,
      T0.BPLId AS Branch,
      T0.DocCur AS Currency,
      T0.GroupNum AS PaymentTerms,
      T0.SlpCode AS SalesEmployeeCode,
      T1.SlpName AS SalesEmployeeName,
      T0.Comments AS Remarks,
      T0.JrnlMemo AS JournalRemark,
      T0.DiscPrcnt AS DiscountPercent,
      T0.TotalExpns AS Freight,
      T0.VatSum AS Tax,
      T0.DocTotal AS TotalPaymentDue
    FROM OPOR T0
    WHERE T0.DocEntry = @docEntry
  `, { docEntry }));

  if (!headerRows.length) {
    throw new Error(`Purchase Order ${docEntry} not found`);
  }

  const header = headerRows[0];

  // Get lines with open quantity
  const lineRows = await safe(db.query(`
    SELECT 
      T0.LineNum,
      T0.ItemCode,
      T0.Dscription AS ItemDescription,
      T0.Quantity,
      T0.OpenQty,
      T0.Price AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent,
      T0.TaxCode,
      T0.LineTotal,
      T0.WhsCode AS Warehouse,
      T0.unitMsr AS UoMCode
    FROM POR1 T0
    WHERE T0.DocEntry = @docEntry
      AND T0.LineStatus = 'O'
      AND T0.OpenQty > 0
    ORDER BY T0.LineNum
  `, { docEntry }));

  // Get HSN codes and batch info for items
  const itemCodes = lineRows.map(l => l.ItemCode).filter(Boolean);
  let itemInfoMap = {};
  
  if (itemCodes.length > 0) {
    try {
      const itemRows = await safe(db.query(`
        SELECT T0.ItemCode,
               CHP.ChapterID AS HSNCode,
               T0.ManBtchNum AS BatchManaged
        FROM OITM T0
        LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
        WHERE T0.ItemCode IN (${itemCodes.map((_, i) => `@item${i}`).join(',')})
      `, itemCodes.reduce((acc, code, i) => ({ ...acc, [`item${i}`]: code }), {})));
      
      itemInfoMap = itemRows.reduce((acc, row) => {
        acc[row.ItemCode] = {
          hsnCode: row.HSNCode || '',
          batchManaged: row.BatchManaged === 'Y',
        };
        return acc;
      }, {});
    } catch (err) {
      // Could not fetch item info
    }
  }

  return {
    header: {
      vendor: header.CardCode,
      name: header.CardName,
      contactPerson: header.ContactPersonCode ? String(header.ContactPersonCode) : '',
      salesContractNo: header.VendorRefNo || '',
      branch: header.Branch ? String(header.Branch) : '',
      paymentTerms: header.PaymentTerms ? String(header.PaymentTerms) : '',
      otherInstruction: header.Remarks || '',
    },
    lines: lineRows.map(l => {
      const itemInfo = itemInfoMap[l.ItemCode] || { hsnCode: '', batchManaged: false };
      return ({
      baseEntry: docEntry,
      baseType: 22, // Purchase Order
      baseLine: l.LineNum,
      itemNo: l.ItemCode || '',
      itemDescription: l.ItemDescription || '',
      hsnCode: itemInfo.hsnCode,
      quantity: l.OpenQty != null ? String(l.OpenQty) : '',
      openQty: l.OpenQty != null ? String(l.OpenQty) : '',
      unitPrice: l.UnitPrice != null ? String(l.UnitPrice) : '',
      stdDiscount: l.DiscountPercent != null ? String(l.DiscountPercent) : '',
      taxCode: l.TaxCode || '',
      total: l.LineTotal != null ? String(l.LineTotal) : '',
      whse: l.Warehouse || '',
      uomCode: l.UoMCode || '',
      batchManaged: itemInfo.batchManaged,
      batches: [],
      udf: {},
    })}),
  };
};

// ── GRPO LIST ─────────────────────────────────────────────────────────────────

const getGRPOList = async ({
  query = '',
  openOnly = false,
  docNum = '',
  vendorCode = '',
  vendorName = '',
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
    partnerCode: vendorCode,
    partnerName: vendorName,
    status,
    postingDateFrom,
    postingDateTo,
  });

  const countRows = await safe(db.query(`
    SELECT COUNT(*) AS total_count
    FROM OPDN T0
    WHERE ${whereClauses.join('\n      AND ')}
  `, params));

  const totalCount = Number(countRows?.[0]?.total_count || 0);

  const result = await safe(db.query(`
    SELECT
      T0.DocEntry AS doc_entry,
      T0.DocNum AS doc_num,
      T0.CardCode AS vendor_code,
      T0.CardName AS vendor_name,
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
        FROM PDN1 T1
        WHERE T1.DocEntry = T0.DocEntry
      ) AS line_count
    FROM OPDN T0
    WHERE ${whereClauses.join('\n      AND ')}
    ORDER BY T0.DocEntry DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize }));

  return {
    grpos: result.map((row) => ({
      doc_entry: row.doc_entry,
      doc_num: row.doc_num,
      vendor_code: row.vendor_code,
      vendor_name: row.vendor_name,
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

// ── GET SINGLE GRPO ───────────────────────────────────────────────────────────

const getGRPO = async (docEntry) => {
  const headerRows = await safe(db.query(`
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T0.Series,
      T0.CardCode,
      T0.CardName,
      T0.CntctCode AS ContactPersonCode,
      T0.NumAtCard AS VendorRefNo,
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
      CASE T0.DocStatus
        WHEN 'O' THEN 'Open'
        WHEN 'C' THEN 'Closed'
        ELSE T0.DocStatus
      END AS DocumentStatus
    FROM OPDN T0
    LEFT JOIN OSLP T1 ON T1.SlpCode = T0.SlpCode
    WHERE T0.DocEntry = @docEntry
  `, { docEntry }));

  if (!headerRows.length) {
    throw new Error(`GRPO ${docEntry} not found`);
  }

  const header = headerRows[0];
  const [headerUdfs, lineUdfsByLineNum] = await Promise.all([
    getHeaderUdfValues({ tableId: 'OPDN', keyValue: docEntry }),
    getLineUdfValues({ tableId: 'PDN1', keyValue: docEntry }),
  ]);

  const lineRows = await safe(db.query(`
    SELECT 
      T0.LineNum,
      T0.ItemCode,
      T0.Dscription AS ItemDescription,
      T0.Quantity,
      T0.Price AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent,
      T0.TaxCode,
      T0.LineTotal,
      T0.WhsCode AS Warehouse,
      T0.unitMsr AS UoMCode,
      T0.BaseEntry,
      T0.BaseType,
      T0.BaseLine
    FROM PDN1 T0
    WHERE T0.DocEntry = @docEntry
    ORDER BY T0.LineNum
  `, { docEntry }));

  const itemCodes = lineRows.map(l => l.ItemCode).filter(Boolean);
  let itemInfoMap = {};
  
  if (itemCodes.length > 0) {
    try {
      const itemRows = await safe(db.query(`
        SELECT T0.ItemCode,
               CHP.ChapterID AS HSNCode,
               T0.ManBtchNum AS BatchManaged
        FROM OITM T0
        LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
        WHERE T0.ItemCode IN (${itemCodes.map((_, i) => `@item${i}`).join(',')})
      `, itemCodes.reduce((acc, code, i) => ({ ...acc, [`item${i}`]: code }), {})));
      
      itemInfoMap = itemRows.reduce((acc, row) => {
        acc[row.ItemCode] = {
          hsnCode: row.HSNCode || '',
          batchManaged: row.BatchManaged === 'Y',
        };
        return acc;
      }, {});
    } catch (err) {
      // Could not fetch item info
    }
  }

  const batchRows = await safe(db.query(`
    SELECT BaseLinNum AS BaseLineNum, BatchNum, Quantity
    FROM   IBT1
    WHERE  BaseEntry = @docEntry
      AND  BaseType = 20
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
    grpo: {
      doc_entry: header.DocEntry,
      doc_num: header.DocNum,
      header: {
        vendor: header.CardCode,
        name: header.CardName,
        contactPerson: header.ContactPersonCode ? String(header.ContactPersonCode) : '',
        salesEmployee: header.SalesEmployeeCode ? String(header.SalesEmployeeCode) : '',
        purchaser: header.SalesEmployeeName || '',
        salesContractNo: header.VendorRefNo || '',
        branch: header.Branch ? String(header.Branch) : '',
        docNo: header.DocNum ? String(header.DocNum) : '',
        status: header.DocumentStatus || 'Open',
        series: header.Series ? String(header.Series) : '',
        postingDate: header.PostingDate ? header.PostingDate.toISOString().split('T')[0] : '',
        deliveryDate: header.DeliveryDate ? header.DeliveryDate.toISOString().split('T')[0] : '',
        documentDate: header.DocumentDate ? header.DocumentDate.toISOString().split('T')[0] : '',
        journalRemark: header.JournalRemark || '',
        paymentTerms: header.PaymentTerms ? String(header.PaymentTerms) : '',
        otherInstruction: header.Remarks || '',
        discount: header.DiscountPercent != null ? String(header.DiscountPercent) : '',
        freight: header.Freight != null ? String(header.Freight) : '',
        tax: header.Tax != null ? String(header.Tax) : '',
        totalPaymentDue: header.TotalPaymentDue != null ? String(header.TotalPaymentDue) : '',
      },
      lines: lineRows.map(l => {
        const itemInfo = itemInfoMap[l.ItemCode] || { hsnCode: '', batchManaged: false };
        return ({
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
        whse: l.Warehouse || '',
        uomCode: l.UoMCode || '',
        batchManaged: itemInfo.batchManaged,
        batches: batchesByLine[l.LineNum] || [],
        udf: lineUdfsByLineNum[l.LineNum] || {},
      })}),
      header_udfs: headerUdfs,
    }
  };
};

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

// ── DOCUMENT SERIES ───────────────────────────────────────────────────────────

const getDocumentSeries = async () => {
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
WHERE T0.ObjectCode = '20'
    AND T0.Locked = 'N'
    AND CAST(CURRENT_TIMESTAMP AS DATE) BETWEEN T1.F_RefDate AND T1.T_RefDate
ORDER BY T0.SeriesName `));

  return { series: result };
};

const getNextNumber = async (series) => {
  const result = await safe(db.query(`
    SELECT NextNumber
    FROM NNM1
    WHERE Series = @series
      AND ObjectCode = '20'
  `, { series }));

  if (result.length > 0) {
    return { nextNumber: result[0].NextNumber };
  }

  return { nextNumber: null };
};

// ── STATE FROM WAREHOUSE ──────────────────────────────────────────────────────

const getStateFromWarehouse = async (whsCode) => {
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

// ── MAIN REFERENCE DATA FUNCTION ──────────────────────────────────────────────

const getReferenceData = async () => {
  const [
    vendors,
    items,
    warehouses,
    paymentTerms,
    salesEmployees,
    shippingTypes,
    branches,
    states,
    taxCodes,
    uomGroupsRaw,
    decimalRows,
    companyRows,
    udfMetadata,
  ] = await Promise.all([
    getVendors(),
    getItems(),
    getWarehouses(),
    getPaymentTerms(),
    getSalesEmployees(),
    getShippingTypes(),
    getBranches(),
    getStates(),
    getTaxCodes(),
    getUomGroups(),
    getDecimalSettings(),
    getCompanyInfo(),
    getMarketingDocumentUdfs({ headerTable: 'OPDN', lineTable: 'PDN1' }),
  ]);

  const uomGroupMap = {};
  uomGroupsRaw.forEach(row => {
    if (!uomGroupMap[row.AbsEntry]) {
      uomGroupMap[row.AbsEntry] = {
        AbsEntry: row.AbsEntry,
        Name: row.Name,
        uomCodes: []
      };
    }
    if (row.UomCode) {
      uomGroupMap[row.AbsEntry].uomCodes.push(row.UomCode);
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
    vendors,
    contacts: [],
    pay_to_addresses: [],
    ship_to_addresses: [],
    bill_to_addresses: [],
    items,
    warehouses,
    warehouse_addresses: warehouses,
    company_address: { State: companyInfo.state },
    tax_codes: taxCodes,
    payment_terms: paymentTerms,
    sales_employees: salesEmployees.map((e) => ({ SlpCode: e.SlpCode, SlpName: e.SlpName, Memo: e.Memo, Commission: e.Commission, Active: e.Active })),
    shipping_types: shippingTypes,
    branches,
    states,
    uom_groups,
    decimal_settings: decimalSettings,
    udf_metadata: udfMetadata,
    warnings: [],
  };
};

const getVendorDetails = async (vendorCode) => {
  if (!vendorCode) {
    return {
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
      bill_to_addresses: [],
      gstin: '',
      vendorState: '',
    };
  }

  const [contacts, addresses] = await Promise.all([
    getContactsByVendor(vendorCode),
    getAddressesByVendor(vendorCode),
  ]);

  const payToAddresses = addresses.filter(a => 
    a.AdresType === 'B' || a.AdresType === 'bo_BillTo'
  );
  const shipToAddresses = addresses.filter(a =>
    a.AdresType === 'S' || a.AdresType === 'bo_ShipTo'
  );
  const primaryTaxAddress = payToAddresses[0] || shipToAddresses[0] || addresses[0] || {};

  return {
    contacts,
    pay_to_addresses: payToAddresses,
    ship_to_addresses: shipToAddresses,
    bill_to_addresses: payToAddresses,
    gstin: String(primaryTaxAddress.GSTIN || '').trim(),
    vendorState: String(primaryTaxAddress.State || '').trim(),
  };
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getGRPOList,
  getGRPO,
  getDocumentSeries,
  getNextNumber,
  getStateFromWarehouse,
  getOpenPurchaseOrders,
  getPurchaseOrderForCopy,
  getBatchesByItem,
  getItemsForModal,
};
