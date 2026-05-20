const FORM_SETTINGS_STORAGE_KEY = 'sapb1.apInvoice.formSettings.v1';

const HEADER_UDF_DEFINITIONS = [];
const ROW_UDF_DEFINITIONS = [];

const BASE_MATRIX_COLUMNS = [
  { key: 'itemNo', label: 'Item No.' },
  { key: 'itemDescription', label: 'Item Description' },
  { key: 'hsnCode', label: 'HSN Code' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'openQty', label: 'Open Qty' },
  { key: 'uomCode', label: 'UoM' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'stdDiscount', label: 'Discount %' },
  { key: 'taxCode', label: 'Tax Code' },
  { key: 'totalBeforeTax', label: 'Total Before Tax' },
  { key: 'total', label: 'Total (LC)' },
  { key: 'whse', label: 'Whse' },
];

const createUdfState = (definitions = [], values = {}) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = values[field.key] ?? field.defaultValue ?? '';
    return acc;
  }, {});

const buildVisibilitySettings = (definitions = []) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = { visible: true, active: true };
    return acc;
  }, {});

const createDefaultFormSettings = (headerUdfs = HEADER_UDF_DEFINITIONS, rowUdfs = ROW_UDF_DEFINITIONS) => ({
  headerUdfs: buildVisibilitySettings(headerUdfs),
  matrixColumns: buildVisibilitySettings(BASE_MATRIX_COLUMNS),
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

const readSavedFormSettings = (headerUdfs = HEADER_UDF_DEFINITIONS, rowUdfs = ROW_UDF_DEFINITIONS) => {
  const defaults = createDefaultFormSettings(headerUdfs, rowUdfs);

  try {
    const raw = localStorage.getItem(FORM_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    return mergeNestedSettings(defaults, JSON.parse(raw));
  } catch (_error) {
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
