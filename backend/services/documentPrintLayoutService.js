const env = require('../config/env');
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
    layoutFilter: 'service-ar-invoice',
  },
  serviceApInvoice: {
    aliases: ['service-ap-invoice', 'serviceapinvoice', 'services-ap-invoice', 'service-purchase-invoice', 'servicepch'],
    label: 'Service A/P Invoice',
    objectType: '18',
    typeCode: 'PCH2',
    tableName: 'OPCH',
    filePrefix: 'service-ap-invoice',
    layoutFilter: 'service-ap-invoice',
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
    defaultDocCode: env.reportServiceDefaultDocCode,
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

const getLayoutText = (layout = {}) =>
  `${layout.layout_id || layout.DocCode || ''} ${layout.layout_name || layout.DocName || ''}`.trim();

const isServiceArInvoiceLayout = (layout = {}) => {
  const text = getLayoutText(layout).toLowerCase();
  return text.includes('service') || text.includes('in_vat_invoice') || text.includes('in_vat invoice');
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

const getLayoutPriority = (layout = {}) => {
  const text = getLayoutText(layout).toLowerCase();
  if (text.includes('service')) return 0;
  if (text.includes('in_vat_invoice') || text.includes('in_vat invoice')) return 1;
  return 2;
};

const filterDocumentLayouts = (config, layouts = []) => {
  const activeLayouts = layouts.filter((layout) => isActiveLayout(layout) && isCrystalLayout(layout));

  if (config.layoutFilter !== 'service-ar-invoice') return activeLayouts;

  return activeLayouts
    .filter(isServiceArInvoiceLayout)
    .sort((left, right) => {
      const priorityDelta = getLayoutPriority(left) - getLayoutPriority(right);
      if (priorityDelta !== 0) return priorityDelta;
      return String(left.layout_id || left.DocCode || '').localeCompare(String(right.layout_id || right.DocCode || ''));
    });
};

const getLayoutsQuery = (config) => {
  if (config.layoutFilter !== 'service-ar-invoice') {
    return {
      sql: `
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
    WHERE TypeCode = @typeCode
      AND Status = 'A'
    ORDER BY DocCode
  `,
      params: { typeCode: config.typeCode },
    };
  }

  return {
    sql: `
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
    WHERE Status = 'A'
      AND (
        TypeCode = @typeCode
        OR DocCode LIKE 'INV%'
        OR DocName LIKE '%Invoice%Service%'
        OR DocName LIKE '%Service%Invoice%'
      )
    ORDER BY DocCode
  `,
    params: { typeCode: config.typeCode },
  };
};

const getLayouts = async (documentType) => {
  const config = getDocumentPrintConfig(documentType);
  const query = getLayoutsQuery(config);
  const defaultSchema = await resolvePrintSchema();
  const result = await dbService.query(query.sql, query.params, { databaseName: defaultSchema });
  const layouts = filterDocumentLayouts(config, result.recordset || []);

  return {
    documentType: config.key,
    documentLabel: config.label,
    objectType: config.objectType,
    typeCode: config.typeCode,
    defaultDocCode: config.defaultDocCode || '',
    defaultSchema,
    companyDatabase: defaultSchema,
    layouts,
  };
};

const getDocumentSummary = async (config, docEntry, { schema = '' } = {}) => {
  const normalizedDocEntry = toRequiredPositiveIntegerString(docEntry, 'DocEntry');
  const result = await dbService.query(`
    SELECT TOP 1 DocEntry, DocNum, CardCode, CardName
    FROM ${config.tableName}
    WHERE DocEntry = @docEntry
  `, {
    docEntry: normalizedDocEntry,
  }, schema ? { databaseName: schema } : {});

  const document = result.recordset?.[0];

  if (!document) {
    throw createHttpError(404, `${config.label} DocEntry ${normalizedDocEntry} was not found.`);
  }

  return document;
};

const getLayoutForDocument = async (config, docCode, schema = '') => {
  const normalizedDocCode = toRequiredString(docCode, 'Layout DocCode');
  const typeFilter = config.layoutFilter === 'service-ar-invoice'
    ? ''
    : 'AND TypeCode = @typeCode';
  const result = await dbService.query(`
    SELECT TOP 1 DocCode, DocName, TypeCode, Category, Status
    FROM RDOC
    WHERE DocCode = @docCode
      ${typeFilter}
      AND Status = 'A'
  `, {
    docCode: normalizedDocCode,
    typeCode: config.typeCode,
  }, schema ? { databaseName: schema } : {});

  const layout = result.recordset?.[0];

  if (!layout) {
    throw createHttpError(404, `Layout ${normalizedDocCode} was not found for ${config.label}.`);
  }

  if (!filterDocumentLayouts(config, [layout]).length) {
    throw createHttpError(404, `Layout ${normalizedDocCode} is not assigned to ${config.label}.`);
  }

  if (String(layout.Category || '').trim().toUpperCase() !== 'C') {
    throw createHttpError(422, `Layout ${normalizedDocCode} is a PLD layout. The PDF API exports Crystal layouts only.`);
  }

  return layout;
};

const hydrateSalesOrderPrintFields = async (config, docEntry, schema) => {
  if (config.key !== 'salesOrder') {
    return;
  }

  const normalizedDocEntry = toRequiredPositiveIntegerString(docEntry, 'DocEntry');

  const result = await dbService.query(`
    UPDATE RDR1
    SET
      U_DocKey = DocEntry,
      U_ItemCode = ItemCode,
      U_Item_Desc = Dscription,
      U_UoM = COALESCE(NULLIF(unitMsr, ''), NULLIF(UomCode, '')),
      U_Order_Qty = Quantity,
      U_Rate = Price,
      U_Amount = LineTotal,
      U_Disc_Rate = CASE
        WHEN ISNULL(DiscPrcnt, 0) = 0 THEN Price
        ELSE Price * (1 - DiscPrcnt / 100.0)
      END,
      U_Disc_Amount = LineTotal
    WHERE DocEntry = @docEntry
  `, {
    docEntry: normalizedDocEntry,
  }, { databaseName: schema });

  console.info('[DocumentPrint] Synced sales order Crystal print UDFs', {
    docEntry: normalizedDocEntry,
    rowsAffected: result.rowsAffected,
  });
};

const buildFileName = ({ config, docEntry, docNum, docCode }) =>
  `${config.filePrefix}-${docNum || docEntry}-${docCode}.pdf`;

const printDocument = async ({
  documentType,
  docEntry,
  docNum,
  schema,
  docCode,
  cardCode,
  auth,
} = {}) => {
  requirePrintPermission(auth);

  const config = getDocumentPrintConfig(documentType);
  const normalizedDocEntry = toRequiredPositiveIntegerString(docEntry, 'DocEntry');
  const normalizedDocCode = toRequiredString(docCode, 'Layout DocCode');
  const normalizedSchema = await resolvePrintSchema(schema);
  const document = await getDocumentSummary(config, normalizedDocEntry, { schema: normalizedSchema });

  const layout = await getLayoutForDocument(config, normalizedDocCode, normalizedSchema);

  const resolvedDocEntry = toRequiredPositiveIntegerString(document.DocEntry || normalizedDocEntry, 'Resolved DocEntry');
  const resolvedDocNum = String(document.DocNum || docNum || '').trim();
  const resolvedCardCode = String(document.CardCode || cardCode || '').trim();

  await hydrateSalesOrderPrintFields(config, resolvedDocEntry, normalizedSchema);

  console.info('[DocumentPrint] Starting document-key print', {
    documentType: config.key,
    documentLabel: config.label,
    tableName: config.tableName,
    docEntry: resolvedDocEntry,
    docCode: normalizedDocCode,
    schema: normalizedSchema,
    query: `SELECT TOP 1 DocEntry, DocNum, CardCode, CardName FROM ${config.tableName} WHERE DocEntry = @docEntry`,
    queryParameters: { docEntry: resolvedDocEntry },
  });

  const genericResponse = await reportService.exportDocumentPdf({
    docEntry: resolvedDocEntry,
    schema: normalizedSchema,
    docCode: normalizedDocCode,
    cardCode: resolvedCardCode,
    docNum: resolvedDocNum,
    objectType: config.objectType,
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
    cardCode: resolvedCardCode,
    cardName: String(document.CardName || '').trim(),
    docKeyValue: genericResponse.docKeyValue,
    docCode: normalizedDocCode,
    layoutName: String(layout.DocName || '').trim(),
    schema: normalizedSchema,
  };
};

const downloadAllLayouts = async ({
  documentType,
  docEntry,
  docNum,
  schema,
  cardCode,
  auth,
} = {}) => {
  const layoutPayload = await getLayouts(documentType);
  const printableLayouts = layoutPayload.layouts.filter(
    (layout) => String(layout.layout_id || '').trim() && layout.is_export_supported,
  );

  if (!printableLayouts.length) {
    throw createHttpError(404, `No Crystal Report layouts are available for ${layoutPayload.documentLabel}.`);
  }

  const documents = [];

  for (const layout of printableLayouts) {
    documents.push(await printDocument({
      documentType,
      docEntry,
      docNum,
      schema,
      cardCode,
      docCode: layout.layout_id,
      auth,
    }));
  }

  return {
    documentType: layoutPayload.documentType,
    documentLabel: layoutPayload.documentLabel,
    objectType: layoutPayload.objectType,
    typeCode: layoutPayload.typeCode,
    count: documents.length,
    skippedCount: layoutPayload.layouts.length - printableLayouts.length,
    documents,
  };
};

module.exports = {
  getDocumentPrintConfig,
  getLayouts,
  printDocument,
  downloadAllLayouts,
};
