const db = require('./dbService');
const { loadBusinessPartnerAddresses } = require('./businessPartnerAddressDbUtils');
const masterDataDbService = require('./masterDataDbService');
const { buildMarketingDocumentListFilterQuery } = require('./documentListUtils');
const { getHeaderUdfValues, getLineUdfValues, getMarketingDocumentUdfs } = require('./udfMetadataService');

const safe = async (promise) => {
  try {
    const r = await promise;
    return r.recordset || [];
  } catch (e) {
    return [];
  }
};

const getTableColumns = async (tableName) => {
  const rows = await safe(db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @tableName
  `, { tableName }));
  return new Set(rows.map((row) => String(row.COLUMN_NAME || '').trim()));
};

const optionalColumn = (columns, tableAlias, columnName, alias, fallback = 'NULL') => (
  columns.has(columnName)
    ? `${tableAlias}.${columnName} AS ${alias}`
    : `${fallback} AS ${alias}`
);

const parseSeriesDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value || '').trim();
  if (!text) return new Date();

  const ymd = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const normalizeSeriesText = (value) =>
  String(value || '').toUpperCase().replace(/FY/g, '').replace(/[-/\s]/g, '');

const getFinancialYearTokens = (docDate) => {
  const year = docDate.getFullYear();
  const fyStartYear = docDate.getMonth() + 1 >= 4 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  const fyStartShort = String(fyStartYear).slice(-2);
  const fyEndShort = String(fyEndYear).slice(-2);
  return [
    `${fyStartShort}${fyEndShort}`,
    `${fyStartYear}${fyEndShort}`,
    `${fyStartYear}${fyEndYear}`,
  ];
};

const isDateBetween = (date, fromDate, toDate) => {
  const from = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const to = toDate instanceof Date ? toDate : new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;
  return date >= from && date <= to;
};

const getMarketingDocumentSeries = async ({ objectCode, date = null, branch = '' } = {}) => {
  const docDate = parseSeriesDate(date);
  const branchId = String(branch || '').trim() === '' ? null : Number.parseInt(branch, 10);
  const normalizedBranchId = Number.isInteger(branchId) ? branchId : null;
  const fyTokens = getFinancialYearTokens(docDate);
  const nnm1Columns = await getTableColumns('NNM1');
  const hasBranchColumn = nnm1Columns.has('BPLId');
  const branchSelect = hasBranchColumn ? 'T0.BPLId,' : 'NULL AS BPLId,';
  const branchFilter = hasBranchColumn && normalizedBranchId != null
    ? 'AND (T0.BPLId IS NULL OR T0.BPLId IN (-1, 0, @branchId))'
    : '';

  const rows = await safe(db.query(`
    SELECT
      T0.Series,
      T0.SeriesName,
      T0.Indicator,
      T0.NextNumber,
      ${branchSelect}
      FY.FinancialYear,
      FY.FromDate,
      FY.ToDate,
      CASE WHEN DEF.DfltSeries = T0.Series THEN 1 ELSE 0 END AS IsDefault
    FROM NNM1 T0
    LEFT JOIN ONNM DEF ON DEF.ObjectCode = T0.ObjectCode
    LEFT JOIN (
      SELECT
        Indicator,
        MAX(Name) AS FinancialYear,
        MIN(F_RefDate) AS FromDate,
        MAX(T_RefDate) AS ToDate
      FROM OFPR
      GROUP BY Indicator
    ) FY ON FY.Indicator = T0.Indicator
    WHERE T0.ObjectCode = @objectCode
      AND COALESCE(T0.Locked, 'N') <> 'Y'
      ${branchFilter}
  `, {
    objectCode,
    branchId: normalizedBranchId,
  }));

  const ranked = rows.map((row) => {
    const rowText = normalizeSeriesText(`${row.SeriesName || ''} ${row.Indicator || ''}`);
    return {
      ...row,
      IsManual: Number(row.Series) === -1 || String(row.SeriesName || '').trim().toUpperCase() === 'MANUAL' ? 1 : 0,
      IsDateMatch: isDateBetween(docDate, row.FromDate, row.ToDate) ? 1 : 0,
      IsYearNameMatch: fyTokens.some((token) => rowText.includes(token)) ? 1 : 0,
      BranchPreference: hasBranchColumn && normalizedBranchId != null && Number(row.BPLId) === normalizedBranchId ? 0 : 1,
    };
  });

  const hasYearMatchedRows = ranked.some((row) => row.IsYearNameMatch === 1);
  const hasExactBranchRows = hasBranchColumn && normalizedBranchId != null
    ? ranked.some((row) => Number(row.BPLId) === normalizedBranchId)
    : false;
  const bySeriesNameAndIndicator = new Map();

  [...ranked]
    .sort((left, right) =>
      left.BranchPreference - right.BranchPreference ||
      Number(right.IsDefault || 0) - Number(left.IsDefault || 0) ||
      Number(left.Series || 0) - Number(right.Series || 0))
    .forEach((row) => {
      const key = `${String(row.SeriesName || '').trim().toUpperCase()}|${String(row.Indicator || '').trim().toUpperCase()}`;
      if (!bySeriesNameAndIndicator.has(key)) bySeriesNameAndIndicator.set(key, row);
    });

  const series = [...bySeriesNameAndIndicator.values()]
    .filter((row) => (
      row.IsManual === 1 ||
      (hasYearMatchedRows && row.IsYearNameMatch === 1) ||
      (!hasYearMatchedRows && row.IsDateMatch === 1)
    ))
    .filter((row) => (
      !hasBranchColumn ||
      normalizedBranchId == null ||
      !hasExactBranchRows ||
      Number(row.BPLId) === normalizedBranchId ||
      row.IsManual === 1
    ))
    .sort((left, right) =>
      left.IsManual - right.IsManual ||
      Number(right.IsDefault || 0) - Number(left.IsDefault || 0) ||
      String(left.SeriesName || '').localeCompare(String(right.SeriesName || '')));

  return { series };
};

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
         CHP.ChapterID  AS HSNCode
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

const getWithholdingTaxCodes = () => masterDataDbService.lookupWithholdingTaxCodes('');
const getGLAccounts = () => masterDataDbService.lookupGLAccounts('', 5000);

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
    PriceDec,
    QtyDec,
    RateDec,
    PercentDec,
    SumDec
  FROM OADM
`));

