const isSapUdfKey = (key) => String(key || '').trim().toUpperCase().startsWith('U_');

const isBlankUdfValue = (value) => (
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '')
);

const normalizeUdfValue = (value) => (isBlankUdfValue(value) ? null : value);

const normalizeUdfValues = (values = {}, allowedKeys = null) =>
  Object.entries(values || {}).reduce((normalized, [key, value]) => {
    if (!isSapUdfKey(key)) return normalized;
    if (allowedKeys && !allowedKeys.has(key)) return normalized;

    normalized[key] = normalizeUdfValue(value);
    return normalized;
  }, {});

const applyUdfValues = (target, values = {}, allowedKeys = null) => {
  Object.assign(target, normalizeUdfValues(values, allowedKeys));
  return target;
};

module.exports = {
  applyUdfValues,
  isBlankUdfValue,
  isSapUdfKey,
  normalizeUdfValue,
  normalizeUdfValues,
};
