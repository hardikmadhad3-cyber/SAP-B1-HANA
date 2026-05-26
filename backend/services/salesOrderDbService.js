/**
 * Sales Order reference data — loaded directly from SAP B1 SQL Server database.
 * Column names verified against NCPL_110126 schema.
 */
const db = require('./dbService');
const masterDataDbService = require('./masterDataDbService');
const {
  getHeaderUdfValues,
  getLineUdfValues,
  getMarketingDocumentUdfs,
  getUdfDefinitions,
} = require('./udfMetadataService');

const safe = async (promise) => {
  try {
    const r = await promise;
    return r.recordset || [];
  } catch (e) {
    return [];
  }
};

const escapeLike = (value) => String(value || '').replace(/[%_[\]]/g, (match) => `[${match}]`);
const normalizeTopLimit = (value) => {
  if (value == null || value === '') return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.floor(parsed);
};

const formatSapDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
};

const normalizeSalesOrderStatusCode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'o' || normalized === 'open') return 'O';
  if (normalized === 'c' || normalized === 'close' || normalized === 'closed') return 'C';
  return '';
};

const quoteSqlIdentifier = (identifier) => `[${String(identifier || '').replace(/]/g, ']]')}]`;
const normalizeUdfNameForMatch = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const unique = (values = []) => [...new Set(values.filter(Boolean))];

const FALLBACK_SALES_ORDER_SELLER_CODE_EXPRESSION = `
  COALESCE(
    CASE
      WHEN T0.SlpCode IS NOT NULL AND T0.SlpCode <> -1 THEN CAST(T0.SlpCode AS NVARCHAR(50))
      ELSE ''
    END,
    ''
  )
`;

const FALLBACK_SALES_ORDER_SELLER_NAME_EXPRESSION = `
  COALESCE(
    CASE
      WHEN T0.SlpCode IS NOT NULL AND T0.SlpCode <> -1 THEN NULLIF(LTRIM(RTRIM(SLP.SlpName)), '')
      ELSE ''
    END,
    ''
  )
`;

const getFallbackSalesOrderSellerExpressions = () => ({
  codeExpression: FALLBACK_SALES_ORDER_SELLER_CODE_EXPRESSION,
  nameExpression: FALLBACK_SALES_ORDER_SELLER_NAME_EXPRESSION,
});

const buildNullableTrimmedTextExpression = (expression) => (
  `NULLIF(LTRIM(RTRIM(CAST(${expression} AS NVARCHAR(254)))), '')`
);

const buildSalesOrderSellerExpression = (columnNames, fallbackExpression) => {
  const udfExpressions = unique(columnNames).map((columnName) => (
    buildNullableTrimmedTextExpression(`T0.${quoteSqlIdentifier(columnName)}`)
  ));

  return `
  COALESCE(
    ${[...udfExpressions, fallbackExpression, "''"].join(',\n    ')}
  )
`;
};

const resolveColumnName = (fieldMetadata = {}, candidateColumnName) => {
  const normalizedCandidate = normalizeUdfNameForMatch(candidateColumnName);
  return Object.keys(fieldMetadata).find(
    (columnName) => normalizeUdfNameForMatch(columnName) === normalizedCandidate
  );
};

const resolveSalesOrderSellerColumns = async () => {
  const [fieldMetadata, udfDefinitions] = await Promise.all([
    getTableFieldMetadata('ORDR'),
    getUdfDefinitions('ORDR'),
  ]);

  const resolveExplicitColumns = (candidates) => unique(
    candidates.map((candidate) => resolveColumnName(fieldMetadata, candidate))
  );

  const resolveDefinitionColumns = (acceptedMatches) => unique(
    udfDefinitions
      .filter((field) => {
        const aliasMatch = normalizeUdfNameForMatch(field.aliasId || field.key);
        const keyMatch = normalizeUdfNameForMatch(field.key);
        const labelMatch = normalizeUdfNameForMatch(field.label || field.Descr);
        return [aliasMatch, keyMatch, labelMatch].some((match) => acceptedMatches.has(match));
      })
      .map((field) => resolveColumnName(fieldMetadata, field.key))
  );

  const codeColumns = unique([
    ...resolveExplicitColumns([
      'U_Seller_Code',
      'U_To_Code_Vendor',
      'U_ToCodeVendor',
      'U_To_Code',
      'U_ToCode',
      'U_To_Vendor_Code',
      'U_Vendor_Code',
      'U_Party_Code',
    ]),
    ...resolveDefinitionColumns(new Set([
      'SELLERCODE',
      'USELLERCODE',
      'TOCODEVENDOR',
      'UTOCODEVENDOR',
      'TOCODE',
      'UTOCODE',
      'TOVENDORCODE',
      'UTOVENDORCODE',
      'VENDORCODE',
      'UVENDORCODE',
      'PARTYCODE',
      'UPARTYCODE',
    ])),
  ]);

  const nameColumns = unique([
    ...resolveExplicitColumns([
      'U_Seller_Name',
      'U_To_Name',
      'U_ToName',
      'U_Vendor_Name',
      'U_Party_Name',
    ]),
    ...resolveDefinitionColumns(new Set([
      'SELLERNAME',
      'USELLERNAME',
      'TONAME',
      'UTONAME',
      'VENDORNAME',
      'UVENDORNAME',
      'PARTYNAME',
      'UPARTYNAME',
    ])),
  ]);

  return { codeColumns, nameColumns };
};

const getSalesOrderSellerExpressions = async () => {
  try {
    const { codeColumns, nameColumns } = await resolveSalesOrderSellerColumns();

    return {
      codeExpression: buildSalesOrderSellerExpression(
        codeColumns,
        `CASE
      WHEN T0.SlpCode IS NOT NULL AND T0.SlpCode <> -1 THEN CAST(T0.SlpCode AS NVARCHAR(50))
      ELSE ''
    END`
      ),
      nameExpression: buildSalesOrderSellerExpression(
        nameColumns,
        `CASE
      WHEN T0.SlpCode IS NOT NULL AND T0.SlpCode <> -1 THEN NULLIF(LTRIM(RTRIM(SLP.SlpName)), '')
      ELSE ''
    END`
      ),
    };
  } catch (error) {
    console.warn('[Sales Order List] Falling back to sales employee seller fields:', error.message);
    return getFallbackSalesOrderSellerExpressions();
  }
};

