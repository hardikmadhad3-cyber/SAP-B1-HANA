const axios = require('axios');
const crypto = require('crypto');
const https = require('https');
const env = require('../config/env');
const dbService = require('./dbService');
const { getActiveCompanyConfig } = require('./companyConfigService');

const reportClientsByConfig = new Map();

const getReportClient = (config) => {
  const clientKey = [
    config.baseUrl,
    config.rejectUnauthorized ? 'strict' : 'relaxed',
  ].join('|');

  if (!reportClientsByConfig.has(clientKey)) {
    reportClientsByConfig.set(clientKey, axios.create({
      baseURL: config.baseUrl,
      timeout: env.reportServiceTimeoutMs,
      responseType: 'text',
      headers: {
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.rejectUnauthorized,
      }),
    }));
  }

  return reportClientsByConfig.get(clientKey);
};

const reportSessionsByCompany = new Map();

const stripPdfPrefix = (value) =>
  String(value || '')
    .trim()
    .replace(/^data:application\/pdf;base64,/i, '')
    .replace(/\s+/g, '');

const extractCookieHeader = (cookieHeader) => {
  const cookieHeaders = Array.isArray(cookieHeader)
    ? cookieHeader
    : [cookieHeader].filter(Boolean);

  if (!cookieHeaders.length) {
    return '';
  }

  return cookieHeaders
    .map((cookie) => String(cookie).split(';')[0])
    .filter(Boolean)
    .join('; ');
};

const parseLoginPayload = (payload) => {
  if (!payload || typeof payload !== 'string') {
    return payload;
  }

  const trimmed = payload.trim();
  if (!trimmed) {
    return payload;
  }

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    return payload;
  }
};

const extractReportServiceMessage = (payload) => {
  const parsedPayload = parseLoginPayload(payload);

  if (!parsedPayload || typeof parsedPayload !== 'object') {
    return '';
  }

  const candidates = [
    parsedPayload?.error?.message?.value,
    parsedPayload?.error?.message,
    parsedPayload?.message?.value,
    parsedPayload?.message,
    parsedPayload?.detail,
  ];

  return String(candidates.find((candidate) => candidate) || '').trim();
};

const normalizeStringPayload = (value) => {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return stripPdfPrefix(JSON.parse(trimmed));
    } catch (_error) {
      return stripPdfPrefix(trimmed.slice(1, -1));
    }
  }

  return stripPdfPrefix(trimmed);
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const padNumber = (value) => String(value).padStart(2, '0');

const normalizeLoadCrDateValue = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const partMatch = text.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)$/i);
  if (partMatch) {
    const year = Number(partMatch[1]);
    const month = Number(partMatch[2]);
    const day = Number(partMatch[3]);

    if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)) {
      return `${year}-${padNumber(month)}-${padNumber(day)}`;
    }
  }

  const epochMatch = text.match(/^\/?Date\((\d{10,})\)\/?$/i);
  if (epochMatch) {
    const epoch = Number(epochMatch[1]);
    if (Number.isFinite(epoch)) {
      return new Date(epoch).toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return text;
};

const humanizeParameterName = (value) =>
  String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const normalizeLookupColumnKey = (value) =>
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '');

const buildParameterOption = (entry, paramType) => {
  if (entry == null || entry === '') {
    return null;
  }

  if (typeof entry === 'object') {
    const valueCandidate =
      entry.value ??
      entry.Value ??
      entry.code ??
      entry.Code ??
      entry.key ??
      entry.Key ??
      entry.name ??
      entry.Name ??
      entry.description ??
      entry.Description;

    if (valueCandidate == null || valueCandidate === '') {
      return null;
    }

    const labelCandidate =
      entry.label ??
      entry.Label ??
      entry.description ??
      entry.Description ??
      entry.name ??
      entry.Name ??
      valueCandidate;

    return {
      value: paramType === 'number' ? String(Number(valueCandidate)) : String(valueCandidate),
      label: String(labelCandidate),
    };
  }

  return {
    value: paramType === 'number' ? String(Number(entry)) : String(entry),
    label: String(entry),
  };
};

