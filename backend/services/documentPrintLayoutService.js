const dbService = require('./dbService');
const reportService = require('./reportService');
const { getActiveCompanyConfig } = require('./companyConfigService');

const DOCUMENT_PRINT_CONFIG = {
  salesQuotation: {
    aliases: ['sales-quotation', 'salesquotation', 'quotation', 'qut', '23'],
    label: 'Sales Quotation',
    objectType: '23',
    typeCode: 'QUT2',
    tableName: 'OQUT',
    filePrefix: 'sales-quotation',
  },
  delivery: {
    aliases: ['delivery', 'deliveries', 'dln', '15'],
    label: 'Delivery',
    objectType: '15',
    typeCode: 'DLN2',
    tableName: 'ODLN',
    filePrefix: 'delivery',
  },
  arInvoice: {
    aliases: ['ar-invoice', 'arinvoice', 'a/r-invoice', 'invoice', 'inv', '13'],
    label: 'A/R Invoice',
    objectType: '13',
    typeCode: 'INV2',
    tableName: 'OINV',
    filePrefix: 'ar-invoice',
  },
  serviceArInvoice: {
    aliases: ['service-ar-invoice', 'servicearinvoice', 'services-ar-invoice', 'service-invoice', 'serviceinv'],
    label: 'Service A/R Invoice',
    objectType: '13',
    typeCode: 'INV2',
    tableName: 'OINV',
    filePrefix: 'service-ar-invoice',
  },
  serviceApInvoice: {
    aliases: ['service-ap-invoice', 'serviceapinvoice', 'services-ap-invoice', 'service-purchase-invoice', 'servicepch'],
    label: 'Service A/P Invoice',
    objectType: '18',
    typeCode: 'PCH2',
    tableName: 'OPCH',
    filePrefix: 'service-ap-invoice',
  },
  serviceApCreditMemo: {
    aliases: ['service-ap-credit-memo', 'serviceapcreditmemo', 'services-ap-credit-memo', 'service-purchase-credit-memo', 'servicerpc'],
    label: 'Service A/P Credit Memo',
    objectType: '19',
    typeCode: 'RPC2',
    tableName: 'ORPC',
    filePrefix: 'service-ap-credit-memo',
  },
  serviceArCreditMemo: {
    aliases: ['service-ar-credit-memo', 'servicearcreditmemo', 'services-ar-credit-memo', 'service-sales-credit-memo', 'servicerin'],
    label: 'Service A/R Credit Memo',
    objectType: '14',
    typeCode: 'RIN2',
    tableName: 'ORIN',
    filePrefix: 'service-ar-credit-memo',
  },
  arCreditMemo: {
    aliases: ['ar-credit-memo', 'arcreditmemo', 'a/r-credit-memo', 'credit-memo', 'rin', '14'],
    label: 'A/R Credit Memo',
    objectType: '14',
    typeCode: 'RIN2',
    tableName: 'ORIN',
    filePrefix: 'ar-credit-memo',
  },
  salesOrder: {
    aliases: ['sales-order', 'salesorder', 'order', 'rdr', '17'],
    label: 'Sales Order',
    objectType: '17',
    typeCode: 'RDR2',
    tableName: 'ORDR',
    filePrefix: 'sales-order',
  },
  purchaseQuotation: {
    aliases: ['purchase-quotation', 'purchasequotation', 'purchase-quote', 'pqt', '540000006'],
    label: 'Purchase Quotation',
    objectType: '540000006',
    typeCode: 'PQT2',
    tableName: 'OPQT',
    filePrefix: 'purchase-quotation',
  },
  purchaseOrder: {
    aliases: ['purchase-order', 'purchaseorder', 'po', 'por', '22'],
    label: 'Purchase Order',
    objectType: '22',
    typeCode: 'POR2',
    tableName: 'OPOR',
    filePrefix: 'purchase-order',
  },
  goodsReceiptPo: {
    aliases: ['goods-receipt-po', 'goodsreceiptpo', 'grpo', 'pdn', '20'],
    label: 'Goods Receipt PO',
    objectType: '20',
    typeCode: 'PDN2',
    tableName: 'OPDN',
    filePrefix: 'goods-receipt-po',
  },
  goodsReturn: {
    aliases: ['goods-return', 'goodsreturn', 'return', 'returns', 'rpd', '21'],
    label: 'Goods Return',
    objectType: '21',
    typeCode: 'RPD2',
    tableName: 'ORPD',
    filePrefix: 'goods-return',
  },
  apInvoice: {
    aliases: ['ap-invoice', 'apinvoice', 'a/p-invoice', 'purchase-invoice', 'pch', '18'],
    label: 'A/P Invoice',
    objectType: '18',
    typeCode: 'PCH2',
    tableName: 'OPCH',
    filePrefix: 'ap-invoice',
  },
  apCreditMemo: {
    aliases: ['ap-credit-memo', 'apcreditmemo', 'a/p-credit-memo', 'purchase-credit-memo', 'rpc', '19'],
    label: 'A/P Credit Memo',
    objectType: '19',
    typeCode: 'RPC2',
    tableName: 'ORPC',
    filePrefix: 'ap-credit-memo',
  },
};

