/**
 * Sales Quotation reference data — loaded directly from SAP B1 SQL Server database.
 * Mirrors salesOrderDbService.js but targets OQUT/QUT1 tables (ObjectCode = '23').
 */
const db = require('./dbService');
const { loadBusinessPartnerAddresses } = require('./businessPartnerAddressDbUtils');
const masterDataDbService = require('./masterDataDbService');
const { getHeaderUdfValues, getLineUdfValues, getMarketingDocumentUdfs } = require('./udfMetadataService');
const { createMarketingDocumentLineLookupRepository } = require('./marketingDocumentLineLookupDbService');
const {
  escapeLike,
  normalizeTopLimit,
  buildMarketingDocumentListFilterQuery,
} = require('./documentListUtils');

const salesQuotationLineLookups = createMarketingDocumentLineLookupRepository({ lineTable: 'QUT1' });

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
const toSqlIdentifier = (identifier) => `[${String(identifier || '').replace(/]/g, ']]')}]`;

const normalizeDbScalar = (value) => {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return value == null ? '' : String(value);
};

const getPhysicalUdfValues = async ({ tableName, keyColumn = 'DocEntry', keyValue, includeLineNum = false }) => {
  const fieldMetadata = await getTableFieldMetadata(tableName);
  const udfColumns = Object.keys(fieldMetadata).filter((columnName) => columnName.startsWith('U_'));
  if (!udfColumns.length) return {};

  const selectColumns = [
    ...(includeLineNum ? ['LineNum'] : []),
    ...udfColumns,
  ].map(toSqlIdentifier).join(', ');

  const rows = await safe(db.query(`
    SELECT ${selectColumns}
    FROM ${toSqlIdentifier(tableName)}
    WHERE ${toSqlIdentifier(keyColumn)} = @keyValue
  `, { keyValue }));

  if (includeLineNum) {
    return rows.reduce((acc, row) => {
      acc[row.LineNum] = udfColumns.reduce((values, columnName) => {
        values[columnName] = normalizeDbScalar(row[columnName]);
        return values;
      }, {});
      return acc;
    }, {});
  }

  const row = rows[0] || {};
  return udfColumns.reduce((values, columnName) => {
    values[columnName] = normalizeDbScalar(row[columnName]);
    return values;
  }, {});
};

const mergeLineUdfValueMaps = (...maps) => maps.reduce((acc, map) => {
  Object.entries(map || {}).forEach(([lineNum, values]) => {
    acc[lineNum] = {
      ...(acc[lineNum] || {}),
      ...(values || {}),
    };
  });

  return acc;
}, {});

const buildLineTaxCodeExpression = (tableAlias, fieldMetadata = {}) => {
  const expressions = [];
  if (hasTableField(fieldMetadata, 'TaxCode')) {
    expressions.push(`NULLIF(LTRIM(RTRIM(CAST(${tableAlias}.TaxCode AS NVARCHAR(100)))), '')`);
  }
  if (hasTableField(fieldMetadata, 'VatGroup')) {
    expressions.push(`NULLIF(LTRIM(RTRIM(CAST(${tableAlias}.VatGroup AS NVARCHAR(100)))), '')`);
  }
  return expressions.length ? `COALESCE(${expressions.join(', ')}, '')` : "''";
};

const buildLineTaxCodeSelect = (tableAlias, fieldMetadata = {}, alias = 'TaxCode') =>
  `${buildLineTaxCodeExpression(tableAlias, fieldMetadata)} AS ${sqlAlias(alias)}`;

const formatSapDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
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
         SWW         AS HSNCode,
         DfltWH      AS DefaultWarehouse,
         CountryOrg  AS ItemCountryOrg,
         SACEntry    AS SACEntry,
         VatGourpSa  AS TaxCodeAR,
         ''          AS DistributionRule
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
    T0.ManSerNum AS SerialManaged,
    T0.CountryOrg AS ItemCountryOrg,
    T0.SACEntry AS SACEntry,
    T0.VatGourpSa AS TaxCodeAR,
    '' AS DistributionRule
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

const getCountries = () => safe(db.query(`
  SELECT Code, Name
  FROM   OCRY
  ORDER  BY Name
`));

const getDistributionRules = () => safe(db.query(`
  SELECT TOP 200 OcrCode AS FactorCode, OcrName AS FactorDescription
  FROM   OOCR
  WHERE  Active <> 'N'
  ORDER  BY OcrCode
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
         CONCAT(CONCAT(COALESCE(firstName, ''), ' '), COALESCE(lastName, '')) AS FullName
  FROM   OHEM
  ORDER  BY firstName, lastName
`));

// ── Document Series (ObjectCode = '23' for Quotations) ───────────────────────

const getCompanyInfo = () => safe(db.query(`
  SELECT TOP 1
    CompnyName,
    CompnyAddr AS Address,
    State,
    MainCurncy AS localCurrency,
    SysCurrncy AS systemCurrency
  FROM OADM
`));

const SALES_QUOTATION_FORM_ID = '149';
const SALES_QUOTATION_MATRIX_ITEM_ID = '38';

