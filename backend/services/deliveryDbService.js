/**
 * Delivery DB Service - ODBC/Direct SQL for GET operations
 * Reads data directly from SAP B1 SQL Server database
 */
const db = require('./dbService');
const masterDataDbService = require('./masterDataDbService');
const salesOrderDb = require('./salesOrderDbService');
const { buildMarketingDocumentListFilterQuery } = require('./documentListUtils');
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

const quoteSqlIdentifier = (identifier) => `[${String(identifier || '').replace(/]/g, ']]')}]`;
const normalizeUdfNameForMatch = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const unique = (values = []) => [...new Set(values.filter(Boolean))];

const toFiniteNumberOrUndefined = (value) => {
  if (value == null || String(value).trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getLineDiscountPercent = (discountAmount, unitPrice, fallbackDiscountPercent) => {
  const discount = toFiniteNumberOrUndefined(discountAmount);
  const price = toFiniteNumberOrUndefined(unitPrice);
  if (discount !== undefined && price !== undefined && price > 0) {
    return (discount * 100) / price;
  }

  return toFiniteNumberOrUndefined(fallbackDiscountPercent);
};

const buildNullableTrimmedTextExpression = (expression) => (
  `NULLIF(LTRIM(RTRIM(CAST(${expression} AS NVARCHAR(254)))), '')`
);

const resolveColumnName = (fieldMetadata = {}, candidateColumnName) => {
  const normalizedCandidate = normalizeUdfNameForMatch(candidateColumnName);
  return Object.keys(fieldMetadata).find(
    (columnName) => normalizeUdfNameForMatch(columnName) === normalizedCandidate
  );
};

const hasTableField = (metadata, columnName) => {
  const normalizedColumnName = String(columnName || '').trim().toLowerCase();
  if (!metadata || !normalizedColumnName) return false;
  return Object.keys(metadata).some((fieldName) => fieldName.toLowerCase() === normalizedColumnName);
};

const buildDeliverySellerExpression = (columnNames, fallbackExpression) => {
  const udfExpressions = unique(columnNames).map((columnName) => (
    buildNullableTrimmedTextExpression(`T0.${quoteSqlIdentifier(columnName)}`)
  ));

  return `
  COALESCE(
    ${[...udfExpressions, fallbackExpression, "''"].join(',\n    ')}
  )
`;
};

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
         CountryOrg  AS ItemCountryOrg,
         SACEntry    AS SACEntry,
         VatGourpSa  AS TaxCodeAR,
         ''          AS DistributionRule,
         DfltWH      AS DefaultWarehouse,
         SWW         AS HSNCode,
         InvntItem   AS InventoryItem,
         ManBtchNum  AS BatchManaged,
         ManSerNum   AS SerialManaged
  FROM   OITM
  WHERE  SellItem = 'Y'
    AND  validFor  <> 'N'
  ORDER  BY ItemCode
`));

const getWarehouses = () => safe(db.query(`
  SELECT WhsCode, WhsName, Street, Block,
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

const getDistributionRules = () => safe(db.query(`
  SELECT TOP 200 OcrCode AS FactorCode, OcrName AS FactorDescription
  FROM   OOCR
  WHERE  Active <> 'N'
  ORDER  BY OcrCode
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

const resolveDeliveryLineUomEntry = async (itemCode, uomValue) =>
  salesOrderDb.resolveSalesOrderLineUomEntry(itemCode, uomValue);

const tableFieldMetadataPromises = new Map();

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

const getDeliveryLineFieldMetadata = () => getTableFieldMetadata('DLN1');

const getDeliverySellerExpressions = async () => {
  try {
    const [fieldMetadata, udfDefinitions] = await Promise.all([
      getTableFieldMetadata('ODLN'),
      getUdfDefinitions('ODLN'),
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

    return {
      codeExpression: buildDeliverySellerExpression(
        codeColumns,
        `CASE
      WHEN T0.SlpCode IS NOT NULL AND T0.SlpCode <> -1 THEN CAST(T0.SlpCode AS NVARCHAR(50))
      ELSE ''
    END`
      ),
      nameExpression: buildDeliverySellerExpression(
        nameColumns,
        `CASE
      WHEN T0.SlpCode IS NOT NULL AND T0.SlpCode <> -1 THEN NULLIF(LTRIM(RTRIM(SLP.SlpName)), '')
      ELSE ''
    END`
      ),
    };
  } catch (error) {
    console.warn('[Delivery List] Falling back to sales employee seller fields:', error.message);
    return {
      codeExpression: `CASE
      WHEN T0.SlpCode IS NOT NULL AND T0.SlpCode <> -1 THEN CAST(T0.SlpCode AS NVARCHAR(50))
      ELSE ''
    END`,
      nameExpression: `CASE
      WHEN T0.SlpCode IS NOT NULL AND T0.SlpCode <> -1 THEN NULLIF(LTRIM(RTRIM(SLP.SlpName)), '')
      ELSE ''
    END`,
    };
  }
};

const LOOKUP_UDF_CONFIG = {
  U_Buyer_Quality: {
    tableId: 'DLN1',
    aliasId: 'Buyer_Quality',
    columnName: 'U_Buyer_Quality',
  },
  U_Seller_Quality: {
    tableId: 'DLN1',
    aliasId: 'Seller_Quality',
    columnName: 'U_Seller_Quality',
  },
  U_Buyer_Price: {
    tableId: 'DLN1',
    aliasId: 'Buyer_Price',
    columnName: 'U_Buyer_Price',
  },
  U_Seller_Price: {
    tableId: 'DLN1',
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
    FROM DLN1
    WHERE NULLIF(LTRIM(RTRIM(CAST(${columnName} AS NVARCHAR(254)))), '') IS NOT NULL
    ORDER BY Value
  `));
};

const getLookupValues = async (aliasId) => {
  const normalizedAlias = normalizeLookupAlias(aliasId);
  const config = LOOKUP_UDF_CONFIG[normalizedAlias];
  if (!config) return [];

  const validValues = await getUdfValidValues(config.tableId, normalizedAlias);
  if (validValues.length > 0) {
    return mapLookupRows(validValues);
  }

  const [existingValues, salesOrderValues] = await Promise.all([
    getExistingLookupValues(normalizedAlias),
    salesOrderDb.getLookupValues(normalizedAlias).catch(() => []),
  ]);

  return mapLookupRows([...existingValues, ...salesOrderValues]);
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

const getDecimalSettings = () => safe(db.query(`
  SELECT TOP 1
    DecSep, ThousSep, DateSep, DateFormat,
    PriceDP AS PriceDec,
    QuantityDP AS QtyDec,
    RateDP AS RateDec,
    PercentDP AS PercentDec,
    MeasurDP AS MeasurDec,
    SumDP AS SumDec
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

// ── SALES ORDERS (FOR COPY FROM) ──────────────────────────────────────────────

const getOpenSalesOrders = async (customerCode = null) => {
  
  // =========================
  // STEP 1: Check header only
  // =========================
  const headerQuery = `
    SELECT 
      DocEntry, DocNum, CardCode, DocStatus, CANCELED
    FROM ORDR
    WHERE 
      DocStatus = 'O'
      AND CANCELED = 'N'
      ${customerCode ? "AND CardCode = @customerCode" : ""}
  `;

  const headerData = await db.query(headerQuery, customerCode ? { customerCode } : {});
 
  // =========================
  // STEP 2: Check line open qty
  // =========================
  const lineQuery = `
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T1.LineNum,
      T1.OpenQty,
      T1.Quantity,
      T1.LineStatus
    FROM ORDR T0
    INNER JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry
    WHERE 
      T0.DocStatus = 'O'
      AND T0.CANCELED = 'N'
      ${customerCode ? "AND T0.CardCode = @customerCode" : ""}
  `;

  const lineData = await db.query(lineQuery, customerCode ? { customerCode } : {});
  
  // =========================
  // STEP 3: Check OPEN QTY only
  // =========================
  const openLineQuery = `
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T1.LineNum,
      T1.OpenQty
    FROM ORDR T0
    INNER JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry
    WHERE 
      T0.DocStatus = 'O'
      AND T0.CANCELED = 'N'
      ${customerCode ? "AND T0.CardCode = @customerCode" : ""}
      AND T1.OpenQty > 0
  `;

  const openLines = await db.query(openLineQuery, customerCode ? { customerCode } : {});
  
  // =========================
  // FINAL QUERY
  // =========================
  const finalQuery = `
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T0.CardCode,
      T0.CardName,
      T0.DocDate,
      T0.DocDueDate,
      T0.Comments,
      T0.DocTotal

    FROM ORDR T0

    WHERE 
      T0.DocStatus = 'O'
      AND T0.CANCELED = 'N'
      ${customerCode ? "AND T0.CardCode = @customerCode" : ""}

      AND EXISTS (
        SELECT 1
        FROM RDR1 T1
        WHERE 
          T1.DocEntry = T0.DocEntry
          AND T1.OpenQty > 0
      )

    ORDER BY 
      T0.DocDate DESC,
      T0.DocNum DESC
  `;

  const result = await db.query(finalQuery, customerCode ? { customerCode } : {});

  return { orders: result.recordset };
};
const getSalesOrderForCopy = async (docEntry) => salesOrderDb.getSalesOrderForCopy(docEntry);

const getDeliveryForCopy = async (docEntry) => {
  const headerFieldMetadata = await getTableFieldMetadata('ODLN');
  const branchAssignedExpression = hasTableField(headerFieldMetadata, 'BPL_IDAssignedToInvoice')
    ? 'T0.BPL_IDAssignedToInvoice'
    : 'T0.BPLId';

  const h = await db.query(`
    SELECT T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate, T0.TaxDate,
      T0.CardCode, T0.CardName, T0.CntctCode, T0.NumAtCard, T0.Comments,
      T0.BPLId, ${branchAssignedExpression} AS BPL_IDAssignedToInvoice, T0.GroupNum, T0.SlpCode,
      T0.DiscPrcnt, T0.TotalExpns AS Freight
    FROM ODLN T0 WHERE T0.DocEntry = @DocEntry
  `, { DocEntry: docEntry });
  const l = await db.query(`
    SELECT T0.LineNum, T0.ItemCode, T0.Dscription AS ItemDescription,
      T0.OpenQty AS Quantity, COALESCE(T0.PriceBefDi, T0.Price) AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent, T0.WhsCode AS WarehouseCode,
      T0.TaxCode, T0.unitMsr AS UomCode,
      CASE
        WHEN ISNULL(T0.Quantity, 0) = 0 THEN ISNULL(T0.LineTotal, 0)
        ELSE ISNULL(T0.LineTotal, 0) * ISNULL(T0.OpenQty, 0) / NULLIF(T0.Quantity, 0)
      END AS LineTotal,
      CASE
        WHEN ISNULL(T0.Quantity, 0) = 0 THEN ISNULL(T0.VatSum, 0)
        ELSE ISNULL(T0.VatSum, 0) * ISNULL(T0.OpenQty, 0) / NULLIF(T0.Quantity, 0)
      END AS TaxAmount,
      CHP.ChapterID AS HSNCode,
      T0.DocEntry AS BaseEntry, T0.LineNum AS BaseLine, 15 AS BaseType
    FROM DLN1 T0
    LEFT JOIN OITM ITM ON T0.ItemCode = ITM.ItemCode
    LEFT JOIN OCHP CHP ON ITM.ChapterID = CHP.AbsEntry
    WHERE T0.DocEntry = @DocEntry AND T0.LineStatus = 'O' AND T0.OpenQty > 0
    ORDER BY T0.LineNum
  `, { DocEntry: docEntry });
  return { ...(h.recordset?.[0] || {}), DocumentLines: l.recordset || [] };
};

// ── GET DELIVERY FOR COPY TO CREDIT MEMO ──────────────────────────────────────

const getDeliveryForCopyToCreditMemo = async (docEntry) => {
  // Get delivery header
  const headerRows = await safe(db.query(`
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T0.CardCode,
      T0.CardName,
      T0.CntctCode AS ContactPersonCode,
      T0.NumAtCard AS CustomerRefNo,
      T0.CreateDate AS DocumentCreated,
      T0.DocDate AS PostingDate,
      T0.DocDueDate AS DeliveryDate,
      T0.TaxDate AS DocumentDate,
      T0.BPLId AS Branch,
      T0.DocCur AS Currency,
      T0.GroupNum AS PaymentTerms,
      T0.ShipToCode,
      T0.PayToCode,
      T0.Address,
      T0.Address2,
      T0.TrnspCode AS ShippingType,
      T0.Confirmed,
      T0.SlpCode AS SalesEmployeeCode,
      SLP.SlpName AS SalesEmployeeName,
      T0.Comments AS Remarks,
      T0.JrnlMemo AS JournalRemark,
      T0.DiscPrcnt AS DiscountPercent,
      T0.TotalExpns AS Freight,
      T0.VatSum AS Tax,
      T0.DocTotal AS TotalPaymentDue
    FROM ODLN T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    WHERE T0.DocEntry = @docEntry
      AND T0.DocStatus = 'O'
  `, { docEntry }));

  if (!headerRows.length) {
    throw new Error(`Delivery ${docEntry} not found or already closed`);
  }

  const header = headerRows[0];

  // Get lines with open quantity (not fully copied)
  const lineRows = await safe(db.query(`
    SELECT 
      T0.LineNum,
      T0.ItemCode,
      T0.Dscription AS ItemDescription,
      T0.Quantity,
      T0.OpenQty,
      COALESCE(T0.PriceBefDi, T0.Price) AS UnitPrice,
      T0.DiscPrcnt AS DiscountPercent,
      T0.TaxCode,
      CASE
        WHEN ISNULL(T0.Quantity, 0) = 0 THEN ISNULL(T0.LineTotal, 0)
        ELSE ISNULL(T0.LineTotal, 0) * ISNULL(T0.OpenQty, 0) / NULLIF(T0.Quantity, 0)
      END AS LineTotal,
      CASE
        WHEN ISNULL(T0.Quantity, 0) = 0 THEN ISNULL(T0.VatSum, 0)
        ELSE ISNULL(T0.VatSum, 0) * ISNULL(T0.OpenQty, 0) / NULLIF(T0.Quantity, 0)
      END AS TaxAmount,
      T0.WhsCode AS Warehouse,
      T0.unitMsr AS UoMCode
    FROM DLN1 T0
    WHERE T0.DocEntry = @docEntry
      AND T0.LineStatus = 'O'
      AND T0.OpenQty > 0
    ORDER BY T0.LineNum
  `, { docEntry }));

  if (!lineRows.length) {
    throw new Error('No rows available for copying. All lines are fully copied or closed.');
  }

  // Get HSN codes and batch info for items
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
      // Could not fetch item info
    }
  }

  return {
    header: {
      customer: header.CardCode,
      name: header.CardName,
      contactPerson: header.ContactPersonCode ? String(header.ContactPersonCode) : '',
      salesContractNo: header.CustomerRefNo || '',
      branch: header.Branch ? String(header.Branch) : '',
      paymentTerms: header.PaymentTerms ? String(header.PaymentTerms) : '',
      otherInstruction: header.Remarks || '',
      baseRef: header.DocNum ? String(header.DocNum) : '', // Reference to delivery doc number
    },
    lines: lineRows.map(l => {
      const itemInfo = itemInfoMap[l.ItemCode] || { hsnCode: '', batchManaged: false };
      return {
        baseEntry: docEntry,
        baseType: 15, // Delivery
        baseLine: l.LineNum,
        itemNo: l.ItemCode || '',
        itemDescription: l.ItemDescription || '',
        hsnCode: itemInfo.hsnCode,
        quantity: l.OpenQty != null ? String(l.OpenQty) : '', // Use OpenQty for credit memo
        openQty: l.OpenQty != null ? String(l.OpenQty) : '',
        unitPrice: l.UnitPrice != null ? String(l.UnitPrice) : '',
        stdDiscount: l.DiscountPercent != null ? String(l.DiscountPercent) : '',
        taxCode: l.TaxCode || '',
        taxAmount: l.TaxAmount != null ? String(l.TaxAmount) : '',
        total: l.LineTotal != null ? String(l.LineTotal) : '',
        whse: l.Warehouse || '',
        uomCode: l.UoMCode || '',
        batchManaged: itemInfo.batchManaged,
        batches: [],
        udf: {},
      };
    }),
  };
};

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

// ── DELIVERY LIST ─────────────────────────────────────────────────────────────

const getDeliveryList = async ({
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
  const {
    codeExpression: sellerCodeExpression,
    nameExpression: sellerNameExpression,
  } = await getDeliverySellerExpressions();
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
  }, {
    includeSellerFields: true,
    sellerCodeField: sellerCodeExpression,
    sellerNameField: sellerNameExpression,
  });

  const countRows = await safe(db.query(`
    SELECT COUNT(*) AS total_count
    FROM ODLN T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    WHERE ${whereClauses.join('\n      AND ')}
  `, params));

  const totalCount = Number(countRows?.[0]?.total_count || 0);

  const result = await safe(db.query(`
    SELECT
      T0.DocEntry AS doc_entry,
      T0.DocNum AS doc_num,
      T0.CardCode AS customer_code,
      T0.CardName AS customer_name,
      ${sellerCodeExpression} AS seller_code,
      ${sellerNameExpression} AS seller_name,
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
        FROM DLN1 T1
        WHERE T1.DocEntry = T0.DocEntry
      ) AS line_count
    FROM ODLN T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    WHERE ${whereClauses.join('\n      AND ')}
    ORDER BY T0.DocEntry DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize }));

  return {
    deliveries: result.map((row) => ({
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

// ── GET SINGLE DELIVERY ───────────────────────────────────────────────────────

const resolveDeliveryDocEntry = async (identifier) => {
  const normalizedIdentifier = Number(identifier);
  if (!Number.isFinite(normalizedIdentifier)) {
    throw new Error(`Invalid Delivery identifier: ${identifier}`);
  }

  const rows = await safe(db.query(`
    SELECT TOP 1 DocEntry, DocNum
    FROM ODLN
    WHERE DocEntry = @DocEntry
       OR DocNum = @DocNum
    ORDER BY CASE WHEN DocEntry = @DocEntry THEN 0 ELSE 1 END, DocEntry
  `, {
    DocEntry: normalizedIdentifier,
    DocNum: normalizedIdentifier,
  }));

  return rows[0] || null;
};

const getDelivery = async (docEntry) => {
  const resolvedDocument = await resolveDeliveryDocEntry(docEntry);
  if (!resolvedDocument) {
    throw new Error(`Delivery ${docEntry} not found`);
  }

  const resolvedDocEntry = resolvedDocument.DocEntry;
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
      T0.CreateDate AS DocumentCreated,
      T0.DocDate AS PostingDate,
      T0.DocDueDate AS DeliveryDate,
      T0.TaxDate AS DocumentDate,
      T0.BPLId AS Branch,
      T0.DocCur AS Currency,
      T0.GroupNum AS PaymentTerms,
      T0.SlpCode AS SalesEmployeeCode,
      SLP.SlpName AS SalesEmployeeName,
      T0.Comments AS Remarks,
      T0.JrnlMemo AS JournalRemark,
      T0.DiscPrcnt AS DiscountPercent,
      T0.TotalExpns AS Freight,
      T0.VatSum AS Tax,
      T0.RoundDif AS RoundingAmount,
      T0.DocTotal AS TotalPaymentDue,
      CASE T0.DocStatus
        WHEN 'O' THEN 'Open'
        WHEN 'C' THEN 'Closed'
        ELSE T0.DocStatus
      END AS DocumentStatus
    FROM ODLN T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    LEFT JOIN NNM1 NNM ON NNM.ObjectCode = '15' AND NNM.Series = T0.Series
    WHERE T0.DocEntry = @docEntry
  `, { docEntry: resolvedDocEntry }));

  if (!headerRows.length) {
    throw new Error(`Delivery ${docEntry} not found`);
  }

  const header = headerRows[0];

  const dln1FieldMetadata = await getDeliveryLineFieldMetadata();
  const hasDln1Column = (columnName) => Boolean(dln1FieldMetadata[String(columnName || '').trim()]);

  const optionalLineSelects = [
    hasDln1Column('OpenQty') ? 'T0.OpenQty AS OpenQuantity' : 'CAST(NULL AS DECIMAL(19, 6)) AS OpenQuantity',
    hasDln1Column('TaxCode') ? 'T0.TaxCode' : "'' AS TaxCode",
    hasDln1Column('VatSum') ? 'ISNULL(T0.VatSum, 0) AS LineTaxAmount' : 'CAST(0 AS DECIMAL(19, 6)) AS LineTaxAmount',
    hasDln1Column('NumPerMsr') ? 'T0.NumPerMsr AS UomFactor' : 'CAST(1 AS DECIMAL(19, 6)) AS UomFactor',
    hasDln1Column('UomEntry') ? 'T0.UomEntry AS UoMEntry' : 'NULL AS UoMEntry',
    hasDln1Column('unitMsr') ? "COALESCE(UOM.UomCode, NULLIF(LTRIM(RTRIM(T0.unitMsr)), ''), '') AS UoMCode" : "COALESCE(UOM.UomCode, '') AS UoMCode",
    hasDln1Column('OcrCode') ? 'T0.OcrCode AS DistributionRule' : "'' AS DistributionRule",
    hasDln1Column('FreeTxt') ? 'T0.FreeTxt AS [FreeText]' : "'' AS [FreeText]",
    hasDln1Column('CountryOrg') ? 'T0.CountryOrg AS CountryOfOrigin' : "'' AS CountryOfOrigin",
    hasDln1Column('BaseEntry') ? 'T0.BaseEntry' : 'NULL AS BaseEntry',
    hasDln1Column('BaseType') ? 'T0.BaseType' : 'NULL AS BaseType',
    hasDln1Column('BaseLine') ? 'T0.BaseLine' : 'NULL AS BaseLine',
    hasDln1Column('U_Rate') ? 'T0.U_Rate AS DiscountAmount' : 'CAST(NULL AS DECIMAL(19, 6)) AS DiscountAmount',
  ];

  let lineRows = [];
  try {
    const lineQuery = `
      SELECT
        T0.LineNum,
        T0.ItemCode,
        T0.Dscription AS ItemDescription,
        T0.Quantity,
        COALESCE(T0.PriceBefDi, T0.Price) AS UnitPrice,
        T0.DiscPrcnt AS DiscountPercent,
        T0.LineTotal,
        T0.WhsCode AS Warehouse,
        ${optionalLineSelects.join(',\n        ')},
        CHP.ChapterID AS HSNCode,
        ITM.ManBtchNum AS BatchManaged,
        '' AS Branch,
        '' AS Loc
      FROM DLN1 T0
      LEFT JOIN OITM ITM ON ITM.ItemCode = T0.ItemCode
      LEFT JOIN OCHP CHP ON CHP.AbsEntry = ITM.ChapterID
      LEFT JOIN OUOM UOM ON UOM.UomEntry = T0.UomEntry
      WHERE T0.DocEntry = @docEntry
      ORDER BY T0.LineNum
    `;

    const result = await db.query(lineQuery, { docEntry: resolvedDocEntry });
    lineRows = result.recordset || [];
  } catch (err) {
    console.error(`[DB] getDelivery line query failed for requested identifier ${docEntry} resolved DocEntry ${resolvedDocEntry}:`, err?.message || err);

    lineRows = await safe(db.query(`
      SELECT
        T0.LineNum,
        T0.ItemCode,
        T0.Dscription AS ItemDescription,
        T0.Quantity,
        T0.OpenQty AS OpenQuantity,
        COALESCE(T0.PriceBefDi, T0.Price) AS UnitPrice,
        T0.DiscPrcnt AS DiscountPercent,
        T0.LineTotal,
        T0.WhsCode AS Warehouse,
        T0.NumPerMsr AS UomFactor,
        T0.UomEntry AS UoMEntry,
        COALESCE(UOM.UomCode, NULLIF(LTRIM(RTRIM(T0.unitMsr)), ''), '') AS UoMCode,
        CAST(NULL AS DECIMAL(19, 6)) AS DiscountAmount,
        '' AS TaxCode,
        CAST(0 AS DECIMAL(19, 6)) AS LineTaxAmount,
        '' AS DistributionRule,
        '' AS [FreeText],
        '' AS CountryOfOrigin,
        CHP.ChapterID AS HSNCode,
        ITM.ManBtchNum AS BatchManaged,
        NULL AS BaseEntry,
        NULL AS BaseType,
        NULL AS BaseLine,
        '' AS Branch,
        '' AS Loc
      FROM DLN1 T0
      LEFT JOIN OITM ITM ON ITM.ItemCode = T0.ItemCode
      LEFT JOIN OCHP CHP ON CHP.AbsEntry = ITM.ChapterID
      LEFT JOIN OUOM UOM ON UOM.UomEntry = T0.UomEntry
      WHERE T0.DocEntry = @docEntry
      ORDER BY T0.LineNum
    `, { docEntry: resolvedDocEntry }));
  }

  console.log(`[DB] getDelivery - requested identifier: ${docEntry}, resolved DocEntry: ${resolvedDocEntry}, Line rows found: ${lineRows.length}`);
  if (lineRows.length > 0) {
    console.log('[DB] getDelivery - First line:', lineRows[0]);
  } else {
    console.warn(`[DB] getDelivery - No lines found for requested identifier ${docEntry} resolved DocEntry ${resolvedDocEntry}`);
  }

  const itemCodes = lineRows.map(l => l.ItemCode).filter(Boolean);
  let itemInfoMap = {};
  
  if (itemCodes.length > 0) {
    try {
      const itemRows = await safe(db.query(`
        SELECT T0.ItemCode, CHP.ChapterID AS HSNCode, T0.ManBtchNum AS BatchManaged
        FROM OITM T0
        LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
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
      // Could not fetch item info
    }
  }

  let [headerUdfs, dynamicLineUdfs] = await Promise.all([
    getHeaderUdfValues({ tableId: 'ODLN', keyValue: resolvedDocEntry }),
    getLineUdfValues({ tableId: 'DLN1', keyValue: resolvedDocEntry }),
  ]);

  let lineUdfs = {};
  try {
    const deliveryLineUdfColumns = [
      'U_SPLRBT',
      'U_COMPRC',
      'U_S_BrokPerQty',
      'U_Unit_Price',
      'U_Brok_Seller',
      'U_Brok_Buyer',
      'U_Buyer_Delivery',
      'U_Seller_Delivery',
      'U_Buyer_Payment_Terms',
      'U_Seller_Payment_Terms',
      'U_Buyer_Quality',
      'U_Seller_Quality',
      'U_Buyer_Price',
      'U_Seller_Price',
      'U_Buyer_SPINS',
      'U_Seller_SPINS',
      'U_Sel_Brok_AP',
      'U_Seller_Brok_Per',
      'U_Buyer_Bill_Disc',
      'U_Seller_Bill_Disc',
      'U_SELLTCODE',
      'U_S_Item',
      'U_S_Qty',
      'U_Freight_pur',
      'U_Freight_sales',
      'U_Fr_trans',
      'U_Fr_trans_name',
      'U_BDNum',
    ].filter(hasDln1Column);

    const udfLineRows = deliveryLineUdfColumns.length
      ? await db.query(`
        SELECT
          LineNum,
          ${deliveryLineUdfColumns.map(quoteSqlIdentifier).join(',\n          ')}
        FROM DLN1
        WHERE DocEntry = @docEntry
      `, { docEntry: resolvedDocEntry })
      : { recordset: [] };

    if (udfLineRows.recordset) {
      udfLineRows.recordset.forEach((row) => {
        lineUdfs[row.LineNum] = row;
      });
    }
  } catch (err) {
    lineUdfs = {};
  }

  // Fetch batch allocations for this delivery
  const batchRows = await safe(db.query(`
    SELECT BaseLinNum AS BaseLineNum, BatchNum, Quantity
    FROM   IBT1
    WHERE  BaseEntry = @docEntry
      AND  BaseType = 15
    ORDER  BY BaseLineNum, BatchNum
  `, { docEntry: resolvedDocEntry }));

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
    delivery: {
      doc_entry: header.DocEntry,
      doc_num: header.DocNum,
      header: {
        customer: header.CardCode,
        customerCode: header.CardCode, // Add alias for consistency
        name: header.CardName,
        customerName: header.CardName, // Add alias for consistency
        contactPerson: header.ContactPersonCode ? String(header.ContactPersonCode) : '',
        salesContractNo: header.CustomerRefNo || '',
        branch: header.Branch ? String(header.Branch) : '',
        warehouse: lineRows.length > 0 && lineRows[0].Warehouse ? String(lineRows[0].Warehouse) : '', // Get warehouse from first line (empty if no lines)
        docNo: header.DocNum ? String(header.DocNum) : '',
        status: header.DocumentStatus || 'Open',
        series: header.Series ? String(header.Series) : '',
        seriesName: header.SeriesName || '',
        seriesIndicator: header.SeriesIndicator || '',
        shipToCode: header.ShipToCode || '',
        payToCode: header.PayToCode || '',
        shipTo: header.Address || '',
        payTo: header.Address2 || '',
        postingDate: header.PostingDate ? header.PostingDate.toISOString().split('T')[0] : '',
        deliveryDate: header.DeliveryDate ? header.DeliveryDate.toISOString().split('T')[0] : '',
        documentDate: header.DocumentDate ? header.DocumentDate.toISOString().split('T')[0] : '',
        documentCreated: header.DocumentCreated ? header.DocumentCreated.toISOString().split('T')[0] : '',
        journalRemark: header.JournalRemark || '',
        paymentTerms: header.PaymentTerms ? String(header.PaymentTerms) : '',
        paymentTermsCode: header.PaymentTerms ? String(header.PaymentTerms) : '', // Add alias
        shippingType: header.ShippingType ? String(header.ShippingType) : '',
        confirmed: String(header.Confirmed || '').toUpperCase() === 'Y',
        salesEmployee: header.SalesEmployeeCode != null ? String(header.SalesEmployeeCode) : '',
        purchaser: header.SalesEmployeeName || '',
        otherInstruction: header.Remarks || '',
        discount: header.DiscountPercent != null ? String(header.DiscountPercent) : '',
        freight: header.Freight != null ? String(header.Freight) : '',
        rounding: Math.abs(Number(header.RoundingAmount || 0)) > 0,
        roundingAmount: header.RoundingAmount != null ? String(header.RoundingAmount) : '',
        tax: header.Tax != null ? String(header.Tax) : '',
        totalPaymentDue: header.TotalPaymentDue != null ? String(header.TotalPaymentDue) : '',
      },
      lines: lineRows.map((l) => {
        const itemInfo = itemInfoMap[l.ItemCode] || { hsnCode: '', batchManaged: false };
        const lineUdf = {
          ...(dynamicLineUdfs[l.LineNum] || {}),
          ...(lineUdfs[l.LineNum] || {}),
        };
        const discountAmount = lineUdf.U_Rate ?? l.DiscountAmount;
        const discountPercent = getLineDiscountPercent(discountAmount, l.UnitPrice, l.DiscountPercent);
        return {
          lineNum: l.LineNum != null ? Number(l.LineNum) : undefined,
          baseEntry: l.BaseEntry || null,
          baseType: l.BaseType || null,
          baseLine: l.BaseLine || null,
          itemNo: l.ItemCode || '',
          itemDescription: l.ItemDescription || '',
          hsnCode: l.HSNCode || itemInfo.hsnCode || '',
          quantity: l.Quantity != null ? String(l.Quantity) : '',
          openQty: l.OpenQuantity != null ? String(l.OpenQuantity) : '',
          unitPrice: l.UnitPrice != null ? String(l.UnitPrice) : '',
          discountAmount: discountAmount != null && String(discountAmount).trim() !== '' ? String(discountAmount) : '',
          unitPriceUdf: lineUdf.U_Unit_Price != null && lineUdf.U_Unit_Price !== '' ? String(lineUdf.U_Unit_Price) : String(l.UnitPrice || 0),
          sellerQuality: lineUdf.U_Seller_Quality || '',
          buyerQuality: lineUdf.U_Buyer_Quality || '',
          sellerPrice: lineUdf.U_Seller_Price || l.SellerPrice || '',
          buyerPrice: lineUdf.U_Buyer_Price || l.BuyerPrice || '',
          sellerDelivery: lineUdf.U_Seller_Delivery || l.SellerDelivery || '',
          buyerDelivery: lineUdf.U_Buyer_Delivery || l.BuyerDelivery || '',
          sellerBrokerageAmtPer: lineUdf.U_Sel_Brok_AP || l.SellerBrokerageAmtPer || '',
          sellerBrokeragePercent: lineUdf.U_Seller_Brok_Per != null ? String(lineUdf.U_Seller_Brok_Per) : (l.SellerBrokeragePercent != null ? String(l.SellerBrokeragePercent) : ''),
          sellerBrokerage: lineUdf.U_Brok_Seller != null ? String(lineUdf.U_Brok_Seller) : (l.SellerBrokerage != null ? String(l.SellerBrokerage) : ''),
          buyerBrokerage: lineUdf.U_Brok_Buyer != null ? String(lineUdf.U_Brok_Buyer) : (l.BuyerBrokerage != null ? String(l.BuyerBrokerage) : ''),
          stcode: lineUdf.U_SELLTCODE || l.TaxCode || '',
          specialRebate: lineUdf.U_SPLRBT != null ? String(lineUdf.U_SPLRBT) : '',
          commission: lineUdf.U_COMPRC != null ? String(lineUdf.U_COMPRC) : '',
          sellerBrokeragePerQty: lineUdf.U_S_BrokPerQty != null ? String(lineUdf.U_S_BrokPerQty) : '',
          buyerPaymentTerms: lineUdf.U_Buyer_Payment_Terms || '',
          sellerPaymentTerms: lineUdf.U_Seller_Payment_Terms || '',
          buyerSpecialInstruction: lineUdf.U_Buyer_SPINS || '',
          sellerSpecialInstruction: lineUdf.U_Seller_SPINS || '',
          buyerBillDiscount: lineUdf.U_Buyer_Bill_Disc != null ? String(lineUdf.U_Buyer_Bill_Disc) : '',
          sellerBillDiscount: lineUdf.U_Seller_Bill_Disc != null ? String(lineUdf.U_Seller_Bill_Disc) : '',
          sellerItem: lineUdf.U_S_Item || '',
          sellerQty: lineUdf.U_S_Qty != null ? String(lineUdf.U_S_Qty) : (l.SellerQty != null ? String(l.SellerQty) : ''),
          freightPurchase: lineUdf.U_Freight_pur != null ? String(lineUdf.U_Freight_pur) : '',
          freightSales: lineUdf.U_Freight_sales != null ? String(lineUdf.U_Freight_sales) : '',
          freightProvider: lineUdf.U_Fr_trans || '',
          freightProviderName: lineUdf.U_Fr_trans_name || '',
          brokerageNumber: lineUdf.U_BDNum || '',
          stdDiscount: discountPercent != null ? String(discountPercent) : '',
          taxCode: l.TaxCode || '',
          taxAmount: l.LineTaxAmount != null ? String(l.LineTaxAmount) : '',
          total: l.LineTotal != null ? String(l.LineTotal) : '',
          whse: l.Warehouse || '',
          uomCode: l.UoMCode || '',
          uomEntry: l.UoMEntry != null ? Number(l.UoMEntry) : null,
          uomFactor: l.UomFactor != null && l.UomFactor !== '' ? Number(l.UomFactor) : 1,
          distRule: l.DistributionRule || '',
          freeText: l.FreeText || '',
          countryOfOrigin: l.CountryOfOrigin || '',
          deliveredQty: l.Quantity != null && l.OpenQuantity != null ? String(Number(l.Quantity || 0) - Number(l.OpenQuantity || 0)) : '',
          documentCreated: header.DocumentCreated ? header.DocumentCreated.toISOString().split('T')[0] : '',
          branch: l.Branch ? String(l.Branch) : '',
          loc: l.Loc ? String(l.Loc) : '',
          batchManaged: String(l.BatchManaged || '').toUpperCase() === 'Y' || itemInfo.batchManaged,
          batches: batchesByLine[l.LineNum] || [],
          udf: {
            U_SPLRBT: lineUdf.U_SPLRBT ?? '',
            U_COMPRC: lineUdf.U_COMPRC ?? '',
            U_S_BrokPerQty: lineUdf.U_S_BrokPerQty ?? '',
            U_Unit_Price: lineUdf.U_Unit_Price ?? '',
            U_Rate: lineUdf.U_Rate ?? discountAmount ?? '',
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
      header_udfs: headerUdfs,
    }
  };
};

const getSavedDeliveryQuantities = async (docEntry) => {
  const lineRows = await safe(db.query(`
    SELECT
      T0.LineNum,
      T0.ItemCode,
      T0.Dscription AS ItemDescription,
      T0.Quantity,
      T0.OpenQty,
      T0.unitMsr AS UoMCode,
      T0.WhsCode AS Warehouse
    FROM DLN1 T0
    WHERE T0.DocEntry = @docEntry
    ORDER BY T0.LineNum
  `, { docEntry }));

  const batchRows = await safe(db.query(`
    SELECT
      T0.BaseLinNum AS LineNum,
      SUM(T0.Quantity) AS BatchQuantity
    FROM IBT1 T0
    WHERE T0.BaseEntry = @docEntry
      AND T0.BaseType = 15
    GROUP BY T0.BaseLinNum
  `, { docEntry }));

  const batchQtyByLine = batchRows.reduce((acc, row) => {
    acc[row.LineNum] = Number(row.BatchQuantity || 0);
    return acc;
  }, {});

  return lineRows.map((row) => ({
    lineNum: Number(row.LineNum || 0),
    itemCode: row.ItemCode || '',
    itemDescription: row.ItemDescription || '',
    quantity: Number(row.Quantity || 0),
    openQty: Number(row.OpenQty || 0),
    uomCode: row.UoMCode || '',
    warehouse: row.Warehouse || '',
    batchQuantity: Number(batchQtyByLine[row.LineNum] || 0),
  }));
};

// ── DOCUMENT SERIES ───────────────────────────────────────────────────────────

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
WHERE T0.ObjectCode = '15'
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
        T0.NextNumber,
        NULL AS FinancialYear,
        NULL AS FromDate,
        NULL AS ToDate
      FROM NNM1 T0
      WHERE T0.ObjectCode = '15'
        AND T0.Locked = 'N'
      ORDER BY T0.SeriesName
    `));
  }

  return { series: result };
};

const getNextNumber = async (series) => {
  const result = await safe(db.query(`
    SELECT NextNumber
    FROM NNM1
    WHERE Series = @series
      AND ObjectCode = '15'
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
    customers,
    items,
    warehouses,
    paymentTerms,
    shippingTypes,
    salesEmployees,
    branches,
    distributionRules,
    states,
    taxCodes,
    uomGroupsRaw,
    decimalRows,
    companyRows,
    buyerQualityOptions,
    sellerQualityOptions,
    buyerPriceOptions,
    sellerPriceOptions,
    udfMetadata,
  ] = await Promise.all([
    getCustomers(),
    getItems(),
    getWarehouses(),
    getPaymentTerms(),
    getShippingTypes(),
    getSalesEmployees(),
    getBranches(),
    getDistributionRules(),
    getStates(),
    getTaxCodes(),
    getUomGroups(),
    getDecimalSettings(),
    getCompanyInfo(),
    getLookupValues('U_Buyer_Quality'),
    getLookupValues('U_Seller_Quality'),
    getLookupValues('U_Buyer_Price'),
    getLookupValues('U_Seller_Price'),
    getMarketingDocumentUdfs({ headerTable: 'ODLN', lineTable: 'DLN1' }),
  ]);

  const uomGroupMap = {};
  uomGroupsRaw.forEach(row => {
    if (!uomGroupMap[row.AbsEntry]) {
      uomGroupMap[row.AbsEntry] = {
        AbsEntry: row.AbsEntry,
        Name: row.Name,
        uomCodes: [],
        conversions: {} // UomCode -> { baseQty, altQty, factor }
      };
    }
    if (row.UomCode) {
      uomGroupMap[row.AbsEntry].uomCodes.push(row.UomCode);
      // Store conversion factor: factor = AltQty / BaseQty
      // Example: 1 BOX = 12 PCS means BaseQty=1, AltQty=12, factor=12
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
    distribution_rules: distributionRules.map(rule => ({
      FactorCode: rule.FactorCode || '',
      FactorDescription: rule.FactorDescription || '',
    })),
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
    uom_groups,
    quality_options: {
      buyer: buyerQualityOptions,
      seller: sellerQualityOptions,
    },
    price_options: {
      buyer: buyerPriceOptions,
      seller: sellerPriceOptions,
    },
    decimal_settings: decimalSettings,
    udf_metadata: udfMetadata,
    warnings: [],
  };
};

const getCustomerDetails = async (customerCode) => {
  if (!customerCode) {
    return {
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
      bill_to_addresses: [],
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
    bill_to_addresses: payToAddresses,
  };
};

// Get freight charges for modal
const getFreightCharges = (docEntry) => {
  if (!docEntry) {
    // 🆕 CREATE MODE (New Delivery)
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

  // ✏️ EDIT MODE (Existing Delivery)
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
    LEFT JOIN DLN3 T1 
      ON T0.ExpnsCode = T1.ExpnsCode 
     AND T1.DocEntry = @DocEntry

    ORDER BY T0.ExpnsName
  `, { DocEntry: docEntry }));
};

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
    T0.CountryOrg AS ItemCountryOrg,
    T0.SACEntry AS SACEntry,
    T0.VatGourpSa AS TaxCodeAR,
    '' AS DistributionRule,
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
  ${hasWarehouse ? 'LEFT JOIN OITW W ON W.ItemCode = T0.ItemCode AND W.WhsCode = @WhsCode' : ''}
  WHERE T0.SellItem = 'Y'
    AND T0.validFor <> 'N'
  ORDER BY T0.ItemCode
`, hasWarehouse ? { WhsCode: hasWarehouse } : {}));
};

// Get UoM conversion factor for an item
const getUomConversionFactor = async (itemCode, uomCode) => {
  // First, let's see what UoMs are available for this item
  const debugResult = await safe(db.query(`
    SELECT 
      T0.ItemCode,
      T0.InvntryUom AS InventoryUOM,
      T0.SUoMEntry AS UoMGroupEntry,
      T0.SalUnitMsr AS SalesUnit,
      T2.BaseQty,
      T2.AltQty,
      T3.UomCode,
      T3.UomName
    FROM OITM T0
    LEFT JOIN OUGP T1 ON T0.SUoMEntry = T1.UgpEntry
    LEFT JOIN UGP1 T2 ON T1.UgpEntry = T2.UgpEntry
    LEFT JOIN OUOM T3 ON T2.UomEntry = T3.UomEntry
    WHERE T0.ItemCode = @itemCode
  `, { itemCode }));
  
  console.log(`[DB] Available UoMs for item ${itemCode}:`, debugResult);
  
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
  
  console.log(`[DB] UoM conversion query result for ${itemCode} / ${uomCode}:`, result);

  if (result.length > 0) {
    const row = result[0];
    const baseQty = parseFloat(row.BaseQty || 1);
    const altQty = parseFloat(row.AltQty || 1);
    const factor = baseQty > 0 ? altQty / baseQty : 1;
    
    console.log(`[DB] Conversion calculation:`, {
      baseQty,
      altQty,
      factor,
      formula: `${altQty} / ${baseQty} = ${factor}`
    });
    
    return {
      inventoryUOM: row.InventoryUOM,
      uomCode: row.UomCode,
      baseQty,
      altQty,
      factor
    };
  }

  // If not found in UoM Group, check if the UoM code itself is numeric (e.g., "5.6")
  // This handles cases where the conversion factor is stored directly in the UoM code
  const numericFactor = parseFloat(uomCode);
  console.log(`[DB] Numeric UoM check:`, {
    uomCode,
    uomCodeType: typeof uomCode,
    uomCodeValue: JSON.stringify(uomCode),
    numericFactor,
    isNaN: isNaN(numericFactor),
    greaterThanZero: numericFactor > 0,
    willEnterBlock: !isNaN(numericFactor) && numericFactor > 0
  });
  
  if (!isNaN(numericFactor) && numericFactor > 0) {
    console.log(`[DB] ✅ UoM code "${uomCode}" is numeric, using as conversion factor: ${numericFactor}`);
    
    // Get inventory UOM from item
    const itemResult = await safe(db.query(`
      SELECT InvntryUom AS InventoryUOM
      FROM OITM
      WHERE ItemCode = @itemCode
    `, { itemCode }));
    
    const inventoryUOM = itemResult.length > 0 ? itemResult[0].InventoryUOM : '';
    
    console.log(`[DB] ✅ Returning numeric UoM conversion:`, {
      inventoryUOM,
      uomCode,
      baseQty: 1,
      altQty: numericFactor,
      factor: numericFactor
    });
    
    return {
      inventoryUOM,
      uomCode: uomCode,
      baseQty: 1,
      altQty: numericFactor,
      factor: numericFactor
    };
  }

  // If not found, return factor of 1 (no conversion)
  console.warn(`[DB] ⚠️ No UoM conversion found for ${itemCode} / ${uomCode}, returning default factor 1`);
  
  return {
    inventoryUOM: '',
    uomCode: uomCode,
    baseQty: 1,
    altQty: 1,
    factor: 1
  };
};

// ─── Validation Functions ───────────────────────────────────────────────────────

const BATCH_QTY_TOLERANCE = 0.001;
const SAP_YES_VALUES = new Set(['Y', 'YES', 'TRUE', 'TYES', '1']);

const parseBatchQtyNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const isSapYes = (value) => SAP_YES_VALUES.has(String(value || '').trim().toUpperCase());

const getLineUomFactor = (line = {}) => {
  const explicitFactor = parseBatchQtyNumber(line.uomFactor);
  if (explicitFactor > 0) return explicitFactor;

  const rawUomCode = String(line.uomCode || '').trim();
  const numericFactor = parseFloat(rawUomCode);
  if (Number.isFinite(numericFactor) && numericFactor > 0) {
    return numericFactor;
  }

  return 1;
};

const getRequiredBatchQty = (line = {}) =>
  parseBatchQtyNumber(line.quantity) * getLineUomFactor(line);

// Validate batch selection only for inventory items that are batch-managed in SAP B1.
const validateBatchSelection = async (lines) => {
  const errors = [];
  
  for (const line of lines) {
    if (!line.itemNo) continue;
    
    const result = await safe(db.query(`
      SELECT T0.InvntItem, T0.ManBtchNum, T0.ItemName
      FROM OITM T0
      WHERE T0.ItemCode = @ItemCode
    `, { ItemCode: line.itemNo }));
    
    const item = result[0];
    if (item && isSapYes(item.InvntItem) && isSapYes(item.ManBtchNum)) {
      if (!Array.isArray(line.batches) || line.batches.length === 0) {
        errors.push(`Batch selection is mandatory for batch-managed item ${line.itemNo}`);
      } else {
        const totalBatchQty = line.batches.reduce(
          (sum, batch) => sum + parseBatchQtyNumber(batch.quantity),
          0
        );
        const requiredBatchQty = getRequiredBatchQty(line);
        const inventoryUOM = String(line.inventoryUOM || line.uomCode || 'Base UoM').trim();
        
        if (Math.abs(totalBatchQty - requiredBatchQty) > BATCH_QTY_TOLERANCE) {
          errors.push(
            `Batch quantity must match base quantity for item ${line.itemNo}. Required: ${requiredBatchQty.toFixed(2)} ${inventoryUOM}, Allocated: ${totalBatchQty.toFixed(2)} ${inventoryUOM}`
          );
        }

        const allocatedByBatch = new Map();
        for (const batch of line.batches) {
          const batchNumber = String(batch.batchNumber || '').trim();
          const batchQty = parseBatchQtyNumber(batch.quantity);

          if (!batchNumber || batchQty <= 0) continue;

          allocatedByBatch.set(
            batchNumber,
            (allocatedByBatch.get(batchNumber) || 0) + batchQty
          );
        }

        for (const [batchNumber, allocatedQty] of allocatedByBatch.entries()) {
          const batchResult = await safe(db.query(`
            SELECT SUM(T0.Quantity) as AvailableQty
            FROM OIBT T0
            WHERE T0.ItemCode = @ItemCode
            AND T0.BatchNum = @BatchNum
            AND T0.WhsCode = @WhsCode
          `, {
            ItemCode: line.itemNo,
            BatchNum: batchNumber,
            WhsCode: line.whse
          }));
          
          const availableQty = parseBatchQtyNumber(batchResult[0]?.AvailableQty);

          if (availableQty <= 0) {
            errors.push(`Batch ${batchNumber} does not belong to warehouse ${line.whse} for item ${line.itemNo}`);
            continue;
          }

          if (allocatedQty - availableQty > BATCH_QTY_TOLERANCE) {
            errors.push(
              `Batch ${batchNumber} exceeds available quantity for item ${line.itemNo}. Allocated: ${allocatedQty.toFixed(2)} ${inventoryUOM}, Available: ${availableQty.toFixed(2)} ${inventoryUOM}`
            );
          }
        }
      }
    }
  }
  
  return { errors, isValid: errors.length === 0 };
};

// Validate tax codes
const validateTaxCodes = (lines) => {
  const errors = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.itemNo) continue;
    
    if (!line.taxCode || line.taxCode === 'Select' || line.taxCode === '') {
      errors.push(`Please select a valid Tax Code for line ${i + 1}`);
    }
  }
  
  return { errors, isValid: errors.length === 0 };
};

// Validate stock availability only for inventory-managed items. SAP B1 allows
// non-inventory sales items on delivery documents without stock or warehouse stock checks.
const validateStockAvailability = (lines) => {
  const errors = [];
  const promises = [];
  
  for (const line of lines) {
    if (!line.itemNo || !line.whse) continue;
    
    const promise = safe(db.query(`
      SELECT 
        T1.InvntItem AS InventoryItem,
        T0.WhsCode AS WarehouseCode,
        T0.OnHand,
        T0.IsCommited,
        T0.OnHand - T0.IsCommited as Available,
        T1.InvntryUom AS InventoryUOM
      FROM OITM T1
      LEFT JOIN OITW T0
        ON T0.ItemCode = T1.ItemCode
       AND T0.WhsCode = @WhsCode
      WHERE T1.ItemCode = @ItemCode
    `, {
      ItemCode: line.itemNo,
      WhsCode: line.whse
    })).then(result => {
      if (result.length === 0) {
        errors.push(`Item ${line.itemNo} not found in SAP B1`);
        return;
      }
      
      const stock = result[0];
      if (!isSapYes(stock.InventoryItem)) {
        return;
      }

      if (!stock.WarehouseCode) {
        errors.push(`Item ${line.itemNo} not found in warehouse ${line.whse}`);
        return;
      }

      const actualRequiredQty = getRequiredBatchQty(line);
      const availableStock = parseBatchQtyNumber(stock.Available);
      const inventoryUOM = String(stock.InventoryUOM || line.inventoryUOM || line.uomCode || 'Base UoM').trim();
      
      if (actualRequiredQty - availableStock > BATCH_QTY_TOLERANCE) {
        errors.push(`Insufficient stock for item ${line.itemNo} in warehouse ${line.whse}. Required: ${actualRequiredQty.toFixed(2)} ${inventoryUOM}, Available: ${availableStock.toFixed(2)} ${inventoryUOM}`);
      }
    });
    
    promises.push(promise);
  }
  
  return Promise.all(promises).then(() => ({
    errors,
    isValid: errors.length === 0
  }));
};

// Validate branch
const validateBranch = (branchId) => {
  if (!branchId) {
    return { errors: ['Please select a branch'], isValid: false };
  }
  
  return safe(db.query(`
    SELECT BPLId, BPLName, Disabled
    FROM OBPL
    WHERE BPLId = @BPLId
  `, { BPLId: branchId })).then(result => {
    if (result.length === 0) {
      return { errors: ['Branch not found'], isValid: false };
    }
    
    const branch = result[0];
    if (branch.Disabled === 'Y') {
      return { errors: ['Invalid or inactive branch selected'], isValid: false };
    }
    
    return { errors: [], isValid: true };
  });
};


// Validate series
const validateSeries = (seriesId, branchId) => {
  if (!seriesId) {
    return { errors: ['Please select a series'], isValid: false };
  }
  
  return safe(db.query(`
    SELECT Series, SeriesName, Locked, BPLId
    FROM NNM1
    WHERE Series = @Series
  `, { Series: seriesId })).then(result => {
    if (result.length === 0) {
      return { errors: ['Series not found'], isValid: false };
    }
    
    const series = result[0];
    if (series.Locked === 'Y') {
      return { errors: ['Invalid series for selected branch'], isValid: false };
    }
    
    if (branchId && series.BPLId && series.BPLId !== parseInt(branchId)) {
      return { errors: ['Invalid series for selected branch'], isValid: false };
    }
    
    return { errors: [], isValid: true };
  });
};

// Validate warehouse belongs to branch
const validateWarehouseBranch = (warehouseCode, branchId) => {
  if (!warehouseCode || !branchId) {
    return { errors: [], isValid: true }; // Skip validation if either is missing
  }
  
  return safe(db.query(`
    SELECT WhsCode, BPLId
    FROM OWHS
    WHERE WhsCode = @WhsCode
    AND BPLId = @BPLId
  `, {
    WhsCode: warehouseCode,
    BPLId: branchId
  })).then(result => {
    if (result.length === 0) {
      return { errors: ['Warehouse does not belong to selected branch'], isValid: false };
    }
    
    return { errors: [], isValid: true };
  });
};

module.exports = {
  getReferenceData,
  getSalesEmployees,
  getCustomerDetails,
  getDeliveryLineFieldMetadata,
  getLookupValues,
  createLookupValue,
  getDeliveryList,
  getDelivery,
  getSavedDeliveryQuantities,
  getDocumentSeries,
  getNextNumber,
  getStateFromWarehouse,
  getOpenSalesOrders,
  getSalesOrderForCopy,
  getDeliveryForCopy,
  getDeliveryForCopyToCreditMemo,
  getBatchesByItem,
  getFreightCharges,
  getItemsForModal,
  getUomConversionFactor,
  resolveDeliveryLineUomEntry,
  // Validation functions
  validateBatchSelection,
  validateTaxCodes,
  validateStockAvailability,
  validateBranch,
  validateSeries,
  validateWarehouseBranch,
  
};