const DOCUMENT_TYPE_BY_ALIAS = Object.entries(DOCUMENT_PRINT_CONFIG).reduce((map, [key, config]) => {
  map.set(key.toLowerCase(), key);
  config.aliases.forEach((alias) => map.set(alias.toLowerCase(), key));
  return map;
}, new Map());

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeDocumentType = (documentType) => {
  const normalized = String(documentType || '').trim().toLowerCase();
  const key = DOCUMENT_TYPE_BY_ALIAS.get(normalized);

  if (!key) {
    throw createHttpError(400, 'Unsupported document type for printing.');
  }

  return key;
};

const getDocumentPrintConfig = (documentType) => {
  const key = normalizeDocumentType(documentType);
  return {
    key,
    ...DOCUMENT_PRINT_CONFIG[key],
  };
};

const resolveActiveDatabaseSchema = async () => {
  const companyConfig = await getActiveCompanyConfig();

  const configuredSchema = String(
    companyConfig.sql.database ||
      companyConfig.reportService.defaultSchema ||
      companyConfig.reportService.companyDb ||
      companyConfig.serviceLayer.companyDb ||
      '',
  ).trim();

  if (configuredSchema) return configuredSchema;

  try {
    const databaseName = await dbService.resolveDatabaseName();
    if (databaseName) return String(databaseName).trim();
  } catch (_error) {
    // Fall through to the validation error raised by the caller.
  }

  return '';
};

const getAllowedPrintSchemas = async () => {
  const companyConfig = await getActiveCompanyConfig();
  return [
    companyConfig.sql.database,
    companyConfig.reportService.defaultSchema,
    companyConfig.reportService.companyDb,
    companyConfig.serviceLayer.companyDb,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
};

const resolvePrintSchema = async (schema) => {
  const defaultSchema = await resolveActiveDatabaseSchema();
  const normalizedSchema = toRequiredString(schema || defaultSchema, 'Schema');
  const allowedSchemas = await getAllowedPrintSchemas();
  const allowedSchemaSet = new Set(allowedSchemas.map((value) => value.toLowerCase()));

  if (allowedSchemaSet.size && !allowedSchemaSet.has(normalizedSchema.toLowerCase())) {
    throw createHttpError(
      403,
      `Schema ${normalizedSchema} is not assigned to the selected company session.`,
    );
  }

  return normalizedSchema;
};

const toRequiredString = (value, fieldName) => {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    throw createHttpError(400, `${fieldName} is required.`);
  }

  return normalized;
};