const SALES_QUOTATION_MATRIX_COLUMN_DEFS = [
  { key: 'itemNo', label: 'Item No.', minWidth: 160, sapField: 'ItemCode', sapColumnIds: ['1', 'ItemCode', 'Item No.', 'ItemNo'] },
  { key: 'itemDescription', label: 'Item Description', minWidth: 240, sapField: 'Dscription', sapColumnIds: ['3', 'Dscription', 'ItemDescription', 'Description', 'Item Description'] },
  { key: 'quantity', label: 'Quantity', minWidth: 95, numeric: true, sapField: 'Quantity', sapColumnIds: ['11', 'Quantity', 'Qty'] },
  { key: 'uomName', label: 'UoM Name', minWidth: 120, readOnly: true, sapField: 'unitMsr', alternativeFields: ['UomCode'], sapColumnIds: ['1470002145', 'unitMsr', 'UomName', 'UoM Name'] },
  { key: 'uomCode', label: 'UoM Code', minWidth: 105, sapField: 'UomCode', alternativeFields: ['unitMsr', 'UomEntry'], sapColumnIds: ['1470002149', '1470002145', 'UomCode', 'unitMsr', 'UoM Code', 'UoM'] },
  { key: 'hsnCode', label: 'HSN', minWidth: 105, source: 'OITM', sapColumnIds: ['254000391', 'HsnEntry', 'HSN', 'HSN/SAC'] },
  { key: 'unitPrice', label: 'Unit Price', minWidth: 110, numeric: true, sapField: 'Price', alternativeFields: ['PriceBefDi'], sapColumnIds: ['14', 'Price', 'PriceBefDi', 'UnitPrice', 'Unit Price'] },
  { key: 'stdDiscount', label: 'Discount %', minWidth: 95, numeric: true, sapField: 'DiscPrcnt', sapColumnIds: ['15', 'DiscPrcnt', 'DiscountPercent', 'Discount %', 'Disc%'] },
  { key: 'taxCode', label: 'Tax Code', minWidth: 115, sapField: 'TaxCode', alternativeFields: ['VatGroup'], sapColumnIds: ['160', '234000377', 'TaxCode', 'VatGroup', 'Tax Code'] },
  { key: 'totalLC', label: 'Total (LC)', minWidth: 115, readOnly: true, numeric: true, sapField: 'LineTotal', sapColumnIds: ['160', '17', 'GTotal', 'LineTotal', 'Total', 'Total (LC)'] },
  { key: 'distRule', label: 'Distr. Rule', minWidth: 115, sapField: 'OcrCode', sapColumnIds: ['21', 'OcrCode', 'DistributionRule', 'Distr. Rule'] },
  { key: 'cogsDistRule', label: 'COGS Distr. Rule', minWidth: 130, sapField: 'CogsOcrCod', sapColumnIds: ['29', 'CogsOcrCod', 'COGS Distr. Rule'] },
  { key: 'countryOfOrigin', label: 'Country/Region of Origin', minWidth: 180, sapField: 'CountryOrg', sapColumnIds: ['10002037', 'CountryOrg', 'Country/Region of Origin'] },
  { key: 'loc', label: 'Loc.', minWidth: 115, readOnly: true, sapField: 'LocCode', alternativeFields: ['WhsCode', 'BPLId'], sapColumnIds: ['10002047', 'LocCode', 'Loc.'] },
  { key: 'blanketAgreementNo', label: 'Blanket Agreement No.', minWidth: 170, sapField: 'AgrNo', sapColumnIds: ['AgrNo', 'Blanket Agreement No.'] },
  { key: 'sellerBrokerage', label: 'Seller Brokerage', minWidth: 135, sapField: 'U_Brok_Seller', sapColumnIds: ['U_Brok_Seller', 'Seller Brokerage'] },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage', minWidth: 130, sapField: 'U_Brok_Buyer', sapColumnIds: ['U_Brok_Buyer', 'Buyer Brokerage'] },
  { key: 'buyerDelivery', label: 'Buyer - Delivery', minWidth: 135, sapField: 'U_Buyer_Delivery', sapColumnIds: ['U_Buyer_Delivery', 'Buyer - Delivery'] },
  { key: 'sellerDelivery', label: 'Seller - Delivery', minWidth: 135, sapField: 'U_Seller_Delivery', sapColumnIds: ['U_Seller_Delivery', 'Seller - Delivery'] },
  { key: 'buyerPaymentTerms', label: 'Buyer - Terms of Payment', minWidth: 180, sapField: 'U_Buyer_Payment_Terms', sapColumnIds: ['U_Buyer_Payment_Terms', 'Buyer - Terms of Payment'] },
  { key: 'sellerPaymentTerms', label: 'Seller - Terms of Payment', minWidth: 180, sapField: 'U_Seller_Payment_Term', alternativeFields: ['U_Seller_Payment_Terms'], sapColumnIds: ['U_Seller_Payment_Term', 'U_Seller_Payment_Terms', 'Seller - Terms of Payment'] },
  { key: 'buyerQuality', label: 'Buyer - Quality', minWidth: 135, sapField: 'U_Buyer_Quality', sapColumnIds: ['U_Buyer_Quality', 'Buyer - Quality'] },
  { key: 'sellerQuality', label: 'Seller - Quality', minWidth: 135, sapField: 'U_Seller_Quality', sapColumnIds: ['U_Seller_Quality', 'Seller - Quality'] },
  { key: 'buyerPrice', label: 'Buyer - Price', minWidth: 120, sapField: 'U_Buyer_Price', sapColumnIds: ['U_Buyer_Price', 'Buyer - Price'] },
  { key: 'sellerPrice', label: 'Seller - Price', minWidth: 120, sapField: 'U_Seller_Price', sapColumnIds: ['U_Seller_Price', 'Seller - Price'] },
  { key: 'buyerSpecialInstruction', label: 'Buyer - Special Instruction', minWidth: 190, sapField: 'U_Buyer_SPINS', sapColumnIds: ['U_Buyer_SPINS', 'Buyer - Special Instruction'] },
  { key: 'sellerSpecialInstruction', label: 'Seller - Special Instruction', minWidth: 190, sapField: 'U_Seller_SPINS', sapColumnIds: ['U_Seller_SPINS', 'Seller - Special Instruction'] },
  { key: 'sellerBrokerageAmtPer', label: 'Seller Brokerage(Amt./Per)', minWidth: 175, sapField: 'U_Sel_Brok_AP', sapColumnIds: ['U_Sel_Brok_AP', 'Seller Brokerage(Amt./Per)'] },
  { key: 'sellerBrokeragePercent', label: 'Seller Brokerage in Percentage', minWidth: 190, numeric: true, sapField: 'U_Seller_Brok_Per', sapColumnIds: ['U_Seller_Brok_Per', 'Seller Brokerage in Percentage'] },
  { key: 'stcode', label: 'STCODE', minWidth: 110, sapField: 'U_SELLTCODE', sapColumnIds: ['U_SELLTCODE', 'STCODE'] },
  { key: 'sellerItem', label: 'S_Item', minWidth: 115, sapField: 'U_S_Item', sapColumnIds: ['U_S_Item', 'S_Item'] },
  { key: 'sellerQty', label: 'S_Qty', minWidth: 105, numeric: true, sapField: 'U_S_Qty', sapColumnIds: ['U_S_Qty', 'S_Qty'] },
  { key: 'specialRebate', label: 'Special Rebate', minWidth: 120, sapField: 'U_SPLRBT', sapColumnIds: ['U_SPLRBT', 'Special Rebate'] },
  { key: 'commission', label: 'Commision', minWidth: 110, sapField: 'U_COMPRC', sapColumnIds: ['U_COMPRC', 'Commission', 'Commision'] },
  { key: 'sellerBrokeragePerQty', label: 'BrokPerQty', minWidth: 110, sapField: 'U_S_BrokPerQty', sapColumnIds: ['U_S_BrokPerQty', 'BrokPerQty'] },
  { key: 'freightPurchase', label: 'Freight Purchase', minWidth: 130, sapField: 'U_Freight_pur', sapColumnIds: ['U_Freight_pur', 'Freight Purchase'] },
  { key: 'freightSales', label: 'Freight Sales', minWidth: 120, sapField: 'U_Freight_sales', sapColumnIds: ['U_Freight_sales', 'Freight Sales'] },
  { key: 'freightProvider', label: 'Freight Provider', minWidth: 120, sapField: 'U_Fr_trans', sapColumnIds: ['U_Fr_trans', 'Freight Provider'] },
  { key: 'freightProviderName', label: 'Freight Provider Name', minWidth: 165, sapField: 'U_Fr_trans_name', sapColumnIds: ['U_Fr_trans_name', 'Freight Provider Name'] },
  { key: 'brokerageNumber', label: 'Brokerage Number', minWidth: 145, sapField: 'U_BDNum', sapColumnIds: ['U_BDNum', 'Brokerage Number'] },
];