const extractParameterOptions = (row, paramType, defaultValue, displayName) => {
  if (paramType !== 'string') {
    return [];
  }

  const sources = [
    row?.validValues,
    row?.ValidValues,
    row?.values,
    row?.Values,
    row?.listOfValues,
    row?.ListOfValues,
    row?.lovValues,
    row?.LovValues,
    row?.initialValues,
    row?.InitialValues,
  ].filter(Array.isArray);

  const optionMap = new Map();

  sources.forEach((source) => {
    source.forEach((entry) => {
      const option = buildParameterOption(entry, paramType);
      if (!option || !option.value) {
        return;
      }

      const key = option.value.toLowerCase();
      if (!optionMap.has(key)) {
        optionMap.set(key, option);
      }
    });
  });

  if (!optionMap.size && /report type/i.test(String(displayName || '')) && defaultValue) {
    optionMap.set(String(defaultValue).toLowerCase(), {
      value: String(defaultValue),
      label: String(defaultValue),
    });
  }

  return [...optionMap.values()];
};

const parseLookupSpec = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^(.+?)@select\s+(.+?)\s+from\s+([A-Za-z0-9_]+)$/i);

  if (!match) {
    return null;
  }

  const label = String(match[1] || '').trim();
  const table = String(match[3] || '').trim().toUpperCase();
  const columns = String(match[2] || '')
    .split(',')
    .map((column) => String(column || '').trim())
    .filter(Boolean)
    .map((column) => ({
      key: normalizeLookupColumnKey(column),
      label: column,
    }))
    .filter((column) => column.key);

  if (!table || !columns.length) {
    return null;
  }

  return {
    type: 'sql-lookup',
    title: label ? `Select ${label}` : 'Select Value',
    table,
    columns,
    valueKey: columns[0].key,
    displayKey: columns[1]?.key || columns[0].key,
  };
};

const mapCrParameterType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (
    normalized === 'xsd:number' ||
    normalized === 'xsd:int' ||
    normalized === 'xsd:integer' ||
    normalized === 'xsd:decimal' ||
    normalized === 'number' ||
    normalized === 'numeric'
  ) {
    return 'number';
  }

  if (normalized === 'xsd:date' || normalized === 'xsd:datetime' || normalized === 'date') {
    return 'date';
  }

  return 'string';
};

const extractParameterDefaultValue = (row, paramType) => {
  const candidates = [
    ...(Array.isArray(row?.initialValues) ? row.initialValues : []),
    ...(Array.isArray(row?.values) ? row.values : []),
    row?.defaultValue,
  ].filter((entry) => entry != null && entry !== '');

  const firstValue = candidates[0];
  if (firstValue == null) {
    return '';
  }

  if (paramType === 'date') {
    return normalizeLoadCrDateValue(firstValue);
  }

  if (paramType === 'number') {
    const numeric = Number(firstValue);
    return Number.isFinite(numeric) ? String(numeric) : String(firstValue);
  }

  return String(firstValue);
};

const normalizeCrParameter = (row, index) => {
  const paramName =
    String(
      row?.name ||
      row?.parameterName ||
      row?.parameter ||
      row?.description ||
      '',
    ).trim();

  if (!paramName) {
    return null;
  }

  const paramType = mapCrParameterType(row?.type);
  const displayNameRaw = String(row?.description || row?.displayName || paramName).trim();
  const sortOrder = Number(row?.sortOrder ?? row?.SortOrder);
  const isOptionalPrompt = normalizeBoolean(row?.isOptionalPrompt);
  const allowNullValue = normalizeBoolean(row?.allowNullValue);
  const defaultValue = extractParameterDefaultValue(row, paramType);
  const lookup =
    parseLookupSpec(displayNameRaw) ||
    parseLookupSpec(paramName);
  const displayName = lookup
    ? humanizeParameterName(String(displayNameRaw.split(/@select/i)[0] || paramName).trim()) || paramName
    : humanizeParameterName(displayNameRaw || paramName) || paramName;
  const options = extractParameterOptions(row, paramType, defaultValue, displayName);

  return {
    paramName,
    displayName,
    paramType,
    isRequired: !isOptionalPrompt || !allowNullValue,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : index,
    defaultValue,
    options,
    lookup,
  };
};

