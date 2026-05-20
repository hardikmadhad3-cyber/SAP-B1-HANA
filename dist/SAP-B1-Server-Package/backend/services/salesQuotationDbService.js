/**
 * Sales Quotation reference data — loaded directly from SAP B1 SQL Server database.
 * Mirrors salesOrderDbService.js but targets OQUT/QUT1 tables (ObjectCode = '23').
 */
const db = require('./dbService');
const masterDataDbService = require('./masterDataDbService');
const { getHeaderUdfValues, getLineUdfValues, getMarketingDocumentUdfs } = require('./udfMetadataService');
const {
  escapeLike,
  normalizeTopLimit,
  buildMarketingDocumentListFilterQuery,
} = require('./documentListUtils');

const safe = async (promise) => {
  try {
    const r = await promise;
    return r.recordset || [];
  } catch (e) {
    return [];
  }
};

// ── queries ───────────────────────────────────────────────────────────────────

const getCustomers = () => safe(db.query(`
  SELECT *
  FROM   OCRD
  WHERE  CardType = 'C'
  ORDER  BY CardName, CardCode
`));

const searchCustomers = async ({ query = '', cardCode = '', cardName = '', top, sortBy = 'code' } = {}) => {
  const normalizedQuery = String(query || '').trim();
  const normalizedCardCode = String(cardCode || '').trim();
  const normalizedCardName = String(cardName || '').trim();
  const normalizedTop = normalizeTopLimit(top);
  const orderBy = String(sortBy || '').trim().toLowerCase() === 'name'
    ? 'CardName, CardCode'
    : 'CardCode, CardName';
  const topClause = normalizedTop ? 'TOP (@top)' : '';

  return safe(db.query(`
    SELECT ${topClause}
      *
    FROM OCRD
    WHERE CardType = 'C'
      AND (@query = '' OR CardCode LIKE @queryLike OR CardName LIKE @queryLike)
      AND (@cardCode = '' OR CardCode LIKE @cardCodeLike)
      AND (@cardName = '' OR CardName LIKE @cardNameLike)
    ORDER BY ${orderBy}
  `, {
    ...(normalizedTop ? { top: normalizedTop } : {}),
    query: normalizedQuery,
    queryLike: `%${escapeLike(normalizedQuery)}%`,
    cardCode: normalizedCardCode,
    cardCodeLike: `%${escapeLike(normalizedCardCode)}%`,
    cardName: normalizedCardName,
    cardNameLike: `%${escapeLike(normalizedCardName)}%`,
  }));
};

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

const getFreightCharges = (docEntry) => {
  if (!docEntry) {
    return safe(db.query(`
      SELECT ExpnsCode, ExpnsName, DistrbMthd
      FROM OEXD
      ORDER BY ExpnsName
    `));
  }
  return safe(db.query(`
    SELECT 
      T0.ExpnsCode,
      T0.ExpnsName,
      T0.DistrbMthd,
      T1.LineTotal,
      T1.TaxCode,
      T1.Comments
    FROM OEXD T0
    LEFT JOIN QUT3 T1 
      ON T0.ExpnsCode = T1.ExpnsCode 
     AND T1.DocEntry = @DocEntry
    ORDER BY T0.ExpnsName
  `, { DocEntry: docEntry }));
};

const getWarehouses = () => safe(db.query(`
  SELECT WhsCode, WhsName, Street, Block, Building,
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
  WHERE  Active = 'Y'
  ORDER  BY SlpName
`));

const getOwners = () => safe(db.query(`
  SELECT empID, firstName, lastName,
         firstName + ' ' + ISNULL(lastName, '') AS FullName
  FROM   OHEM
  ORDER  BY firstName, lastName
`));