const sapFlagToBoolean = (value, fallback = true) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (['Y', 'YES', 'TRUE', '1', 'TYES'].includes(normalized)) return true;
  if (['N', 'NO', 'FALSE', '0', 'TNO'].includes(normalized)) return false;
  return fallback;
};

const normalizePreferenceKey = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^U_/, '')
    .replace(/[^A-Z0-9]/g, '');

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const resolveSapUserSign = async () => {
  let sapUsername = '';
  try {
    const { getActiveCompanyConfig } = require('./companyConfigService');
    const company = await getActiveCompanyConfig();
    sapUsername = String(company?.serviceLayer?.username || '').trim();
  } catch (_error) {
    sapUsername = '';
  }
  if (!sapUsername) return null;

  const rows = await safe(db.query(`
    SELECT TOP 1 USERID
    FROM OUSR
    WHERE USER_CODE = @sapUsername
       OR U_NAME = @sapUsername
    ORDER BY
      CASE WHEN USER_CODE = @sapUsername THEN 0 ELSE 1 END,
      USERID
  `, { sapUsername }));

  const userSign = Number(rows[0]?.USERID);
  return Number.isFinite(userSign) ? userSign : null;
};

const getRichTableColumns = async (tableName) => {
  const rows = await safe(db.query(`
    SELECT
      COLUMN_NAME,
      DATA_TYPE,
      CHARACTER_MAXIMUM_LENGTH,
      NUMERIC_PRECISION,
      NUMERIC_SCALE,
      IS_NULLABLE,
      ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @tableName
    ORDER BY ORDINAL_POSITION
  `, { tableName }));

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

const getPreferenceRowMatchKeys = (row = {}) => unique([
  row.Caption,
  row.Title,
  row.Descr,
  row.ColAlias,
  row.ItemUID,
  row.TableName,
  row.ColID,
].map(normalizePreferenceKey).filter(Boolean));

const buildColumnCandidates = (column = {}) => unique([
  ...(column.sapColumnIds || []),
  column.label,
  column.sapField,
  ...(column.alternativeFields || []),
  column.key,
].map(normalizePreferenceKey).filter(Boolean));

const shouldReplaceColumnPreference = (current, next) => {
  if (!current) return true;
  const currentVisible = sapFlagToBoolean(current.VisInForm, false);
  const nextVisible = sapFlagToBoolean(next.VisInForm, false);
  if (currentVisible !== nextVisible) return nextVisible;

  const currentIndex = Number(current.VisualIndx);
  const nextIndex = Number(next.VisualIndx);
  if (Number.isFinite(currentIndex) && Number.isFinite(nextIndex) && currentIndex !== nextIndex) {
    return nextIndex < currentIndex;
  }

  const currentWidth = Number(current.Width);
  const nextWidth = Number(next.Width);
  if (Number.isFinite(currentWidth) && Number.isFinite(nextWidth) && currentWidth !== nextWidth) {
    return nextWidth > currentWidth;
  }

  return false;
};

const getSalesQuotationColumnPreferences = async () => {
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
  const hasCaption = columnSet.has('Caption');
  const hasTitle = columnSet.has('Title');
  const hasDescr = columnSet.has('Descr');
  const hasColAlias = columnSet.has('ColAlias');
  const userSign = await resolveSapUserSign();
  if (userSign == null) return { byKey: {}, rows: [], userSign: null };

  const rows = await safe(db.query(`
    SELECT
      FormID,
      ItemID,
      ColID,
      Width,
      VisInForm,
      VisualIndx,
      EditInForm,
      UserSign,
      TPLId
      ${hasTableName ? ', TableName' : ", '' AS TableName"}
      ${hasItemUid ? ', ItemUID' : ", '' AS ItemUID"}
      ${hasCaption ? ', Caption' : ", '' AS Caption"}
      ${hasTitle ? ', Title' : ", '' AS Title"}
      ${hasDescr ? ', Descr' : ", '' AS Descr"}
      ${hasColAlias ? ', ColAlias' : ", '' AS ColAlias"}
    FROM CPRF
    WHERE FormID = @formId
      AND (
        ItemID = @itemId
        ${hasItemUid ? 'OR ItemUID = @itemId' : ''}
        ${hasTableName ? 'OR TableName = @tableName' : ''}
      )
      AND UserSign = @userSign
    ORDER BY
      CASE WHEN TPLId = 0 THEN 0 ELSE 1 END,
      VisualIndx,
      ColID
  `, {
    formId: SALES_QUOTATION_FORM_ID,
    itemId: SALES_QUOTATION_MATRIX_ITEM_ID,
    tableName: 'QUT1',
    userSign,
  }));

  const byKey = rows.reduce((acc, row) => {
    getPreferenceRowMatchKeys(row).forEach((key) => {
      if (shouldReplaceColumnPreference(acc[key], row)) acc[key] = row;
    });
    return acc;
  }, {});

  return { byKey, rows, userSign };
};

const getColumnMetadata = (column, lineColumns = {}) => {
  const candidates = [column.sapField, ...(column.alternativeFields || [])].filter(Boolean);
  for (const candidate of candidates) {
    const metadata = lineColumns[String(candidate).toUpperCase()];
    if (metadata) return metadata;
  }
  return null;
};

const findColumnPreference = (column, preferences = {}) => {
  for (const candidate of buildColumnCandidates(column)) {
    if (preferences[candidate]) return preferences[candidate];
  }
  return null;
};

const getSalesQuotationLineUiMetadata = async () => {
  const [lineColumns, preferencesResult] = await Promise.all([
    getRichTableColumns('QUT1'),
    getSalesQuotationColumnPreferences(),
  ]);
  const hasSapPreferences = preferencesResult.rows.length > 0;

  const matrixColumns = SALES_QUOTATION_MATRIX_COLUMN_DEFS
    .map((column, index) => {
      const metadata = getColumnMetadata(column, lineColumns);
      const exists = Boolean(metadata || column.source || column.calculated);
      if (!exists) return null;

      const preference = findColumnPreference(column, preferencesResult.byKey);
      const width = Number(preference?.Width);

      return {
        key: column.key,
        label: column.label,
        sapField: column.sapField || '',
        source: column.source || (column.calculated ? 'calculated' : 'QUT1'),
        dataType: metadata?.dataType || '',
        maxLength: metadata?.maxLength || undefined,
        precision: metadata?.precision || undefined,
        scale: metadata?.scale || undefined,
        required: Boolean(metadata && !metadata.nullable),
        readOnly: Boolean(column.readOnly || column.calculated),
        visible: preference ? sapFlagToBoolean(preference.VisInForm, true) : true,
        active: preference ? sapFlagToBoolean(preference.EditInForm, true) : true,
        minWidth: Number.isFinite(width) && width > 0
          ? Math.max(width, column.minWidth || 125)
          : (column.minWidth || 125),
        order: Number.isFinite(Number(preference?.VisualIndx))
          ? Number(preference.VisualIndx)
          : index + 1,
        sapColumnId: preference?.ColID || '',
        numeric: Boolean(column.numeric),
        type: column.type,
        hasPreference: Boolean(preference),
        sapControlled: hasSapPreferences,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (left.order || 0) - (right.order || 0));

  return {
    matrix_columns: matrixColumns,
    sap_form: {
      formId: SALES_QUOTATION_FORM_ID,
      matrixItemId: SALES_QUOTATION_MATRIX_ITEM_ID,
      userSign: preferencesResult.userSign,
      preferenceRows: preferencesResult.rows.length,
    },
    _preferencesByKey: preferencesResult.byKey,
  };
};

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

const getAddressesByCustomer = async (cardCode) => {
  const { addresses } = await loadBusinessPartnerAddresses(db, cardCode, { context: 'Sales Quotation' });
  return addresses;
};

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
    shippingTypes, branches, states, countries, distributionRules, taxCodes, uomRaw, salesEmployees, owners, companyInfo,
    buyerQualityOptions, sellerQualityOptions, buyerPriceOptions, sellerPriceOptions, udfMetadata,
  ] = await Promise.all([
    getCustomers(), getItems(), getWarehouses(), getPaymentTerms(),
    getShippingTypes(), getBranches(), getStates(), getCountries(), getDistributionRules(), getTaxCodes(), getUomGroups(),
    getSalesEmployees(), getOwners(), getCompanyInfo(),
    salesQuotationLineLookups.getLookupValues('U_Buyer_Quality'),
    salesQuotationLineLookups.getLookupValues('U_Seller_Quality'),
    salesQuotationLineLookups.getLookupValues('U_Buyer_Price'),
    salesQuotationLineLookups.getLookupValues('U_Seller_Price'),
    getMarketingDocumentUdfs({ headerTable: 'OQUT', lineTable: 'QUT1' }),
  ]);
  const lineFieldMetadata = await getSalesQuotationLineUiMetadata();
  const company = companyInfo[0] || {};

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
      DistributionRule: i.DistributionRule || '',
      DefaultWarehouse: i.DefaultWarehouse || '',
    })),
    warehouses: mappedWarehouses,
    warehouse_addresses: mappedWarehouses,
    payment_terms: paymentTerms.map(t => ({ GroupNum: t.GroupNum, PymntGroup: t.PymntGroup })),
    shipping_types: shippingTypes.map(s => ({ TrnspCode: s.TrnspCode, TrnspName: s.TrnspName })),
    branches: branches.map(b => ({ BPLId: b.BPLId, BPLName: b.BPLName })),
    states: states.map(st => ({ Code: st.Code, Name: st.Name })),
    countries: countries.map(country => ({ Code: country.Code, Name: country.Name })),
    distribution_rules: distributionRules.map(rule => ({
      FactorCode: rule.FactorCode || '',
      FactorDescription: rule.FactorDescription || '',
    })),
    tax_codes: taxCodes.map(t => ({ Code: t.Code, Name: t.Name, Rate: t.Rate, GSTType: t.GSTType })),
    uom_groups,
    sales_employees: salesEmployees.map(e => ({ SlpCode: e.SlpCode, SlpName: e.SlpName })),
    owners: owners.map(o => ({ empID: o.empID, firstName: o.firstName, lastName: o.lastName, FullName: o.FullName })),
    quality_options: {
      buyer: buyerQualityOptions,
      seller: sellerQualityOptions,
    },
    price_options: {
      buyer: buyerPriceOptions,
      seller: sellerPriceOptions,
    },
    contacts: [],
    pay_to_addresses: [],
    company_address: {
      CompnyName: company.CompnyName || '',
      Address: company.Address || '',
      State: company.State || '',
    },
    company_currencies: {
      localCurrency: company.localCurrency || 'INR',
      systemCurrency: company.systemCurrency || company.localCurrency || 'INR',
    },
    decimal_settings: { QtyDec: 2, PriceDec: 2, SumDec: 2, RateDec: 2, PercentDec: 2 },
    matrix_columns: lineFieldMetadata.matrix_columns || [],
    line_field_metadata: {
      matrix_columns: lineFieldMetadata.matrix_columns || [],
      sap_form: lineFieldMetadata.sap_form || {},
    },
    udf_metadata: udfMetadata,
    warnings: [],
  };
};