const extractBase64Pdf = (payload) => {
  if (typeof payload === 'string') {
    return normalizeStringPayload(payload);
  }

  if (!payload) {
    return '';
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const result = extractBase64Pdf(entry);
      if (result) {
        return result;
      }
    }

    return '';
  }

  if (typeof payload === 'object') {
    const preferredKeys = ['base64Pdf', 'Base64Pdf', 'pdfBase64', 'PDFData', 'data', 'value'];

    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const result = extractBase64Pdf(payload[key]);
        if (result) {
          return result;
        }
      }
    }

    for (const value of Object.values(payload)) {
      const result = extractBase64Pdf(value);
      if (result) {
        return result;
      }
    }
  }

  return '';
};

const isKnownUnsupportedLayoutMessage = (value) =>
  /^ThereisnodefaultCrystalReportlayoutrelatedto/i.test(String(value || '').trim());

const isKnownPdfGenerationFailureMessage = (value) =>
  /^AnerrorhasoccurredwhilegeneratingthePDFfile\.?$/i.test(String(value || '').trim());

const isProbablyBase64 = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length < 80 || normalized.length % 4 !== 0) {
    return false;
  }

  return /^[A-Za-z0-9+/=]+$/.test(normalized);
};

const resolveReportServiceConfig = async (companyDb = '') => {
  const explicitCompanyDb = String(companyDb || '').trim();
  const activeCompanyConfig = await getActiveCompanyConfig();

  return {
    ...activeCompanyConfig.reportService,
    companyDb: explicitCompanyDb || activeCompanyConfig.reportService.companyDb,
  };
};

const resolveReportCompanyDb = async (companyDb = '') => {
  const config = await resolveReportServiceConfig(companyDb);
  return String(config.companyDb || '').trim();
};

const hashSecret = (value) =>
  crypto.createHash('sha256').update(String(value || '')).digest('hex');

const getReportSessionKey = (config) => [
  config.baseUrl,
  config.username,
  hashSecret(config.password),
  config.companyDb,
].map((value) => String(value || '').trim().toLowerCase()).join('|');

const ensureReportLoginConfig = (config) => {
  const requiredFields = [
    ['baseUrl', 'Report Service Base Url'],
    ['username', 'Report Service Username'],
    ['password', 'Report Service Password'],
    ['companyDb', 'Report Service Company Db'],
  ];
  const missingFields = requiredFields
    .filter(([key]) => !String(config[key] || '').trim())
    .map(([, label]) => label);

  if (missingFields.length) {
    const sourceSummary = requiredFields
      .map(([key, label]) => `${label}: ${config.fieldSources?.[key] || 'unknown'}`)
      .join(', ');
    const error = new Error(
      `Missing SAP Report Service login configuration (${missingFields.join(', ')}). Enter these values in Admin Panel > Companies > SAP Report Service for the selected company. Current sources: ${sourceSummary}.`,
    );
    error.statusCode = 500;
    throw error;
  }
};

const buildCredentialSourceSummary = (config) => {
  const fieldSources = config.fieldSources || {};
  const usernameSource = fieldSources.username || 'configured';
  const passwordSource = fieldSources.password || 'configured';
  const companyDbSource = fieldSources.companyDb || 'configured';

  return `username from ${usernameSource}, password from ${passwordSource}, company DB from ${companyDbSource}`;
};

const loginToReportService = async (companyDb = '') => {
  const reportConfig = await resolveReportServiceConfig(companyDb);
  const normalizedCompanyDb = String(reportConfig.companyDb || '').trim();
  ensureReportLoginConfig(reportConfig);

  const response = await getReportClient(reportConfig).post('/login', {
    CompanyDB: normalizedCompanyDb,
    UserName: reportConfig.username,
    Password: reportConfig.password,
  });

  const sessionCookie = extractCookieHeader(response.headers['set-cookie']);

  if (!sessionCookie) {
    const sapMessage = extractReportServiceMessage(response.data);
    const credentialSource = buildCredentialSourceSummary(reportConfig);
    const detail = sapMessage
      ? `SAP Report Service login failed for company ${normalizedCompanyDb} (${credentialSource}). Check Admin Panel > Companies > SAP Report Service and retry. SAP said: ${sapMessage}`
      : `SAP Report Service login did not return a session cookie for company ${normalizedCompanyDb} (${credentialSource}).`;
    const error = new Error(detail);
    error.statusCode = 502;
    throw error;
  }

  const responsePayload = parseLoginPayload(response.data);
  const sessionTimeoutMinutes = Number(responsePayload?.SessionTimeout);
  const ttlMinutes = Number.isFinite(sessionTimeoutMinutes) && sessionTimeoutMinutes > 0
    ? sessionTimeoutMinutes
    : 30;

  reportSessionsByCompany.set(getReportSessionKey(reportConfig), {
    cookie: sessionCookie,
    expiresAt: Date.now() + Math.max(ttlMinutes - 1, 1) * 60 * 1000,
  });

  return sessionCookie;
};

