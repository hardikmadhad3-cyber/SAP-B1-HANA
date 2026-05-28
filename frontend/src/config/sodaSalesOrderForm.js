import {
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createUdfState,
  normalizeUdfState,
  filterSalesOrderRowUdfDefinitions,
} from './salesOrderForm';

export const FORM_SETTINGS_STORAGE_KEY = 'sapb1.sodaSalesOrder.formSettings.v2';

const normalizeSapUdfKey = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  return normalized.startsWith('U_') ? normalized : `U_${normalized}`;
};

const REQUESTED_VISIBLE_COLUMNS = new Set([
  'itemNo',
  'itemDescription',
  'unit',
  'quantity',
  'unitPrice',
  'discountAmount',
  'amount',
  'netRate',
  'taxableAmount',
  'totalLC',
  'taxCode',
  'taxAmount',
  'stdDiscount',
  'commissionAmountPerTon',
  'commissionPercent',
  'commissionAmount',
  'openQty',
  'countryOfOrigin',
  'loc',
  'hsnCode',
  'sacCode',
]);

const SODA_MATRIX_COLUMN_UDF_KEYS = {
  sellerQuality: 'U_Seller_Quality',
  buyerQuality: 'U_Buyer_Quality',
  sellerPrice: 'U_Seller_Price',
  buyerPrice: 'U_Buyer_Price',
  sellerDelivery: 'U_Seller_Delivery',
  buyerDelivery: 'U_Buyer_Delivery',
  sellerBrokerageAmtPer: 'U_Sel_Brok_AP',
  sellerBrokeragePercent: 'U_Seller_Brok_Per',
  sellerBrokerage: 'U_Brok_Seller',
  buyerBrokerage: 'U_Brok_Buyer',
  qtySpecialInstruction: 'U_Buyer_SPINS',
  deliverySpecialInstruction: 'U_Seller_SPINS',
  buyerBillDiscount: 'U_Buyer_Bill_Disc',
  sellerBillDiscount: 'U_Seller_Bill_Disc',
  stcode: 'U_SELLTCODE',
  specialRebate: 'U_SPLRBT',
  commission: 'U_COMPRC',
  commissionPercent: 'U_COMPRC',
  commissionAmount: 'U_Brok_Seller',
  commissionAmountPerTon: 'U_S_BrokPerQty',
  sellerBrokeragePerQty: 'U_S_BrokPerQty',
  buyerPaymentTerms: 'U_Buyer_Payment_Terms',
  sellerPaymentTerms: 'U_Seller_Payment_Terms',
  freightPurchase: 'U_Freight_pur',
  freightSales: 'U_Freight_sales',
  freightProvider: 'U_Fr_trans',
  freightProviderName: 'U_Fr_trans_name',
  brokerageNumber: 'U_BDNum',
};

const SODA_MATRIX_COLUMNS = [
  { key: 'itemNo', label: 'Item No.' },
  { key: 'itemDescription', label: 'Item Description' },
  { key: 'unit', label: 'Unit' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'discountAmount', label: 'Discount' },
  { key: 'amount', label: 'Amount' },
  { key: 'netRate', label: 'Net Rate' },
  { key: 'taxableAmount', label: 'Taxable Amount' },
  { key: 'totalLC', label: 'Total (LC)' },
  { key: 'taxCode', label: 'Tax Code' },
  { key: 'taxAmount', label: 'Tax Amount (LC)' },
  { key: 'stdDiscount', label: 'Discount %' },
  { key: 'commissionAmountPerTon', label: 'comm amt per tone' },
  { key: 'commissionPercent', label: 'Commission (Percent)' },
  { key: 'commissionAmount', label: 'Commission' },
  { key: 'openQty', label: 'Open Qty' },
  { key: 'countryOfOrigin', label: 'Country/Region of Origin' },
  { key: 'loc', label: 'Loc.' },
  { key: 'hsnCode', label: 'HSN' },
  { key: 'sacCode', label: 'SAC' },
  { key: 'sellerQuality', label: 'Seller - Quality' },
  { key: 'buyerQuality', label: 'Buyer - Quality' },
  { key: 'sellerPrice', label: 'Seller - Price' },
  { key: 'buyerPrice', label: 'Buyer - Price' },
  { key: 'sellerDelivery', label: 'Seller - Delivery' },
  { key: 'buyerDelivery', label: 'Buyer - Delivery' },
  { key: 'sellerBrokerageAmtPer', label: 'Seller Brokerage(Amt./Per)' },
  { key: 'sellerBrokeragePercent', label: 'Seller Brokerage in Percentage' },
  { key: 'sellerBrokerage', label: 'Seller Brokerage' },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage' },
  { key: 'qtySpecialInstruction', label: 'Qty Special Instruction' },
  { key: 'deliverySpecialInstruction', label: 'Delivery Special Instruction' },
  { key: 'buyerBillDiscount', label: 'Buyer Bill Discount' },
  { key: 'sellerBillDiscount', label: 'Seller Bill Discount' },
  { key: 'deliveredQty', label: 'Delivered Qty' },
  { key: 'stcode', label: 'STCODE' },
  { key: 'whse', label: 'Whse' },
  { key: 'distRule', label: 'Distr. Rule' },
  { key: 'freeText', label: 'Free Text' },
  { key: 'uomCode', label: 'UoM Code' },
  { key: 'uomName', label: 'UoM Name' },
  { key: 'specialRebate', label: 'Special Rebate' },
  { key: 'commission', label: 'Commision' },
  { key: 'sellerBrokeragePerQty', label: 'BrokPerQty' },
  { key: 'buyerPaymentTerms', label: 'Buyer - Terms of Payment' },
  { key: 'sellerPaymentTerms', label: 'Seller - Terms of Payment' },
  { key: 'freightPurchase', label: 'Freight Purchase' },
  { key: 'freightSales', label: 'Freight Sales' },
  { key: 'freightProvider', label: 'Freight Provider' },
  { key: 'freightProviderName', label: 'Freight Provider Name' },
  { key: 'documentCreated', label: 'Document Created' },
  { key: 'brokerageNumber', label: 'Brokerage Number' },
];