const getCustomerDetails = async (cardCode) => {
  if (!String(cardCode || '').trim()) {
    return {
      contacts: [],
      bill_to_addresses: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
    };
  }
  const [contacts, addresses] = await Promise.all([
    getContactsByCustomer(cardCode),
    getAddressesByCustomer(cardCode),
  ]);
  const billTo = addresses.filter(a => a.AdresType === 'B');
  const shipTo = addresses.filter(a => a.AdresType === 'S');
  return {
    contacts: contacts.map(c => ({
      CardCode: c.CardCode, CntctCode: c.CntctCode,
      Name: c.Name || `${c.FirstName || ''} ${c.LastName || ''}`.trim(),
      FirstName: c.FirstName, LastName: c.LastName,
      E_Mail: c.E_Mail, MobilePhone: c.MobilePhone, Phone1: c.Phone1,
    })),
    bill_to_addresses: billTo,
    pay_to_addresses: billTo,
    ship_to_addresses: shipTo,
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
  const lineFieldMetadata = await getTableFieldMetadata('QUT1');
  const lineField = (columnName, alias, fallback = "NULL") => (
    hasTableField(lineFieldMetadata, columnName)
      ? `T1.${columnName} AS ${sqlAlias(alias)}`
      : `${fallback} AS ${sqlAlias(alias)}`
  );
  const lineUomCodeField = hasTableField(lineFieldMetadata, 'unitMsr')
    ? `T1.unitMsr AS ${sqlAlias('UomCode')}`
    : hasTableField(lineFieldMetadata, 'UomCode')
      ? `T1.UomCode AS ${sqlAlias('UomCode')}`
      : `'' AS ${sqlAlias('UomCode')}`;
  const lineUomNameField = hasTableField(lineFieldMetadata, 'unitMsr')
    ? `T1.unitMsr AS ${sqlAlias('UomName')}`
    : hasTableField(lineFieldMetadata, 'UomCode')
      ? `T1.UomCode AS ${sqlAlias('UomName')}`
      : `'' AS ${sqlAlias('UomName')}`;

  const rows = await safe(db.query(`
    SELECT
      T0.DocEntry, T0.DocNum, T0.CardCode, T0.CardName,
      T0.DocDate, T0.CreateDate AS DocumentCreated, T0.DocDueDate, T0.TaxDate, T0.DocStatus,
      T0.NumAtCard, T0.Comments AS Remarks, T0.DocTotal, T0.DocCur,
      T0.CntctCode, T0.BPLId, T0.GroupNum,
      T0.ShipToCode, T0.PayToCode, T0.Address, T0.Address2,
      T0.TrnspCode, T0.Confirmed, T0.JrnlMemo, T0.Series, NNM.SeriesName, NNM.Indicator AS SeriesIndicator, T0.DiscPrcnt,
      T0.SlpCode,
      SLP.SlpName AS SalesEmployeeName,
      T0.OwnerCode,
      CASE WHEN EMP.empID IS NOT NULL
        THEN CONCAT(CONCAT(COALESCE(EMP.firstName, ''), ' '), COALESCE(EMP.lastName, ''))
        ELSE NULL
      END AS OwnerName,
      T0.TotalExpns AS Freight,
      T0.VatSum AS TaxAmount,
      ST.Name AS PlaceOfSupply,
      T1.LineNum,
      T1.ItemCode,
      COALESCE(NULLIF(LTRIM(RTRIM(T1.Dscription)), ''), ITM.ItemName, '') AS Dscription,
      T1.Quantity, T1.Price,
      ${lineField('RequiredDate', 'RequiredDate')},
      ${lineField('ShipDate', 'ShipDate')},
      T1.DiscPrcnt AS LineDiscPrcnt,
      ${buildLineTaxCodeSelect('T1', lineFieldMetadata, 'TaxCode')},
      T1.WhsCode, ${lineUomCodeField}, ${lineUomNameField}, T1.LineTotal,
      T1.OcrCode AS DistRule,
      T1.CogsOcrCod AS CogsDistRule,
      T1.CountryOrg AS CountryOfOrigin,
      T1.AgrNo AS BlanketAgreementNo,
      ${lineField('U_PackingType', 'U_PackingType')},
      CHP.ChapterID AS HSNCode
    FROM OQUT T0
    INNER JOIN QUT1 T1 ON T0.DocEntry = T1.DocEntry
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    LEFT JOIN NNM1 NNM ON NNM.ObjectCode = '23' AND NNM.Series = T0.Series
    LEFT JOIN OHEM EMP ON EMP.empID = T0.OwnerCode
    LEFT JOIN (
      SELECT
        C.CardCode,
        C.Address,
        C.State,
        C.Country,
        ROW_NUMBER() OVER (
          PARTITION BY C.CardCode, C.Address
          ORDER BY C.LineNum
        ) AS AddressRank
      FROM CRD1 C
      WHERE C.AdresType = 'S'
    ) C
      ON C.CardCode = T0.CardCode
     AND C.Address = T0.ShipToCode
     AND C.AddressRank = 1
    LEFT JOIN OCST ST ON ST.Code = C.State AND ST.Country = C.Country
    LEFT JOIN OITM ITM ON ITM.ItemCode = T1.ItemCode
    LEFT JOIN OCHP CHP ON CHP.AbsEntry = ITM.ChapterID
    WHERE T0.DocEntry = @DocEntry
    ORDER BY T1.LineNum
  `, { DocEntry: docEntry }));

  if (!rows.length) throw new Error(`Sales Quotation ${docEntry} not found`);

  const header = rows[0];
  const [metadataHeaderUdfs, metadataLineUdfs, physicalHeaderUdfs, physicalLineUdfs] = await Promise.all([
    getHeaderUdfValues({ tableId: 'OQUT', keyValue: docEntry }),
    getLineUdfValues({ tableId: 'QUT1', keyValue: docEntry }),
    getPhysicalUdfValues({ tableName: 'OQUT', keyValue: docEntry }),
    getPhysicalUdfValues({ tableName: 'QUT1', keyValue: docEntry, includeLineNum: true }),
  ]);
  const headerUdfs = { ...metadataHeaderUdfs, ...physicalHeaderUdfs };
  const lineUdfs = mergeLineUdfValueMaps(metadataLineUdfs, physicalLineUdfs);

  const batchRows = await safe(db.query(`
    SELECT BaseLinNum AS BaseLineNum, BatchNum, Quantity
    FROM   IBT1
    WHERE  BaseEntry = @docEntry
      AND  BaseType = 23
    ORDER  BY BaseLinNum, BatchNum
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

  const normalizeUdfLookupToken = (value) =>
    String(value || '')
      .trim()
      .toUpperCase()
      .replace(/^U_/, '')
      .replace(/[^A-Z0-9]/g, '');

  const firstUdfValue = (udfs, keys) => {
    const entries = Object.entries(udfs || {});
    for (const key of keys) {
      const direct = udfs[key];
      if (direct !== undefined && direct !== null && String(direct) !== '') {
        return String(direct);
      }

      const keyToken = normalizeUdfLookupToken(key);
      const match = entries.find(([entryKey, value]) => (
        normalizeUdfLookupToken(entryKey) === keyToken &&
        value !== undefined &&
        value !== null &&
        String(value) !== ''
      ));
      if (match) {
        return String(match[1]);
      }
    }
    return '';
  };

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
      lines: rows.map(line => {
        const lineUdf = lineUdfs[line.LineNum] || {};
        const packingType = firstUdfValue(lineUdf, ['U_PackingType', 'U_PACKINGTYPE', 'U_Packing_Type']) || line.U_PackingType || '';
        return {
          lineNum: line.LineNum != null ? Number(line.LineNum) : undefined,
          itemNo: line.ItemCode,
          itemDescription: line.Dscription || '',
          requiredDate: firstUdfValue(lineUdf, ['U_Required_Date', 'U_ReqDate']) || formatSapDate(line.RequiredDate),
          quotedDate: firstUdfValue(lineUdf, ['U_Quoted_Date', 'U_QuoteDate']) || formatSapDate(line.ShipDate),
          requiredQty: firstUdfValue(lineUdf, ['U_Req_Qty', 'U_ReqQty']),
          hsnCode: firstUdfValue(lineUdf, ['U_HSNCode', 'U_HSN']) || line.HSNCode || '',
          sacCode: firstUdfValue(lineUdf, ['U_SACCode', 'U_SAC']),
          quantity: String(line.Quantity || 0),
          unitPrice: String(line.Price || 0),
          unitPriceUdf: firstUdfValue(lineUdf, ['U_Unit_Price']),
          uomCode: line.UomCode || '',
          uomName: line.UomName || line.UomCode || '',
          stdDiscount: String(line.LineDiscPrcnt || ''),
          taxCode: line.TaxCode || '',
          taxCodeRepeat: line.TaxCode || '',
          TaxCode: line.TaxCode || '',
          VatGroup: line.TaxCode || '',
          total: String(line.LineTotal || 0),
          totalLC: String(line.LineTotal || 0),
          whse: line.WhsCode || '',
          distRule: line.DistRule || '',
          cogsDistRule: line.CogsDistRule || '',
          countryOfOrigin: line.CountryOfOrigin || '',
          blanketAgreementNo: line.BlanketAgreementNo != null ? String(line.BlanketAgreementNo) : '',
          specialRebate: firstUdfValue(lineUdf, ['U_SPLRBT']),
          commission: firstUdfValue(lineUdf, ['U_COMPRC']),
          sellerBrokeragePerQty: firstUdfValue(lineUdf, ['U_S_BrokPerQty']),
          sellerBrokerage: firstUdfValue(lineUdf, ['U_Brok_Seller']),
          buyerBrokerage: firstUdfValue(lineUdf, ['U_Brok_Buyer']),
          buyerDelivery: firstUdfValue(lineUdf, ['U_Buyer_Delivery']),
          sellerDelivery: firstUdfValue(lineUdf, ['U_Seller_Delivery']),
          buyerPaymentTerms: firstUdfValue(lineUdf, ['U_Buyer_Payment_Terms']),
          sellerPaymentTerms: firstUdfValue(lineUdf, ['U_Seller_Payment_Term', 'U_Seller_Payment_Terms']),
          buyerQuality: firstUdfValue(lineUdf, ['U_Buyer_Quality']),
          sellerQuality: firstUdfValue(lineUdf, ['U_Seller_Quality']),
          buyerPrice: firstUdfValue(lineUdf, ['U_Buyer_Price']),
          sellerPrice: firstUdfValue(lineUdf, ['U_Seller_Price']),
          buyerSpecialInstruction: firstUdfValue(lineUdf, ['U_Buyer_SPINS']),
          sellerSpecialInstruction: firstUdfValue(lineUdf, ['U_Seller_SPINS']),
          sellerBrokerageAmtPer: firstUdfValue(lineUdf, ['U_Sel_Brok_AP']),
          sellerBrokeragePercent: firstUdfValue(lineUdf, ['U_Seller_Brok_Per']),
          buyerBillDiscount: firstUdfValue(lineUdf, ['U_Buyer_Bill_Disc']),
          sellerBillDiscount: firstUdfValue(lineUdf, ['U_Seller_Bill_Disc']),
          packingType,
          U_PackingType: packingType,
          stcode: firstUdfValue(lineUdf, ['U_SELLTCODE']),
          sellerItem: firstUdfValue(lineUdf, ['U_S_Item']),
          sellerQty: firstUdfValue(lineUdf, ['U_S_Qty']),
          freightPurchase: firstUdfValue(lineUdf, ['U_Freight_pur']),
          freightSales: firstUdfValue(lineUdf, ['U_Freight_sales']),
          freightProvider: firstUdfValue(lineUdf, ['U_Fr_trans']),
          freightProviderName: firstUdfValue(lineUdf, ['U_Fr_trans_name']),
          documentCreated: firstUdfValue(lineUdf, ['U_Document_Created', 'U_DocCreated']) || formatSapDate(line.DocumentCreated),
          brokerageNumber: firstUdfValue(lineUdf, ['U_BDNum']),
          batches: batchesByLine[line.LineNum] || [],
          udf: {
            ...lineUdf,
            U_PackingType: packingType,
          },
        };
      }),
    },
  };
};

// ── Open Quotations for Copy ──────────────────────────────────────────────────

const getOpenSalesQuotations = (customerCode = '') => {
  const normalizedCustomerCode = String(customerCode || '').trim();
  const params = {};
  const customerFilter = normalizedCustomerCode ? 'AND T0.CardCode = @customerCode' : '';
  if (normalizedCustomerCode) {
    params.customerCode = normalizedCustomerCode;
  }

  return safe(db.query(`
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
    ${customerFilter}
ORDER BY 
    T0.DocDate DESC,
    T0.DocNum DESC;
`, params));
};

const getSalesQuotationForCopy = async (docEntry) => {
  const headerFieldMetadata = await getTableFieldMetadata('OQUT');
  const lineFieldMetadata = await getTableFieldMetadata('QUT1');
  const headerBranchField = hasTableField(headerFieldMetadata, 'BPL_IDAssignedToInvoice')
    ? 'T0.BPL_IDAssignedToInvoice'
    : hasTableField(headerFieldMetadata, 'BPLId')
      ? 'T0.BPLId'
      : 'NULL';
  const placeOfSupplyExpression = hasTableField(headerFieldMetadata, 'U_PlaceOfSupply')
    ? "COALESCE(NULLIF(LTRIM(RTRIM(CAST(T0.U_PlaceOfSupply AS NVARCHAR(254)))), ''), ST.Name, '')"
    : "ISNULL(ST.Name, '')";
  const lineField = (columnName, alias, fallback = "''") => (
    hasTableField(lineFieldMetadata, columnName)
      ? `T0.${columnName} AS ${sqlAlias(alias)}`
      : `${fallback} AS ${sqlAlias(alias)}`
  );
  const lineTaxField = buildLineTaxCodeSelect('T0', lineFieldMetadata, 'TaxCode');
  const lineTaxExpression = buildLineTaxCodeExpression('T0', lineFieldMetadata);
  const lineUomCodeField = hasTableField(lineFieldMetadata, 'unitMsr')
    ? `T0.unitMsr AS ${sqlAlias('UomCode')}`
    : hasTableField(lineFieldMetadata, 'UomCode')
      ? `T0.UomCode AS ${sqlAlias('UomCode')}`
      : `'' AS ${sqlAlias('UomCode')}`;
  const lineUomNameField = hasTableField(lineFieldMetadata, 'unitMsr')
    ? `T0.unitMsr AS ${sqlAlias('UomName')}`
    : hasTableField(lineFieldMetadata, 'UomCode')
      ? `T0.UomCode AS ${sqlAlias('UomName')}`
      : `'' AS ${sqlAlias('UomName')}`;

  // ================= HEADER =================
  const headerResult = await db.query(`
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T0.DocDate,
      T0.CreateDate AS DocumentCreated,
      T0.DocDueDate,
      T0.TaxDate,
      T0.DocStatus,
      T0.CardCode,
      T0.CardName,
      T0.CntctCode,
      T0.NumAtCard,
      T0.Comments,
      T0.BPLId,
      ${headerBranchField} AS BPL_IDAssignedToInvoice,
      T0.GroupNum,
      T0.ShipToCode,
      T0.PayToCode,
      T0.Address,
      T0.Address2,
      T0.TrnspCode,
      T0.Confirmed,
      T0.JrnlMemo,
      T0.Series,
      T0.DiscPrcnt,
      T0.SlpCode,
      SLP.SlpName AS SalesEmployeeName,
      T0.OwnerCode,
      CASE
        WHEN EMP.empID IS NOT NULL THEN CONCAT(CONCAT(COALESCE(EMP.firstName, ''), ' '), COALESCE(EMP.lastName, ''))
        ELSE NULL
      END AS OwnerName,
      ${placeOfSupplyExpression} AS PlaceOfSupply,
      T0.DocCur,
      T0.DocTotal,
      T0.TotalExpns AS Freight,
      T0.VatSum AS TaxAmount
    FROM OQUT T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    LEFT JOIN OHEM EMP ON EMP.empID = T0.OwnerCode
    LEFT JOIN (
      SELECT
        C.CardCode,
        C.Address,
        C.State,
        C.Country,
        ROW_NUMBER() OVER (
          PARTITION BY C.CardCode, C.Address
          ORDER BY C.LineNum
        ) AS AddressRank
      FROM CRD1 C
      WHERE C.AdresType = 'S'
    ) C
      ON C.CardCode = T0.CardCode
     AND C.Address = T0.ShipToCode
     AND C.AddressRank = 1
    LEFT JOIN OCST ST ON ST.Code = C.State AND ST.Country = C.Country
    WHERE T0.DocEntry = @DocEntry
      AND T0.DocStatus = 'O'
      AND T0.CANCELED <> 'Y'
  `, { DocEntry: docEntry });

  // ================= LINES =================
  const linesResult = await db.query(`
    SELECT 
      T0.LineNum,
      T0.ItemCode,
      COALESCE(NULLIF(LTRIM(RTRIM(T0.Dscription)), ''), ITM.ItemName, '') AS ItemDescription,

      -- 🔥 IMPORTANT: USE OPEN QTY
      T0.OpenQty AS Quantity,
      ${lineField('RequiredDate', 'RequiredDate')},
      ${lineField('ShipDate', 'ShipDate')},

      COALESCE(T0.PriceBefDi, T0.Price) AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent,
      T0.WhsCode AS WarehouseCode,
      ${lineTaxField},
      ${lineUomCodeField},
      ${lineUomNameField},
      ${lineField('OcrCode', 'DistributionRule')},
      ${lineField('FreeTxt', 'FreeText')},
      ${lineField('CountryOrg', 'CountryOfOrigin')},
      T0.OpenQty AS OpenQty,
      CAST((ISNULL(T0.Quantity, 0) - ISNULL(T0.OpenQty, 0)) AS DECIMAL(19, 6)) AS DeliveredQty,
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
      23 AS BaseType,
      ${lineField('U_SPLRBT', 'SpecialRebate')},
      ${lineField('U_COMPRC', 'Commission')},
      ${lineField('U_S_BrokPerQty', 'SellerBrokeragePerQty')},
      ${lineField('U_Req_Qty', 'RequiredQty')},
      ${lineField('U_Unit_Price', 'UnitPriceUdf')},
      ${lineField('U_Brok_Seller', 'SellerBrokerage')},
      ${lineField('U_Brok_Buyer', 'BuyerBrokerage')},
      ${lineField('U_Buyer_Delivery', 'BuyerDelivery')},
      ${lineField('U_Seller_Delivery', 'SellerDelivery')},
      ${lineField('U_Buyer_Payment_Terms', 'BuyerPaymentTerms')},
      ${lineField('U_Seller_Payment_Term', 'SellerPaymentTerm')},
      ${lineField('U_Seller_Payment_Terms', 'SellerPaymentTerms')},
      ${lineField('U_Buyer_Quality', 'BuyerQuality')},
      ${lineField('U_Seller_Quality', 'SellerQuality')},
      ${lineField('U_Buyer_Price', 'BuyerPrice')},
      ${lineField('U_Seller_Price', 'SellerPrice')},
      ${lineField('U_Buyer_SPINS', 'BuyerSpecialInstruction')},
      ${lineField('U_Seller_SPINS', 'SellerSpecialInstruction')},
      ${lineField('U_Seller_SPINS', 'QtySpecialInstruction')},
      ${lineField('U_Buyer_SPINS', 'DeliverySpecialInstruction')},
      ${lineField('U_Sel_Brok_AP', 'SellerBrokerageAmtPer')},
      ${lineField('U_Seller_Brok_Per', 'SellerBrokeragePercent')},
      ${lineField('U_Buyer_Bill_Disc', 'BuyerBillDiscount')},
      ${lineField('U_Seller_Bill_Disc', 'SellerBillDiscount')},
      ${lineField('U_SELLTCODE', 'STCODE')},
      ${lineField('U_S_Item', 'SellerItem')},
      ${lineField('U_S_Qty', 'SellerQty')},
      ${lineField('U_Freight_pur', 'FreightPurchase')},
      ${lineField('U_Freight_sales', 'FreightSales')},
      ${lineField('U_Fr_trans', 'FreightProvider')},
      ${lineField('U_Fr_trans_name', 'FreightProviderName')},
      ${lineField('U_BDNum', 'BrokerageNumber')},
      ${lineField('U_PackingType', 'U_PackingType')}

    FROM QUT1 T0
    LEFT JOIN OITM ITM ON T0.ItemCode = ITM.ItemCode
    LEFT JOIN OCHP CHP ON ITM.ChapterID = CHP.AbsEntry

    WHERE T0.DocEntry = @DocEntry
      AND T0.OpenQty > 0   -- 🔥 ONLY OPEN LINES

    ORDER BY T0.LineNum
  `, { DocEntry: docEntry });

  const header = headerResult.recordset?.[0] || {};
  const resolvedDocEntry = header.DocEntry || docEntry;
  const [metadataHeaderUdfs, metadataLineUdfs, physicalHeaderUdfs, physicalLineUdfs, freightCharges] = await Promise.all([
    getHeaderUdfValues({ tableId: 'OQUT', keyValue: resolvedDocEntry }),
    getLineUdfValues({ tableId: 'QUT1', keyValue: resolvedDocEntry }),
    getPhysicalUdfValues({ tableName: 'OQUT', keyValue: resolvedDocEntry }),
    getPhysicalUdfValues({ tableName: 'QUT1', keyValue: resolvedDocEntry, includeLineNum: true }),
    getFreightCharges(resolvedDocEntry),
  ]);
  const headerUdfs = { ...metadataHeaderUdfs, ...physicalHeaderUdfs };
  const lineUdfs = mergeLineUdfValueMaps(metadataLineUdfs, physicalLineUdfs);
  const lines = (linesResult.recordset || []).map((line) => {
    const udf = lineUdfs[line.LineNum] || {};
    const packingType = line.U_PackingType || udf.U_PackingType || udf.U_PACKINGTYPE || udf.U_Packing_Type || '';
    return {
      ...line,
      taxCode: line.TaxCode || '',
      taxCodeRepeat: line.TaxCode || '',
      VatGroup: line.TaxCode || '',
      packingType,
      U_PackingType: packingType,
      DocumentCreated: formatSapDate(header.DocumentCreated),
      udf: {
        ...udf,
        U_PackingType: packingType,
      },
    };
  });

  return {
    ...header,
    header_udfs: headerUdfs,
    freightCharges,
    DocumentLines: lines,
    sales_quotation: {
      doc_entry: header.DocEntry,
      doc_num: header.DocNum,
      header: {
        customerCode: header.CardCode || '',
        customerName: header.CardName || '',
        contactPerson: header.CntctCode != null ? String(header.CntctCode) : '',
        branch: header.BPL_IDAssignedToInvoice != null ? String(header.BPL_IDAssignedToInvoice) : (header.BPLId != null ? String(header.BPLId) : ''),
        series: header.Series != null ? String(header.Series) : '',
        placeOfSupply: header.PlaceOfSupply || '',
        postingDate: formatSapDate(header.DocDate),
        documentCreated: formatSapDate(header.DocumentCreated),
        deliveryDate: formatSapDate(header.DocDueDate),
        documentDate: formatSapDate(header.TaxDate),
        customerRefNo: header.NumAtCard || '',
        remarks: header.Comments || '',
        otherInstruction: header.Comments || '',
        docNum: header.DocNum,
        status: header.DocStatus === 'O' ? 'Open' : header.DocStatus === 'C' ? 'Closed' : '',
        paymentTerms: header.GroupNum != null ? String(header.GroupNum) : '',
        salesEmployee: header.SlpCode != null ? String(header.SlpCode) : '',
        purchaser: header.SalesEmployeeName || '',
        owner: header.OwnerName || '',
        freight: header.Freight != null ? String(header.Freight) : '',
        tax: header.TaxAmount != null ? String(header.TaxAmount) : '',
        totalPaymentDue: header.DocTotal != null ? String(header.DocTotal) : '',
        shipToCode: header.ShipToCode || '',
        payToCode: header.PayToCode || '',
        shipTo: header.Address || '',
        payTo: header.Address2 || '',
        shippingType: header.TrnspCode != null ? String(header.TrnspCode) : '',
        confirmed: header.Confirmed === 'Y',
        journalRemark: header.JrnlMemo || '',
        discount: header.DiscPrcnt != null ? String(header.DiscPrcnt) : '',
        currency: header.DocCur || 'INR',
      },
      header_udfs: headerUdfs,
      freightCharges,
      lines,
    },
  };
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  searchCustomers,
  getLookupValues: salesQuotationLineLookups.getLookupValues,
  createLookupValue: salesQuotationLineLookups.createLookupValue,
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
