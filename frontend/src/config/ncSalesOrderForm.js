import {
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createUdfState,
  normalizeUdfState,
  filterSalesOrderRowUdfDefinitions,
} from './salesOrderForm';

export const FORM_SETTINGS_STORAGE_KEY = 'sapb1.ncSalesOrder.formSettings.v2';

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

const DC_MATRIX_COLUMNS = [
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

const BASE_MATRIX_COLUMNS = DC_MATRIX_COLUMNS.map((field) => ({
  ...field,
  visible: REQUESTED_VISIBLE_COLUMNS.has(field.key),
}));

const buildVisibilitySettings = (definitions) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = {
      visible: field.visible !== undefined ? field.visible : true,
      active: true,
    };
    return acc;
  }, {});

const createDefaultFormSettings = () => ({
  headerUdfs: buildVisibilitySettings(HEADER_UDF_DEFINITIONS),
  matrixColumns: buildVisibilitySettings(BASE_MATRIX_COLUMNS),
  rowUdfs: buildVisibilitySettings(ROW_UDF_DEFINITIONS),
});

const mergeNestedSettings = (defaults, saved = {}) =>
  Object.keys(defaults).reduce((acc, groupKey) => {
    acc[groupKey] = {
      ...defaults[groupKey],
      ...(saved[groupKey] || {}),
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
  createDefaultFormSettings,
  createUdfState,
  normalizeUdfState,
  readSavedFormSettings,
  filterSalesOrderRowUdfDefinitions,
};
