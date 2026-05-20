export {
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createDefaultFormSettings,
  createUdfState,
  normalizeUdfState,
} from './arInvoiceForm';

export const FORM_SETTINGS_STORAGE_KEY = 'sapb1.arCreditMemo.formSettings.v1';

const buildVisibilitySettings = (definitions = []) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = { visible: field.visible !== undefined ? field.visible : true, active: true };
    return acc;
  }, {});

const createDefaultFormSettingsForCreditMemo = (headerUdfs = [], rowUdfs = []) => ({
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

export const readSavedFormSettings = (headerUdfs = [], rowUdfs = []) => {
  const defaults = createDefaultFormSettingsForCreditMemo(headerUdfs, rowUdfs);

  try {
    const raw = localStorage.getItem(FORM_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    return mergeNestedSettings(defaults, JSON.parse(raw));
  } catch (_error) {
    return defaults;
  }
};
