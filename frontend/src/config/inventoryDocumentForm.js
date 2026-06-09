export const GOODS_RECEIPT_FORM_SETTINGS_STORAGE_KEY = 'sapb1.goodsReceipt.formSettings.v1';
export const GOODS_ISSUE_FORM_SETTINGS_STORAGE_KEY = 'sapb1.goodsIssue.formSettings.v1';
export const INVENTORY_TRANSFER_FORM_SETTINGS_STORAGE_KEY = 'sapb1.inventoryTransfer.formSettings.v1';
export const INVENTORY_TRANSFER_REQUEST_FORM_SETTINGS_STORAGE_KEY = 'sapb1.inventoryTransferRequest.formSettings.v1';

export const createUdfState = (definitions = [], values = {}) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = values[field.key] ?? field.defaultValue ?? '';
    return acc;
  }, {});

export const normalizeUdfState = (definitions = [], values = {}) =>
  createUdfState(definitions, values);

const buildVisibilitySettings = (definitions = []) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = {
      visible: field.visible !== undefined ? field.visible : true,
      active: true,
    };
    return acc;
  }, {});

export const createDefaultFormSettings = (
  headerUdfFields = [],
  rowUdfFields = [],
  matrixColumns = [],
) => ({
  headerUdfs: buildVisibilitySettings(headerUdfFields),
  matrixColumns: buildVisibilitySettings(matrixColumns),
  rowUdfs: buildVisibilitySettings(rowUdfFields),
});

const mergeFieldSettings = (defaults = {}, saved = {}) =>
  Object.keys(defaults).reduce((acc, groupKey) => {
    acc[groupKey] = {
      ...defaults[groupKey],
      ...(saved[groupKey] || {}),
    };
    return acc;
  }, {});

export const readSavedFormSettings = (
  headerUdfFields = [],
  rowUdfFields = [],
  matrixColumns = [],
  storageKey,
) => {
  const defaults = createDefaultFormSettings(headerUdfFields, rowUdfFields, matrixColumns);

  if (!storageKey || typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    return mergeFieldSettings(defaults, JSON.parse(raw));
  } catch (_error) {
    return defaults;
  }
};

export const GOODS_RECEIPT_MATRIX_COLUMNS = [
  { key: 'itemCode', label: 'Item No.' },
  { key: 'itemDescription', label: 'Item Description' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'total', label: 'Total' },
  { key: 'warehouse', label: 'Whse' },
  { key: 'accountCode', label: 'Account Code' },
  { key: 'itemCost', label: 'Item Cost' },
  { key: 'inventoryUOM', label: 'Inventory UoM' },
  { key: 'uomCode', label: 'UoM Code' },
  { key: 'uomName', label: 'UoM Name' },
  { key: 'distributionRule', label: 'Distr. Rule' },
  { key: 'location', label: 'Location' },
  { key: 'batches', label: 'Batches' },
];

export const INVENTORY_TRANSFER_MATRIX_COLUMNS = [
  { key: 'itemCode', label: 'Item No.' },
  { key: 'itemDescription', label: 'Item Description' },
  { key: 'fromWarehouse', label: 'From Warehouse' },
  { key: 'toWarehouse', label: 'To Warehouse' },
  { key: 'location', label: 'Loc.' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'itemCost', label: 'Item Cost' },
  { key: 'excisable', label: 'Excisable' },
  { key: 'distributionRule', label: 'Distr. Rule' },
  { key: 'uomCode', label: 'UoM Code' },
  { key: 'uomName', label: 'UoM Name' },
];
