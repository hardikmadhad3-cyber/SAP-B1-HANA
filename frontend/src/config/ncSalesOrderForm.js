import {
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createUdfState,
  normalizeUdfState,
  filterSalesOrderRowUdfDefinitions,
} from './salesOrderForm';

export const FORM_SETTINGS_STORAGE_KEY = 'sapb1.ncSalesOrder.formSettings.v2';
const FORM_SETTINGS_LAYOUT_VERSION = 3;

const NC_MATRIX_COLUMN_DEFINITIONS = [
  { key: 'itemNo', label: 'Item No.', standard: true },
  { key: 'itemDescription', label: 'Item Description', standard: true },
  { key: 'sellerQuality', label: 'Seller - Quality', sapFields: ['U_Seller_Quality'] },
  { key: 'buyerQuality', label: 'Buyer - Quality', sapFields: ['U_Buyer_Quality'] },
  { key: 'quantity', label: 'Quantity', standard: true },
  { key: 'unitPrice', label: 'Unit Price', standard: true },
  { key: 'sellerPrice', label: 'Seller - Price', sapFields: ['U_Seller_Price'] },
  { key: 'buyerPrice', label: 'Buyer - Price', sapFields: ['U_Buyer_Price'] },
  { key: 'sellerDelivery', label: 'Seller - Delivery', sapFields: ['U_Seller_Delivery'] },
  { key: 'buyerDelivery', label: 'Buyer - Delivery', sapFields: ['U_Buyer_Delivery'] },
  { key: 'sellerBrokerageAmtPer', label: 'Seller Brokerage(Amt./Per)', sapFields: ['U_Sel_Brok_AP'] },
  { key: 'sellerBrokeragePercent', label: 'Seller Brokerage in Percentage', sapFields: ['U_Seller_Brok_Per'] },
  { key: 'sellerBrokerage', label: 'Seller Brokerage', sapFields: ['U_Brok_Seller'] },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage', sapFields: ['U_Brok_Buyer'] },
  { key: 'qtySpecialInstruction', label: 'Qty Special Instruction', sapFields: ['U_Buyer_SPINS'] },
  { key: 'deliverySpecialInstruction', label: 'Delivery Special Instruction', sapFields: ['U_Seller_SPINS'] },
  { key: 'buyerBillDiscount', label: 'Buyer Bill Discount', sapFields: ['U_Buyer_Bill_Disc'] },
  { key: 'sellerBillDiscount', label: 'Seller Bill Discount', sapFields: ['U_Seller_Bill_Disc'] },
  { key: 'deliveredQty', label: 'Delivered Qty', standard: true },
  { key: 'stdDiscount', label: 'Discount %', standard: true },
  { key: 'stcode', label: 'STCODE', sapFields: ['U_SELLTCODE'] },
  { key: 'taxCode', label: 'Tax Code', standard: true },
  { key: 'taxAmount', label: 'Tax Amount (LC)', standard: true },
  { key: 'totalLC', label: 'Total (LC)', standard: true },
  { key: 'whse', label: 'Whse', standard: true },
  { key: 'distRule', label: 'Distr. Rule', standard: true },
  { key: 'openQty', label: 'Open Qty', standard: true },
  { key: 'countryOfOrigin', label: 'Country/Region of Origin', standard: true },
  { key: 'freeText', label: 'Free Text', standard: true },
  { key: 'uomCode', label: 'UoM Code', standard: true },
  { key: 'uomName', label: 'UoM Name', standard: true },
  { key: 'loc', label: 'Loc.', standard: true },
  { key: 'specialRebate', label: 'Special Rebate', sapFields: ['U_SPLRBT'] },
  { key: 'commission', label: 'Commision', sapFields: ['U_COMPRC'] },
  { key: 'hsnCode', label: 'HSN', standard: true },
  { key: 'unitPriceUdf', label: 'Unit Price', sapFields: ['U_Unit_Price'] },
  { key: 'sacCode', label: 'SAC', standard: true },
  { key: 'buyerPaymentTerms', label: 'Buyer - Terms of Payment', sapFields: ['U_Buyer_Payment_Terms'] },
  { key: 'sellerPaymentTerms', label: 'Seller - Terms of Payment', sapFields: ['U_Seller_Payment_Terms'] },
  { key: 'freightPurchase', label: 'Freight Purchase', sapFields: ['U_Freight_pur'] },
  { key: 'freightSales', label: 'Freight Sales', sapFields: ['U_Freight_sales'] },
  { key: 'freightProvider', label: 'Freight Provider', sapFields: ['U_Fr_trans'] },
  { key: 'freightProviderName', label: 'Freight Provider Name', sapFields: ['U_Fr_trans_name'] },
  { key: 'documentCreated', label: 'Document Created', standard: true },
  { key: 'brokerageNumber', label: 'Brokerage Number', sapFields: ['U_BDNum'] },
];

