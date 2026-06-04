const isBlankString = (value) => typeof value === 'string' && value.trim() === '';

const normalizeSapWritePayload = (value) => {
  if (isBlankString(value)) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeSapWritePayload);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  return Object.entries(value).reduce((normalized, [key, nestedValue]) => {
    normalized[key] = normalizeSapWritePayload(nestedValue);
    return normalized;
  }, {});
};

module.exports = {
  isBlankString,
  normalizeSapWritePayload,
};