const getCompanyInfo = () => safe(db.query(`
  SELECT TOP 1
    CompnyName,
    CompnyAddr AS Address,
    State,
    MainCurncy
  FROM OADM
`));

const getContactsByVendor = async (cardCode) => safe(db.query(`
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

const getAddressesByVendor = async (cardCode) => {
  const { addresses } = await loadBusinessPartnerAddresses(db, cardCode, { context: 'AP Invoice' });
  return addresses;
};

const getVendorGSTProfile = async (cardCode) => {
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

const getVendorWithholdingTaxDetails = async (vendorCode) => {
  const [ocrdRows, allowedRows, allCodes] = await Promise.all([
    safe(db.query(`
      SELECT TOP 1
        T0.CardCode,
        T0.WTCode
      FROM OCRD T0
      WHERE T0.CardCode = @vendorCode
    `, { vendorCode })),
    safe(db.query(`
      SELECT DISTINCT
        T0.WTCode
      FROM CRD4 T0
      WHERE T0.CardCode = @vendorCode
        AND ISNULL(T0.WTCode, '') <> ''
      ORDER BY T0.WTCode
    `, { vendorCode })),
    getWithholdingTaxCodes(),
  ]);

  const defaultCode = String(ocrdRows[0]?.WTCode || '').trim();
  const allowedCodeSet = new Set(
    [
      ...allowedRows.map((row) => String(row.WTCode || '').trim()),
      defaultCode,
    ].filter(Boolean)
  );
  const allowedCodes = allCodes.filter((row) => allowedCodeSet.has(String(row.code || '').trim()));
  const fallbackAllowedCodes = allowedCodeSet.size
    ? Array.from(allowedCodeSet).map((code) => ({ code, name: code, rate: 0, taxCategory: '' }))
    : [];

  return {
    subject: allowedCodeSet.size > 0,
    defaultCode,
    allowedCodes: allowedCodes.length ? allowedCodes : fallbackAllowedCodes,
  };
};

const getOpenGRPO = async (vendorCode = null) => {
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
      FROM OPDN T0
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
      FROM OPDN T0
      WHERE T0.DocStatus = 'O'
      ORDER BY T0.DocEntry DESC
    `;

  const result = await safe(vendorCode ? db.query(query, { vendorCode }) : db.query(query));
  return { orders: result };
};

const getGRPOForCopy = async (docEntry) => {
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
    FROM OPDN T0
    LEFT JOIN OSLP T1 ON T1.SlpCode = T0.SlpCode
    WHERE T0.DocEntry = @docEntry
  `, { docEntry }));

  if (!headerRows.length) {
    throw new Error(`GRPO ${docEntry} not found`);
  }

  const header = headerRows[0];
  const lineUdfsByLineNum = await getLineUdfValues({ tableId: 'PDN1', keyValue: docEntry });

  const lineColumns = await getTableColumns('PDN1');
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
      ${optionalColumn(lineColumns, 'T0', 'WTLiable', 'WTLiable', "'N'")},
      T0.LineTotal,
      T0.WhsCode AS Warehouse,
      ${optionalColumn(lineColumns, 'T0', 'AcctCode', 'GLAccount', "''")},
      T0.unitMsr AS UoMCode,
      ${optionalColumn(lineColumns, 'T0', 'StockPrice', 'ItemCost', '0')},
      ${optionalColumn(lineColumns, 'T0', 'OcrCode', 'DistributionRule', "''")},
      ${optionalColumn(lineColumns, 'T0', 'CountryOrg', 'CountryOfOrigin', "''")},
      ${optionalColumn(lineColumns, 'T0', 'LocCode', 'LocationCode', "''")},
      ${optionalColumn(lineColumns, 'T0', 'AgrNo', 'BlanketAgreementNo', "''")}
    FROM PDN1 T0
    WHERE T0.DocEntry = @docEntry
      AND T0.LineStatus = 'O'
      AND T0.OpenQty > 0
    ORDER BY T0.LineNum
  `, { docEntry }));

  const itemCodes = lineRows.map((l) => l.ItemCode).filter(Boolean);
  let itemInfoMap = {};

  if (itemCodes.length > 0) {
    const params = itemCodes.reduce((acc, code, i) => ({ ...acc, [`item${i}`]: code }), {});
    const itemRows = await safe(db.query(`
      SELECT T0.ItemCode,
             CHP.ChapterID AS HSNCode,
             T0.ManBtchNum AS BatchManaged
      FROM OITM T0
      LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
      WHERE T0.ItemCode IN (${itemCodes.map((_, i) => `@item${i}`).join(',')})
    `, params));

    itemInfoMap = itemRows.reduce((acc, row) => {
      acc[row.ItemCode] = {
        hsnCode: row.HSNCode || '',
        batchManaged: row.BatchManaged === 'Y',
      };
      return acc;
    }, {});
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
    lines: lineRows.map((l) => {
      const itemInfo = itemInfoMap[l.ItemCode] || { hsnCode: '', batchManaged: false };
      return {
        baseEntry: docEntry,
        baseType: 20,
        baseLine: l.LineNum,
        itemNo: l.ItemCode || '',
        itemDescription: l.ItemDescription || '',
        hsnCode: itemInfo.hsnCode,
        quantity: l.OpenQty != null ? String(l.OpenQty) : '',
        openQty: l.OpenQty != null ? String(l.OpenQty) : '',
        unitPrice: l.UnitPrice != null ? String(l.UnitPrice) : '',
        stdDiscount: l.DiscountPercent != null ? String(l.DiscountPercent) : '',
        taxCode: l.TaxCode || '',
        wtaxLiable: String(l.WTLiable || '').toUpperCase() === 'Y' ? 'Y' : 'N',
        total: l.LineTotal != null ? String(l.LineTotal) : '',
        whse: l.Warehouse || '',
        glAccount: l.GLAccount || '',
        uomCode: l.UoMCode || '',
        itemCost: l.ItemCost != null ? String(l.ItemCost) : '',
        distRule: l.DistributionRule || '',
        countryOfOrigin: l.CountryOfOrigin || '',
        loc: l.LocationCode != null ? String(l.LocationCode) : '',
        blanketAgreementNo: l.BlanketAgreementNo ? String(l.BlanketAgreementNo) : '',
        batchManaged: itemInfo.batchManaged,
        batches: [],
        udf: lineUdfsByLineNum[l.LineNum] || {},
      };
    }),
  };
};