const normalizeSapField = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^U_/, '')
    .replace(/[^A-Z0-9]+/g, '');

const getUdfMatchTokens = (field = {}) => [
  field.key,
  field.sapField,
  field.aliasId,
  field.label,
  field.description,
  field.Descr,
].map(normalizeSapField).filter(Boolean);

const findMatchingUdf = (definition, rowUdfFields) => {
  const candidates = new Set(
    (definition.sapFields || [])
      .flatMap((fieldName) => [fieldName, String(fieldName || '').replace(/^U_/i, '')])
      .map(normalizeSapField)
      .filter(Boolean)
  );

  if (!candidates.size) return null;

  return (rowUdfFields || []).find((field) =>
    getUdfMatchTokens(field).some((token) => candidates.has(token))
  ) || null;
};

const buildNCSalesOrderMatrixColumns = (rowUdfFields = []) => {
  const hasLiveUdfMetadata = (rowUdfFields || []).some((field) =>
    field?.fieldId !== undefined || field?.tableId || field?.sapField || field?.aliasId
  );

  return NC_MATRIX_COLUMN_DEFINITIONS.reduce((columns, definition) => {
    const matchingUdf = findMatchingUdf(definition, rowUdfFields);
    const shouldInclude = definition.standard || matchingUdf || !hasLiveUdfMetadata;

    if (!shouldInclude) return columns;

    columns.push({
      ...definition,
      label: matchingUdf?.label || definition.label,
      visible: true,
      sapField: matchingUdf?.sapField || matchingUdf?.key || definition.sapFields?.[0],
      fieldId: matchingUdf?.fieldId,
      aliasId: matchingUdf?.aliasId,
    });
    return columns;
  }, []);
};

const BASE_MATRIX_COLUMNS = buildNCSalesOrderMatrixColumns(ROW_UDF_DEFINITIONS);

const buildVisibilitySettings = (definitions) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = {
      visible: field.visible !== undefined ? field.visible : true,
      active: true,
    };
    return acc;
  }, {});

const createDefaultFormSettings = () => ({
  _layoutVersion: FORM_SETTINGS_LAYOUT_VERSION,
  headerUdfs: buildVisibilitySettings(HEADER_UDF_DEFINITIONS),
  matrixColumns: buildVisibilitySettings(BASE_MATRIX_COLUMNS),
  rowUdfs: buildVisibilitySettings(ROW_UDF_DEFINITIONS),
});

const mergeNestedSettings = (defaults, saved = {}) => {
  const savedLayoutVersion = Number(saved?._layoutVersion || 0);
  const savedSettings = savedLayoutVersion >= FORM_SETTINGS_LAYOUT_VERSION
    ? saved
    : { ...saved, matrixColumns: {} };

  return Object.keys(defaults).reduce((acc, groupKey) => {
    if (groupKey === '_layoutVersion') {
      acc[groupKey] = FORM_SETTINGS_LAYOUT_VERSION;
      return acc;
    }

    acc[groupKey] = {
      ...defaults[groupKey],
      ...(savedSettings[groupKey] || {}),
    };
    return acc;
  }, {});
};

const readSavedFormSettings = (storageKey = FORM_SETTINGS_STORAGE_KEY) => {
  const defaults = createDefaultFormSettings();

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    return mergeNestedSettings(defaults, JSON.parse(raw));
  } catch (error) {
    return defaults;
  }
};

export {
  BASE_MATRIX_COLUMNS,
  FORM_SETTINGS_LAYOUT_VERSION,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  buildNCSalesOrderMatrixColumns,
  createDefaultFormSettings,
  createUdfState,
  normalizeUdfState,
  readSavedFormSettings,
  filterSalesOrderRowUdfDefinitions,
};
