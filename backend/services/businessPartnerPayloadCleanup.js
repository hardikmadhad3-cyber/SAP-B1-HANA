const SYSTEM_FIELD_NAMES = new Set([
  'AbsoluteEntry',
  'DocEntry',
  'LogInstanc',
  'LogInstance',
  'UserSign',
  'UserSign2',
  'CreateDate',
  'CreateTime',
  'UpdateDate',
  'UpdateTime',
  'DataSource',
  'CurrentAccountBalance',
  'OpenOrdersBalance',
  'OpenDeliveryNotesBalance',
  'OrdersBal',
  'DNotesBal',
  'Balance',
  'BalanceSys',
  'BalanceFC',
  'DunningDate',
  'ValidComm',
  'FrozenComm',
  'AttachmentEntry',
]);

const CHILD_SYSTEM_FIELD_NAMES = new Set([
  'AbsoluteEntry',
  'DocEntry',
  'LineNum',
  'RowNum',
  'InternalCode',
  'InternalKey',
  'CardCode',
  'BPCode',
  'RowNumber',
  'LogInstanc',
  'LogInstance',
  'UserSign',
  'UserSign2',
  'CreateDate',
  'CreateTime',
  'UpdateDate',
  'UpdateTime',
]);

const COMPLIANCE_FIELD_NAMES = new Set([
  'FederalTaxID',
  'VatIDNum',
  'VATRegistrationNumber',
  'UnifiedFederalTaxID',
  'DeductibleAtSource',
  'CertificateNumber',
  'NationalInsuranceNum',
  'EORINumber',
  'GTSRegNo',
  'TaxId0',
  'TaxId1',
  'TaxId2',
  'TaxId3',
  'TaxId4',
  'TaxId5',
  'TaxId6',
  'TaxId7',
  'TaxId8',
  'TaxId9',
  'TaxId10',
  'TaxId11',
  'TaxId12',
  'TaxId13',
  'TaxId14',
  'GSTIN',
  'GstType',
  'U_GSTIN_No',
  'GSTRegnNo',
  'PAN',
  'TinNo',
]);

const COLLECTION_NAMES = new Set([
  'BPAddresses',
  'ContactEmployees',
  'BPBankAccounts',
  'BPPaymentMethods',
  'BPPaymentDates',
  'BPWithholdingTaxCollection',
  'BPFiscalTaxIDCollection',
]);

// Used only when Service Layer metadata cannot be loaded.
const UNSUPPORTED_FISCAL_TAX_FIELDS = new Set([
  'TaxId14',
]);

const metadataSchemasByCompany = new Map();
const METADATA_SCHEMA_TTL_MS = 10 * 60 * 1000;

const COMPLIANCE_KEY_TOKENS = [
  'GSTIN',
  'GSTNO',
  'GSTREG',
  'PAN',
  'TIN',
  'TAN',
  'CIN',
  'IEC',
  'FSSAI',
  'MSME',
  'UDYAM',
  'TAXID',
  'VATREG',
  'GOVTREG',
  'GOVERNMENTREG',
];

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const shouldCopyComplianceFields = () =>
  String(process.env.BP_DUPLICATE_COPY_COMPLIANCE_FIELDS || '').trim().toLowerCase() === 'true';

