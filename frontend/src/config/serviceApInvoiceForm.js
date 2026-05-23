const FORM_SETTINGS_STORAGE_KEY = 'sapb1.serviceApInvoice.formSettings.v7';

const HEADER_UDF_DEFINITIONS = [];
const ROW_UDF_DEFINITIONS = [];

const getOptionValue = (option) => (typeof option === 'string' ? option : option?.value ?? '');

const getDefaultUdfValue = (field = {}) => {
  if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
    return field.defaultValue;
  }

  if (field.required && field.type === 'select' && Array.isArray(field.options)) {
    return field.options.map(getOptionValue).find((value) => String(value || '').trim() !== '') ?? '';
  }

  return field.defaultValue ?? '';
};

const createUdfState = (definitions = []) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = getDefaultUdfValue(field);
    return acc;
  }, {});

const normalizeUdfState = (definitions = [], values = {}) =>
  definitions.reduce((acc, field) => {
    const currentValue = values[field.key];
    const shouldApplyDefault =
      currentValue === undefined ||
      currentValue === null ||
      (field.required && String(currentValue) === '');

    acc[field.key] = shouldApplyDefault ? getDefaultUdfValue(field) : currentValue;
    return acc;
  }, {});

const buildVisibilitySettings = (definitions = []) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = { visible: field.visible !== undefined ? field.visible : true, active: true };
    return acc;
  }, {});

const createDefaultFormSettings = (
  headerUdfs = HEADER_UDF_DEFINITIONS,
  rowUdfs = ROW_UDF_DEFINITIONS,
  matrixColumns = [],
) => ({
  matrixColumns: buildVisibilitySettings(matrixColumns),
  headerUdfs: buildVisibilitySettings(headerUdfs),
  rowUdfs: buildVisibilitySettings(rowUdfs),
});

const mergeNestedSettings = (defaults, saved = {}) =>
  Object.keys(defaults).reduce((acc, groupKey) => {
    acc[groupKey] = {
      ...defaults[groupKey],
      ...(saved[groupKey] || {}),
    };
    return acc;
  }, {});

const readSavedFormSettings = (
  headerUdfs = HEADER_UDF_DEFINITIONS,
  rowUdfs = ROW_UDF_DEFINITIONS,
  matrixColumns = [],
  storageKey = FORM_SETTINGS_STORAGE_KEY,
) => {
  const defaults = createDefaultFormSettings(headerUdfs, rowUdfs, matrixColumns);

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    return mergeNestedSettings(defaults, JSON.parse(raw));
  } catch (_error) {
    return defaults;
  }
};

export {
  FORM_SETTINGS_STORAGE_KEY,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createDefaultFormSettings,
  createUdfState,
  normalizeUdfState,
  readSavedFormSettings,
};