const toRequiredPositiveIntegerString = (value, fieldName) => {
  const normalized = toRequiredString(value, fieldName);

  if (!/^\d+$/.test(normalized) || Number(normalized) <= 0) {
    throw createHttpError(400, `${fieldName} must be a valid positive internal document key.`);
  }

  return normalized;
};

const requirePrintPermission = (auth) => {
  if (!auth?.userId || !auth?.companyId) {
    throw createHttpError(403, 'A valid company session is required to print document layouts.');
  }
};

const isActiveLayout = (layout = {}) => {
  const status = String(layout.status_code || layout.Status || '').trim().toUpperCase();
  return !status || status === 'A';
};

const isCrystalLayout = (layout = {}) => {
  const category = String(layout.category_code || layout.Category || '').trim().toUpperCase();
  if (category) return category === 'C';

  const type = String(layout.layout_type || '').trim().toLowerCase();
  return type.includes('crystal');
};

const filterDocumentLayouts = (_config, layouts = []) =>
  layouts.filter((layout) => isActiveLayout(layout) && isCrystalLayout(layout));

const SAP_DEFAULT_LAYOUT_FLAG_COLUMNS = [
  'IsDefault',
  'IsDflt',
  'Dflt',
  'DfltLayout',
  'DfltReport',
  'PrintDefault',
  'DefaultLayout',
];

const isTruthySapFlag = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  return ['1', 'Y', 'YES', 'T', 'TRUE'].includes(normalized);
};

const getSapLayoutRows = async (config, schema) => {
  const defaultFlagColumnSet = await getExistingTableColumns('RDOC', SAP_DEFAULT_LAYOUT_FLAG_COLUMNS, schema);
  const defaultFlagColumns = [...defaultFlagColumnSet];
  const defaultFlagSelect = defaultFlagColumns.length
    ? `,\n      ${defaultFlagColumns.map((columnName) => `T0.${columnName} AS ${columnName}`).join(',\n      ')}`
    : '';

  const result = await dbService.query(`
    SELECT
      T0.DocCode AS layout_id,
      T0.DocName AS layout_name,
      CASE
        WHEN T0.Category = 'P' THEN 'PLD'
        WHEN T0.Category = 'C' THEN 'Crystal Reports'
        ELSE T0.Category
      END AS layout_type,
      CASE T0.Language
        WHEN 8 THEN 'English (UK)'
        WHEN 3 THEN 'English'
        WHEN 1 THEN 'Default'
        ELSE ''
      END AS language_name,
      T0.TypeCode AS type_code,
      T0.Category AS category_code,
      T0.Language AS language_code,
      T0.Status AS status_code,
      CASE
        WHEN T0.Category = 'C' THEN 1
        ELSE 0
      END AS is_export_supported,
      T0.DocCode,
      T0.DocName,
      T0.TypeCode,
      T0.Category,
      T0.Language,
      T0.Status
      ${defaultFlagSelect}
    FROM RDOC T0
    WHERE T0.TypeCode = @typeCode
      AND T0.Status = 'A'
    ORDER BY T0.DocCode
  `, { typeCode: config.typeCode }, { databaseName: schema });

  return {
    layouts: result.recordset || [],
    defaultFlagColumns,
  };
};