const getAPInvoiceList = async ({
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
  }, {
    additionalQueryClauses: [
      'T0.NumAtCard LIKE @query',
      `EXISTS (
        SELECT 1
        FROM PCH1 Q1
        WHERE Q1.DocEntry = T0.DocEntry
          AND (Q1.ItemCode LIKE @query OR Q1.Dscription LIKE @query)
      )`,
    ],
  });
  whereClauses.push("ISNULL(T0.DocType, 'I') = 'I'");

  const countRows = await safe(db.query(`
    SELECT COUNT(*) AS total_count
    FROM OPCH T0
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
        FROM PCH1 T1
        WHERE T1.DocEntry = T0.DocEntry
      ) AS line_count
    FROM OPCH T0
    WHERE ${whereClauses.join('\n      AND ')}
    ORDER BY T0.DocEntry DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize }));

  return {
    apInvoices: result.map((row) => ({
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

const getAPInvoice = async (docEntry) => {
  const headerRows = await safe(db.query(`
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T0.Series,
      T0.CardCode,
      T0.CardName,
      T0.CntctCode AS ContactPersonCode,
      T0.SlpCode AS SalesEmployeeCode,
      T1.SlpName AS SalesEmployeeName,
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
    FROM OPCH T0
    LEFT JOIN OSLP T1 ON T1.SlpCode = T0.SlpCode
    WHERE T0.DocEntry = @docEntry
  `, { docEntry }));

  if (!headerRows.length) {
    throw new Error(`A/P Invoice ${docEntry} not found`);
  }

  const header = headerRows[0];
  const [headerUdfs, lineUdfsByLineNum] = await Promise.all([
    getHeaderUdfValues({ tableId: 'OPCH', keyValue: docEntry }),
    getLineUdfValues({ tableId: 'PCH1', keyValue: docEntry }),
  ]);

  const lineColumns = await getTableColumns('PCH1');
  const lineRows = await safe(db.query(`
    SELECT 
      T0.LineNum,
      T0.ItemCode,
      T0.Dscription AS ItemDescription,
      T0.Quantity,
      T0.Price AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent,
      T0.TaxCode,
      ${optionalColumn(lineColumns, 'T0', 'WTLiable', 'WTLiable', "'N'")},
      T0.LineTotal,
      T0.WhsCode AS Warehouse,
      ${optionalColumn(lineColumns, 'T0', 'AcctCode', 'GLAccount', "''")},
      T0.unitMsr AS UoMCode,
      ${optionalColumn(lineColumns, 'T0', 'StockPrice', 'ItemCost', '0')},
      ${optionalColumn(lineColumns, 'T0', 'OcrCode', 'DistributionRule', "''")},
      ${optionalColumn(lineColumns, 'T0', 'CountryOrg', 'CountryOfOrigin', "''")},
      ${optionalColumn(lineColumns, 'T0', 'LocCode', 'LocationCode', "''")},
      ${optionalColumn(lineColumns, 'T0', 'AgrNo', 'BlanketAgreementNo', "''")},
      T0.BaseEntry,
      T0.BaseType,
      T0.BaseLine
    FROM PCH1 T0
    WHERE T0.DocEntry = @docEntry
    ORDER BY T0.LineNum
  `, { docEntry }));

  const itemCodes = lineRows.map((l) => l.ItemCode).filter(Boolean);
  let itemInfoMap = {};

  if (itemCodes.length > 0) {
    const params = itemCodes.reduce((acc, code, i) => ({ ...acc, [`item${i}`]: code }), {});
    const itemRows = await safe(db.query(`
      SELECT T0.ItemCode,
             CHP.ChapterID AS HSNCode,
             T0.ManBtchNum AS BatchManaged
      FROM OITM T0
      LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
      WHERE T0.ItemCode IN (${itemCodes.map((_, i) => `@item${i}`).join(',')})
    `, params));

    itemInfoMap = itemRows.reduce((acc, row) => {
      acc[row.ItemCode] = {
        hsnCode: row.HSNCode || '',
        batchManaged: row.BatchManaged === 'Y',
      };
      return acc;
    }, {});
  }

  return {
    apInvoice: {
      doc_entry: header.DocEntry,
      doc_num: header.DocNum,
      header: {
        vendor: header.CardCode,
        name: header.CardName,
        contactPerson: header.ContactPersonCode ? String(header.ContactPersonCode) : '',
        salesEmployee: header.SalesEmployeeCode != null ? String(header.SalesEmployeeCode) : '',
        purchaser: header.SalesEmployeeName || '',
        salesContractNo: header.VendorRefNo || '',
        branch: header.Branch ? String(header.Branch) : '',
        docNo: header.DocNum ? String(header.DocNum) : '',
        status: header.DocumentStatus || 'Open',
        series: header.Series != null ? String(header.Series) : '',
        currency: header.Currency || '',
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
      lines: lineRows.map((l) => {
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
          wtaxLiable: String(l.WTLiable || '').toUpperCase() === 'Y' ? 'Y' : 'N',
          total: l.LineTotal != null ? String(l.LineTotal) : '',
          whse: l.Warehouse || '',
          glAccount: l.GLAccount || '',
          uomCode: l.UoMCode || '',
          itemCost: l.ItemCost != null ? String(l.ItemCost) : '',
          distRule: l.DistributionRule || '',
          countryOfOrigin: l.CountryOfOrigin || '',
          loc: l.LocationCode != null ? String(l.LocationCode) : '',
          blanketAgreementNo: l.BlanketAgreementNo ? String(l.BlanketAgreementNo) : '',
          batchManaged: itemInfo.batchManaged,
          batches: [],
          udf: lineUdfsByLineNum[l.LineNum] || {},
        };
      }),
      header_udfs: headerUdfs,
    },
  };
};

const getDocumentSeries = async ({ date = null, branch = '' } = {}) => {
  return getMarketingDocumentSeries({ objectCode: '18', date, branch });
};

const getNextNumber = async (series) => {
  const result = await safe(db.query(`
    SELECT NextNumber
    FROM NNM1
    WHERE Series = @series
      AND ObjectCode = '18'
  `, { series }));

  return { nextNumber: result.length ? result[0].NextNumber : null };
};

const getStateFromWarehouse = async (whsCode) => {
  const result = await safe(db.query(`
    SELECT State
    FROM OWHS
    WHERE WhsCode = @whsCode
  `, { whsCode }));

  return { state: result.length ? (result[0].State || '') : '' };
};

const loadReferencePart = async (label, loader, fallback, warnings) => {
  try {
    return await loader();
  } catch (error) {
    warnings.push(`${label}: ${error.message || 'failed to load'}`);
    return fallback;
  }
};

const getReferenceData = async () => {
  const warnings = [];
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
    withholdingTaxCodes,
    distributionRules,
    glAccounts,
    businessPartners,
  ] = await Promise.all([
    loadReferencePart('Vendors', getVendors, [], warnings),
    loadReferencePart('Items', getItems, [], warnings),
    loadReferencePart('Warehouses', getWarehouses, [], warnings),
    loadReferencePart('Payment terms', getPaymentTerms, [], warnings),
    loadReferencePart('Sales employees', getSalesEmployees, [], warnings),
    loadReferencePart('Shipping types', getShippingTypes, [], warnings),
    loadReferencePart('Branches', getBranches, [], warnings),
    loadReferencePart('States', getStates, [], warnings),
    loadReferencePart('Tax codes', getTaxCodes, [], warnings),
    loadReferencePart('UoM groups', getUomGroups, [], warnings),
    loadReferencePart('Decimal settings', getDecimalSettings, [], warnings),
    loadReferencePart('Company info', getCompanyInfo, [], warnings),
    loadReferencePart(
      'UDF metadata',
      () => getMarketingDocumentUdfs({ headerTable: 'OPCH', lineTable: 'PCH1' }),
      { header: [], rows: [] },
      warnings
    ),
    loadReferencePart('Withholding tax codes', getWithholdingTaxCodes, [], warnings),
    loadReferencePart('Distribution rules', () => masterDataDbService.lookupDistributionRules(), [], warnings),
    loadReferencePart('GL accounts', getGLAccounts, [], warnings),
    loadReferencePart('Business partners', () => masterDataDbService.searchBP('', '', 5000, 0), [], warnings),
  ]);

  const uomGroupMap = {};
  uomGroupsRaw.forEach((row) => {
    if (!uomGroupMap[row.AbsEntry]) {
      uomGroupMap[row.AbsEntry] = { AbsEntry: row.AbsEntry, Name: row.Name, uomCodes: [] };
    }
    if (row.UomCode) {
      uomGroupMap[row.AbsEntry].uomCodes.push(row.UomCode);
    }
  });

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
    localCurrency: companyRows[0].MainCurncy || '',
  } : {
    name: 'SAP B1',
    address: '',
    state: '',
    localCurrency: '',
  };

  return {
    company: companyInfo.name,
    company_state: companyInfo.state,
    company_currency: companyInfo.localCurrency,
    default_branch: branches.length === 1 ? String(branches[0].BPLId || '') : '',
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
    withholding_tax_codes: withholdingTaxCodes,
    gl_accounts: glAccounts,
    distribution_rules: distributionRules,
    business_partners: businessPartners,
    payment_terms: paymentTerms,
    sales_employees: salesEmployees.map((e) => ({ SlpCode: e.SlpCode, SlpName: e.SlpName, Memo: e.Memo, Commission: e.Commission, Active: e.Active })),
    shipping_types: shippingTypes,
    branches,
    states,
    uom_groups: Object.values(uomGroupMap),
    decimal_settings: decimalSettings,
    udf_metadata: udfMetadata,
    warnings,
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
      withholding_tax: {
        subject: false,
        defaultCode: '',
        allowedCodes: [],
      },
    };
  }

  const [contacts, addresses, withholdingTax] = await Promise.all([
    getContactsByVendor(vendorCode),
    getAddressesByVendor(vendorCode),
    getVendorWithholdingTaxDetails(vendorCode),
  ]);
  const gstProfile = await getVendorGSTProfile(vendorCode);
  const payToAddresses = addresses.filter((a) => a.AdresType === 'B' || a.AdresType === 'bo_BillTo');
  const shipToAddresses = addresses.filter((a) => a.AdresType === 'S' || a.AdresType === 'bo_ShipTo');

  return {
    contacts,
    pay_to_addresses: payToAddresses,
    ship_to_addresses: shipToAddresses,
    bill_to_addresses: payToAddresses,
    gstin: gstProfile.GSTIN || '',
    vendorState: gstProfile.State || '',
    withholding_tax: withholdingTax,
  };
};

const getVendorValidation = async (cardCode) => {
  const rows = await safe(db.query(`
    SELECT TOP 1
      T0.CardCode,
      T0.CardType,
      T0.frozenFor AS FrozenFor,
      GST.State,
      GST.GSTIN
    FROM OCRD T0
    LEFT JOIN (
      SELECT
        T1.CardCode,
        T1.GSTRegnNo AS GSTIN,
        T1.State,
        ROW_NUMBER() OVER (
          PARTITION BY T1.CardCode
          ORDER BY CASE WHEN T1.AdresType = 'B' THEN 0 ELSE 1 END, T1.Address
        ) AS AddressRank
      FROM CRD1 T1
    ) GST
      ON GST.CardCode = T0.CardCode
     AND GST.AddressRank = 1
    WHERE T0.CardCode = @cardCode
  `, { cardCode }));

  return rows[0] || null;
};

const getFallbackNonGstTaxCode = async () => {
  const rows = await safe(db.query(`
    SELECT TOP 1
      T0.Code,
      T0.Name,
      SUM(T1.Rate) AS Rate
    FROM OVTG T0
    INNER JOIN VTG1 T1 ON T0.Code = T1.Code
    GROUP BY T0.Code, T0.Name
    HAVING
      SUM(T1.Rate) = 0
      OR UPPER(T0.Code) LIKE '%NON%GST%'
      OR UPPER(T0.Name) LIKE '%NON%GST%'
      OR UPPER(T0.Code) LIKE '%EXEMPT%'
      OR UPPER(T0.Name) LIKE '%EXEMPT%'
    ORDER BY
      CASE
        WHEN UPPER(T0.Code) LIKE '%NON%GST%' OR UPPER(T0.Name) LIKE '%NON%GST%' THEN 0
        WHEN UPPER(T0.Code) LIKE '%EXEMPT%' OR UPPER(T0.Name) LIKE '%EXEMPT%' THEN 1
        ELSE 2
      END,
      T0.Code
  `));

  return rows[0] || null;
};

const getPostingPeriodValidation = async (docDate) => {
  const rows = await safe(db.query(`
    SELECT TOP 1 AbsEntry, PeriodStat
    FROM OFPR
    WHERE @docDate BETWEEN F_RefDate AND T_RefDate
      AND ISNULL(PeriodStat, 'N') <> 'C'
  `, { docDate }));
  return rows[0] || null;
};

const getBranchEnabled = async () => {
  const rows = await safe(db.query(`
    SELECT COUNT(*) AS BranchCount
    FROM OBPL
  `));
  return Number(rows[0]?.BranchCount || 0) > 0;
};

const getItemValidation = async (itemCode) => {
  const rows = await safe(db.query(`
    SELECT TOP 1
      ItemCode,
      validFor,
      frozenFor,
      PrchseItem
    FROM OITM
    WHERE ItemCode = @itemCode
  `, { itemCode }));
  return rows[0] || null;
};

const getTaxCodeValidation = async (code) => masterDataDbService.getTaxCode(code);

const getGRPOOpenLineValidation = async (docEntry, lineNum) => {
  const rows = await safe(db.query(`
    SELECT TOP 1
      T0.DocEntry,
      T0.LineNum,
      T0.OpenQty,
      T0.LineStatus
    FROM PDN1 T0
    INNER JOIN OPDN H ON H.DocEntry = T0.DocEntry
    WHERE T0.DocEntry = @docEntry
      AND T0.LineNum = @lineNum
  `, { docEntry, lineNum }));
  return rows[0] || null;
};

const isDuplicateVendorInvoiceNumber = async (cardCode, vendorRefNo, excludeDocEntry = null) => {
  if (!cardCode || !vendorRefNo) return false;
  const params = { cardCode, vendorRefNo };
  const extra = excludeDocEntry != null ? 'AND DocEntry <> @excludeDocEntry' : '';
  if (excludeDocEntry != null) params.excludeDocEntry = excludeDocEntry;
  const rows = await safe(db.query(`
    SELECT TOP 1 DocEntry
    FROM OPCH
    WHERE CardCode = @cardCode
      AND NumAtCard = @vendorRefNo
      ${extra}
  `, params));
  return rows.length > 0;
};

const hasItemGLAccount = async (itemCode) => {
  try {
    const rows = await db.query(`
      SELECT TOP 1 T1.AcctCode
      FROM OITM T0
      LEFT JOIN OACT T1 ON T1.AcctCode = T0.CogsAcct
      WHERE T0.ItemCode = @itemCode
    `, { itemCode });
    return !!rows.recordset?.[0]?.AcctCode;
  } catch (_error) {
    return true;
  }
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getAPInvoiceList,
  getAPInvoice,
  getDocumentSeries,
  getNextNumber,
  getStateFromWarehouse,
  getOpenGRPO,
  getGRPOForCopy,
  getVendorValidation,
  getFallbackNonGstTaxCode,
  getPostingPeriodValidation,
  getBranchEnabled,
  getItemValidation,
  getTaxCodeValidation,
  getGRPOOpenLineValidation,
  isDuplicateVendorInvoiceNumber,
  hasItemGLAccount,
  getItemsForModal
};