const buildSalesOrderListFilterQuery = ({
  query = '',
  openOnly = true,
  docNum = '',
  customerCode = '',
  customerName = '',
  sellerCode = '',
  sellerName = '',
  status = '',
  postingDateFrom = '',
  postingDateTo = '',
}, options = {}) => {
  const {
    codeExpression: salesOrderSellerCodeExpression,
    nameExpression: salesOrderSellerNameExpression,
  } = options.sellerExpressions || getFallbackSalesOrderSellerExpressions();
  const normalizedQuery = String(query || '').trim();
  const normalizedDocNum = String(docNum || '').trim();
  const normalizedCustomerCode = String(customerCode || '').trim();
  const normalizedCustomerName = String(customerName || '').trim();
  const normalizedSellerCode = String(sellerCode || '').trim();
  const normalizedSellerName = String(sellerName || '').trim();
  const normalizedDateFrom = String(postingDateFrom || '').trim();
  const normalizedDateTo = String(postingDateTo || '').trim();
  const normalizedStatus = normalizeSalesOrderStatusCode(status);
  const openOnlyFilter = openOnly !== false;
  const excludeField = String(options.excludeField || '').trim();
  const whereClauses = ["T0.CANCELED <> 'Y'"];
  const params = {};

  if (normalizedStatus && excludeField !== 'status') {
    whereClauses.push('T0.DocStatus = @status');
    params.status = normalizedStatus;
  } else if (openOnlyFilter) {
    whereClauses.push("T0.DocStatus = 'O'");
  }

  if (normalizedQuery) {
    whereClauses.push(`(
      CAST(T0.DocNum AS NVARCHAR(50)) LIKE @query
      OR T0.CardCode LIKE @query
      OR T0.CardName LIKE @query
      OR ${salesOrderSellerCodeExpression} LIKE @query
      OR ${salesOrderSellerNameExpression} LIKE @query
    )`);
    params.query = `%${escapeLike(normalizedQuery)}%`;
  }

  if (normalizedDocNum && excludeField !== 'docNum') {
    whereClauses.push('CAST(T0.DocNum AS NVARCHAR(50)) = @docNum');
    params.docNum = normalizedDocNum;
  }

  if (normalizedCustomerCode && excludeField !== 'customerCode') {
    whereClauses.push('T0.CardCode LIKE @customerCode');
    params.customerCode = `%${escapeLike(normalizedCustomerCode)}%`;
  }

  if (normalizedCustomerName && excludeField !== 'customerName') {
    whereClauses.push('T0.CardName LIKE @customerName');
    params.customerName = `%${escapeLike(normalizedCustomerName)}%`;
  }

  if (normalizedSellerCode && excludeField !== 'sellerCode') {
    whereClauses.push(`${salesOrderSellerCodeExpression} LIKE @sellerCode`);
    params.sellerCode = `%${escapeLike(normalizedSellerCode)}%`;
  }

  if (normalizedSellerName && excludeField !== 'sellerName') {
    whereClauses.push(`${salesOrderSellerNameExpression} LIKE @sellerName`);
    params.sellerName = `%${escapeLike(normalizedSellerName)}%`;
  }

  if (normalizedDateFrom && excludeField !== 'postingDateFrom') {
    whereClauses.push('CAST(T0.DocDate AS date) >= CAST(@postingDateFrom AS date)');
    params.postingDateFrom = normalizedDateFrom;
  }

  if (normalizedDateTo && excludeField !== 'postingDateTo') {
    whereClauses.push('CAST(T0.DocDate AS date) <= CAST(@postingDateTo AS date)');
    params.postingDateTo = normalizedDateTo;
  }

  return { whereClauses, params };
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
         CountryOrg  AS ItemCountryOrg,
         SACEntry    AS SACEntry,
         VatGourpSa  AS TaxCodeAR,
         ''          AS DistributionRule,
         DfltWH      AS DefaultWarehouse
  FROM   OITM
  WHERE  SellItem = 'Y'
    AND  validFor  <> 'N'
  ORDER  BY ItemCode
`));

// Enhanced item list for modal with all details
const getItemsForModal = (whsCode = '') => {
  const hasWarehouse = String(whsCode || '').trim();

  return safe(db.query(`
  SELECT 
    T0.ItemCode,
    T0.ItemName,
    T0.FrgnName AS ForeignName,
    T0.ItmsGrpCod AS ItemGroupCode,
    T1.ItmsGrpNam AS ItemGroup, 
    CAST(${hasWarehouse ? 'ISNULL(W.OnHand, 0)' : 'T0.OnHand'} AS DECIMAL(19,2)) AS InStock,
    ${hasWarehouse ? 'ISNULL(W.IsCommited, 0)' : 'T0.IsCommited'} AS Committed,
    ${hasWarehouse ? 'ISNULL(W.OnOrder, 0)' : 'T0.OnOrder'} AS Ordered,
    CAST(${hasWarehouse ? 'ISNULL(W.OnHand, 0) - ISNULL(W.IsCommited, 0)' : 'T0.OnHand - T0.IsCommited'} AS DECIMAL(19,2)) AS Available,
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
    --T0.brand AS Brand,
    --T0.U_Origin AS Origin
  FROM OITM T0
 LEFT JOIN OITB T1 ON T0.ItmsGrpCod = T1.ItmsGrpCod 
   LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
   ${hasWarehouse ? 'LEFT JOIN OITW W ON W.ItemCode = T0.ItemCode AND W.WhsCode = @WhsCode' : ''}

 WHERE T0.SellItem = 'Y'
    AND T0.validFor <> 'N'
  ORDER BY T0.ItemCode

 
`, hasWarehouse ? { WhsCode: hasWarehouse } : {}));
};

// Get freight charges for modal
const getFreightCharges = (docEntry) => {
  if (!docEntry) {
    // CREATE MODE
    return safe(db.query(`
      SELECT 
        T0.ExpnsCode,
        T0.ExpnsName,
        T0.DistrbMthd AS DistributionMethod,
        T0.DistrbMthd AS FreightTaxDistributionMethod,
        T0.TaxLiable,
        T0.RevFixSum AS DefaultAmount,
        'O' AS Status
      FROM OEXD T0
      ORDER BY T0.ExpnsName
    `));
  }

  // EDIT MODE
  return safe(db.query(`
    SELECT 
      T0.ExpnsCode,
      T0.ExpnsName,
      T0.DistrbMthd AS DistributionMethod,
      T0.DistrbMthd AS FreightTaxDistributionMethod,
      T0.TaxLiable,
      T0.RevFixSum AS DefaultAmount,
      'O' AS Status,
      ISNULL(T1.LineTotal, 0) AS LineTotal,
      T1.TaxCode,
      ISNULL(T1.VatSum, 0) AS TaxAmount,
      T1.Comments
    FROM OEXD T0
    LEFT JOIN RDR3 T1 
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

const getSalesOrderPrintLayouts = () => safe(db.query(`
  SELECT
    DocCode AS layout_id,
    DocName AS layout_name,
    CASE
      WHEN Category = 'P' THEN 'PLD'
      WHEN Category = 'C' THEN 'Crystal Reports'
      ELSE Category
    END AS layout_type,
    CASE Language
      WHEN 8 THEN 'English (UK)'
      WHEN 3 THEN 'English'
      WHEN 1 THEN 'Default'
      ELSE ''
    END AS language_name,
    TypeCode AS type_code,
    Category AS category_code,
    Language AS language_code,
    Status AS status_code,
    CASE
      WHEN Category = 'C' THEN CAST(1 AS bit)
      ELSE CAST(0 AS bit)
    END AS is_export_supported
  FROM RDOC
  WHERE TypeCode = 'RDR2'
    AND Status = 'A'
  ORDER BY
    CONVERT(int, SUBSTRING(DocCode, 4, LEN(DocCode) - 3)),
    DocCode
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

const getTaxCodeDiagnostics = async (taxCodes = []) => {
  const normalizedCodes = [...new Set(
    (taxCodes || [])
      .map((code) => String(code || '').trim())
      .filter(Boolean)
  )];

  if (!normalizedCodes.length) {
    return [];
  }

  const params = {};
  const placeholders = normalizedCodes.map((code, index) => {
    const key = `taxCode${index}`;
    params[key] = code;
    return `@${key}`;
  });

  return safe(db.query(`
    SELECT
      T0.Code,
      T0.Name,
      T0.Lock,
      T1.STACode,
      T1.STAType,
      T1.EfctivRate,
      T1.Rate
    FROM OSTC T0
    LEFT JOIN STC1 T1
      ON T0.Code = T1.STCCode
    WHERE T0.Code IN (${placeholders.join(', ')})
    ORDER BY T0.Code, T1.STACode
  `, params));
};

// const getTaxCodes = () => masterDataDbService.searchDocumentTaxCodes('', 'sales', 500, 0);

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

const tableFieldMetadataPromises = new Map();
const itemUomContextCache = new Map();

const getTableFieldMetadata = async (tableName) => {
  const normalizedTableName = String(tableName || '').trim();
  if (!normalizedTableName) return {};

  const databaseName = await db.resolveDatabaseName();
  const cacheKey = `${databaseName || 'default'}:${normalizedTableName}`;

  if (!tableFieldMetadataPromises.has(cacheKey)) {
    tableFieldMetadataPromises.set(cacheKey, safe(db.query(`
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

  return tableFieldMetadataPromises.get(cacheKey);
};

const toSqlIdentifier = (identifier) => `[${String(identifier || '').replace(/]/g, ']]')}]`;

const normalizeDbScalar = (value) => {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return value == null ? '' : String(value);
};

const getPhysicalUdfValues = async ({ tableName, keyColumn = 'DocEntry', keyValue, includeLineNum = false }) => {
  const fieldMetadata = await getTableFieldMetadata(tableName);
  const udfColumns = Object.keys(fieldMetadata).filter((columnName) => columnName.startsWith('U_'));
  if (!udfColumns.length) return includeLineNum ? {} : {};

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

const getSalesOrderLineFieldMetadata = async () => {
  return getTableFieldMetadata('RDR1');
};

const getItemUomContext = async (itemCode) => {
  const normalizedItemCode = String(itemCode || '').trim();
  if (!normalizedItemCode) return null;

  if (!itemUomContextCache.has(normalizedItemCode)) {
    itemUomContextCache.set(normalizedItemCode, safe(db.query(`
      SELECT TOP 1
        T0.ItemCode,
        T0.UgpEntry,
        T0.SUoMEntry,
        T0.IUoMEntry,
        T0.SalUnitMsr,
        T0.InvntryUom,
        SU.UomCode AS SalesUomCode,
        IU.UomCode AS InventoryUomCode
      FROM OITM T0
      LEFT JOIN OUOM SU ON SU.UomEntry = T0.SUoMEntry
      LEFT JOIN OUOM IU ON IU.UomEntry = T0.IUoMEntry
      WHERE T0.ItemCode = @itemCode
    `, { itemCode: normalizedItemCode })).then((rows) => rows[0] || null));
  }

  return itemUomContextCache.get(normalizedItemCode);
};

const resolveSalesOrderLineUomEntry = async (itemCode, uomValue) => {
  const item = await getItemUomContext(itemCode);
  if (!item) return null;

  const rawValue = uomValue == null ? '' : String(uomValue).trim();
  const requestedUomEntry = Number(rawValue);
  const requestedUomCode = rawValue.toUpperCase();
  const ugpEntry = Number(item.UgpEntry);
  const salesUomEntry = Number(item.SUoMEntry);
  const inventoryUomEntry = Number(item.IUoMEntry);

  const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

  if (isPositiveInteger(requestedUomEntry)) {
    if (ugpEntry > 0) {
      const rows = await safe(db.query(`
        SELECT TOP 1 UomEntry
        FROM UGP1
        WHERE UgpEntry = @ugpEntry
          AND UomEntry = @uomEntry
      `, { ugpEntry, uomEntry: requestedUomEntry }));
      return rows[0]?.UomEntry != null ? Number(rows[0].UomEntry) : null;
    }

    const rows = await safe(db.query(`
      SELECT TOP 1 UomEntry
      FROM OUOM
      WHERE UomEntry = @uomEntry
    `, { uomEntry: requestedUomEntry }));
    return rows[0]?.UomEntry != null ? Number(rows[0].UomEntry) : null;
  }

  if (requestedUomCode) {
    if (ugpEntry > 0) {
      const rows = await safe(db.query(`
        SELECT TOP 1 U.UomEntry
        FROM UGP1 G
        INNER JOIN OUOM U ON U.UomEntry = G.UomEntry
        WHERE G.UgpEntry = @ugpEntry
          AND UPPER(LTRIM(RTRIM(U.UomCode))) = @uomCode
      `, { ugpEntry, uomCode: requestedUomCode }));

      if (rows[0]?.UomEntry != null) {
        return Number(rows[0].UomEntry);
      }

      return null;
    }

    const rows = await safe(db.query(`
      SELECT TOP 1 UomEntry
      FROM OUOM
      WHERE UPPER(LTRIM(RTRIM(UomCode))) = @uomCode
      ORDER BY UomEntry
    `, { uomCode: requestedUomCode }));

    if (rows[0]?.UomEntry != null) {
      return Number(rows[0].UomEntry);
    }
  }

  if (isPositiveInteger(salesUomEntry)) {
    return salesUomEntry;
  }

  if (isPositiveInteger(inventoryUomEntry)) {
    return inventoryUomEntry;
  }

  return null;
};

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

const LOOKUP_UDF_CONFIG = {
  U_Buyer_Quality: {
    tableId: 'RDR1',
    aliasId: 'Buyer_Quality',
    columnName: 'U_Buyer_Quality',
  },
  U_Seller_Quality: {
    tableId: 'RDR1',
    aliasId: 'Seller_Quality',
    columnName: 'U_Seller_Quality',
  },
  U_Buyer_Price: {
    tableId: 'RDR1',
    aliasId: 'Buyer_Price',
    columnName: 'U_Buyer_Price',
  },
  U_Seller_Price: {
    tableId: 'RDR1',
    aliasId: 'Seller_Price',
    columnName: 'U_Seller_Price',
  },
};

const normalizeLookupAlias = (aliasId) => {
  const normalized = String(aliasId || '').trim();
  if (!normalized) return '';
  if (LOOKUP_UDF_CONFIG[normalized]) return normalized;

  const prefixed = normalized.startsWith('U_') ? normalized : `U_${normalized}`;
  if (LOOKUP_UDF_CONFIG[prefixed]) return prefixed;

  const byAliasId = Object.entries(LOOKUP_UDF_CONFIG).find(([, config]) => (
    String(config.aliasId || '').toLowerCase() === normalized.replace(/^U_/, '').toLowerCase()
  ));

  return byAliasId ? byAliasId[0] : '';
};

const mapLookupRows = (rows = []) => {
  const seen = new Set();
  const options = [];

  rows.forEach((row) => {
    const rawValue = row?.Value ?? row?.FldValue ?? '';
    const rawDescription = row?.Description ?? row?.Descr ?? '';
    const description = String(rawDescription || '').trim();
    const value = String(rawValue || description || '').trim();

    if (!value) return;

    const normalized = value.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);

    options.push({
      value,
      description,
      label: description && description !== value ? `${value} - ${description}` : value,
    });
  });

  return options;
};

const getUdfValidValues = (tableId, aliasId) => safe(db.query(`
  SELECT
    LTRIM(RTRIM(ISNULL(T1.FldValue, ''))) AS Value,
    LTRIM(RTRIM(ISNULL(T1.Descr, ''))) AS Description,
    T1.IndexID
  FROM CUFD T0
  INNER JOIN UFD1 T1
    ON T0.TableID = T1.TableID
   AND T0.FieldID = T1.FieldID
  WHERE T0.TableID = @tableId
    AND (T0.AliasID = @aliasId OR CONCAT('U_', T0.AliasID) = @aliasId)
  ORDER BY T1.IndexID, T1.FldValue
`, { tableId, aliasId }));

const getExistingLookupValues = async (aliasId) => {
  const normalizedAlias = normalizeLookupAlias(aliasId);
  const columnName = LOOKUP_UDF_CONFIG[normalizedAlias]?.columnName;
  if (!columnName) return [];

  return safe(db.query(`
    SELECT DISTINCT
      LTRIM(RTRIM(CAST(${columnName} AS NVARCHAR(254)))) AS Value,
      '' AS Description
    FROM RDR1
    WHERE NULLIF(LTRIM(RTRIM(CAST(${columnName} AS NVARCHAR(254)))), '') IS NOT NULL
    ORDER BY Value
  `));
};

const getLookupValues = async (aliasId) => {
  const normalizedAlias = normalizeLookupAlias(aliasId);
  const config = LOOKUP_UDF_CONFIG[normalizedAlias];
  if (!config) return [];

  const [validValues, existingValues] = await Promise.all([
    getUdfValidValues(config.tableId, normalizedAlias),
    getExistingLookupValues(normalizedAlias),
  ]);

  return mapLookupRows([...validValues, ...existingValues]);
};

const getLookupUdfDefinition = async (aliasId) => {
  const normalizedAlias = normalizeLookupAlias(aliasId);
  const config = LOOKUP_UDF_CONFIG[normalizedAlias];
  if (!config) return null;

  const rows = await safe(db.query(`
    SELECT TOP 1 TableID, AliasID, FieldID, Descr
    FROM CUFD
    WHERE TableID = @tableId
      AND AliasID = @aliasId
  `, {
    tableId: config.tableId,
    aliasId: config.aliasId,
  }));

  return rows[0] || null;
};

const createLookupValue = async (aliasId, value, description = '') => {
  const normalizedAlias = normalizeLookupAlias(aliasId);
  const config = LOOKUP_UDF_CONFIG[normalizedAlias];
  if (!config) {
    throw new Error('Unsupported lookup field.');
  }

  const udfDefinition = await getLookupUdfDefinition(normalizedAlias);
  if (!udfDefinition) {
    throw new Error(`SAP UDF definition not found for ${normalizedAlias}.`);
  }

  const normalizedValue = String(value || '').trim();
  const normalizedDescription = String(description || normalizedValue).trim();

  if (!normalizedValue) {
    throw new Error('Value is required.');
  }

  const existingRows = await safe(db.query(`
    SELECT TOP 1
      LTRIM(RTRIM(ISNULL(FldValue, ''))) AS Value,
      LTRIM(RTRIM(ISNULL(Descr, ''))) AS Description
    FROM UFD1
    WHERE TableID = @tableId
      AND FieldID = @fieldId
      AND UPPER(LTRIM(RTRIM(ISNULL(FldValue, '')))) = @fieldValue
  `, {
    tableId: config.tableId,
    fieldId: udfDefinition.FieldID,
    fieldValue: normalizedValue.toUpperCase(),
  }));

  if (existingRows[0]) {
    return mapLookupRows(existingRows)[0];
  }

  const nextIndexRows = await db.query(`
    SELECT ISNULL(MAX(IndexID), -1) + 1 AS NextIndex
    FROM UFD1
    WHERE TableID = @tableId
      AND FieldID = @fieldId
  `, {
    tableId: config.tableId,
    fieldId: udfDefinition.FieldID,
  });

  const nextIndex = Number(nextIndexRows.recordset?.[0]?.NextIndex ?? 0);

  await db.query(`
    INSERT INTO UFD1 (TableID, FieldID, IndexID, FldValue, Descr, FldDate)
    VALUES (@tableId, @fieldId, @indexId, @fieldValue, @description, NULL)
  `, {
    tableId: config.tableId,
    fieldId: udfDefinition.FieldID,
    indexId: nextIndex,
    fieldValue: normalizedValue,
    description: normalizedDescription,
  });

  return mapLookupRows([{
    Value: normalizedValue,
    Description: normalizedDescription,
  }])[0];
};

// ── Document Series ───────────────────────────────────────────────────────────

const getDocumentSeries = async (targetDate = null) => {
  const effectiveTargetDate = targetDate || new Date().toISOString().split('T')[0];

  let result = await safe(db.query(`
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
WHERE T0.ObjectCode = '17'
    AND T0.Locked = 'N'
    AND CAST(@targetDate AS date) BETWEEN T1.F_RefDate AND T1.T_RefDate
ORDER BY T0.SeriesName
  `, { targetDate: effectiveTargetDate }));

  if (!result.length) {
    result = await safe(db.query(`
      SELECT
        T0.Series,
        T0.SeriesName,
        T0.Indicator,
        T0.NextNumber
      FROM NNM1 T0
      WHERE T0.ObjectCode = '17'
        AND T0.Locked = 'N'
      ORDER BY T0.SeriesName
    `));
  }
  
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
    WHERE  ObjectCode = '17'
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
const getContactsByCustomer = async (cardCode) => {
  const result = await safe(db.query(`
    SELECT 
      CntctCode,
      Name,
      FirstName,
      LastName,
      E_MailL AS E_Mail,
      Cellolar AS MobilePhone,   -- ✅ FIXED
      Tel1 AS Phone1,
      CardCode
    FROM OCPR
    WHERE UPPER(LTRIM(RTRIM(CardCode))) = UPPER(LTRIM(RTRIM(@cardCode)))
    ORDER BY Name
  `, { cardCode }));

  return result;
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
  if (!cardCode || !addressCode) {
    return { state: '' };
  }
  
  const result = await safe(db.query(`
    SELECT State
    FROM   CRD1
    WHERE  CardCode = @cardCode
      AND  Address = @addressCode
  `, { cardCode, addressCode }));
  
  return {
    state: result.length > 0 ? result[0].State || '' : '',
  };
};

// ── aggregators ───────────────────────────────────────────────────────────────

const getReferenceData = async () => {
  const [
    customers, items, warehouses, paymentTerms,
    shippingTypes, branches, states, countries, distributionRules, taxCodes, uomRaw, salesEmployees, owners,
    buyerQualityOptions, sellerQualityOptions, buyerPriceOptions, sellerPriceOptions, udfMetadata,
  ] = await Promise.all([
    getCustomers(), getItems(), getWarehouses(), getPaymentTerms(),
    getShippingTypes(), getBranches(), getStates(), getCountries(), getDistributionRules(), getTaxCodes(), getUomGroups(), getSalesEmployees(), getOwners(),
    getLookupValues('U_Buyer_Quality'),
    getLookupValues('U_Seller_Quality'),
    getLookupValues('U_Buyer_Price'),
    getLookupValues('U_Seller_Price'),
    getMarketingDocumentUdfs({ headerTable: 'ORDR', lineTable: 'RDR1' }),
  ]);

  // Group UoM rows: UgpEntry -> { AbsEntry, Name, uomCodes[] }
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
    CardCode:        c.CardCode,
    CardName:        c.CardName,
    CardType:        c.CardType,
    Currency:        c.Currency,
    VatGroup:        c.VatGroup,
    PayTermsGrpCode: c.GroupNum,
    Balance:         c.Balance,
    CurrentAccountBalance: c.Balance,
    FrozenFor:       c.frozenFor,
  }));

  const mappedWarehouses = warehouses.map(w => ({
    WhsCode: w.WhsCode, WhsName: w.WhsName,
    Street: w.Street, Block: w.Block, Building: w.Building,
    City: w.City, County: w.County, State: w.State,
    ZipCode: w.ZipCode, Country: w.Country, BranchID: w.BranchID,
  }));

  return {
    customers:           mappedCustomers,
    vendors:             mappedCustomers,
    items: items.map(i => ({
      ItemCode:      i.ItemCode,
      ItemName:      i.ItemName,
      SalesUnit:     i.SalesUnit,
      InventoryUOM:  i.InventoryUOM,
      UoMGroupEntry: i.UoMGroupEntry,
      SWW:           i.HSNCode || '',
      ItemCountryOrg:i.ItemCountryOrg || '',
      SACEntry:      i.SACEntry != null ? String(i.SACEntry) : '',
      TaxCodeAR:     i.TaxCodeAR || '',
      DistributionRule: i.DistributionRule || '',
      DefaultWarehouse: i.DefaultWarehouse || '',
    })),
    warehouses:          mappedWarehouses,
    warehouse_addresses: mappedWarehouses,
    payment_terms:  paymentTerms.map(t => ({ GroupNum: t.GroupNum, PymntGroup: t.PymntGroup })),
    shipping_types: shippingTypes.map(s => ({ TrnspCode: s.TrnspCode, TrnspName: s.TrnspName })),
    branches:       branches.map(b => ({ BPLId: b.BPLId, BPLName: b.BPLName })),
    states:         states.map(st => ({ Code: st.Code, Name: st.Name })),
    countries:      countries.map(country => ({ Code: country.Code, Name: country.Name })),
    distribution_rules: distributionRules.map(rule => ({
      FactorCode: rule.FactorCode || '',
      FactorDescription: rule.FactorDescription || '',
    })),
    tax_codes:      taxCodes.map(t => ({ Code: t.Code, Name: t.Name, Rate: t.Rate, GSTType: t.GSTType })),
    uom_groups,
    sales_employees: salesEmployees.map(e => ({ SlpCode: e.SlpCode, SlpName: e.SlpName })),
    owners:         owners.map(o => ({ empID: o.empID, firstName: o.firstName, lastName: o.lastName, FullName: o.FullName })),
    quality_options: {
      buyer: buyerQualityOptions,
      seller: sellerQualityOptions,
    },
    price_options: {
      buyer: buyerPriceOptions,
      seller: sellerPriceOptions,
    },
    contacts:           [],
    pay_to_addresses:   [],
    company_address:    {},
    decimal_settings:   { QtyDec: 2, PriceDec: 2, SumDec: 2, RateDec: 2, PercentDec: 2 },
    udf_metadata:       udfMetadata,
    warnings:           [],
  };
};