const selectSapAssignedLayout = ({ config, layouts, defaultFlagColumns, docCode = '' }) => {
  const crystalLayouts = filterDocumentLayouts(config, layouts);
  const normalizedDocCode = String(docCode || '').trim();

  if (!crystalLayouts.length) {
    throw createHttpError(404, `SAP B1 has no active Crystal Report layout assigned for ${config.label} (${config.typeCode}).`);
  }

  if (normalizedDocCode) {
    const selectedLayout = crystalLayouts.find((layout) =>
      String(layout.DocCode || layout.layout_id || '').trim().toLowerCase() === normalizedDocCode.toLowerCase(),
    );

    if (!selectedLayout) {
      throw createHttpError(404, `Layout ${normalizedDocCode} is not an active SAP B1 Crystal layout for ${config.label}.`);
    }

    return {
      layout: selectedLayout,
      layoutCandidates: crystalLayouts,
      requiresLayoutSelection: false,
      selectionSource: 'SAP B1 Choose Layout selection',
      warnings: [],
    };
  }

  const defaultLayouts = defaultFlagColumns.length
    ? crystalLayouts.filter((layout) => defaultFlagColumns.some((columnName) => isTruthySapFlag(layout[columnName])))
    : [];

  if (defaultLayouts.length === 1) {
    return {
      layout: defaultLayouts[0],
      layoutCandidates: crystalLayouts,
      requiresLayoutSelection: false,
      selectionSource: `RDOC default flag (${defaultFlagColumns.join(', ')})`,
      warnings: [],
    };
  }

  if (defaultLayouts.length > 1) {
    return {
      layout: null,
      layoutCandidates: crystalLayouts,
      requiresLayoutSelection: true,
      selectionSource: 'SAP B1 Choose Layout list',
      warnings: [`SAP B1 exposes multiple default Crystal Report layouts for ${config.label}; choose the required layout.`],
    };
  }

  if (crystalLayouts.length === 1) {
    return {
      layout: crystalLayouts[0],
      layoutCandidates: crystalLayouts,
      requiresLayoutSelection: false,
      selectionSource: 'Single active SAP B1 Crystal layout',
      warnings: defaultFlagColumns.length
        ? []
        : ['SAP RDOC default flag columns were not exposed; the only active Crystal layout was used.'],
    };
  }

  return {
    layout: null,
    layoutCandidates: crystalLayouts,
    requiresLayoutSelection: true,
    selectionSource: 'SAP B1 Choose Layout list',
    warnings: [],
  };
};

const getLayouts = async (documentType) => {
  const config = getDocumentPrintConfig(documentType);
  const defaultSchema = await resolvePrintSchema();
  const { layouts } = await getSapLayoutRows(config, defaultSchema);

  return {
    documentType: config.key,
    documentLabel: config.label,
    objectType: config.objectType,
    typeCode: config.typeCode,
    defaultDocCode: '',
    defaultSchema,
    companyDatabase: defaultSchema,
    layouts: filterDocumentLayouts(config, layouts),
    warnings: [],
  };
};

const getLayoutParameters = async ({
  documentType,
  docCode,
  schema,
  auth,
} = {}) => {
  requirePrintPermission(auth);

  const config = getDocumentPrintConfig(documentType);
  const normalizedDocCode = toRequiredString(docCode, 'Layout DocCode');
  const normalizedSchema = await resolvePrintSchema(schema);
  const layout = await getLayoutForDocument(config, normalizedDocCode, normalizedSchema);
  const parameters = await reportService.loadReportParameters(normalizedDocCode, {
    reportCompanyDb: normalizedSchema,
  });
  const promptParameters = (parameters || [])
    .filter((parameter) => !reportService.isDocumentPrintSystemParameter(parameter.paramName))
    .map((parameter) => ({
      ...parameter,
      layoutDocCode: normalizedDocCode,
      layoutName: String(layout.DocName || '').trim(),
    }));

  return {
    documentType: config.key,
    documentLabel: config.label,
    objectType: config.objectType,
    typeCode: config.typeCode,
    docCode: normalizedDocCode,
    layoutName: String(layout.DocName || '').trim(),
    schema: normalizedSchema,
    parameters: promptParameters,
  };
};

const normalizeOptionalText = (value) => String(value ?? '').trim();

const valuesMatch = (left, right) =>
  normalizeOptionalText(left).toLowerCase() === normalizeOptionalText(right).toLowerCase();

const documentMatchesPrintIdentity = (document, { docNum = '', series = '', cardCode = '' } = {}) => {
  if (!document) return false;

  const expectedDocNum = normalizeOptionalText(docNum);
  const expectedSeries = normalizeOptionalText(series);
  const expectedCardCode = normalizeOptionalText(cardCode);

  if (expectedDocNum && !valuesMatch(document.DocNum, expectedDocNum)) return false;
  if (expectedSeries && !valuesMatch(document.Series, expectedSeries)) return false;
  if (expectedCardCode && !valuesMatch(document.CardCode, expectedCardCode)) return false;

  return true;
};

