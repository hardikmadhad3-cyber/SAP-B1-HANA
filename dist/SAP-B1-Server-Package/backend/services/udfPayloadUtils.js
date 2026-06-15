const isSapUdfKey = (key) => String(key || '').trim().toUpperCase().startsWith('U_');

const isBlankUdfValue = (value) => (
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '')
);

const normalizeForCompare = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const compactForCompare = (value) => normalizeForCompare(value).replace(/[^a-z0-9]/g, '');

const toUdfDefinitionMap = (definitions = null) => {
  if (!definitions) return null;
  if (definitions instanceof Map) return definitions;

  if (Array.isArray(definitions)) {
    return new Map(
      definitions
        .map((field) => [field?.key, field])
        .filter(([key]) => isSapUdfKey(key))
    );
  }

  if (typeof definitions === 'object') {
    return new Map(
      Object.entries(definitions)
        .map(([key, field]) => [
          field && typeof field === 'object' && field.key ? field.key : key,
          field && typeof field === 'object' ? field : { key },
        ])
        .filter(([key]) => isSapUdfKey(key))
    );
  }

  return null;
};

const COMMON_UDF_OPTION_ALIASES = {
  UDOCTYPE: {
    taxinvoice: 'INV',
    gsttaxinvoice: 'INV',
    invoice: 'INV',
    billofsupply: 'BIL',
    gstbillofsupply: 'BIL',
    billofentry: 'BOE',
    deliverychallan: 'CHL',
    challan: 'CHL',
    others: 'OTH',
    other: 'OTH',
  },
};

const resolveCommonUdfOptionValue = (key, value) => {
  const aliases = COMMON_UDF_OPTION_ALIASES[compactForCompare(key).toUpperCase()];
  if (!aliases) return undefined;
  return aliases[compactForCompare(value)];
};

const resolveUdfOptionValue = (field, key, value) => {
  const text = String(value ?? '').trim();
  if (!text) return text;

  if (Array.isArray(field?.options) && field.options.length) {
    const normalizedText = normalizeForCompare(text);
    const compactText = compactForCompare(text);
    const matchedOption = field.options.find((option) => (
      normalizeForCompare(option?.value) === normalizedText ||
      normalizeForCompare(option?.label) === normalizedText ||
      compactForCompare(option?.label) === compactText
    ));

    if (matchedOption) return String(matchedOption.value);
  }

  return resolveCommonUdfOptionValue(key, text) ?? text;
};

const isLengthCheckedUdfType = (field = {}) => (
  !['number', 'date', 'time', 'checkbox'].includes(String(field.type || '').trim().toLowerCase())
);

const normalizeUdfValue = (value, field = null, key = '') => {
  if (isBlankUdfValue(value)) return null;

  const normalizedValue = field || key
    ? resolveUdfOptionValue(field, key, value)
    : value;

  if (isBlankUdfValue(normalizedValue)) return null;

  const maxLength = Number(field?.maxLength);
  if (
    isLengthCheckedUdfType(field) &&
    Number.isFinite(maxLength) &&
    maxLength > 0 &&
    String(normalizedValue).length > maxLength
  ) {
    console.warn(
      `[UDF Payload] Skipping ${key || field?.key || 'UDF'} because value length ` +
      `${String(normalizedValue).length} exceeds SAP max length ${maxLength}.`
    );
    return undefined;
  }

  return normalizedValue;
};

const normalizeUdfValues = (values = {}, allowedKeys = null, definitions = null) => {
  const definitionsByKey = toUdfDefinitionMap(definitions);

  return Object.entries(values || {}).reduce((normalized, [key, value]) => {
    if (!isSapUdfKey(key)) return normalized;
    if (allowedKeys && !allowedKeys.has(key)) return normalized;

    const normalizedValue = normalizeUdfValue(value, definitionsByKey?.get(key), key);
    if (normalizedValue !== undefined) normalized[key] = normalizedValue;
    return normalized;
  }, {});
};

const applyUdfValues = (target, values = {}, allowedKeys = null, definitions = null) => {
  Object.assign(target, normalizeUdfValues(values, allowedKeys, definitions));
  return target;
};

module.exports = {
  applyUdfValues,
  isBlankUdfValue,
  isSapUdfKey,
  normalizeUdfValue,
  normalizeUdfValues,
  toUdfDefinitionMap,
};