const isComplianceFieldName = (key = '') => {
  if (COMPLIANCE_FIELD_NAMES.has(key)) return true;
  const token = String(key || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return COMPLIANCE_KEY_TOKENS.some((sensitiveToken) => token.includes(sensitiveToken));
};

const omitEmptyCollectionRows = (collectionName, rows) => {
  if (!Array.isArray(rows)) return rows;
  if (collectionName === 'BPAddresses') {
    return rows.filter((row) => String(row.AddressName || row.Address || '').trim());
  }
  if (collectionName === 'ContactEmployees') {
    return rows.filter((row) => String(row.Name || '').trim());
  }
  if (collectionName === 'BPBankAccounts') {
    return rows.filter((row) => Object.keys(row || {}).some((key) => !CHILD_SYSTEM_FIELD_NAMES.has(key) && row[key] != null && row[key] !== ''));
  }
  return rows;
};

const sanitizeValue = (value, options = {}, depth = 0, parentKey = '') => {
  if (Array.isArray(value)) {
    return omitEmptyCollectionRows(
      parentKey,
      value
        .map((row) => sanitizeValue(row, options, depth + 1, parentKey))
        .filter((row) => row && (!isPlainObject(row) || Object.keys(row).length > 0)),
    );
  }

  if (!isPlainObject(value)) return value;

  const systemFields = depth > 0 ? CHILD_SYSTEM_FIELD_NAMES : SYSTEM_FIELD_NAMES;
  const copyCompliance = options.copyComplianceFields ?? shouldCopyComplianceFields();

  return Object.entries(value).reduce((payload, [key, nestedValue]) => {
    if (systemFields.has(key)) return payload;
    if (!copyCompliance && isComplianceFieldName(key)) return payload;
    if (!copyCompliance && key === 'BPFiscalTaxIDCollection') return payload;
    if (key === '__metadata' || key.startsWith('odata.') || key.startsWith('@odata.')) return payload;
    if (key.startsWith('__')) return payload;

    const sanitized = sanitizeValue(nestedValue, options, depth + 1, key);
    if (sanitized === undefined) return payload;
    if (Array.isArray(sanitized) && sanitized.length === 0 && COLLECTION_NAMES.has(key)) return payload;

    payload[key] = sanitized;
    return payload;
  }, {});
};

const sanitizeBusinessPartnerForDuplicate = (source, overrides = {}, options = {}) => {
  const payload = sanitizeValue(source || {}, options);

  delete payload.CardCode;
  delete payload.Series;

  payload.CardCode = String(overrides.CardCode || '').trim();
  if (Object.prototype.hasOwnProperty.call(overrides, 'CardName')) {
    payload.CardName = String(overrides.CardName ?? '');
  }

  return payload;
};

const sanitizeBusinessPartnerDuplicateOverrides = (source = {}) => {
  const payload = sanitizeValue(source, { copyComplianceFields: true });
  delete payload.CardCode;
  delete payload.Series;
  delete payload._duplicateFromCardCode;
  return payload;
};

const normalizeBusinessPartnerDuplicateForTargetType = (payload = {}, sourceCardType = '', targetCardType = '') => {
  const normalizedSourceType = normalizedText(sourceCardType);
  const normalizedTargetType = normalizedText(targetCardType);
  if (!normalizedSourceType || !normalizedTargetType || normalizedSourceType === normalizedTargetType) {
    return payload;
  }

  const normalized = { ...payload };
  [
    'GroupCode',
    'BPPaymentMethods',
    'PeymentMethodCode',
    'DefaultAccount',
    'DebitorAccount',
    'DownPaymentClearAct',
    'DownPaymentInterimAccount',
    'BPWithholdingTaxCollection',
    'WTCode',
    'SubjectToWithholdingTax',
    'WithholdingTaxCertified',
  ].forEach((field) => delete normalized[field]);
  return normalized;
};

const sanitizeBusinessPartnerPayload = (source = {}) => {
  const payload = { ...source };

  if (Array.isArray(payload.BPFiscalTaxIDCollection)) {
    payload.BPFiscalTaxIDCollection = payload.BPFiscalTaxIDCollection.map((row) => {
      if (!isPlainObject(row)) return row;

      return Object.entries(row).reduce((sanitizedRow, [key, value]) => {
        if (!UNSUPPORTED_FISCAL_TAX_FIELDS.has(key)) sanitizedRow[key] = value;
        return sanitizedRow;
      }, {});
    });
  }

  return payload;
};

const parseAttribute = (attributes, name) => {
  const match = String(attributes || '').match(new RegExp(`\\b${name}="([^"]+)"`));
  return match?.[1] || '';
};

const normalizeMetadataTypeName = (typeName = '') => {
  const collectionMatch = String(typeName).match(/^Collection\((.+)\)$/);
  const normalized = collectionMatch ? collectionMatch[1] : String(typeName);
  return normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.') + 1) : normalized;
};

const parseServiceLayerMetadata = (metadataXml = '') => {
  const schemas = new Map();
  const typeRegex = /<(EntityType|ComplexType)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let typeMatch;

  while ((typeMatch = typeRegex.exec(String(metadataXml))) !== null) {
    const typeName = parseAttribute(typeMatch[2], 'Name');
    if (!typeName) continue;

    const properties = new Map();
    const propertyRegex = /<Property\b([^>]*?)(?:\/>|>[\s\S]*?<\/Property>)/g;
    let propertyMatch;
    while ((propertyMatch = propertyRegex.exec(typeMatch[3])) !== null) {
      const propertyName = parseAttribute(propertyMatch[1], 'Name');
      const propertyType = parseAttribute(propertyMatch[1], 'Type');
      if (propertyName) properties.set(propertyName, propertyType);
    }

    schemas.set(typeName, properties);
  }

  return schemas;
};

const sanitizeByMetadataType = (value, typeName, schemas, removedPaths, path = '') => {
  if (Array.isArray(value)) {
    return value.map((row, index) =>
      sanitizeByMetadataType(row, typeName, schemas, removedPaths, `${path}[${index}]`)
    );
  }

  if (!isPlainObject(value)) return value;

  const properties = schemas.get(normalizeMetadataTypeName(typeName));
  if (!properties) return value;

  return Object.entries(value).reduce((payload, [key, nestedValue]) => {
    const propertyType = properties.get(key);
    const propertyPath = path ? `${path}.${key}` : key;
    if (!propertyType) {
      removedPaths.add(propertyPath);
      return payload;
    }

    const childType = normalizeMetadataTypeName(propertyType);
    payload[key] = schemas.has(childType)
      ? sanitizeByMetadataType(nestedValue, childType, schemas, removedPaths, propertyPath)
      : nestedValue;
    return payload;
  }, {});
};

const getBusinessPartnerMetadataSchemas = async (companyDb, loadMetadataXml) => {
  const cacheKey = String(companyDb || '').trim().toUpperCase();
  const cached = metadataSchemasByCompany.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.schemas;

  const metadataXml = await loadMetadataXml();
  const schemas = parseServiceLayerMetadata(metadataXml);
  if (!schemas.has('BusinessPartner')) {
    throw new Error('SAP Service Layer metadata does not define the BusinessPartner entity.');
  }

  metadataSchemasByCompany.set(cacheKey, {
    schemas,
    expiresAt: Date.now() + METADATA_SCHEMA_TTL_MS,
  });
  return schemas;
};

const sanitizeBusinessPartnerPayloadForSap = async (source, options = {}) => {
  try {
    const schemas = await getBusinessPartnerMetadataSchemas(options.companyDb, options.loadMetadataXml);
    const removedPaths = new Set();
    const payload = sanitizeByMetadataType(source, 'BusinessPartner', schemas, removedPaths);
    return { payload, removedPaths: [...removedPaths] };
  } catch (error) {
    console.warn(`[SAP BP payload] Metadata filtering unavailable; using fallback cleanup: ${error.message}`);
    return { payload: sanitizeBusinessPartnerPayload(source), removedPaths: [] };
  }
};

const normalizedText = (value) => String(value ?? '').trim().toUpperCase();
const normalizedNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const COLLECTION_UPDATE_IDENTITIES = {
  BPAddresses: {
    keys: ['BPCode', 'RowNum'],
    match: (incoming, existing) => (
      normalizedNumber(incoming.RowNum) != null
        ? normalizedNumber(incoming.RowNum) === normalizedNumber(existing.RowNum)
        : normalizedText(incoming.AddressName) === normalizedText(existing.AddressName)
          && normalizedText(incoming.AddressType) === normalizedText(existing.AddressType)
    ),
  },
  ContactEmployees: {
    keys: ['CardCode', 'InternalCode'],
    match: (incoming, existing) => (
      normalizedNumber(incoming.InternalCode) != null
        ? normalizedNumber(incoming.InternalCode) === normalizedNumber(existing.InternalCode)
        : normalizedText(incoming.Name) === normalizedText(existing.Name)
    ),
  },
  BPBankAccounts: {
    keys: ['BPCode', 'InternalKey'],
    match: (incoming, existing) => (
      normalizedNumber(incoming.InternalKey) != null
        ? normalizedNumber(incoming.InternalKey) === normalizedNumber(existing.InternalKey)
        : normalizedText(incoming.Country) === normalizedText(existing.Country)
          && normalizedText(incoming.BankCode) === normalizedText(existing.BankCode)
          && normalizedText(incoming.AccountNo) === normalizedText(existing.AccountNo)
    ),
  },
  BPPaymentMethods: {
    keys: ['BPCode', 'RowNumber'],
    match: (incoming, existing) =>
      normalizedText(incoming.PaymentMethodCode) === normalizedText(existing.PaymentMethodCode),
  },
  BPPaymentDates: {
    keys: ['BPCode', 'RowNumber'],
    match: (incoming, existing) =>
      normalizedText(incoming.PaymentDate) === normalizedText(existing.PaymentDate),
  },
  BPWithholdingTaxCollection: {
    keys: ['BPCode'],
    match: (incoming, existing) => normalizedText(incoming.WTCode) === normalizedText(existing.WTCode),
  },
  BPFiscalTaxIDCollection: {
    keys: ['BPCode'],
    match: (incoming, existing) => (
      normalizedText(incoming.Address) === normalizedText(existing.Address)
      && normalizedText(incoming.AddrType) === normalizedText(existing.AddrType)
    ),
  },
};

const preserveBusinessPartnerUpdateCollectionKeys = (source = {}, current = {}) => {
  const payload = { ...source };

  for (const [collectionName, identity] of Object.entries(COLLECTION_UPDATE_IDENTITIES)) {
    if (!Array.isArray(payload[collectionName])) continue;

    const existingRows = Array.isArray(current[collectionName]) ? current[collectionName] : [];
    payload[collectionName] = payload[collectionName].map((incomingRow) => {
      if (!isPlainObject(incomingRow)) return incomingRow;
      const existingRow = existingRows.find((row) => identity.match(incomingRow, row));
      if (!existingRow) return incomingRow;

      const nextRow = { ...incomingRow };
      for (const key of identity.keys) {
        if (existingRow[key] !== undefined && existingRow[key] !== null) {
          nextRow[key] = existingRow[key];
        }
      }
      return nextRow;
    });
  }

  return payload;
};

module.exports = {
  normalizeBusinessPartnerDuplicateForTargetType,
  preserveBusinessPartnerUpdateCollectionKeys,
  sanitizeBusinessPartnerDuplicateOverrides,
  sanitizeBusinessPartnerPayload,
  sanitizeBusinessPartnerPayloadForSap,
  sanitizeBusinessPartnerForDuplicate,
  parseServiceLayerMetadata,
};