const getCustomerDetails = async (cardCode) => {
  
  const [contacts, addresses] = await Promise.all([
    
    getContactsByCustomer(cardCode),
    getAddressesByCustomer(cardCode),
  ]);

  const billTo = addresses.filter(a => a.AdresType === 'B');
  const shipTo = addresses.filter(a => a.AdresType === 'S');

  return {
    contacts: contacts.map(c => ({
      CardCode:    c.CardCode,
      CntctCode:   c.CntctCode,
      Name:        c.Name || `${c.FirstName || ''} ${c.LastName || ''}`.trim(),
      FirstName:   c.FirstName,
      LastName:    c.LastName,
      E_Mail:      c.E_Mail,
      MobilePhone: c.MobilePhone,
      Phone1:      c.Phone1,
    })),
    bill_to_addresses: billTo,
    pay_to_addresses:  billTo,
    ship_to_addresses: shipTo,
  };
};

const getItemDetails = async (itemCode) => {
  const rows = await safe(db.query(`
    SELECT ItemCode, ItemName,
           SalUnitMsr AS SalesUnit,
           InvntryUom AS InventoryUOM,
           UgpEntry   AS UgpEntry,
           SUoMEntry  AS UoMGroupEntry,
           IUoMEntry  AS InventoryUomEntry,
           SWW        AS HSNCode,
           CountryOrg AS ItemCountryOrg,
           SACEntry   AS SACEntry,
           VatGourpSa AS TaxCodeAR,
           ''         AS DistributionRule,
           DfltWH     AS DefaultWarehouse
    FROM   OITM
    WHERE  ItemCode = @itemCode
  `, { itemCode }));
  const item = rows[0];
  if (!item) return null;
  return {
    ItemCode:      item.ItemCode,
    ItemName:      item.ItemName,
    SalesUnit:     item.SalesUnit,
    InventoryUOM:  item.InventoryUOM,
    UgpEntry:      item.UgpEntry,
    UoMGroupEntry: item.UoMGroupEntry,
    InventoryUomEntry: item.InventoryUomEntry,
    SWW:           item.HSNCode || '',
    ItemCountryOrg:item.ItemCountryOrg || '',
    SACEntry:      item.SACEntry != null ? String(item.SACEntry) : '',
    TaxCodeAR:     item.TaxCodeAR || '',
    DistributionRule: item.DistributionRule || '',
    DefaultWarehouse: item.DefaultWarehouse || '',
  };
};