const ensureReportSession = async (companyDb = '') => {
  const reportConfig = await resolveReportServiceConfig(companyDb);
  const sessionKey = getReportSessionKey(reportConfig);
  const session = reportSessionsByCompany.get(sessionKey);

  if (!session?.cookie || Date.now() >= session.expiresAt) {
    return loginToReportService(reportConfig.companyDb);
  }

  return session.cookie;
};

const toRequiredString = (value, fieldName) => {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    const error = new Error(`${fieldName} is required.`);
    error.statusCode = 400;
    throw error;
  }

  return normalized;
};

const buildFileName = ({ docEntry, docCode }) => `sales-order-${docEntry}-${docCode}.pdf`;

const DOCUMENT_TYPE_LABELS = new Map([
  ['RDR', 'Sales Order'],
  ['POR', 'Purchase Order'],
  ['PRQ', 'Purchase Request'],
  ['PQT', 'Purchase Quotation'],
  ['PCH', 'A/P Invoice'],
  ['PDN', 'Goods Receipt PO'],
  ['DLN', 'Delivery'],
  ['QUT', 'Sales Quotation'],
  ['INV', 'A/R Invoice'],
  ['RIN', 'A/R Credit Memo'],
  ['RPC', 'A/P Credit Memo'],
  ['IGN', 'Goods Receipt'],
  ['IGE', 'Goods Issue'],
  ['WTR', 'Inventory Transfer'],
  ['WTQ', 'Inventory Transfer Request'],
]);

const getLayoutMetadata = async (docCode, databaseName = '') => {
  const normalizedDocCode = String(docCode || '').trim();
  if (!normalizedDocCode) {
    return null;
  }

  const result = await dbService.query(`
    SELECT TOP 1 DocCode, DocName, TypeCode, Category, Status
    FROM RDOC
    WHERE DocCode = @docCode
  `, { docCode: normalizedDocCode }, databaseName ? { databaseName } : {});

  return result.recordset?.[0] || null;
};

const getDocumentTypeLabel = (typeCode) => {
  const prefix = String(typeCode || '').trim().slice(0, 3).toUpperCase();
  return DOCUMENT_TYPE_LABELS.get(prefix) || String(typeCode || '').trim() || 'document';
};

const isDocumentPrintLayout = (layoutMetadata) => {
  const typeCode = String(layoutMetadata?.TypeCode || '').trim().toUpperCase();
  const prefix = typeCode.slice(0, 3);
  return DOCUMENT_TYPE_LABELS.has(prefix);
};

const resolveXsdType = (type) => {
  const normalized = String(type || '').trim().toLowerCase();

  if (normalized === 'number' || normalized === 'numeric' || normalized === 'int' || normalized === 'xsd:number') {
    return 'xsd:number';
  }

  if (normalized === 'date' || normalized === 'xsd:date') {
    return 'xsd:date';
  }

  if (normalized === 'datetime' || normalized === 'xsd:datetime') {
    return 'xsd:dateTime';
  }

  if (normalized.startsWith('xsd:')) {
    return normalized;
  }

  return 'xsd:string';
};

const normalizeReportParameterValue = (value, type) => {
  if (value == null) {
    return '';
  }

  if (resolveXsdType(type) === 'xsd:number') {
    return Number(value);
  }

  return String(value);
};