// ── Document Series (ObjectCode = '23' for Quotations) ───────────────────────

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
WHERE T0.ObjectCode = '23'
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
    WHERE  ObjectCode = '23'
      AND  Series = @series
      AND  Locked = 'N'
  `, { series }));
  if (result.length === 0) throw new Error('Series not found or locked');
  return { nextNumber: result[0].NextNumber };
};

const getContactsByCustomer = async (cardCode) => {
  return safe(db.query(`
    SELECT 
      CntctCode, Name, FirstName, LastName,
      E_MailL AS E_Mail,
      Cellolar AS MobilePhone,
      Tel1 AS Phone1,
      CardCode
    FROM OCPR
    WHERE UPPER(LTRIM(RTRIM(CardCode))) = UPPER(LTRIM(RTRIM(@cardCode)))
    ORDER BY Name
  `, { cardCode }));
};

const getAddressesByCustomer = (cardCode) => safe(db.query(`
  SELECT CardCode, AdresType, Address,
         Street, StreetNo, Block, Building,
         Address2, Address3,
         City, County, State, ZipCode, Country
  FROM   CRD1
  WHERE  CardCode = @cardCode
  ORDER  BY AdresType, Address
`, { cardCode }));

const getStateFromAddress = async (cardCode, addressCode) => {
  if (!cardCode || !addressCode) return { state: '' };
  const result = await safe(db.query(`
    SELECT State
    FROM   CRD1
    WHERE  CardCode = @cardCode
      AND  Address = @addressCode
  `, { cardCode, addressCode }));
  return { state: result.length > 0 ? result[0].State || '' : '' };
};

// ── aggregators ───────────────────────────────────────────────────────────────

const getReferenceData = async () => {
  const [
    customers, items, warehouses, paymentTerms,
    shippingTypes, branches, states, taxCodes, uomRaw, salesEmployees, owners, udfMetadata,
  ] = await Promise.all([
    getCustomers(), getItems(), getWarehouses(), getPaymentTerms(),
    getShippingTypes(), getBranches(), getStates(), getTaxCodes(), getUomGroups(),
    getSalesEmployees(), getOwners(), getMarketingDocumentUdfs({ headerTable: 'OQUT', lineTable: 'QUT1' }),
  ]);

  const uomMap = {};
  for (const row of uomRaw) {
    if (!uomMap[row.AbsEntry]) {
      uomMap[row.AbsEntry] = { AbsEntry: row.AbsEntry, Name: row.Name, uomCodes: [] };
    }
    if (row.UomCode && row.UomCode !== 'Manual' && !uomMap[row.AbsEntry].uomCodes.includes(row.UomCode)) {
      uomMap[row.AbsEntry].uomCodes.push(row.UomCode);
    }
  }
  const uom_groups = Object.values(uomMap);

  const mappedCustomers = customers.map(c => ({
    CardCode: c.CardCode, CardName: c.CardName,
    CardType: c.CardType,
    Currency: c.Currency, VatGroup: c.VatGroup,
    PayTermsGrpCode: c.GroupNum,
    Balance: c.Balance,
    CurrentAccountBalance: c.Balance,
    FrozenFor: c.frozenFor,
  }));

  const mappedWarehouses = warehouses.map(w => ({
    WhsCode: w.WhsCode, WhsName: w.WhsName,
    Street: w.Street, Block: w.Block, Building: w.Building,
    City: w.City, County: w.County, State: w.State,
    ZipCode: w.ZipCode, Country: w.Country, BranchID: w.BranchID,
  }));

  return {
    customers: mappedCustomers,
    vendors: mappedCustomers,
    items: items.map(i => ({
      ItemCode: i.ItemCode, ItemName: i.ItemName,
      SalesUnit: i.SalesUnit, InventoryUOM: i.InventoryUOM,
      UoMGroupEntry: i.UoMGroupEntry, SWW: i.HSNCode || '',
    })),
    warehouses: mappedWarehouses,
    warehouse_addresses: mappedWarehouses,
    payment_terms: paymentTerms.map(t => ({ GroupNum: t.GroupNum, PymntGroup: t.PymntGroup })),
    shipping_types: shippingTypes.map(s => ({ TrnspCode: s.TrnspCode, TrnspName: s.TrnspName })),
    branches: branches.map(b => ({ BPLId: b.BPLId, BPLName: b.BPLName })),
    states: states.map(st => ({ Code: st.Code, Name: st.Name })),
    tax_codes: taxCodes.map(t => ({ Code: t.Code, Name: t.Name, Rate: t.Rate, GSTType: t.GSTType })),
    uom_groups,
    sales_employees: salesEmployees.map(e => ({ SlpCode: e.SlpCode, SlpName: e.SlpName })),
    owners: owners.map(o => ({ empID: o.empID, firstName: o.firstName, lastName: o.lastName, FullName: o.FullName })),
    contacts: [],
    pay_to_addresses: [],
    company_address: {},
    decimal_settings: { QtyDec: 2, PriceDec: 2, SumDec: 2, RateDec: 2, PercentDec: 2 },
    udf_metadata: udfMetadata,
    warnings: [],
  };
};

const getCustomerDetails = async (cardCode) => {
  const [contacts, addresses] = await Promise.all([
    getContactsByCustomer(cardCode),
    getAddressesByCustomer(cardCode),
  ]);
  const billTo = addresses.filter(a => a.AdresType === 'B');
  return {
    contacts: contacts.map(c => ({
      CardCode: c.CardCode, CntctCode: c.CntctCode,
      Name: c.Name || `${c.FirstName || ''} ${c.LastName || ''}`.trim(),
      FirstName: c.FirstName, LastName: c.LastName,
      E_Mail: c.E_Mail, MobilePhone: c.MobilePhone, Phone1: c.Phone1,
    })),
    bill_to_addresses: billTo,
    pay_to_addresses: billTo,
  };
};

// ── quotation list ────────────────────────────────────────────────────────────

const getSalesQuotationList = async ({
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
    FROM OQUT T0
    WHERE ${whereClauses.join('\n      AND ')}
  `, params));

  const totalCount = Number(countRows?.[0]?.total_count || 0);

  const rows = await safe(db.query(`
    SELECT
      T0.DocEntry,
      T0.DocNum,
      T0.CardCode,
      T0.CardName,
      T0.U_Seller_Code,
      T0.U_Seller_Name,
      T0.DocDate,
      T0.DocDueDate,
      T0.DocStatus,
      T0.DocTotal,
      T0.DocCur,
      (
        SELECT COUNT(*)
        FROM QUT1 T1
        WHERE T1.DocEntry = T0.DocEntry
      ) AS line_count
    FROM OQUT T0
    WHERE ${whereClauses.join('\n      AND ')}
    ORDER BY T0.DocEntry DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize }));

  return {
    quotations: rows.map(o => ({
      doc_entry: o.DocEntry,
      doc_num: o.DocNum,
      customer_code: o.CardCode,
      customer_name: o.CardName,
      seller_code: o.U_Seller_Code || '',
      seller_name: o.U_Seller_Name || '',
      posting_date: o.DocDate ? o.DocDate.toISOString().split('T')[0] : '',
      delivery_date: o.DocDueDate ? o.DocDueDate.toISOString().split('T')[0] : '',
      status: o.DocStatus === 'O' ? 'Open' : o.DocStatus === 'C' ? 'Closed' : 'Unknown',
      total_amount: Number(o.DocTotal || 0),
      currency: o.DocCur || '',
      line_count: Number(o.line_count || 0),
    })),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalCount,
      totalPages: Math.max(Math.ceil(totalCount / normalizedPageSize), 1),
    },
  };
};

// ── single quotation ──────────────────────────────────────────────────────────

const getSalesQuotation = async (docEntry) => {
  const rows = await safe(db.query(`
    SELECT
      T0.DocEntry, T0.DocNum, T0.CardCode, T0.CardName,
      T0.DocDate, T0.DocDueDate, T0.TaxDate, T0.DocStatus,
      T0.NumAtCard, T0.Comments AS Remarks, T0.DocTotal, T0.DocCur,
      T0.CntctCode, T0.BPLId, T0.GroupNum,
      T0.ShipToCode, T0.PayToCode, T0.Address, T0.Address2,
      T0.TrnspCode, T0.Confirmed, T0.JrnlMemo, T0.Series, NNM.SeriesName, NNM.Indicator AS SeriesIndicator, T0.DiscPrcnt,
      T0.SlpCode,
      SLP.SlpName AS SalesEmployeeName,
      T0.OwnerCode,
      CASE WHEN EMP.empID IS NOT NULL
        THEN EMP.firstName + ' ' + ISNULL(EMP.lastName,'')
        ELSE NULL
      END AS OwnerName,
      T0.TotalExpns AS Freight,
      T0.VatSum AS TaxAmount,
      ST.Name AS PlaceOfSupply,
      T1.LineNum, T1.ItemCode, T1.Dscription,
      T1.Quantity, T1.Price,
      T1.DiscPrcnt AS LineDiscPrcnt,
      T1.VatGroup AS TaxCode,
      T1.WhsCode, T1.unitMsr AS UomCode, T1.LineTotal,
      CHP.ChapterID AS HSNCode
    FROM OQUT T0
    INNER JOIN QUT1 T1 ON T0.DocEntry = T1.DocEntry
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    LEFT JOIN NNM1 NNM ON NNM.ObjectCode = '23' AND NNM.Series = T0.Series
    LEFT JOIN OHEM EMP ON EMP.empID = T0.OwnerCode
    OUTER APPLY (
      SELECT TOP 1 C.State, C.Country
      FROM CRD1 C
      WHERE C.CardCode = T0.CardCode
        AND C.Address = T0.ShipToCode
        AND C.AdresType = 'S'
    ) C
    LEFT JOIN OCST ST ON ST.Code = C.State AND ST.Country = C.Country
    LEFT JOIN OITM ITM ON ITM.ItemCode = T1.ItemCode
    LEFT JOIN OCHP CHP ON CHP.AbsEntry = ITM.ChapterID
    WHERE T0.DocEntry = @DocEntry
    ORDER BY T1.LineNum
  `, { DocEntry: docEntry }));

  if (!rows.length) throw new Error(`Sales Quotation ${docEntry} not found`);

  const header = rows[0];
  const [headerUdfs, lineUdfs] = await Promise.all([
    getHeaderUdfValues({ tableId: 'OQUT', keyValue: docEntry }),
    getLineUdfValues({ tableId: 'QUT1', keyValue: docEntry }),
  ]);

  const batchRows = await safe(db.query(`
    SELECT BaseLineNum, BatchNum, Quantity
    FROM   IBT1
    WHERE  BaseEntry = @docEntry
      AND  BaseType = 23
    ORDER  BY BaseLineNum, BatchNum
  `, { docEntry }));

  const batchesByLine = {};
  batchRows.forEach(b => {
    if (!batchesByLine[b.BaseLineNum]) batchesByLine[b.BaseLineNum] = [];
    batchesByLine[b.BaseLineNum].push({
      batchNumber: b.BatchNum || '',
      quantity: String(b.Quantity || 0),
      expiryDate: '',
    });
  });

  return {
    sales_quotation: {
      doc_entry: header.DocEntry,
      doc_num: header.DocNum,
      header: {
        customerCode: header.CardCode,
        customerName: header.CardName,
        contactPerson: String(header.CntctCode || ''),
        branch: String(header.BPLId || ''),
        series: String(header.Series || ''),
        seriesName: header.SeriesName || '',
        seriesIndicator: header.SeriesIndicator || '',
        placeOfSupply: header.PlaceOfSupply || '',
        postingDate: header.DocDate ? header.DocDate.toISOString().split('T')[0] : '',
        deliveryDate: header.DocDueDate ? header.DocDueDate.toISOString().split('T')[0] : '',
        documentDate: header.TaxDate ? header.TaxDate.toISOString().split('T')[0] : '',
        customerRefNo: header.NumAtCard || '',
        remarks: header.Remarks || '',
        otherInstruction: header.Remarks || '',
        docNum: header.DocNum,
        status: header.DocStatus === 'O' ? 'Open' : header.DocStatus === 'C' ? 'Closed' : 'Unknown',
        paymentTerms: String(header.GroupNum || ''),
        salesEmployee: String(header.SlpCode || ''),
        purchaser: header.SalesEmployeeName || '',
        owner: header.OwnerName || '',
        freight: String(header.Freight || ''),
        shipToCode: header.ShipToCode || '',
        payToCode: header.PayToCode || '',
        shipTo: header.Address || '',
        payTo: header.Address2 || '',
        shippingType: String(header.TrnspCode || ''),
        confirmed: header.Confirmed === 'Y',
        journalRemark: header.JrnlMemo || '',
        discount: String(header.DiscPrcnt || ''),
        currency: header.DocCur || 'INR',
      },
      header_udfs: headerUdfs,
      lines: rows.map(line => ({
        itemNo: line.ItemCode,
        itemDescription: line.Dscription || '',
        hsnCode: line.HSNCode || '',
        quantity: String(line.Quantity || 0),
        unitPrice: String(line.Price || 0),
        uomCode: line.UomCode || '',
        stdDiscount: String(line.LineDiscPrcnt || ''),
        taxCode: line.TaxCode || '',
        total: String(line.LineTotal || 0),
        whse: line.WhsCode || '',
        batches: batchesByLine[line.LineNum] || [],
        udf: lineUdfs[line.LineNum] || {},
      })),
    },
  };
};

// ── Open Quotations for Copy ──────────────────────────────────────────────────

const getOpenSalesQuotations = () => safe(db.query(`
  SELECT DISTINCT
    T0.DocEntry,
    T0.DocNum,
    T0.DocDate,
    T0.DocDueDate,
    T0.CardCode,
    T0.CardName,
    T0.Comments,
    T0.DocTotal,
    T0.DocStatus,
    T0.CANCELED
FROM OQUT T0
INNER JOIN QUT1 T1 ON T0.DocEntry = T1.DocEntry
WHERE 
    T0.DocStatus = 'O'
    AND T0.CANCELED = 'N'
    AND T1.OpenQty > 0
ORDER BY 
    T0.DocDate DESC,
    T0.DocNum DESC;
`));

const getSalesQuotationForCopy = async (docEntry) => {
  // ================= HEADER =================
  const headerResult = await db.query(`
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T0.DocDate,
      T0.DocDueDate,
      T0.TaxDate,
      T0.CardCode,
      T0.CardName,
      T0.CntctCode,
      T0.NumAtCard,
      T0.Comments,
      T0.BPLId,
      T0.BPL_IDAssignedToInvoice,
      T0.GroupNum,
      T0.SlpCode,
      T0.U_PlaceOfSupply AS PlaceOfSupply,
      T0.DocTotal,
      T0.TotalExpenses AS Freight
    FROM OQUT T0
    WHERE T0.DocEntry = @DocEntry
      AND T0.DocStatus = 'O'
      AND T0.CANCELED <> 'Y'
  `, { DocEntry: docEntry });

  // ================= LINES =================
  const linesResult = await db.query(`
    SELECT 
      T0.LineNum,
      T0.ItemCode,
      T0.Dscription AS ItemDescription,

      -- 🔥 IMPORTANT: USE OPEN QTY
      T0.OpenQty AS Quantity,

      COALESCE(T0.PriceBefDi, T0.Price) AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent,
      T0.WhsCode AS WarehouseCode,
      T0.TaxCode,
      T0.UomCode,
      CASE
        WHEN ISNULL(T0.Quantity, 0) = 0 THEN ISNULL(T0.LineTotal, 0)
        ELSE ISNULL(T0.LineTotal, 0) * ISNULL(T0.OpenQty, 0) / NULLIF(T0.Quantity, 0)
      END AS LineTotal,
      CASE
        WHEN ISNULL(T0.Quantity, 0) = 0 THEN ISNULL(T0.VatSum, 0)
        ELSE ISNULL(T0.VatSum, 0) * ISNULL(T0.OpenQty, 0) / NULLIF(T0.Quantity, 0)
      END AS TaxAmount,

      -- HSN
      CHP.ChapterID AS HSNCode,

      -- 🔥 BASE DOCUMENT LINK (VERY IMPORTANT)
      T0.DocEntry AS BaseEntry,
      T0.LineNum AS BaseLine,
      23 AS BaseType   -- Sales Quotation

    FROM QUT1 T0
    LEFT JOIN OITM ITM ON T0.ItemCode = ITM.ItemCode
    LEFT JOIN OCHP CHP ON ITM.ChapterID = CHP.AbsEntry

    WHERE T0.DocEntry = @DocEntry
      AND T0.OpenQty > 0   -- 🔥 ONLY OPEN LINES

    ORDER BY T0.LineNum
  `, { DocEntry: docEntry });

  const header = headerResult.recordset?.[0] || {};
  const lines = linesResult.recordset || [];

  return {
    ...header,
    DocumentLines: lines
  };
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  searchCustomers,
  getSalesQuotationList,
  getSalesQuotation,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getItemsForModal,
  getFreightCharges,
  getOpenSalesQuotations,
  getSalesQuotationForCopy,
};
