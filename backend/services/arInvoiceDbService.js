/**
 * AR Invoice reference data — loaded directly from SAP B1 SQL Server database.
 * Column names verified against SAP B1 schema.
 */
const db = require('./dbService');
const masterDataDbService = require('./masterDataDbService');
const salesOrderDb = require('./salesOrderDbService');
const salesQuotationDb = require('./salesQuotationDbService');
const deliveryDb = require('./deliveryDbService');
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

const tableFieldMetadataPromises = new Map();

const getTableFieldMetadata = async (tableName) => {
  const normalizedTableName = String(tableName || '').trim();
  if (!normalizedTableName) return {};

  if (!tableFieldMetadataPromises.has(normalizedTableName)) {
    tableFieldMetadataPromises.set(normalizedTableName, safe(db.query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `, { tableName: normalizedTableName })).then((rows) => rows.reduce((acc, row) => {
      const columnName = String(row.COLUMN_NAME || '').trim();
      if (!columnName) return acc;
      acc[columnName] = String(row.DATA_TYPE || '').trim().toLowerCase();
      return acc;
    }, {})));
  }

  return tableFieldMetadataPromises.get(normalizedTableName);
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

// ── queries ───────────────────────────────────────────────────────────────────

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
         SWW         AS HSNCode
  FROM   OITM
  WHERE  SellItem = 'Y'
    AND  validFor  <> 'N'
  ORDER  BY ItemCode
`));

const getWarehouses = () => safe(db.query(`
  SELECT WhsCode, WhsName, Street, Block, Building,
         City, County, State, ZipCode, Country, BPLId AS BranchID
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

const getBranches = () => safe(db.query(`
  SELECT BPLId, BPLName
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
         u.UomCode
  FROM   OUGP g
  LEFT JOIN UGP1 d ON d.UgpEntry = g.UgpEntry
  LEFT JOIN OUOM u ON u.UomEntry = d.UomEntry
  WHERE  g.Locked <> 'Y'
  ORDER  BY g.UgpEntry, d.LineNum
`));

const getSalesEmployees = () => safe(db.query(`
  SELECT SlpCode, SlpName, Memo, Commission, Active
  FROM   OSLP
  ORDER  BY
    CASE WHEN SlpCode = -1 THEN 0 ELSE 1 END,
    SlpName
`));

// ── Document Series (ObjectCode = '18' for A/R Invoice) ───────────────────────────────────────────────────────────

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
WHERE T0.ObjectCode = '13'
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
    FROM   NNM1
    WHERE  ObjectCode = '13'
      AND  Series = @series
      AND  Locked = 'N'
  `, { series }));

  if (result.length === 0) {
    throw new Error('Series not found or locked');
  }

  return {
    nextNumber: result[0].NextNumber,
  };
};

// ── Customer Details ──────────────────────────────────────────────────────────

const getContactsByCustomer = async (cardCode) => {
  const result = await safe(db.query(`
    SELECT
      CntctCode,
      Name,
      FirstName,
      LastName,
      E_MailL AS E_Mail,
      Cellolar AS MobilePhone,
      Tel1 AS Phone
    FROM   OCPR
    WHERE  CardCode = @cardCode
    ORDER  BY Name
  `, { cardCode }));

  return result.map(c => ({
    CntctCode: c.CntctCode,
    Name: c.Name,
    FirstName: c.FirstName,
    LastName: c.LastName,
    E_Mail: c.E_Mail,
    MobilePhone: c.MobilePhone,
    Phone: c.Phone,
  }));
};

const getBillToAddressesByCustomer = async (cardCode) => {
  const result = await safe(db.query(`
    SELECT
      Address,
      Street,
      StreetNo,
      Block,
      Building,
      City,
      County,
      State,
      ZipCode,
      Country,
      AdresType
    FROM   CRD1
    WHERE  CardCode = @cardCode
      AND  AdresType = 'B'
    ORDER  BY Address
  `, { cardCode }));

  return result.map(a => ({
    Address: a.Address,
    Street: a.Street,
    StreetNo: a.StreetNo,
    Block: a.Block,
    Building: a.Building,
    City: a.City,
    County: a.County,
    State: a.State,
    ZipCode: a.ZipCode,
    Country: a.Country,
    AdresType: a.AdresType,
  }));
};

const getShipToAddressesByCustomer = async (cardCode) => {
  const result = await safe(db.query(`
    SELECT
      Address,
      Street,
      StreetNo,
      Block,
      Building,
      City,
      County,
      State,
      ZipCode,
      Country,
      AdresType
    FROM   CRD1
    WHERE  CardCode = @cardCode
      AND  AdresType = 'S'
    ORDER  BY Address
  `, { cardCode }));

  return result.map(a => ({
    Address: a.Address,
    Street: a.Street,
    StreetNo: a.StreetNo,
    Block: a.Block,
    Building: a.Building,
    City: a.City,
    County: a.County,
    State: a.State,
    ZipCode: a.ZipCode,
    Country: a.Country,
    AdresType: a.AdresType,
  }));
};

// ── Base Documents (Sales Orders and Deliveries) ──────────────────────────────────────────────────────────

const getOpenSalesOrders = (customerCode = null) => {
  const query = `
    SELECT TOP 200
      T0.DocEntry, T0.DocNum, T0.CardCode, T0.CardName,
      T0.DocDate, T0.DocDueDate, T0.Comments, T0.DocTotal
    FROM ORDR T0
    WHERE T0.DocStatus = 'O'
      AND T0.CANCELED <> 'Y'
      ${customerCode ? "AND T0.CardCode = @customerCode" : ""}
    ORDER BY T0.DocDate DESC, T0.DocNum DESC
  `;
  
  return safe(db.query(query, customerCode ? { customerCode } : {}));
};

const getOpenDeliveries = (customerCode = null) => {
  const query = `
    SELECT 
      T0.DocNum, T0.CardCode, T0.CardName,
      T0.DocDate, T0.DocDueDate, T0.DocTotal,
      T0.DocEntry, T0.Comments
    FROM ODLN T0
    WHERE T0.DocStatus = 'O'
      AND T0.CANCELED <> 'Y'
      ${customerCode ? "AND T0.CardCode = @customerCode" : ""}
    ORDER BY T0.DocNum DESC, T0.DocDate DESC  
  `;
  
  return safe(db.query(query, customerCode ? { customerCode } : {}));
};

// ── Main Functions ────────────────────────────────────────────────────────────

const getReferenceData = async () => {
  const [
    customers,
    items,
    warehouses,
    paymentTerms,
    shippingTypes,
    branches,
    states,
    taxCodes,
    uomGroups,
    salesEmployees,
    openSalesOrders,
    openDeliveries,
    udfMetadata,
  ] = await Promise.all([
    getCustomers(),
    getItems(),
    getWarehouses(),
    getPaymentTerms(),
    getShippingTypes(),
    getBranches(),
    getStates(),
    getTaxCodes(),
    getUomGroups(),
    getSalesEmployees(),
    getOpenSalesOrders(),
    getOpenDeliveries(),
    getMarketingDocumentUdfs({ headerTable: 'OINV', lineTable: 'INV1' }),
  ]);

  // Process UOM groups
  const uomGroupsMap = {};
  uomGroups.forEach(g => {
    if (!uomGroupsMap[g.AbsEntry]) {
      uomGroupsMap[g.AbsEntry] = { AbsEntry: g.AbsEntry, Name: g.Name, uomCodes: [] };
    }
    if (g.UomCode) {
      uomGroupsMap[g.AbsEntry].uomCodes.push(g.UomCode);
    }
  });
  const processedUomGroups = Object.values(uomGroupsMap);

  return {
    company: 'SAP B1',
    vendors: customers,  // Frontend expects 'vendors', not 'customers'
    contacts: [],        // Will be loaded per-customer on demand
    pay_to_addresses: [],  // Will be loaded per-customer on demand
    items,
    warehouses,
    warehouse_addresses: warehouses,
    company_address: {},
    payment_terms: paymentTerms,
    shipping_types: shippingTypes,
    branches,
    states,
    tax_codes: taxCodes,
    sales_employees: salesEmployees.map((e) => ({
      SlpCode: e.SlpCode,
      SlpName: e.SlpName,
      Memo: e.Memo || '',
      Commission: e.Commission,
      Active: e.Active,
    })),
    uom_groups: processedUomGroups,
    base_documents: {
      sales_orders: openSalesOrders,
      deliveries: openDeliveries,
    },
    decimal_settings: {
      QtyDec: 2,
      PriceDec: 2,
      SumDec: 2,
      RateDec: 2,
      PercentDec: 2,
    },
    udf_metadata: udfMetadata,
    warnings: [],
  };
};

const getCustomerGSTProfile = async (cardCode) => {
  const rows = await safe(db.query(`
    SELECT TOP 1
      T1.GSTRegnNo AS GSTIN,
      T1.State
    FROM OCRD T0
    JOIN CRD1 T1 ON T0.CardCode = T1.CardCode
    WHERE T0.CardCode = @cardCode
    ORDER BY CASE WHEN T1.AdresType = 'B' THEN 0 ELSE 1 END, T1.Address
  `, { cardCode }));

  return rows[0] || { GSTIN: '', State: '' };
};

const getCustomerDetails = async (customerCode) => {
  const [contacts, billToAddresses, shipToAddresses] = await Promise.all([
    getContactsByCustomer(customerCode),
    getBillToAddressesByCustomer(customerCode),
    getShipToAddressesByCustomer(customerCode),
  ]);

  // Get customer basic info
  const customers = await safe(db.query(`
    SELECT CardCode, CardName, CardType, Currency, VatGroup, GroupNum
    FROM OCRD
    WHERE CardCode = @customerCode
  `, { customerCode }));

  const customer = customers.length > 0 ? customers[0] : null;

  // Get GST profile
  const gstProfile = await getCustomerGSTProfile(customerCode);

  return {
    customer,
    contacts,
    pay_to_addresses: billToAddresses,  // Frontend expects 'pay_to_addresses' for bill-to
    ship_to_addresses: shipToAddresses,
    gstin: gstProfile.GSTIN || '',
    customerState: gstProfile.State || '',
  };
};

const getARInvoiceList = async ({
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
    FROM OINV T0
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
        FROM INV1 T1
        WHERE T1.DocEntry = T0.DocEntry
      ) AS line_count
    FROM OINV T0
    WHERE ${whereClauses.join('\n      AND ')}
    ORDER BY T0.DocEntry DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize }));

  return {
    ar_invoices: result.map((row) => ({
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

const getARInvoice = async (docEntry) => {
  const [headerFieldMetadata, lineFieldMetadata] = await Promise.all([
    getTableFieldMetadata('OINV'),
    getTableFieldMetadata('INV1'),
  ]);

  const placeOfSupplyExpression = hasTableField(headerFieldMetadata, 'U_PlaceOfSupply')
    ? "COALESCE(NULLIF(LTRIM(RTRIM(CAST(T0.U_PlaceOfSupply AS NVARCHAR(254)))), ''), C.State, ST.Name, '')"
    : "COALESCE(C.State, ST.Name, '')";
  const headerBranchExpression = hasTableField(headerFieldMetadata, 'BPL_IDAssignedToInvoice')
    ? 'COALESCE(T0.BPL_IDAssignedToInvoice, T0.BPLId)'
    : 'T0.BPLId';
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
      ${headerBranchExpression} AS Branch,
      T0.DocCur AS Currency,
      T0.GroupNum AS PaymentTerms,
      T0.Comments AS Remarks,
      T0.JrnlMemo AS JournalRemark,
      T0.DiscPrcnt AS DiscountPercent,
      T0.TotalExpns AS Freight,
      T0.VatSum AS Tax,
      T0.DocTotal AS TotalPaymentDue,
      ${placeOfSupplyExpression} AS PlaceOfSupply,
      ${optionalColumn(headerFieldMetadata, 'T0', 'ShipToCode', 'ShipToCode', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'PayToCode', 'PayToCode', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'Address', 'ShipToAddress', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'Address2', 'BillToAddress', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'TrnspCode', 'ShippingType', 'NULL')},
      ${optionalColumn(headerFieldMetadata, 'T0', 'Confirmed', 'Confirmed', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'PeyMethod', 'PaymentMethod', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'OwnerCode', 'OwnerCode', 'NULL')},
      ${optionalColumn(headerFieldMetadata, 'T0', 'RoundDif', 'RoundingAmount', '0')},
      ${optionalColumn(headerFieldMetadata, 'T0', 'LangCode', 'Language', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'TrackNo', 'TrackingNo', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'StampNum', 'StampNo', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'PickRmrk', 'PickPackRemarks', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'BPChCode', 'BpChannelName', "''")},
      ${optionalColumn(headerFieldMetadata, 'T0', 'BPChCntc', 'BpChannelContact', "''")},
      T0.SlpCode AS SalesEmployeeCode,
      SLP.SlpName AS SalesEmployeeName,
      CASE WHEN EMP.empID IS NOT NULL
        THEN LTRIM(RTRIM(COALESCE(EMP.firstName, '') + ' ' + COALESCE(EMP.lastName, '')))
        ELSE ''
      END AS OwnerName,
      CASE T0.DocStatus
        WHEN 'O' THEN 'Open'
        WHEN 'C' THEN 'Closed'
        ELSE T0.DocStatus
      END AS DocumentStatus
    FROM OINV T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    LEFT JOIN NNM1 NNM ON NNM.ObjectCode = '13' AND NNM.Series = T0.Series
    LEFT JOIN OHEM EMP ON EMP.empID = ${hasTableField(headerFieldMetadata, 'OwnerCode') ? 'T0.OwnerCode' : 'NULL'}
    OUTER APPLY (
      SELECT TOP 1 C.State, C.Country
      FROM CRD1 C
      WHERE C.CardCode = T0.CardCode
        AND C.Address = ${hasTableField(headerFieldMetadata, 'ShipToCode') ? 'T0.ShipToCode' : "''"}
        AND C.AdresType = 'S'
    ) C
    LEFT JOIN OCST ST ON ST.Code = C.State AND ST.Country = C.Country
    WHERE T0.DocEntry = @docEntry
  `, { docEntry }));

  if (!headerRows.length) {
    throw new Error('AR Invoice not found');
  }

  const header = headerRows[0];

  const lineRows = await safe(db.query(`
    SELECT
      T0.LineNum,
      T0.ItemCode,
      T0.Dscription AS ItemDescription,
      T0.Quantity,
      T0.OpenQty AS OpenQuantity,
      T0.Price AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent,
      ${lineTaxExpression} AS TaxCode,
      T0.LineTotal,
      T0.WhsCode AS Warehouse,
      ${lineUomExpression} AS UoMCode,
      ${optionalColumn(lineFieldMetadata, 'T0', 'OcrCode', 'Loc', "''")},
      ${optionalColumn(lineFieldMetadata, 'T0', 'OcrCode2', 'BranchCode', "''")},
      T0.BaseEntry,
      T0.BaseType,
      T0.BaseLine,
      COALESCE(CHP.ChapterID, ITM.SWW, '') AS HSNCode
    FROM INV1 T0
    LEFT JOIN OITM ITM ON ITM.ItemCode = T0.ItemCode
    LEFT JOIN OCHP CHP ON CHP.AbsEntry = ITM.ChapterID
    WHERE T0.DocEntry = @docEntry
    ORDER BY T0.LineNum
  `, { docEntry }));
  const [headerUdfs, lineUdfsByLineNum] = await Promise.all([
    getHeaderUdfValues({ tableId: 'OINV', keyValue: docEntry }),
    getLineUdfValues({ tableId: 'INV1', keyValue: docEntry }),
  ]);

  return {
    ar_invoice: {
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
        placeOfSupply: header.PlaceOfSupply || '',
        shipToCode: header.ShipToCode || '',
        payToCode: header.PayToCode || '',
        billToCode: header.PayToCode || '',
        shipTo: header.ShipToAddress || '',
        payTo: header.BillToAddress || '',
        shipToAddress: header.ShipToAddress || '',
        billToAddress: header.BillToAddress || '',
        shippingType: header.ShippingType != null ? String(header.ShippingType) : '',
        confirmed: String(header.Confirmed || '').toUpperCase() === 'Y',
        journalRemark: header.JournalRemark || '',
        paymentTerms: header.PaymentTerms ? String(header.PaymentTerms) : '',
        paymentTermsCode: header.PaymentTerms ? String(header.PaymentTerms) : '',
        paymentMethod: header.PaymentMethod || '',
        language: header.Language != null ? String(header.Language) : '',
        trackingNo: header.TrackingNo || '',
        stampNo: header.StampNo || '',
        pickPackRemarks: header.PickPackRemarks || '',
        bpChannelName: header.BpChannelName || '',
        bpChannelContact: header.BpChannelContact != null ? String(header.BpChannelContact) : '',
        otherInstruction: header.Remarks || '',
        discount: header.DiscountPercent != null ? String(header.DiscountPercent) : '',
        freight: header.Freight != null ? String(header.Freight) : '',
        rounding: Math.abs(Number(header.RoundingAmount || 0)) > 0,
        roundingAmount: header.RoundingAmount != null ? String(header.RoundingAmount) : '',
        tax: header.Tax != null ? String(header.Tax) : '',
        totalPaymentDue: header.TotalPaymentDue != null ? String(header.TotalPaymentDue) : '',
        salesEmployee: header.SalesEmployeeCode != null ? String(header.SalesEmployeeCode) : '',
        purchaser: header.SalesEmployeeName || '',
        ownerCode: header.OwnerCode != null ? String(header.OwnerCode) : '',
        owner: header.OwnerName || '',
        currency: header.Currency || 'INR',
      },
      lines: lineRows.map((line) => ({
        baseEntry: line.BaseEntry || null,
        baseType: line.BaseType || null,
        baseLine: line.BaseLine || null,
        itemNo: line.ItemCode || '',
        itemDescription: line.ItemDescription || '',
        hsnCode: line.HSNCode || '',
        quantity: line.Quantity != null ? String(line.Quantity) : '',
        openQty: line.OpenQuantity != null ? String(line.OpenQuantity) : (line.Quantity != null ? String(line.Quantity) : ''),
        unitPrice: line.UnitPrice != null ? String(line.UnitPrice) : '',
        stdDiscount: line.DiscountPercent != null ? String(line.DiscountPercent) : '',
        taxCode: line.TaxCode || '',
        total: line.LineTotal != null ? String(line.LineTotal) : '',
        whse: line.Warehouse || '',
        uomCode: line.UoMCode || '',
        loc: line.Loc || '',
        branch: line.BranchCode || (header.Branch ? String(header.Branch) : ''),
        udf: lineUdfsByLineNum[line.LineNum] || {},
      })),
      header_udfs: headerUdfs,
    },
  };
};

const getStateFromAddress = async (cardCode, addressCode) => {
  const result = await safe(db.query(`
    SELECT State
    FROM CRD1
    WHERE CardCode = @cardCode
      AND Address = @addressCode
  `, { cardCode, addressCode }));

  return {
    state: result.length > 0 ? result[0].State : '',
  };
};

const getWarehouseState = async (whsCode) => {
  const result = await safe(db.query(`
    SELECT State
    FROM OWHS
    WHERE WhsCode = @whsCode
  `, { whsCode }));

  return {
    state: result.length > 0 ? result[0].State : '',
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

const getFreightCharges = (docEntry) => {
  if (!docEntry) {
    // CREATE MODE (New AR Invoice)
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

  // EDIT MODE (Existing AR Invoice)
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
    LEFT JOIN INV3 T1 
      ON T0.ExpnsCode = T1.ExpnsCode 
     AND T1.DocEntry = @DocEntry

    ORDER BY T0.ExpnsName
  `, { DocEntry: docEntry }));
};

// Enhanced item list for modal with all details
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

// ── COPY FROM FUNCTIONS ───────────────────────────────────────────────────────

const getSalesOrderForCopy = async (docEntry) => salesOrderDb.getSalesOrderForCopy(docEntry);

const getDeliveryForCopy = async (docEntry) => deliveryDb.getDeliveryForCopy(docEntry);

const getOpenSalesQuotations = (customerCode = null) => {
  const normalizedCustomerCode = String(customerCode || '').trim();
  const params = {};
  const customerFilter = normalizedCustomerCode ? 'AND T0.CardCode = @customerCode' : '';
  if (normalizedCustomerCode) {
    params.customerCode = normalizedCustomerCode;
  }

  return safe(db.query(`
  SELECT TOP 200
    T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate,
    T0.CardCode, T0.CardName, T0.Comments, T0.DocTotal
  FROM OQUT T0
  WHERE T0.DocStatus = 'O' AND T0.CANCELED <> 'Y'
    ${customerFilter}
  ORDER BY T0.DocDate DESC, T0.DocNum DESC
`, params));
};

const getSalesQuotationForCopy = async (docEntry) => salesQuotationDb.getSalesQuotationForCopy(docEntry);

const getARInvoiceForCopy = async (docEntry) => {
  const h = await db.query(`
    SELECT T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate, T0.TaxDate,
      T0.CardCode, T0.CardName, T0.CntctCode, T0.NumAtCard, T0.Comments,
      T0.BPLId, T0.BPL_IDAssignedToInvoice, T0.GroupNum, T0.SlpCode,
      T0.DiscPrcnt, T0.TotalExpns AS Freight
    FROM OINV T0 WHERE T0.DocEntry = @DocEntry
  `, { DocEntry: docEntry });
  const l = await db.query(`
    SELECT T0.LineNum, T0.ItemCode, T0.Dscription AS ItemDescription,
      T0.OpenQty AS Quantity, T0.Price AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent, T0.WhsCode AS WarehouseCode,
      T0.TaxCode, T0.unitMsr AS UomCode, CHP.ChapterID AS HSNCode,
      T0.DocEntry AS BaseEntry, T0.LineNum AS BaseLine, 13 AS BaseType
    FROM INV1 T0
    LEFT JOIN OITM ITM ON T0.ItemCode = ITM.ItemCode
    LEFT JOIN OCHP CHP ON ITM.ChapterID = CHP.AbsEntry
    WHERE T0.DocEntry = @DocEntry AND T0.LineStatus = 'O' AND T0.OpenQty > 0
    ORDER BY T0.LineNum
  `, { DocEntry: docEntry });
  return { ...(h.recordset?.[0] || {}), DocumentLines: l.recordset || [] };
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getARInvoiceList,
  getARInvoice,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getWarehouseState,
  getBatchesByItem,
  getFreightCharges,
  getItemsForModal,
  getOpenSalesOrders,
  getSalesOrderForCopy,
  getOpenDeliveries,
  getDeliveryForCopy,
  getARInvoiceForCopy,
  getOpenSalesQuotations,
  getSalesQuotationForCopy,
};