const normalizeParameterNameKey = (value) =>
  String(value || '')
    .split(/@select/i)[0]
    .replace(/@/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

const isDocEntryParameter = (parameterName) => {
  const key = normalizeParameterNameKey(parameterName);
  return [
    'dockey',
    'docentry',
    'documentkey',
    'documententry',
  ].includes(key);
};

const isDocNumParameter = (parameterName) => {
  const key = normalizeParameterNameKey(parameterName);
  return [
    'docnum',
    'documentnumber',
    'documentno',
    'docno',
  ].includes(key);
};

const isObjectTypeParameter = (parameterName) => {
  const key = normalizeParameterNameKey(parameterName);
  return [
    'objectid',
    'objecttype',
    'objtype',
    'boobjecttype',
    'doctype',
    'documenttype',
  ].includes(key);
};

const isSchemaParameter = (parameterName) => {
  const key = normalizeParameterNameKey(parameterName);
  return [
    'schema',
    'schemaname',
    'database',
    'databasename',
    'dbname',
    'companydb',
    'companydatabase',
  ].includes(key);
};

const isCardCodeParameter = (parameterName) => {
  const key = normalizeParameterNameKey(parameterName);
  if (!key || key.includes('name')) return false;

  return [
    'card',
    'cardcode',
    'bp',
    'bpcode',
    'businesspartner',
    'businesspartnercode',
    'customer',
    'customercode',
    'custcode',
    'buyer',
    'buyercode',
    'vendor',
    'vendorcode',
    'supplier',
    'suppliercode',
  ].includes(key);
};

const resolveDocumentParameterValue = (parameterName, context) => {
  if (isDocEntryParameter(parameterName)) {
    return context.docKeyValue || context.docEntry;
  }

  if (isSchemaParameter(parameterName)) {
    return context.schema;
  }

  if (isObjectTypeParameter(parameterName)) {
    return context.objectType;
  }

  if (isCardCodeParameter(parameterName)) {
    return context.cardCode;
  }

  if (isDocNumParameter(parameterName)) {
    return context.docNum;
  }

  return undefined;
};

const addParameterIfMissing = (parameters, parameter) => {
  const key = String(parameter.name || '').trim().toUpperCase();
  if (!key || parameters.some((entry) => String(entry.name || '').trim().toUpperCase() === key)) {
    return;
  }

  parameters.push(parameter);
};

const buildDocumentPrintParameters = async ({
  docCode,
  docEntry,
  docKeyValue = '',
  docNum = '',
  schema,
  cardCode = '',
  objectType = '',
} = {}) => {
  const resolvedDocKeyValue = String(docKeyValue || docEntry || '').trim();
  const context = { docEntry, docKeyValue: resolvedDocKeyValue, docNum, schema, cardCode, objectType };
  let layoutParameters = [];

  try {
    layoutParameters = await loadReportParameters(docCode, { reportCompanyDb: schema });
  } catch (_error) {
    layoutParameters = [];
  }

  const parameters = [];

  for (const layoutParameter of layoutParameters) {
    const value = resolveDocumentParameterValue(layoutParameter.paramName, context);
    if (value === undefined || value === null || value === '') {
      continue;
    }

    addParameterIfMissing(parameters, {
      name: layoutParameter.paramName,
      type: layoutParameter.paramType,
      value,
    });
  }

  addParameterIfMissing(parameters, {
    name: 'Dockey@',
    type: 'number',
    value: resolvedDocKeyValue,
  });

  addParameterIfMissing(parameters, {
    name: 'Schema@',
    type: 'string',
    value: schema,
  });

  if (objectType) {
    addParameterIfMissing(parameters, {
      name: 'ObjectId@',
      type: 'string',
      value: objectType,
    });
  }

  return parameters;
};

const chooseDocumentPdfCandidate = (candidates) => {
  const successfulCandidates = candidates
    .filter((candidate) => candidate?.response?.base64Pdf)
    .sort((left, right) => {
      const sizeDelta = String(right.response.base64Pdf).length - String(left.response.base64Pdf).length;
      if (sizeDelta !== 0) return sizeDelta;
      return left.priority - right.priority;
    });

  return successfulCandidates[0] || null;
};

const buildExportDiagnostics = ({ docCode, layoutMetadata, payload, rawResponse }) => ({
  docCode,
  layout: {
    docName: String(layoutMetadata?.DocName || '').trim(),
    typeCode: String(layoutMetadata?.TypeCode || '').trim(),
    status: String(layoutMetadata?.Status || '').trim(),
  },
  payload,
  rawResponse: String(rawResponse || '').slice(0, 500),
});

const exportReportPdf = async ({
  docCode,
  parameters = [],
  fileName = '',
  reportCompanyDb = '',
} = {}, retryOnAuth = true) => {
  const normalizedDocCode = toRequiredString(docCode || env.reportServiceDefaultDocCode, 'DocCode');
  const reportConfig = await resolveReportServiceConfig(reportCompanyDb);
  const normalizedReportCompanyDb = String(reportConfig.companyDb || '').trim();
  const reportSessionKey = getReportSessionKey(reportConfig);
  const layoutMetadata = await getLayoutMetadata(normalizedDocCode, normalizedReportCompanyDb);
  const parameterNames = new Set(
    parameters.map((parameter) => String(parameter?.name || '').trim().toUpperCase()).filter(Boolean),
  );

  if (!layoutMetadata) {
    const error = new Error(`SAP layout ${normalizedDocCode} was not found in RDOC.`);
    error.statusCode = 404;
    throw error;
  }

  if (String(layoutMetadata.Status || '').trim().toUpperCase() !== 'A') {
    const error = new Error(`SAP layout ${normalizedDocCode} (${layoutMetadata.DocName || 'Unknown'}) is not active.`);
    error.statusCode = 422;
    throw error;
  }

  if (isDocumentPrintLayout(layoutMetadata) && !parameterNames.has('DOCKEY@')) {
    const documentTypeLabel = getDocumentTypeLabel(layoutMetadata.TypeCode);
    const error = new Error(
      `SAP layout ${normalizedDocCode} (${layoutMetadata.DocName || 'Unknown'}) is a ${documentTypeLabel} print layout (${layoutMetadata.TypeCode}). It expects document-key parameters like Dockey@ and Schema@, not date-range criteria.`,
    );
    error.statusCode = 422;
    throw error;
  }

  const payload = parameters.map((parameter) => ({
    name: toRequiredString(parameter?.name, 'Parameter name'),
    type: resolveXsdType(parameter?.type),
    value: [[normalizeReportParameterValue(parameter?.value, parameter?.type)]],
  }));

  const reportSessionCookie = await ensureReportSession(normalizedReportCompanyDb);
  const reportClient = getReportClient(reportConfig);

  let response;

  try {
    response = await reportClient.post('/rs/v1/ExportPDFData', payload, {
      params: {
        DocCode: normalizedDocCode,
      },
      headers: {
        Cookie: reportSessionCookie,
      },
    });
  } catch (error) {
    if (retryOnAuth && error.response?.status === 401) {
      reportSessionsByCompany.delete(reportSessionKey);
      await loginToReportService(normalizedReportCompanyDb);
      return exportReportPdf({ docCode, parameters, fileName, reportCompanyDb: normalizedReportCompanyDb }, false);
    }

    throw error;
  }

  const base64Pdf = extractBase64Pdf(response.data);

  if (!base64Pdf) {
    const error = new Error('SAP Report Service returned an empty PDF response.');
    error.statusCode = 502;
    throw error;
  }

  if (isKnownUnsupportedLayoutMessage(base64Pdf)) {
    const error = new Error(`Layout ${normalizedDocCode} is not exportable through the Crystal Report PDF API.`);
    error.statusCode = 422;
    error.diagnostics = buildExportDiagnostics({
      docCode: normalizedDocCode,
      layoutMetadata,
      payload,
      rawResponse: base64Pdf,
    });
    throw error;
  }

  if (isKnownPdfGenerationFailureMessage(base64Pdf)) {
    const error = new Error('SAP Report Service could not generate the PDF for this layout and parameter set.');
    error.statusCode = 422;
    error.diagnostics = buildExportDiagnostics({
      docCode: normalizedDocCode,
      layoutMetadata,
      payload,
      rawResponse: base64Pdf,
    });
    throw error;
  }

  if (!isProbablyBase64(base64Pdf)) {
    const error = new Error(`SAP Report Service returned an unexpected response: ${String(base64Pdf).slice(0, 200)}`);
    error.statusCode = 502;
    error.diagnostics = buildExportDiagnostics({
      docCode: normalizedDocCode,
      layoutMetadata,
      payload,
      rawResponse: base64Pdf,
    });
    throw error;
  }

  return {
    message: 'SAP report PDF generated successfully.',
    base64Pdf,
    mimeType: 'application/pdf',
    fileName: fileName || `${normalizedDocCode}.pdf`,
    docCode: normalizedDocCode,
  };
};

const exportDocumentPdf = async ({
  docEntry,
  docNum = '',
  schema,
  cardCode = '',
  objectType = '',
  docCode,
  documentLabel = 'Document',
  fileName = '',
} = {}, retryOnAuth = true) => {
  const normalizedDocEntry = toRequiredString(docEntry, 'DocEntry');
  const reportConfig = await resolveReportServiceConfig();
  const normalizedSchema = toRequiredString(schema || reportConfig.defaultSchema, 'Schema');
  const normalizedDocCode = toRequiredString(docCode || env.reportServiceDefaultDocCode, 'DocCode');
  const normalizedDocNum = String(docNum || '').trim();
  const normalizedCardCode = String(cardCode || '').trim();
  const normalizedObjectType = String(objectType || '').trim();
  const outputFileName = fileName || `${String(documentLabel || 'document').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${normalizedDocEntry}-${normalizedDocCode}.pdf`;
  const docKeyCandidates = [
    { source: 'DocEntry', value: normalizedDocEntry, priority: 0 },
    ...(normalizedDocNum && normalizedDocNum !== normalizedDocEntry
      ? [{ source: 'DocNum', value: normalizedDocNum, priority: 1 }]
      : []),
  ];
  const exportedCandidates = [];
  let firstError = null;

  for (const candidate of docKeyCandidates) {
    try {
      const parameters = await buildDocumentPrintParameters({
        docCode: normalizedDocCode,
        docEntry: normalizedDocEntry,
        docKeyValue: candidate.value,
        docNum: normalizedDocNum,
        schema: normalizedSchema,
        cardCode: normalizedCardCode,
        objectType: normalizedObjectType,
      });
      const response = await exportReportPdf({
        docCode: normalizedDocCode,
        reportCompanyDb: normalizedSchema,
        parameters,
        fileName: outputFileName,
      }, retryOnAuth);

      exportedCandidates.push({
        ...candidate,
        parameters,
        response,
      });
    } catch (error) {
      firstError ||= error;
    }
  }

  const selectedCandidate = chooseDocumentPdfCandidate(exportedCandidates);

  if (!selectedCandidate) {
    throw firstError || new Error('SAP Report Service could not generate a document PDF.');
  }

  const genericResponse = selectedCandidate.response;

  return {
    message: `${documentLabel} PDF generated successfully.`,
    base64Pdf: genericResponse.base64Pdf,
    mimeType: 'application/pdf',
    fileName: genericResponse.fileName,
    docEntry: normalizedDocEntry,
    docNum: normalizedDocNum,
    cardCode: normalizedCardCode,
    objectType: normalizedObjectType,
    docKeySource: selectedCandidate.source,
    docKeyValue: selectedCandidate.value,
    docCode: normalizedDocCode,
    schema: normalizedSchema,
  };
};

const exportSalesOrderPdf = async ({ docEntry, schema, docCode } = {}, retryOnAuth = true) =>
  exportDocumentPdf({
    docEntry,
    schema,
    docCode,
    documentLabel: 'Sales order',
    fileName: buildFileName({
      docEntry: toRequiredString(docEntry, 'DocEntry'),
      docCode: toRequiredString(docCode || env.reportServiceDefaultDocCode, 'DocCode'),
    }),
  }, retryOnAuth);

const parseJsonPayload = (payload) => {
  if (payload == null) {
    return {};
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) {
      return {};
    }

    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      const error = new Error('SAP Report Service returned an invalid JSON response.');
      error.statusCode = 502;
      throw error;
    }
  }

  if (typeof payload === 'object') {
    return payload;
  }

  return {};
};

