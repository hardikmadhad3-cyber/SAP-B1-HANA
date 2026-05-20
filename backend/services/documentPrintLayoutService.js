const env = require('../config/env');
const dbService = require('./dbService');
const reportService = require('./reportService');

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

const toRequiredString = (value, fieldName) => {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    throw createHttpError(400, `${fieldName} is required.`);
  }

  return normalized;
};

const requirePrintPermission = (auth) => {
  if (!auth?.userId || !auth?.companyId) {
    throw createHttpError(403, 'A valid company session is required to print document layouts.');
  }
};

const getLayouts = async (documentType) => {
  const config = getDocumentPrintConfig(documentType);
  const result = await dbService.query(`
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
  `, { typeCode: config.typeCode });

  return {
    documentType: config.key,
    documentLabel: config.label,
    objectType: config.objectType,
    typeCode: config.typeCode,
    defaultDocCode: config.defaultDocCode || '',
    defaultSchema: env.reportServiceDefaultSchema,
    layouts: result.recordset || [],
  };
};

const getDocumentSummary = async (config, docEntry) => {
  const normalizedDocEntry = toRequiredString(docEntry, 'DocEntry');
  const result = await dbService.query(`
    SELECT TOP 1 DocEntry, DocNum
    FROM ${config.tableName}
    WHERE DocEntry = @docEntry
  `, { docEntry: normalizedDocEntry });

  const document = result.recordset?.[0];

  if (!document) {
    throw createHttpError(404, `${config.label} ${normalizedDocEntry} was not found.`);
  }

  return document;
};

const getLayoutForDocument = async (config, docCode) => {
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
  });

  const layout = result.recordset?.[0];

  if (!layout) {
    throw createHttpError(404, `Layout ${normalizedDocCode} was not found for ${config.label}.`);
  }

  if (String(layout.Category || '').trim().toUpperCase() !== 'C') {
    throw createHttpError(422, `Layout ${normalizedDocCode} is a PLD layout. The PDF API exports Crystal layouts only.`);
  }

  return layout;
};

const buildFileName = ({ config, docEntry, docNum, docCode }) =>
  `${config.filePrefix}-${docNum || docEntry}-${docCode}.pdf`;

const printDocument = async ({
  documentType,
  docEntry,
  docNum,
  schema,
  docCode,
  auth,
} = {}) => {
  requirePrintPermission(auth);

  const config = getDocumentPrintConfig(documentType);
  const normalizedDocEntry = toRequiredString(docEntry, 'DocEntry');
  const normalizedDocCode = toRequiredString(docCode, 'Layout DocCode');
  const normalizedSchema = toRequiredString(schema || env.reportServiceDefaultSchema, 'Schema');
  const document = await getDocumentSummary(config, normalizedDocEntry);

  const layout = await getLayoutForDocument(config, normalizedDocCode);

  const resolvedDocNum = String(docNum || document.DocNum || '').trim();
  const genericResponse = await reportService.exportDocumentPdf({
    docEntry: normalizedDocEntry,
    schema: normalizedSchema,
    docCode: normalizedDocCode,
    documentLabel: config.label,
    fileName: buildFileName({
      config,
      docEntry: normalizedDocEntry,
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
    docEntry: normalizedDocEntry,
    docNum: resolvedDocNum,
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
