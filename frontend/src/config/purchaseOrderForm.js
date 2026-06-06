const FORM_SETTINGS_STORAGE_KEY = 'sapb1.purchaseOrder.formSettings.v1';

const HEADER_UDF_DEFINITIONS = [];

const ROW_UDF_DEFINITIONS = [];

const BASE_MATRIX_COLUMNS = [
  { key: 'itemNo', label: 'Item No.' },
  { key: 'itemDescription', label: 'Item Description' },
  { key: 'hsnCode', label: 'HSN Code' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'uomCode', label: 'UoM' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'stdDiscount', label: 'Discount %' },
  { key: 'taxCode', label: 'Tax Code' },
  { key: 'totalBeforeTax', label: 'Total Before Tax' },
  { key: 'total', label: 'Total (LC)' },
  { key: 'whse', label: 'Whse' },
];

const getUdfIdentity = (field = {}) =>
  [
    field.key,
    field.sapField,
    field.aliasId,
    field.label,
    field.description,
    field.Descr,
  ].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '');

const shouldKeepUdfBlankByDefault = (field = {}) => {
  const identity = getUdfIdentity(field);
  return identity.includes('termsofsupply') ||
    identity.includes('supplyterms');
};

const asDefinitionArray = (definitions) => (Array.isArray(definitions) ? definitions : []);

const createUdfState = (definitions = [], values = {}) =>
  asDefinitionArray(definitions).reduce((acc, field) => {
    acc[field.key] = values[field.key] ?? (shouldKeepUdfBlankByDefault(field) ? '' : field.defaultValue ?? '');
    return acc;
  }, {});

const buildVisibilitySettings = (definitions = []) =>
  asDefinitionArray(definitions).reduce((acc, field) => {
    acc[field.key] = {
      visible: field.visible !== false,
      active: field.active !== false,
    };
    return acc;
  }, {});

const createDefaultFormSettings = (
  headerUdfs = HEADER_UDF_DEFINITIONS,
  rowUdfs = ROW_UDF_DEFINITIONS,
  matrixColumns = BASE_MATRIX_COLUMNS,
) => ({
  headerUdfs: buildVisibilitySettings(headerUdfs),
  matrixColumns: buildVisibilitySettings(matrixColumns),
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
  matrixColumns = BASE_MATRIX_COLUMNS,
  storageKey = FORM_SETTINGS_STORAGE_KEY,
) => {
  const effectiveMatrixColumns = Array.isArray(matrixColumns) ? matrixColumns : BASE_MATRIX_COLUMNS;
  const effectiveStorageKey = typeof matrixColumns === 'string' ? matrixColumns : storageKey;
  const defaults = createDefaultFormSettings(headerUdfs, rowUdfs, effectiveMatrixColumns);

  try {
    const raw = localStorage.getItem(effectiveStorageKey);
    if (!raw) return defaults;
    return mergeNestedSettings(defaults, JSON.parse(raw));
  } catch (error) {
    return defaults;
  }
};

export {
  BASE_MATRIX_COLUMNS,
  FORM_SETTINGS_STORAGE_KEY,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createDefaultFormSettings,
  createUdfState,
  readSavedFormSettings,
};