const loadReportParameters = async (docCode, optionsOrRetry = {}, retryOverride = undefined) => {
  const normalizedDocCode = toRequiredString(docCode, 'DocCode');
  const options = typeof optionsOrRetry === 'object' && optionsOrRetry !== null
    ? optionsOrRetry
    : {};
  const retryOnAuth = typeof optionsOrRetry === 'boolean'
    ? optionsOrRetry
    : (typeof retryOverride === 'boolean' ? retryOverride : true);
  const reportConfig = await resolveReportServiceConfig(options.reportCompanyDb);
  const reportCompanyDb = String(reportConfig.companyDb || '').trim();
  const reportSessionKey = getReportSessionKey(reportConfig);
  const reportSessionCookie = await ensureReportSession(reportCompanyDb);
  const reportClient = getReportClient(reportConfig);

  let response;

  try {
    response = await reportClient.get('/rs/v1/LoadCR', {
      params: {
        DocCode: normalizedDocCode,
      },
      headers: {
        Cookie: reportSessionCookie,
      },
    });
  } catch (error) {
    if (retryOnAuth && error.response?.status === 401) {
      reportSessionsByCompany.delete(reportSessionKey);
      await loginToReportService(reportCompanyDb);
      return loadReportParameters(normalizedDocCode, options, false);
    }

    throw error;
  }

  const payload = parseJsonPayload(response.data);

  if (normalizeBoolean(payload?.error)) {
    const message =
      String(payload?.message || '').trim() ||
      String(payload?.detail || '').trim() ||
      `SAP Report Service could not load parameters for ${normalizedDocCode}.`;
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  const rows = Array.isArray(payload?.resultSet) ? payload.resultSet : [];

  return rows
    .map((row, index) => normalizeCrParameter(row, index))
    .filter(Boolean)
    .filter((parameter, index, all) =>
      all.findIndex((candidate) => candidate.paramName.toLowerCase() === parameter.paramName.toLowerCase()) === index,
    );
};

const loadAuthorizedCrList = async (query = '', retryOnAuth = true) => {
  const reportConfig = await resolveReportServiceConfig();
  const reportCompanyDb = String(reportConfig.companyDb || '').trim();
  const reportSessionKey = getReportSessionKey(reportConfig);
  const reportSessionCookie = await ensureReportSession(reportCompanyDb);
  const reportClient = getReportClient(reportConfig);

  let response;

  try {
    response = await reportClient.get('/rs/v1/LoadAuthorizedCRList', {
      headers: {
        Cookie: reportSessionCookie,
      },
    });
  } catch (error) {
    if (retryOnAuth && error.response?.status === 401) {
      reportSessionsByCompany.delete(reportSessionKey);
      await loginToReportService(reportCompanyDb);
      return loadAuthorizedCrList(query, false);
    }

    throw error;
  }

  const payload = parseJsonPayload(response.data);
  const rows = Array.isArray(payload?.resultSet) ? payload.resultSet : [];
  const search = String(query || '').trim().toLowerCase();

  return rows
    .map((row) => ({
      code: String(row?.code || '').trim(),
      name: String(row?.name || '').trim(),
      rootName: String(row?.root_name || '').trim(),
      rootGuid: String(row?.root_guid || '').trim(),
    }))
    .filter((row) => row.code)
    .filter((row) => {
      if (!search) {
        return true;
      }

      return (
        row.code.toLowerCase().includes(search) ||
        row.name.toLowerCase().includes(search) ||
        row.rootName.toLowerCase().includes(search)
      );
    })
    .sort((left, right) => {
      const byRoot = left.rootName.localeCompare(right.rootName);
      if (byRoot !== 0) return byRoot;

      const byName = left.name.localeCompare(right.name);
      if (byName !== 0) return byName;

      return left.code.localeCompare(right.code);
    });
};

const clearReportSessions = () => {
  reportSessionsByCompany.clear();
};

module.exports = {
  clearReportSessions,
  loadAuthorizedCrList,
  loadReportParameters,
  isProbablyBase64,
  exportReportPdf,
  exportDocumentPdf,
  exportSalesOrderPdf,
};