const getDocumentByPrintIdentity = async (
  config,
  { docNum = '', series = '', cardCode = '' } = {},
  { schema = '' } = {},
) => {
  const normalizedDocNum = normalizeOptionalText(docNum);
  const normalizedSeries = normalizeOptionalText(series);
  const normalizedCardCode = normalizeOptionalText(cardCode);

  if (!normalizedDocNum || (!normalizedSeries && !normalizedCardCode)) {
    return null;
  }

  const filters = ['DocNum = @docNum'];
  const params = { docNum: normalizedDocNum };

  if (normalizedSeries) {
    filters.push('Series = @series');
    params.series = normalizedSeries;
  }

  if (normalizedCardCode) {
    filters.push('UPPER(LTRIM(RTRIM(CardCode))) = @cardCode');
    params.cardCode = normalizedCardCode.toUpperCase();
  }

  const result = await dbService.query(`
    SELECT TOP 1 DocEntry, DocNum, Series, CardCode, CardName
    FROM ${config.tableName}
    WHERE ${filters.join('\n      AND ')}
    ORDER BY DocEntry DESC
  `, params, schema ? { databaseName: schema } : {});

  return result.recordset?.[0] || null;
};

const getDocumentSummary = async (config, docEntry, {
  schema = '',
  docNum = '',
  series = '',
  cardCode = '',
} = {}) => {
  const normalizedDocEntry = toRequiredPositiveIntegerString(docEntry, 'DocEntry');
  const result = await dbService.query(`
    SELECT TOP 1 DocEntry, DocNum, Series, CardCode, CardName
    FROM ${config.tableName}
    WHERE DocEntry = @docEntry
  `, {
    docEntry: normalizedDocEntry,
  }, schema ? { databaseName: schema } : {});

  const document = result.recordset?.[0];

  if (document && documentMatchesPrintIdentity(document, { docNum, series, cardCode })) {
    return document;
  }

  const documentByPrintIdentity = await getDocumentByPrintIdentity(
    config,
    { docNum, series, cardCode },
    { schema },
  );

  if (documentByPrintIdentity) {
    if (document && String(document.DocEntry) !== String(documentByPrintIdentity.DocEntry)) {
      console.warn('[DocumentPrint] Corrected mismatched document key before Crystal export', {
        documentType: config.key,
        requestedDocEntry: normalizedDocEntry,
        requestedDocNum: normalizeOptionalText(docNum),
        requestedSeries: normalizeOptionalText(series),
        requestedCardCode: normalizeOptionalText(cardCode),
        correctedDocEntry: documentByPrintIdentity.DocEntry,
      });
    }

    return documentByPrintIdentity;
  }

  if (!document) {
    throw createHttpError(404, `${config.label} DocEntry ${normalizedDocEntry} was not found.`);
  }

  const expectedParts = [
    normalizeOptionalText(docNum) ? `DocNum ${normalizeOptionalText(docNum)}` : '',
    normalizeOptionalText(series) ? `Series ${normalizeOptionalText(series)}` : '',
    normalizeOptionalText(cardCode) ? `CardCode ${normalizeOptionalText(cardCode)}` : '',
  ].filter(Boolean).join(', ');

  throw createHttpError(
    409,
    `${config.label} DocEntry ${normalizedDocEntry} does not match the open document${expectedParts ? ` (${expectedParts})` : ''}. Reopen the document from Find and try printing again.`,
  );
};