const BASE_MATRIX_COLUMNS = SODA_MATRIX_COLUMNS.map((field) => ({
  ...field,
  visible: REQUESTED_VISIBLE_COLUMNS.has(field.key),
}));

const buildSapUdfKeySet = (definitions = []) =>
  (definitions || []).reduce((keys, field = {}) => {
    [field.key, field.sapField, field.aliasId].forEach((value) => {
      const normalized = normalizeSapUdfKey(value);
      if (normalized) keys.add(normalized);
    });
    return keys;
  }, new Set());

const buildCompanyMatrixColumnSettings = (rowUdfDefinitions = [], savedSettings = {}) => {
  const availableUdfKeys = buildSapUdfKeySet(rowUdfDefinitions);

  return BASE_MATRIX_COLUMNS.reduce((acc, field) => {
    const requiredUdfKey = SODA_MATRIX_COLUMN_UDF_KEYS[field.key];
    const hasRequiredUdf = !requiredUdfKey || availableUdfKeys.has(normalizeSapUdfKey(requiredUdfKey));
    const savedFieldSettings = { ...(savedSettings[field.key] || {}) };
    delete savedFieldSettings.available;

    acc[field.key] = {
      visible: hasRequiredUdf && REQUESTED_VISIBLE_COLUMNS.has(field.key),
      active: true,
      ...savedFieldSettings,
      available: hasRequiredUdf,
    };

    if (requiredUdfKey && !hasRequiredUdf) {
      acc[field.key].available = false;
    }

    return acc;
  }, {});
};

const buildVisibilitySettings = (definitions, defaultVisible = null) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = {
      visible: defaultVisible !== null ? defaultVisible : (field.visible !== undefined ? field.visible : true),
      active: true,
    };
    return acc;
  }, {});

const stripSavedMatrixAvailability = (settings = {}) =>
  Object.keys(settings || {}).reduce((acc, key) => {
    acc[key] = { ...(settings[key] || {}) };
    delete acc[key].available;
    return acc;
  }, {});

const createDefaultFormSettings = () => ({
  headerUdfs: buildVisibilitySettings(HEADER_UDF_DEFINITIONS),
  matrixColumns: buildVisibilitySettings(BASE_MATRIX_COLUMNS),
  rowUdfs: buildVisibilitySettings(ROW_UDF_DEFINITIONS, false),
});

const mergeNestedSettings = (defaults, saved = {}) =>
  Object.keys(defaults).reduce((acc, groupKey) => {
    const savedGroup = groupKey === 'matrixColumns'
      ? stripSavedMatrixAvailability(saved[groupKey])
      : (saved[groupKey] || {});

    acc[groupKey] = {
      ...defaults[groupKey],
      ...savedGroup,
    };
    return acc;
  }, {});

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
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  buildCompanyMatrixColumnSettings,
  createDefaultFormSettings,
  createUdfState,
  normalizeUdfState,
  readSavedFormSettings,
  filterSalesOrderRowUdfDefinitions,
};