// ── sales order list ──────────────────────────────────────────────────────────

const getSalesOrderList = async ({
  query = '',
  openOnly = true,
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
  const sellerExpressions = await getSalesOrderSellerExpressions();
  const {
    codeExpression: salesOrderSellerCodeExpression,
    nameExpression: salesOrderSellerNameExpression,
  } = sellerExpressions;
  const { whereClauses, params } = buildSalesOrderListFilterQuery({
    query,
    openOnly,
    docNum,
    customerCode,
    customerName,
    sellerCode,
    sellerName,
    status,
    postingDateFrom,
    postingDateTo,
  }, { sellerExpressions });

  const countResult = await safe(db.query(`
    SELECT COUNT(*) AS total_count
    FROM   ORDR T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    WHERE  ${whereClauses.join('\n      AND ')}
  `, params));

  const totalCount = Number(countResult?.[0]?.total_count || countResult?.[0]?.TOTAL_COUNT || 0);

  const orders = await safe(db.query(`
    SELECT
           T0.DocEntry,
           T0.DocNum,
           T0.CardCode,
           T0.CardName,
           ${salesOrderSellerCodeExpression} AS SellerCode,
           ${salesOrderSellerNameExpression} AS SellerName,
           T0.DocDate,
           T0.DocDueDate,
           T0.DocStatus,
           T0.DocTotal,
           T0.DocCur,
           (
             SELECT COUNT(*)
             FROM   RDR1 T1
             WHERE  T1.DocEntry = T0.DocEntry
           ) AS line_count
    FROM   ORDR T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    WHERE  ${whereClauses.join('\n      AND ')}
    ORDER  BY T0.DocEntry DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize }));

  return {
    orders: orders.map(o => ({
      doc_entry: o.DocEntry,
      doc_num: o.DocNum,
      customer_code: o.CardCode,
      customer_name: o.CardName,
      seller_code: o.SellerCode || '',
      seller_name: o.SellerName || '',
      posting_date: o.DocDate ? o.DocDate.toISOString().split('T')[0] : '',
      delivery_date: o.DocDueDate ? o.DocDueDate.toISOString().split('T')[0] : '',
      status: o.DocStatus === 'O' ? 'Open' : o.DocStatus === 'C' ? 'Closed' : 'Unknown',
      line_count: Number(o.line_count || 0),
      total_amount: Number(o.DocTotal || 0),
      currency: o.DocCur || '',
    })),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / normalizedPageSize)),
    },
  };
};

const getSalesOrderFilterOptions = async ({
  field = '',
  query = '',
  openOnly = true,
  docNum = '',
  customerCode = '',
  customerName = '',
  sellerCode = '',
  sellerName = '',
  status = '',
  postingDateFrom = '',
  postingDateTo = '',
  top = 50,
} = {}) => {
  const normalizedField = String(field || '').trim();
  const normalizedQuery = String(query || '').trim();
  const normalizedTop = normalizeTopLimit(top);

  if (normalizedField === 'customerCode' || normalizedField === 'customerName') {
    const customerWhereClauses = [
      "CardType = 'C'",
      "(@lookupQuery = '' OR CardCode LIKE @lookupLike OR CardName LIKE @lookupLike)",
    ];
    const customerParams = {
      lookupQuery: normalizedQuery,
      lookupLike: `%${escapeLike(normalizedQuery)}%`,
    };
    const topClause = normalizedTop ? 'TOP (@top)' : '';

    if (normalizedTop) {
      customerParams.top = normalizedTop;
    }

    const normalizedCustomerCode = String(customerCode || '').trim();
    const normalizedCustomerName = String(customerName || '').trim();

    if (normalizedCustomerCode && normalizedField !== 'customerCode') {
      customerWhereClauses.push('CardCode LIKE @customerCode');
      customerParams.customerCode = `%${escapeLike(normalizedCustomerCode)}%`;
    }

    if (normalizedCustomerName && normalizedField !== 'customerName') {
      customerWhereClauses.push('CardName LIKE @customerName');
      customerParams.customerName = `%${escapeLike(normalizedCustomerName)}%`;
    }

    const customerRows = await safe(db.query(`
      SELECT ${topClause}
        *
      FROM OCRD
      WHERE ${customerWhereClauses.join('\n        AND ')}
      ORDER BY ${normalizedField === 'customerCode' ? 'CardCode' : 'CardName'}, CardCode
    `, customerParams));

    return {
      options: customerRows.map((row) => ({
        code: normalizedField === 'customerCode'
          ? String(row.CardCode || '').trim()
          : String(row.CardName || '').trim(),
        name: normalizedField === 'customerCode'
          ? String(row.CardName || '').trim()
          : String(row.CardCode || '').trim(),
      })).filter((option) => option.code),
    };
  }

  const sellerExpressions = await getSalesOrderSellerExpressions();
  const {
    codeExpression: salesOrderSellerCodeExpression,
    nameExpression: salesOrderSellerNameExpression,
  } = sellerExpressions;

  const fieldConfig = {
    docNum: {
      select: `
        DISTINCT TOP (@top)
        CAST(T0.DocNum AS NVARCHAR(50)) AS code,
        T0.CardName AS name,
        T0.DocNum AS sort_code
      `,
      queryClause: 'CAST(T0.DocNum AS NVARCHAR(50)) LIKE @lookupQuery',
      orderBy: 'sort_code DESC',
    },
    customerCode: {
      select: `
        DISTINCT TOP (@top)
        T0.CardCode AS code,
        T0.CardName AS name
      `,
      queryClause: '(T0.CardCode LIKE @lookupQuery OR T0.CardName LIKE @lookupQuery)',
      orderBy: 'code',
    },
    customerName: {
      select: `
        DISTINCT TOP (@top)
        T0.CardName AS code,
        T0.CardCode AS name
      `,
      queryClause: '(T0.CardName LIKE @lookupQuery OR T0.CardCode LIKE @lookupQuery)',
      orderBy: 'code',
    },
    sellerCode: {
      select: `
        DISTINCT TOP (@top)
        ${salesOrderSellerCodeExpression} AS code,
        ${salesOrderSellerNameExpression} AS name
      `,
      queryClause: `(${salesOrderSellerCodeExpression} LIKE @lookupQuery OR ${salesOrderSellerNameExpression} LIKE @lookupQuery)`,
      orderBy: 'code',
    },
    sellerName: {
      select: `
        DISTINCT TOP (@top)
        ${salesOrderSellerNameExpression} AS code,
        ${salesOrderSellerCodeExpression} AS name
      `,
      queryClause: `(${salesOrderSellerNameExpression} LIKE @lookupQuery OR ${salesOrderSellerCodeExpression} LIKE @lookupQuery)`,
      orderBy: 'code',
    },
  };

  const config = fieldConfig[normalizedField];
  if (!config) return { options: [] };

  const { whereClauses, params } = buildSalesOrderListFilterQuery({
    query: '',
    openOnly,
    docNum,
    customerCode,
    customerName,
    sellerCode,
    sellerName,
    status,
    postingDateFrom,
    postingDateTo,
  }, { excludeField: normalizedField, sellerExpressions });

  if (normalizedQuery) {
    whereClauses.push(config.queryClause);
    params.lookupQuery = `%${escapeLike(normalizedQuery)}%`;
  }

  const rows = await safe(db.query(`
    SELECT ${config.select}
    FROM ORDR T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    WHERE ${whereClauses.join('\n      AND ')}
      AND NULLIF(LTRIM(RTRIM(${normalizedField === 'sellerName' ? salesOrderSellerNameExpression : normalizedField === 'sellerCode' ? salesOrderSellerCodeExpression : 'CAST(1 AS NVARCHAR(1))'})), '') IS NOT NULL
    ORDER BY ${config.orderBy}
  `, { ...params, top: normalizedTop }));

  return {
    options: rows.map((row) => ({
      code: String(row.code || '').trim(),
      name: String(row.name || '').trim(),
    })).filter((option) => option.code),
  };
};

// ── single sales order ────────────────────────────────────────────────────────

const resolveSalesOrderDocEntry = async (identifier) => {
  const normalizedIdentifier = Number(identifier);
  if (!Number.isFinite(normalizedIdentifier)) {
    throw new Error(`Invalid Sales Order identifier: ${identifier}`);
  }

  const rows = await safe(db.query(`
    SELECT TOP 1 DocEntry, DocNum
    FROM ORDR
    WHERE DocEntry = @DocEntry
       OR DocNum = @DocNum
    ORDER BY CASE WHEN DocEntry = @DocEntry THEN 0 ELSE 1 END, DocEntry
  `, {
    DocEntry: normalizedIdentifier,
    DocNum: normalizedIdentifier,
  }));

  return rows[0] || null;
};

const getSalesOrder = async (docEntry) => {
  const resolvedDocument = await resolveSalesOrderDocEntry(docEntry);
  if (!resolvedDocument) {
    throw new Error(`Sales Order ${docEntry} not found`);
  }

  const resolvedDocEntry = resolvedDocument.DocEntry;
  const lineFieldMetadata = await getSalesOrderLineFieldMetadata();
  const lineField = (columnName, alias, fallback = "''") => (
    lineFieldMetadata?.[columnName]
      ? `T1.${quoteSqlIdentifier(columnName)} AS ${quoteSqlIdentifier(alias)}`
      : `${fallback} AS ${quoteSqlIdentifier(alias)}`
  );
  const hasSellerPaymentTermsField = Boolean(lineFieldMetadata?.U_Seller_Payment_Terms);

  // ✅ Get complete header and line data with Place of Supply and HSN Code
  let rows = await safe(db.query(`
   SELECT 
    -- 🔹 HEADER
    T0.DocEntry,
    T0.DocNum,
    T0.CardCode,
    T0.CardName,
    T0.DocDate,
    T0.CreateDate AS DocumentCreated,
    T0.DocDueDate,
    T0.TaxDate,
    T0.DocStatus,
    T0.NumAtCard,
    T0.Comments AS Remarks,
    T0.DocTotal,
    T0.DocCur,
    T0.CntctCode,
    T0.BPLId,
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

    -- 🔹 SALES EMPLOYEE
    T0.SlpCode,
    SLP.SlpName AS SalesEmployeeName,

    -- 🔹 OWNER
    T0.OwnerCode,
    CASE 
      WHEN EMP.empID IS NOT NULL 
      THEN EMP.firstName + ' ' + ISNULL(EMP.lastName,'')
      ELSE NULL
    END AS OwnerName,

    -- 🔹 FINANCIALS
    T0.TotalExpns AS Freight,
    T0.VatSum AS TaxAmount,

    -- 🔹 PLACE OF SUPPLY (NO DUPLICATE FIXED)
    ST.Name AS PlaceOfSupply,

    -- 🔹 LINE DATA
    T1.LineNum,
    T1.ItemCode,
    T1.Dscription,
    T1.Quantity,
    T1.Price,
    T1.PriceBefDi,
    T1.DiscPrcnt AS LineDiscPrcnt,
    T1.TaxCode AS TaxCode,
    T1.WhsCode,
    T1.unitMsr AS UomCode,
    T1.unitMsr AS UomName,
    T1.OcrCode AS DistributionRule,
    ${lineField('FreeTxt', 'FreeText')},
    ${lineField('CountryOrg', 'CountryOfOrigin')},
    T1.OpenQty AS OpenQuantity,
    CAST((ISNULL(T1.Quantity, 0) - ISNULL(T1.OpenQty, 0)) AS DECIMAL(19, 6)) AS DeliveredQuantity,
    ISNULL(T1.VatSum, 0) AS LineTaxAmount,
    T1.LineTotal,
    ${lineField('U_SPLRBT', 'SpecialRebate')},
    ${lineField('U_COMPRC', 'Commission')},
    ${lineField('U_S_BrokPerQty', 'SellerBrokeragePerQty')},
    ${lineField('U_Unit_Price', 'UnitPriceUdf', 'COALESCE(T1.PriceBefDi, T1.Price)')},
    ${lineField('U_Brok_Seller', 'SellerBrokerage')},
    ${lineField('U_Brok_Buyer', 'BuyerBrokerage')},
    ${lineField('U_Buyer_Delivery', 'BuyerDelivery')},
    ${lineField('U_Seller_Delivery', 'SellerDelivery')},
    ${lineField('U_Buyer_Payment_Terms', 'BuyerPaymentTerms')},
    ${lineField('U_Seller_Payment_Terms', 'SellerPaymentTerms')},
    ${lineField('U_Buyer_Quality', 'BuyerQuality')},
    ${lineField('U_Seller_Quality', 'SellerQuality')},
    ${lineField('U_Buyer_Price', 'BuyerPrice')},
    ${lineField('U_Seller_Price', 'SellerPrice')},
    ${lineField('U_Buyer_SPINS', 'BuyerSpecialInstruction')},
    ${lineField('U_Seller_SPINS', 'SellerSpecialInstruction')},
    ${lineField('U_Buyer_SPINS', 'QtySpecialInstruction')},
    ${lineField('U_Seller_SPINS', 'DeliverySpecialInstruction')},
    ${lineField('U_Sel_Brok_AP', 'SellerBrokerageAmtPer')},
    ${lineField('U_Seller_Brok_Per', 'SellerBrokeragePercent')},
    ${lineField('U_Buyer_Bill_Disc', 'BuyerBillDiscount')},
    ${lineField('U_Seller_Bill_Disc', 'SellerBillDiscount')},
    ${lineField('U_SELLTCODE', 'STCODE', 'T1.TaxCode')},
    ${lineField('U_S_Item', 'SellerItem')},
    ${lineField('U_S_Qty', 'SellerQty')},
    ${lineField('U_Freight_pur', 'FreightPurchase')},
    ${lineField('U_Freight_sales', 'FreightSales')},
    ${lineField('U_Fr_trans', 'FreightProvider')},
    ${lineField('U_Fr_trans_name', 'FreightProviderName')},
    ${lineField('U_BDNum', 'BrokerageNumber')},

    -- 🔹 HSN
    CHP.ChapterID AS HSNCode

FROM ORDR T0

-- ✅ LINES (KEEP INNER JOIN if lines must exist)
INNER JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry

-- ✅ SALES EMPLOYEE
LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode

-- ✅ OWNER
LEFT JOIN OHEM EMP ON EMP.empID = T0.OwnerCode

-- ✅ ADDRESS FIX (NO DUPLICATE ISSUE)
OUTER APPLY (
    SELECT TOP 1 C.State, C.Country
    FROM CRD1 C
    WHERE C.CardCode = T0.CardCode
      AND C.Address = T0.ShipToCode
      AND C.AdresType = 'S'
) C

LEFT JOIN OCST ST 
    ON ST.Code = C.State 
   AND ST.Country = C.Country

-- ✅ HSN
LEFT JOIN OITM ITM ON ITM.ItemCode = T1.ItemCode
LEFT JOIN OCHP CHP ON CHP.AbsEntry = ITM.ChapterID

WHERE T0.DocEntry = @DocEntry

ORDER BY T1.LineNum
  `, { DocEntry: resolvedDocEntry }));

  console.log('🔍 [Backend] Query returned', rows.length, 'rows for requested identifier', docEntry, 'resolved DocEntry', resolvedDocEntry);

  if (!rows.length) {
    throw new Error(`Sales Order ${docEntry} not found`);
  }

  const header = rows[0];  // Header data is same in all rows
  const placeOfSupply = header.PlaceOfSupply || '';
  const [dynamicHeaderUdfs, dynamicLineUdfs, physicalHeaderUdfs, physicalLineUdfs] = await Promise.all([
    getHeaderUdfValues({ tableId: 'ORDR', keyValue: resolvedDocEntry }),
    getLineUdfValues({ tableId: 'RDR1', keyValue: resolvedDocEntry }),
    getPhysicalUdfValues({ tableName: 'ORDR', keyValue: resolvedDocEntry }),
    getPhysicalUdfValues({ tableName: 'RDR1', keyValue: resolvedDocEntry, includeLineNum: true }),
  ]);

  // ✅ Try to get header UDFs if they exist
  let headerUdfs = {
    ...dynamicHeaderUdfs,
    ...physicalHeaderUdfs,
  };
  try {
    const udfRows = await db.query(`
      SELECT
        U_SCharge,
        U_TRNS,
        U_LRNO,
        U_LRDT,
        U_DSTN,
        U_DSTNADD,
        U_FDSTN,
        U_VEHNO,
        U_DOCTHR,
        U_UOM,
        U_Price,
        U_SAmount,
        U_B_FromDate,
        U_B_ToDate,
        U_Seller_Code,
        U_Seller_Name,
        U_Seller_AddressId,
        U_Seller_Address,
        U_Old_Soda_Nodh_No,
        U_Old_Soda_Nodh_Date,
        U_Canceled,
        U_TrfId,
        U_TrfName,
        U_TrfVehi,
        U_TrfDist,
        U_TrfMode,
        U_TrfVType,
        U_AckNo,
        U_AckDt,
        U_CanDt,
        U_QrCode,
        U_SigInv,
        U_EwbDt,
        U_EwbVliDt,
        U_EWayBCan,
        U_TrfCode,
        U_MultiVeh,
        U_MultiVehPosted,
        U_SubSuply,
        U_DocType,
        U_TraType,
        U_DelRemarks
      FROM   ORDR
      WHERE  DocEntry = @DocEntry
    `, { DocEntry: resolvedDocEntry });
    if (udfRows.recordset && udfRows.recordset.length > 0) {
      const udf = udfRows.recordset[0];
      headerUdfs = {
        ...headerUdfs,
        U_SCharge: udf.U_SCharge || '',
        U_TRNS: udf.U_TRNS || '',
        U_LRNO: udf.U_LRNO || '',
        U_LRDT: udf.U_LRDT ? udf.U_LRDT.toISOString().split('T')[0] : '',
        U_DSTN: udf.U_DSTN || '',
        U_DSTNADD: udf.U_DSTNADD || '',
        U_FDSTN: udf.U_FDSTN || '',
        U_VEHNO: udf.U_VEHNO || '',
        U_DOCTHR: udf.U_DOCTHR || '',
        U_UOM: udf.U_UOM || '',
        U_Price: udf.U_Price != null ? String(udf.U_Price) : '',
        U_SAmount: udf.U_SAmount != null ? String(udf.U_SAmount) : '',
        U_B_FromDate: udf.U_B_FromDate ? udf.U_B_FromDate.toISOString().split('T')[0] : '',
        U_B_ToDate: udf.U_B_ToDate ? udf.U_B_ToDate.toISOString().split('T')[0] : '',
        U_Seller_Code: udf.U_Seller_Code || '',
        U_Seller_Name: udf.U_Seller_Name || '',
        U_Seller_AddressId: udf.U_Seller_AddressId || '',
        U_Seller_Address: udf.U_Seller_Address || '',
        U_Old_Soda_Nodh_No: udf.U_Old_Soda_Nodh_No || '',
        U_Old_Soda_Nodh_Date: udf.U_Old_Soda_Nodh_Date ? udf.U_Old_Soda_Nodh_Date.toISOString().split('T')[0] : '',
        U_Canceled: udf.U_Canceled || '',
        U_TrfId: udf.U_TrfId || '',
        U_TrfName: udf.U_TrfName || '',
        U_TrfVehi: udf.U_TrfVehi || '',
        U_TrfDist: udf.U_TrfDist != null ? String(udf.U_TrfDist) : '',
        U_TrfMode: udf.U_TrfMode || '',
        U_TrfVType: udf.U_TrfVType || '',
        U_AckNo: udf.U_AckNo || '',
        U_AckDt: udf.U_AckDt || '',
        U_CanDt: udf.U_CanDt || '',
        U_QrCode: udf.U_QrCode || '',
        U_SigInv: udf.U_SigInv || '',
        U_EwbDt: udf.U_EwbDt || '',
        U_EwbVliDt: udf.U_EwbVliDt || '',
        U_EWayBCan: udf.U_EWayBCan || '',
        U_TrfCode: udf.U_TrfCode || '',
        U_MultiVeh: udf.U_MultiVeh || '',
        U_MultiVehPosted: udf.U_MultiVehPosted || '',
        U_SubSuply: udf.U_SubSuply || '',
        U_DocType: udf.U_DocType || '',
        U_TraType: udf.U_TraType || '',
        U_DelRemarks: udf.U_DelRemarks || '',
      };
    }
  } catch (err) {
    // Header UDF fields don't exist, skip them
  }

  // Use line data from the main joined query (rows already contains all lines)
  const lineRows = rows;

  // ✅ Try to get line UDFs if they exist
  let lineUdfs = mergeLineUdfValueMaps(dynamicLineUdfs, physicalLineUdfs);
  try {
    const udfLineRows = await db.query(`
      SELECT
        LineNum,
        U_Brand,
        U_Origin,
        U_PackSize,
        U_QcStatus,
        U_SPLRBT,
        U_COMPRC,
        U_S_BrokPerQty,
        U_Unit_Price,
        U_Brok_Seller,
        U_Brok_Buyer,
        U_Buyer_Delivery,
        U_Seller_Delivery,
        U_Buyer_Payment_Terms,
        ${hasSellerPaymentTermsField ? 'U_Seller_Payment_Terms,' : ''}
        U_Buyer_Quality,
        U_Seller_Quality,
        U_Buyer_Price,
        U_Seller_Price,
        U_Buyer_SPINS,
        U_Seller_SPINS,
        U_Sel_Brok_AP,
        U_Seller_Brok_Per,
        U_Buyer_Bill_Disc,
        U_Seller_Bill_Disc,
        U_SELLTCODE,
        U_S_Item,
        U_S_Qty,
        U_Freight_pur,
        U_Freight_sales,
        U_Fr_trans,
        U_Fr_trans_name,
        U_BDNum
      FROM   RDR1
      WHERE  DocEntry = @DocEntry
    `, { DocEntry: resolvedDocEntry });
    if (udfLineRows.recordset) {
      udfLineRows.recordset.forEach(row => {
          lineUdfs[row.LineNum] = {
            ...(lineUdfs[row.LineNum] || {}),
          U_Brand: row.U_Brand || '',
          U_Origin: row.U_Origin || '',
          U_PackSize: row.U_PackSize || '',
          U_QcStatus: row.U_QcStatus || 'Pending',
          U_SPLRBT: row.U_SPLRBT ?? '',
          U_COMPRC: row.U_COMPRC ?? '',
          U_S_BrokPerQty: row.U_S_BrokPerQty ?? '',
          U_Unit_Price: row.U_Unit_Price ?? '',
          U_Brok_Seller: row.U_Brok_Seller ?? '',
          U_Brok_Buyer: row.U_Brok_Buyer ?? '',
          U_Buyer_Delivery: row.U_Buyer_Delivery || '',
          U_Seller_Delivery: row.U_Seller_Delivery || '',
          U_Buyer_Payment_Terms: row.U_Buyer_Payment_Terms || '',
          U_Seller_Payment_Terms: row.U_Seller_Payment_Terms || '',
          U_Buyer_Quality: row.U_Buyer_Quality || '',
          U_Seller_Quality: row.U_Seller_Quality || '',
          U_Buyer_Price: row.U_Buyer_Price || '',
          U_Seller_Price: row.U_Seller_Price || '',
          U_Buyer_SPINS: row.U_Buyer_SPINS || '',
          U_Seller_SPINS: row.U_Seller_SPINS || '',
          U_Sel_Brok_AP: row.U_Sel_Brok_AP || '',
          U_Seller_Brok_Per: row.U_Seller_Brok_Per ?? '',
          U_Buyer_Bill_Disc: row.U_Buyer_Bill_Disc ?? '',
          U_Seller_Bill_Disc: row.U_Seller_Bill_Disc ?? '',
          U_SELLTCODE: row.U_SELLTCODE || '',
          U_S_Item: row.U_S_Item || '',
          U_S_Qty: row.U_S_Qty ?? '',
          U_Freight_pur: row.U_Freight_pur ?? '',
          U_Freight_sales: row.U_Freight_sales ?? '',
          U_Fr_trans: row.U_Fr_trans || '',
          U_Fr_trans_name: row.U_Fr_trans_name || '',
          U_BDNum: row.U_BDNum || '',
        };
      });
    }
  } catch (err) {
    // Line UDF fields don't exist, skip them
  }

  // ✅ Get batch numbers for each line (if any)
  const batchRows = await safe(db.query(`
    SELECT BaseLineNum, BatchNum, Quantity
    FROM   IBT1
    WHERE  BaseEntry = @DocEntry
      AND  BaseType = 17
    ORDER  BY BaseLineNum, BatchNum
  `, { DocEntry: resolvedDocEntry }));

  // Group batches by line number
  const batchesByLine = {};
  batchRows.forEach(b => {
    if (!batchesByLine[b.BaseLineNum]) {
      batchesByLine[b.BaseLineNum] = [];
    }
    batchesByLine[b.BaseLineNum].push({
      batchNumber: b.BatchNum || '',
      quantity: String(b.Quantity || 0),
      expiryDate: '', // ExpDate column doesn't exist in IBT1
    });
  });

  const result = {
    sales_order: {
      doc_entry: header.DocEntry,
      doc_num: header.DocNum,
      header: {
        customerCode: header.CardCode,
        customerName: header.CardName,
        contactPerson: String(header.CntctCode || ''),
        branch: String(header.BPLId || ''),
        series: String(header.Series || ''),
        placeOfSupply: placeOfSupply,
        postingDate: header.DocDate ? header.DocDate.toISOString().split('T')[0] : '',
        documentCreated: formatSapDate(header.DocumentCreated),
        deliveryDate: header.DocDueDate ? header.DocDueDate.toISOString().split('T')[0] : '',
        documentDate: header.TaxDate ? header.TaxDate.toISOString().split('T')[0] : '',
        customerRefNo: header.NumAtCard || '',
        remarks: header.Comments || '',
        otherInstruction: header.Comments || '',  // Map Comments to otherInstruction for frontend
        docNum: header.DocNum,
        status: header.DocStatus === 'O' ? 'Open' : header.DocStatus === 'C' ? 'Closed' : 'Unknown',
        paymentTerms: String(header.GroupNum || ''),
        salesEmployee: String(header.SlpCode || ''),
        purchaser: header.SalesEmployeeName || '',  // Return name for frontend
        owner: header.OwnerName || '',  // Return owner name
        freight: String(header.Freight || ''),  // Use Freight (mapped from TotalExpns)
        shipToCode: header.ShipToCode || '',
        payToCode: header.PayToCode || '',
        shipTo: header.Address || '',
        payTo: header.Address2 || '',
        shippingType: String(header.TrnspCode || ''),
        confirmed: header.Confirmed === 'Y',
        journalRemark: header.JrnlMemo || '',
        discount: String(header.DiscPrcnt || ''),
        tax: '', // Tax is calculated, not stored
        currency: header.DocCur || 'INR',
      },
      header_udfs: headerUdfs,
      lines: lineRows.map(line => {
        const lineUdf = lineUdfs[line.LineNum] || {};
        const savedUnitPrice = lineUdf.U_Unit_Price != null && lineUdf.U_Unit_Price !== ''
          ? lineUdf.U_Unit_Price
          : (line.UnitPriceUdf != null && line.UnitPriceUdf !== ''
            ? line.UnitPriceUdf
            : (line.PriceBefDi != null && line.PriceBefDi !== '' ? line.PriceBefDi : line.Price));
        const displayUnitPrice = savedUnitPrice != null && savedUnitPrice !== ''
          ? String(savedUnitPrice)
          : '0';
        // Get HSN Code from the joined query
        const hsnCode = line.HSNCode || '';
        
        console.log('🔍 [Backend] Processing line:', line.LineNum, 'Item:', line.ItemCode, 'HSN:', hsnCode);
        
        return {
          lineNum: line.LineNum != null ? Number(line.LineNum) : undefined,
          itemNo: line.ItemCode,
          itemDescription: line.Dscription || '',
          hsnCode: hsnCode,
          quantity: String(line.Quantity || 0),
          unitPrice: displayUnitPrice,
          unitPriceUdf: displayUnitPrice,
          sellerQuality: lineUdf.U_Seller_Quality || line.SellerQuality || '',
          buyerQuality: lineUdf.U_Buyer_Quality || line.BuyerQuality || '',
          sellerPrice: lineUdf.U_Seller_Price || line.SellerPrice || '',
          buyerPrice: lineUdf.U_Buyer_Price || line.BuyerPrice || '',
          sellerDelivery: lineUdf.U_Seller_Delivery || line.SellerDelivery || '',
          buyerDelivery: lineUdf.U_Buyer_Delivery || line.BuyerDelivery || '',
          sellerBrokerageAmtPer: lineUdf.U_Sel_Brok_AP || line.SellerBrokerageAmtPer || '',
          sellerBrokeragePercent: lineUdf.U_Seller_Brok_Per != null ? String(lineUdf.U_Seller_Brok_Per) : (line.SellerBrokeragePercent != null ? String(line.SellerBrokeragePercent) : ''),
          sellerBrokerage: lineUdf.U_Brok_Seller != null ? String(lineUdf.U_Brok_Seller) : (line.SellerBrokerage != null ? String(line.SellerBrokerage) : ''),
          buyerBrokerage: lineUdf.U_Brok_Buyer != null ? String(lineUdf.U_Brok_Buyer) : (line.BuyerBrokerage != null ? String(line.BuyerBrokerage) : ''),
          stcode: lineUdf.U_SELLTCODE || line.TaxCode || '',
          specialRebate: lineUdf.U_SPLRBT != null ? String(lineUdf.U_SPLRBT) : (line.SpecialRebate != null ? String(line.SpecialRebate) : ''),
          commission: lineUdf.U_COMPRC != null ? String(lineUdf.U_COMPRC) : (line.Commission != null ? String(line.Commission) : ''),
          sellerBrokeragePerQty: lineUdf.U_S_BrokPerQty != null ? String(lineUdf.U_S_BrokPerQty) : (line.SellerBrokeragePerQty != null ? String(line.SellerBrokeragePerQty) : ''),
          buyerPaymentTerms: lineUdf.U_Buyer_Payment_Terms || line.BuyerPaymentTerms || '',
          sellerPaymentTerms: lineUdf.U_Seller_Payment_Terms || line.SellerPaymentTerms || '',
          qtySpecialInstruction: lineUdf.U_Buyer_SPINS || line.QtySpecialInstruction || line.BuyerSpecialInstruction || '',
          deliverySpecialInstruction: lineUdf.U_Seller_SPINS || line.DeliverySpecialInstruction || line.SellerSpecialInstruction || '',
          buyerSpecialInstruction: lineUdf.U_Buyer_SPINS || line.BuyerSpecialInstruction || '',
          sellerSpecialInstruction: lineUdf.U_Seller_SPINS || line.SellerSpecialInstruction || '',
          buyerBillDiscount: lineUdf.U_Buyer_Bill_Disc != null ? String(lineUdf.U_Buyer_Bill_Disc) : (line.BuyerBillDiscount != null ? String(line.BuyerBillDiscount) : ''),
          sellerBillDiscount: lineUdf.U_Seller_Bill_Disc != null ? String(lineUdf.U_Seller_Bill_Disc) : (line.SellerBillDiscount != null ? String(line.SellerBillDiscount) : ''),
          sellerItem: lineUdf.U_S_Item || line.SellerItem || '',
          sellerQty: lineUdf.U_S_Qty != null ? String(lineUdf.U_S_Qty) : (line.SellerQty != null ? String(line.SellerQty) : ''),
          freightPurchase: lineUdf.U_Freight_pur != null ? String(lineUdf.U_Freight_pur) : (line.FreightPurchase != null ? String(line.FreightPurchase) : ''),
          freightSales: lineUdf.U_Freight_sales != null ? String(lineUdf.U_Freight_sales) : (line.FreightSales != null ? String(line.FreightSales) : ''),
          freightProvider: lineUdf.U_Fr_trans || line.FreightProvider || '',
          freightProviderName: lineUdf.U_Fr_trans_name || line.FreightProviderName || '',
          brokerageNumber: lineUdf.U_BDNum || line.BrokerageNumber || '',
          uomCode: line.UomCode || '',
          uomName: line.UomName || line.UomCode || '',
          discountAmount: String((Number(displayUnitPrice || 0) * Number(line.LineDiscPrcnt || 0)) / 100),
          stdDiscount: String(line.LineDiscPrcnt || ''),
          taxCode: line.TaxCode || '',
          total: String(line.LineTotal || 0),
          taxAmount: String(line.LineTaxAmount || 0),
          whse: line.WhsCode || '',
          distRule: line.DistributionRule || '',
          freeText: line.FreeText || '',
          countryOfOrigin: line.CountryOfOrigin || '',
          openQty: line.OpenQuantity != null ? String(line.OpenQuantity) : '',
          deliveredQty: line.DeliveredQuantity != null ? String(line.DeliveredQuantity) : '',
          documentCreated: formatSapDate(line.DocumentCreated),
          batches: batchesByLine[line.LineNum] || [],
          udf: {
            ...lineUdf,
            U_Brand: lineUdf.U_Brand || '',
            U_Origin: lineUdf.U_Origin || '',
            U_PackSize: lineUdf.U_PackSize || '',
            U_QcStatus: lineUdf.U_QcStatus || 'Pending',
            U_SPLRBT: lineUdf.U_SPLRBT ?? '',
            U_COMPRC: lineUdf.U_COMPRC ?? '',
            U_S_BrokPerQty: lineUdf.U_S_BrokPerQty ?? '',
            U_Unit_Price: lineUdf.U_Unit_Price ?? '',
            U_Brok_Seller: lineUdf.U_Brok_Seller ?? '',
            U_Brok_Buyer: lineUdf.U_Brok_Buyer ?? '',
            U_Buyer_Delivery: lineUdf.U_Buyer_Delivery || '',
            U_Seller_Delivery: lineUdf.U_Seller_Delivery || '',
            U_Buyer_Payment_Terms: lineUdf.U_Buyer_Payment_Terms || '',
            U_Seller_Payment_Terms: lineUdf.U_Seller_Payment_Terms || '',
            U_Buyer_Quality: lineUdf.U_Buyer_Quality || '',
            U_Seller_Quality: lineUdf.U_Seller_Quality || '',
            U_Buyer_Price: lineUdf.U_Buyer_Price || '',
            U_Seller_Price: lineUdf.U_Seller_Price || '',
            U_Buyer_SPINS: lineUdf.U_Buyer_SPINS || '',
            U_Seller_SPINS: lineUdf.U_Seller_SPINS || '',
            U_Sel_Brok_AP: lineUdf.U_Sel_Brok_AP || '',
            U_Seller_Brok_Per: lineUdf.U_Seller_Brok_Per ?? '',
            U_Buyer_Bill_Disc: lineUdf.U_Buyer_Bill_Disc ?? '',
            U_Seller_Bill_Disc: lineUdf.U_Seller_Bill_Disc ?? '',
            U_SELLTCODE: lineUdf.U_SELLTCODE || '',
            U_S_Item: lineUdf.U_S_Item || '',
            U_S_Qty: lineUdf.U_S_Qty ?? '',
            U_Freight_pur: lineUdf.U_Freight_pur ?? '',
            U_Freight_sales: lineUdf.U_Freight_sales ?? '',
            U_Fr_trans: lineUdf.U_Fr_trans || '',
            U_Fr_trans_name: lineUdf.U_Fr_trans_name || '',
            U_BDNum: lineUdf.U_BDNum || '',
          },
        };
      }),
    },
  };
  
  console.log('🔍 [Backend] Returning header fields:');
  console.log('  - salesEmployee (SlpCode):', result.sales_order.header.salesEmployee);
  console.log('  - purchaser (SlpName):', result.sales_order.header.purchaser);
  console.log('  - owner (OwnerName):', result.sales_order.header.owner);
  console.log('  - freight:', result.sales_order.header.freight);
  console.log('  - remarks:', result.sales_order.header.remarks);
  console.log('  - otherInstruction:', result.sales_order.header.otherInstruction);
  
  return result;
};

// ── OPEN SALES ORDERS (FOR COPY FROM) ────────────────────────────────────────

const getOpenSalesOrders = (customerCode = '') => {
  const normalizedCustomerCode = String(customerCode || '').trim();
  const params = {};
  const customerFilter = normalizedCustomerCode ? 'AND T0.CardCode = @customerCode' : '';
  if (normalizedCustomerCode) {
    params.customerCode = normalizedCustomerCode;
  }

  return safe(db.query(`
  SELECT TOP 200
    T0.DocEntry,
    T0.DocNum,
    T0.DocDate,
    T0.DocDueDate,
    T0.CardCode,
    T0.CardName,
    T0.Comments,
    T0.DocTotal
  FROM ORDR T0
  WHERE T0.DocStatus = 'O'
    AND T0.CANCELED <> 'Y'
    ${customerFilter}
  ORDER BY T0.DocDate DESC, T0.DocNum DESC
`, params));
};

const getSalesOrderForCopy = async (docEntry) => {
  const headerFieldMetadata = await getTableFieldMetadata('ORDR');
  const lineFieldMetadata = await getSalesOrderLineFieldMetadata();
  const sqlAlias = (alias) => `[${String(alias || '').replace(/]/g, ']]')}]`;
  const headerBranchField = headerFieldMetadata?.BPL_IDAssignedToInvoice
    ? 'T0.BPL_IDAssignedToInvoice'
    : headerFieldMetadata?.BPLId
      ? 'T0.BPLId'
      : 'NULL';
  const lineField = (columnName, alias, fallback = "''") => (
    lineFieldMetadata?.[columnName]
      ? `T0.${columnName} AS ${sqlAlias(alias)}`
      : `${fallback} AS ${sqlAlias(alias)}`
  );

  const headerResult = await db.query(`
    SELECT
      T0.DocEntry, T0.DocNum, T0.DocDate, T0.CreateDate AS DocumentCreated, T0.DocDueDate, T0.TaxDate,
      T0.CardCode, T0.CardName, T0.CntctCode,
      T0.NumAtCard, T0.Comments,
      T0.Address, T0.Address2, T0.ShipToCode, T0.PayToCode,
      T0.BPLId,
      ${headerBranchField} AS BPL_IDAssignedToInvoice,
      T0.GroupNum, T0.SlpCode,
      T0.DiscPrcnt, T0.TotalExpns AS Freight,
      T0.VatSum AS TaxAmount, T0.DocCur, T0.DocTotal
    FROM ORDR T0
    WHERE T0.DocEntry = @DocEntry
  `, { DocEntry: docEntry });

  const linesResult = await db.query(`
    SELECT
      T0.LineNum, T0.ItemCode,
      T0.Dscription AS ItemDescription,
      T0.OpenQty AS Quantity,
      COALESCE(T0.PriceBefDi, T0.Price) AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent,
      T0.WhsCode AS WarehouseCode,
      T0.TaxCode, T0.unitMsr AS UomCode, T0.unitMsr AS UomName,
      T0.OcrCode AS DistributionRule,
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
      CHP.ChapterID AS HSNCode,
      T0.DocEntry AS BaseEntry,
      T0.LineNum AS BaseLine,
      17 AS BaseType,
      ${lineField('U_SPLRBT', 'SpecialRebate')},
      ${lineField('U_COMPRC', 'Commission')},
      ${lineField('U_S_BrokPerQty', 'SellerBrokeragePerQty')},
      ${lineField('U_Unit_Price', 'UnitPriceUdf', 'COALESCE(T0.PriceBefDi, T0.Price)')},
      ${lineField('U_Brok_Seller', 'SellerBrokerage')},
      ${lineField('U_Brok_Buyer', 'BuyerBrokerage')},
      ${lineField('U_Buyer_Delivery', 'BuyerDelivery')},
      ${lineField('U_Seller_Delivery', 'SellerDelivery')},
      ${lineField('U_Buyer_Payment_Terms', 'BuyerPaymentTerms')},
      ${lineField('U_Buyer_Quality', 'BuyerQuality')},
      ${lineField('U_Seller_Quality', 'SellerQuality')},
      ${lineField('U_Buyer_Price', 'BuyerPrice')},
      ${lineField('U_Seller_Price', 'SellerPrice')},
      ${lineField('U_Buyer_SPINS', 'BuyerSpecialInstruction')},
      ${lineField('U_Seller_SPINS', 'SellerSpecialInstruction')},
      ${lineField('U_Buyer_SPINS', 'QtySpecialInstruction')},
      ${lineField('U_Seller_SPINS', 'DeliverySpecialInstruction')},
      ${lineField('U_Sel_Brok_AP', 'SellerBrokerageAmtPer')},
      ${lineField('U_Seller_Brok_Per', 'SellerBrokeragePercent')},
      ${lineField('U_Buyer_Bill_Disc', 'BuyerBillDiscount')},
      ${lineField('U_Seller_Bill_Disc', 'SellerBillDiscount')},
      ${lineField('U_SELLTCODE', 'STCODE', 'T0.TaxCode')},
      ${lineField('U_S_Item', 'SellerItem')},
      ${lineField('U_S_Qty', 'SellerQty')},
      ${lineField('U_Freight_pur', 'FreightPurchase')},
      ${lineField('U_Freight_sales', 'FreightSales')},
      ${lineField('U_Fr_trans', 'FreightProvider')},
      ${lineField('U_Fr_trans_name', 'FreightProviderName')},
      ${lineField('U_BDNum', 'BrokerageNumber')}
    FROM RDR1 T0
    LEFT JOIN OITM ITM ON T0.ItemCode = ITM.ItemCode
    LEFT JOIN OCHP CHP ON ITM.ChapterID = CHP.AbsEntry
    WHERE T0.DocEntry = @DocEntry
      AND T0.LineStatus = 'O'
      AND T0.OpenQty > 0
    ORDER BY T0.LineNum
  `, { DocEntry: docEntry });

  const header = headerResult.recordset?.[0] || {};
  const resolvedDocEntry = header.DocEntry || docEntry;
  const [metadataHeaderUdfs, metadataLineUdfsByLineNum, physicalHeaderUdfs, physicalLineUdfsByLineNum] = await Promise.all([
    getHeaderUdfValues({ tableId: 'ORDR', keyValue: resolvedDocEntry }),
    getLineUdfValues({ tableId: 'RDR1', keyValue: resolvedDocEntry }),
    getPhysicalUdfValues({ tableName: 'ORDR', keyValue: resolvedDocEntry }),
    getPhysicalUdfValues({ tableName: 'RDR1', keyValue: resolvedDocEntry, includeLineNum: true }),
  ]);
  const headerUdfs = {
    ...metadataHeaderUdfs,
    ...physicalHeaderUdfs,
  };
  const batchRows = await safe(db.query(`
    SELECT BaseLineNum, BatchNum, Quantity
    FROM   IBT1
    WHERE  BaseEntry = @DocEntry
      AND  BaseType = 17
    ORDER  BY BaseLineNum, BatchNum
  `, { DocEntry: resolvedDocEntry }));
  const batchesByLine = {};
  batchRows.forEach((batch) => {
    if (!batchesByLine[batch.BaseLineNum]) {
      batchesByLine[batch.BaseLineNum] = [];
    }
    batchesByLine[batch.BaseLineNum].push({
      batchNumber: batch.BatchNum || '',
      quantity: String(batch.Quantity || 0),
    });
  });
  const documentLines = (linesResult.recordset || []).map((line) => ({
    ...line,
    batches: batchesByLine[line.LineNum] || [],
    udf: {
      ...(metadataLineUdfsByLineNum[line.LineNum] || {}),
      ...(physicalLineUdfsByLineNum[line.LineNum] || {}),
    },
  }));

  return {
    ...header,
    header_udfs: headerUdfs,
    headerUdfs,
    DocumentLines: documentLines,
  };
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  searchCustomers,
  getItemDetails,
  getSalesOrderLineFieldMetadata,
  resolveSalesOrderLineUomEntry,
  getTaxCodeDiagnostics,
  getLookupValues,
  createLookupValue,
  getSalesOrderList,
  getSalesOrderFilterOptions,
  getSalesOrder,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getItemsForModal,
  getFreightCharges,
  getSalesOrderPrintLayouts,
  getOpenSalesOrders,
  getSalesOrderForCopy,
};