const normalizeReportParameter = (parameter = {}, layout, resolvedSystemParameters = []) => {
  const paramName = String(parameter.paramName || parameter.name || '').trim();
  const resolvedSystemParameter = resolvedSystemParameters.find(
    (entry) => String(entry.name || '').trim().toUpperCase() === paramName.toUpperCase(),
  );

  return {
    ...parameter,
    paramName,
    name: paramName,
    type: parameter.paramType || parameter.type || resolvedSystemParameter?.type || 'string',
    value: resolvedSystemParameter?.value ?? parameter.value ?? parameter.defaultValue ?? '',
    layoutDocCode: String(layout.DocCode || layout.layout_id || '').trim(),
    layoutName: String(layout.DocName || layout.layout_name || '').trim(),
  };
};

const buildLayoutMetadata = (layout = {}, { selectionSource = '' } = {}) => ({
  docCode: String(layout.DocCode || layout.layout_id || '').trim(),
  layoutId: String(layout.DocCode || layout.layout_id || '').trim(),
  docName: String(layout.DocName || layout.layout_name || '').trim(),
  reportName: String(layout.DocName || layout.layout_name || '').trim(),
  typeCode: String(layout.TypeCode || layout.type_code || '').trim(),
  category: String(layout.Category || layout.category_code || '').trim(),
  status: String(layout.Status || layout.status_code || '').trim(),
  language: layout.Language ?? layout.language_code ?? '',
  languageName: String(layout.language_name || '').trim(),
  isCrystal: isCrystalLayout(layout),
  isExportSupported: Boolean(Number(layout.is_export_supported ?? 0)) || isCrystalLayout(layout),
  selectionSource,
});

const getDocumentReportMetadata = async ({
  documentType,
  docEntry,
  docNum,
  series,
  schema,
  docCode,
  cardCode,
  auth,
} = {}) => {
  requirePrintPermission(auth);

  const config = getDocumentPrintConfig(documentType);
  const normalizedDocEntry = toRequiredPositiveIntegerString(docEntry, 'DocEntry');
  const normalizedSchema = await resolvePrintSchema(schema);
  const document = await getDocumentSummary(config, normalizedDocEntry, {
    schema: normalizedSchema,
    docNum,
    series,
    cardCode,
  });
  const resolvedDocEntry = toRequiredPositiveIntegerString(document.DocEntry || normalizedDocEntry, 'Resolved DocEntry');
  const resolvedDocNum = String(document.DocNum || docNum || '').trim();
  const resolvedCardCode = String(document.CardCode || cardCode || '').trim();
  const { layouts, defaultFlagColumns } = await getSapLayoutRows(config, normalizedSchema);
  const {
    layout,
    layoutCandidates,
    requiresLayoutSelection,
    selectionSource,
    warnings,
  } = selectSapAssignedLayout({
    config,
    layouts,
    defaultFlagColumns,
    docCode,
  });
  const layoutCandidateMetadata = (layoutCandidates || []).map((candidate) =>
    buildLayoutMetadata(candidate, { selectionSource: 'SAP B1 active Crystal layout' }));
  const baseMetadata = {
    documentType: config.key,
    documentLabel: config.label,
    objectType: config.objectType,
    typeCode: config.typeCode,
    schema: normalizedSchema,
    companyDatabase: normalizedSchema,
    tableName: config.tableName,
    document: {
      docEntry: resolvedDocEntry,
      docNum: resolvedDocNum,
      series: String(document.Series || series || '').trim(),
      cardCode: resolvedCardCode,
      cardName: String(document.CardName || '').trim(),
    },
    layoutCandidates: layoutCandidateMetadata,
    requiresLayoutSelection: Boolean(requiresLayoutSelection),
    warnings,
    diagnostics: {
      layoutSource: selectionSource,
      activeCrystalLayoutCount: filterDocumentLayouts(config, layouts).length,
      defaultFlagColumns,
      reportService: 'SAP Business One Report Service / Crystal Reports',
    },
  };

  if (!layout) {
    return {
      ...baseMetadata,
      layout: null,
      systemParameters: [],
      promptParameters: [],
      parameters: [],
    };
  }

  const normalizedDocCode = String(layout.DocCode || layout.layout_id || '').trim();
  const parameters = await reportService.loadReportParameters(normalizedDocCode, {
    reportCompanyDb: normalizedSchema,
  });
  const systemParameters = await reportService.buildDocumentPrintParameters({
    docCode: normalizedDocCode,
    docEntry: resolvedDocEntry,
    docKeyValue: resolvedDocEntry,
    docNum: resolvedDocNum,
    schema: normalizedSchema,
    cardCode: resolvedCardCode,
    objectType: config.objectType,
  });
  const promptParameters = (parameters || [])
    .filter((parameter) => !reportService.isDocumentPrintSystemParameter(parameter.paramName || parameter.name))
    .map((parameter) => normalizeReportParameter(parameter, layout));

  return {
    ...baseMetadata,
    layout: buildLayoutMetadata(layout, { selectionSource }),
    systemParameters: systemParameters.map((parameter) => normalizeReportParameter(parameter, layout, systemParameters)),
    promptParameters,
    parameters: promptParameters,
  };
};

