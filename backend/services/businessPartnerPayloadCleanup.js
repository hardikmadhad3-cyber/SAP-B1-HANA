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

module.exports = {
  sanitizeBusinessPartnerForDuplicate,
};
