export {
  BASE_MATRIX_COLUMNS,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createDefaultFormSettings,
  createUdfState,
} from './APInvoiceForm';

export const FORM_SETTINGS_STORAGE_KEY = 'sapb1.apCreditMemo.formSettings.v1';

const buildVisibilitySettings = (definitions = []) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = { visible: true, active: true };
    return acc;
  }, {});

const createDefaultFormSettingsForCreditMemo = (headerUdfs = [], rowUdfs = []) => ({
  headerUdfs: buildVisibilitySettings(headerUdfs),
  matrixColumns: buildVisibilitySettings([
    { key: 'itemNo' },
    { key: 'itemDescription' },
    { key: 'hsnCode' },
    { key: 'quantity' },
    { key: 'openQty' },
    { key: 'uomCode' },
    { key: 'unitPrice' },
    { key: 'stdDiscount' },
    { key: 'taxCode' },
    { key: 'totalBeforeTax' },
    { key: 'total' },
    { key: 'whse' },
  ]),
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

export const readSavedFormSettings = (
  headerUdfs = [],
  rowUdfs = [],
  storageKey = FORM_SETTINGS_STORAGE_KEY,
) => {
  const defaults = createDefaultFormSettingsForCreditMemo(headerUdfs, rowUdfs);

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    return mergeNestedSettings(defaults, JSON.parse(raw));
  } catch (_error) {
    return defaults;
  }
};