const getLayoutForDocument = async (config, docCode, schema = '') => {
  const normalizedDocCode = toRequiredString(docCode, 'Layout DocCode');
  const result = await dbService.query(`
    SELECT TOP 1 DocCode, DocName, TypeCode, Category, Status
    FROM RDOC
    WHERE DocCode = @docCode
      AND TypeCode = @typeCode
      AND Status = 'A'
  `, {
    docCode: normalizedDocCode,
    typeCode: config.typeCode,
  }, schema ? { databaseName: schema } : {});

  const layout = result.recordset?.[0];

  if (!layout) {
    throw createHttpError(404, `Layout ${normalizedDocCode} was not found for ${config.label}.`);
  }

  if (String(layout.Category || '').trim().toUpperCase() !== 'C') {
    throw createHttpError(422, `Layout ${normalizedDocCode} is a PLD layout. The PDF API exports Crystal layouts only.`);
  }

  return layout;
};

const SALES_ORDER_PRINT_UDF_SETTERS = {
  U_DocKey: 'DocEntry',
  U_ItemCode: 'ItemCode',
  U_Item_Desc: 'Dscription',
  U_UoM: "COALESCE(NULLIF(unitMsr, ''), NULLIF(UomCode, ''))",
};

const getExistingTableColumns = async (tableName, columnNames, schema) => {
  const result = await dbService.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @tableName
      AND COLUMN_NAME IN (${columnNames.map((_, index) => `@columnName${index}`).join(', ')})
  `, columnNames.reduce((params, columnName, index) => ({
    ...params,
    [`columnName${index}`]: columnName,
  }), { tableName }), { databaseName: schema });

  return new Set((result.recordset || []).map((row) => String(row.COLUMN_NAME || '').trim()));
};

const hydrateSalesOrderPrintFields = async (config, docEntry, schema) => {
  if (config.key !== 'salesOrder') {
    return;
  }

  const normalizedDocEntry = toRequiredPositiveIntegerString(docEntry, 'DocEntry');
  const columnsToHydrate = Object.keys(SALES_ORDER_PRINT_UDF_SETTERS);
  const existingColumns = await getExistingTableColumns('RDR1', columnsToHydrate, schema);
  const setClauses = columnsToHydrate
    .filter((columnName) => existingColumns.has(columnName))
    .map((columnName) => `${columnName} = ${SALES_ORDER_PRINT_UDF_SETTERS[columnName]}`);

  if (!setClauses.length) {
    console.info('[DocumentPrint] Skipped sales order Crystal print UDF sync; no expected RDR1 UDF columns exist', {
      docEntry: normalizedDocEntry,
      schema,
      expectedColumns: columnsToHydrate,
    });
    return;
  }

  const result = await dbService.query(`
    UPDATE RDR1
    SET
      ${setClauses.join(',\n      ')}
    WHERE DocEntry = @docEntry
  `, {
    docEntry: normalizedDocEntry,
  }, { databaseName: schema });

  console.info('[DocumentPrint] Synced sales order Crystal print UDFs', {
    docEntry: normalizedDocEntry,
    rowsAffected: result.rowsAffected,
    columns: setClauses.map((clause) => clause.split('=')[0].trim()),
  });
};

const buildFileName = ({ config, docEntry, docNum, docCode }) =>
  `${config.filePrefix}-${docNum || docEntry}-${docCode}.pdf`;

const printDocument = async ({
  documentType,
  docEntry,
  docNum,
  series,
  schema,
  docCode,
  cardCode,
  reportParameters,
  auth,
} = {}) => {
  requirePrintPermission(auth);

  const metadata = await getDocumentReportMetadata({
    documentType,
    docEntry,
    docNum,
    series,
    schema,
    docCode,
    cardCode,
    auth,
  });

  const config = getDocumentPrintConfig(documentType);
  if (metadata.requiresLayoutSelection || !metadata.layout?.docCode) {
    throw createHttpError(
      400,
      `Choose a SAP B1 layout before printing ${metadata.documentLabel}.`,
    );
  }

  const normalizedDocCode = metadata.layout.docCode;

  const normalizedSchema = metadata.schema;
  const resolvedDocEntry = metadata.document.docEntry;
  const resolvedDocNum = metadata.document.docNum;
  const resolvedCardCode = metadata.document.cardCode;

  await hydrateSalesOrderPrintFields(config, resolvedDocEntry, normalizedSchema);

  console.info('[DocumentPrint] Starting document-key print', {
    documentType: config.key,
    documentLabel: config.label,
    tableName: config.tableName,
    docEntry: resolvedDocEntry,
    docCode: normalizedDocCode,
    series: metadata.document.series,
    schema: normalizedSchema,
    query: `SELECT TOP 1 DocEntry, DocNum, CardCode, CardName FROM ${config.tableName} WHERE DocEntry = @docEntry`,
    queryParameters: { docEntry: resolvedDocEntry },
    layoutSource: metadata.diagnostics.layoutSource,
  });

  const genericResponse = await reportService.exportDocumentPdf({
    docEntry: resolvedDocEntry,
    schema: normalizedSchema,
    docCode: normalizedDocCode,
    cardCode: resolvedCardCode,
    docNum: resolvedDocNum,
    objectType: config.objectType,
    reportParameters,
    documentLabel: config.label,
    fileName: buildFileName({
      config,
      docEntry: resolvedDocEntry,
      docNum: resolvedDocNum,
      docCode: normalizedDocCode,
    }),
  });

  return {
    message: `${config.label} PDF generated successfully.`,
    base64Pdf: genericResponse.base64Pdf,
    mimeType: genericResponse.mimeType,
    fileName: genericResponse.fileName,
    documentType: config.key,
    documentLabel: config.label,
    objectType: config.objectType,
    typeCode: config.typeCode,
    docEntry: resolvedDocEntry,
    docNum: resolvedDocNum,
    series: metadata.document.series,
    cardCode: resolvedCardCode,
    cardName: metadata.document.cardName,
    docKeyValue: genericResponse.docKeyValue,
    docCode: normalizedDocCode,
    layoutName: metadata.layout.docName,
    schema: normalizedSchema,
    reportMetadata: metadata,
  };
};

const downloadAllLayouts = async ({
  documentType,
  auth,
} = {}) => {
  requirePrintPermission(auth);
  const config = getDocumentPrintConfig(documentType);
  throw createHttpError(
    410,
    `Bulk export of every ${config.label} layout is disabled. Document printing must use the single active SAP B1 Crystal layout.`,
  );
};

module.exports = {
  getDocumentPrintConfig,
  getLayouts,
  getLayoutParameters,
  getDocumentReportMetadata,
  printDocument,
  downloadAllLayouts,
};
