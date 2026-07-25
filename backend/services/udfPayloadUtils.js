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
const normalizeUdfToken = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^U_/, '')
    .replace(/[^A-Z0-9]+/g, '');

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

  if (field && Array.isArray(field.options) && field.options.length) {
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

const isLengthCheckedUdfType = (field = {}) => {
  // Defensive check: handle null or undefined field
  if (!field || typeof field !== 'object') return true;
  const type = String(field.type || '').trim().toLowerCase();
  return !['number', 'date', 'time', 'checkbox'].includes(type);
};

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
  const definitionKeyByToken = definitionsByKey
    ? new Map(Array.from(definitionsByKey.keys()).map((key) => [normalizeUdfToken(key), key]))
    : null;

  return Object.entries(values || {}).reduce((normalized, [key, value]) => {
    if (!isSapUdfKey(key)) return normalized;
    const actualKey = definitionsByKey?.has(key)
      ? key
      : definitionKeyByToken?.get(normalizeUdfToken(key)) || key;
    if (allowedKeys && !allowedKeys.has(actualKey)) return normalized;

    const normalizedValue = normalizeUdfValue(value, definitionsByKey?.get(actualKey), actualKey);
    if (normalizedValue !== undefined) normalized[actualKey] = normalizedValue;
    return normalized;
  }, {});
};

const applyUdfValues = (target, values = {}, allowedKeys = null, definitions = null) => {
  Object.assign(target, normalizeUdfValues(values, allowedKeys, definitions));
  return target;
};

/**
 * Robust UDF application helper with defensive checks, logging, and error handling.
 * - Skips empty/null/undefined values
 * - Logs warnings for unknown UDFs
 * - Validates metadata exists before accessing .type
 * - Returns useful error messages
 *
 * @param {Object} target - Target object to assign UDFs to
 * @param {Object} udfs - UDF values keyed by field name (e.g., { U_TaxReverseCharge: "Y", U_VehicalNo: "ABC123" })
 * @param {Map|Array|null} udfMetadata - UDF metadata (Map, Array of {key, type}, or null)
 * @param {boolean} throwOnUnknownUdf - If true, throw error for unknown UDFs; if false, warn and skip
 * @returns {Object} - Updated target object
 */
const applyUdfsRobust = (target, udfs, udfMetadata = null, throwOnUnknownUdf = false) => {
  if (!target || typeof target !== 'object') {
    throw new Error('applyUdfsRobust: target must be an object');
  }

  if (!udfs || typeof udfs !== 'object') {
    // No UDFs to apply, return target as-is
    return target;
  }

  const definitionsByKey = toUdfDefinitionMap(udfMetadata);

  for (const [fieldName, value] of Object.entries(udfs)) {
    try {
      // Skip non-UDF fields
      if (!isSapUdfKey(fieldName)) {
        continue;
      }

      // Skip empty values
      if (isBlankUdfValue(value)) {
        continue;
      }

      // Get metadata for this UDF
      const meta = definitionsByKey?.get(fieldName);

      // Handle missing metadata
      if (!meta) {
        const errorMsg = `Unknown UDF field: ${fieldName}`;
        if (throwOnUnknownUdf) {
          throw new Error(errorMsg);
        } else {
          console.warn(`[UDF] ${errorMsg}. Value: ${JSON.stringify(value)}. Field will be skipped.`);
          continue;
        }
      }

      // Validate metadata has required properties
      if (!meta || typeof meta !== 'object') {
        const errorMsg = `Invalid UDF metadata for ${fieldName}: metadata is not an object`;
        if (throwOnUnknownUdf) {
          throw new Error(errorMsg);
        } else {
          console.warn(`[UDF] ${errorMsg}. Field will be skipped.`);
          continue;
        }
      }

      // Normalize and validate the value
      const normalizedValue = normalizeUdfValue(value, meta, fieldName);

      // Apply the normalized value
      if (normalizedValue !== undefined && normalizedValue !== null) {
        target[fieldName] = normalizedValue;
      }
    } catch (error) {
      // Log detailed error with context
      console.error(`[UDF] Error processing UDF ${fieldName}:`, error.message);
      if (throwOnUnknownUdf) {
        throw error;
      }
      // Continue processing other UDFs on error
    }
  }

  return target;
};

module.exports = {
  applyUdfValues,
  applyUdfsRobust,
  isBlankUdfValue,
  isSapUdfKey,
  normalizeUdfValue,
  normalizeUdfValues,
  toUdfDefinitionMap,
};
