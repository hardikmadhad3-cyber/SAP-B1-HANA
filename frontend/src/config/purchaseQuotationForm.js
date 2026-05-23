const FORM_SETTINGS_STORAGE_KEY = 'sapb1.purchaseQuotation.formSettings.v1';

const HEADER_UDF_DEFINITIONS = [];

const ROW_UDF_DEFINITIONS = [];

const BASE_MATRIX_COLUMNS = [
  { key: 'itemNo', label: 'Item No.', visible: true },
  { key: 'requiredDate', label: 'Required Date', visible: true },
  { key: 'quotedDate', label: 'Quoted Date', visible: true },
  { key: 'requiredQty', label: 'Required Qty.', visible: true },
  { key: 'quantity', label: 'Quoted Qty.', visible: true },
  { key: 'unitPrice', label: 'Unit Price', visible: true },
  { key: 'stdDiscount', label: 'Discount %', visible: true },
  { key: 'taxCode', label: 'Tax Code', visible: true },
  { key: 'totalLC', label: 'Total (LC)', visible: true },
  { key: 'distRule', label: 'Distr. Rule', visible: true },
  { key: 'uomCode', label: 'UoM Code', visible: true },
  { key: 'countryOfOrigin', label: 'Country/Region of Origin', visible: true },
  { key: 'loc', label: 'Loc.', visible: true },
  { key: 'blanketAgreementNo', label: 'Blanket Agreement No.', visible: true },
  { key: 'saudaNodeRef', label: 'Sauda Node Ref', visible: true },
  { key: 'apInvDocKey', label: 'AP Inv DocKey', visible: true },
  { key: 'apInvDocNum', label: 'AP Inv DocNum', visible: true },
  { key: 'apInvLineNum', label: 'AP Inv LineNum', visible: true },
  { key: 'assessableValue', label: 'Assessable Value', visible: true },
  { key: 'bedRate', label: 'BED Rate', visible: true },
  { key: 'bedAmount', label: 'BED Amount', visible: true },
  { key: 'rg23dNo', label: 'RG23DNo', visible: true },
  { key: 'specialRebate', label: 'Special Rebate', visible: true },
  { key: 'commission', label: 'Commision', visible: true },
  { key: 'sellerItem', label: 'S_Item', visible: true },
  { key: 'sellerQty', label: 'S_Qty', visible: true },
  { key: 'sellerBrokeragePerQty', label: 'BrokPerQty', visible: true },
  { key: 'hsnCode', label: 'HSN', visible: true },
  { key: 'sacCode', label: 'SAC', visible: true },
  { key: 'unitPriceUdf', label: 'Unit Price', visible: true },
  { key: 'sellerBrokerage', label: 'Seller Brokerage', visible: true },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage', visible: true },
  { key: 'buyerDelivery', label: 'Buyer - Delivery', visible: true },
  { key: 'sellerDelivery', label: 'Seller - Delivery', visible: true },
  { key: 'buyerPaymentTerms', label: 'Buyer - Terms of payment', visible: true },
  { key: 'sellerPaymentTerms', label: 'Seller - Terms of Payment', visible: true },
  { key: 'buyerQuality', label: 'Buyer - Quality', visible: true },
  { key: 'sellerQuality', label: 'Seller - Quality', visible: true },
  { key: 'buyerPrice', label: 'Buyer - Price', visible: true },
  { key: 'sellerPrice', label: 'Seller - Price', visible: true },
  { key: 'buyerSpecialInstruction', label: 'Buyer - Special Instruction', visible: true },
  { key: 'sellerSpecialInstruction', label: 'Seller - Special Instruction', visible: true },
  { key: 'sellerBrokerageAmtPer', label: 'Seller Brokerage(Amt./Per)', visible: true },
  { key: 'sellerBrokeragePercent', label: 'Seller Brokerage in Percentage', visible: true },
  { key: 'buyerBillDiscount', label: 'Buyer Bill Discount', visible: true },
  { key: 'sellerBillDiscount', label: 'Seller Bill Discount', visible: true },
  { key: 'stcode', label: 'STCODE', visible: true },
  { key: 'freightPurchase', label: 'Freight Purchase', visible: true },
  { key: 'freightSales', label: 'Freight Sales', visible: true },
  { key: 'freightProvider', label: 'Freight Provider', visible: true },
  { key: 'freightProviderName', label: 'Freight Provider Name', visible: true },
  { key: 'documentCreated', label: 'Document Created', visible: true },
  { key: 'brokerageNumber', label: 'Brokerage Number', visible: true },
  { key: 'itemDescription', label: 'Item Description', visible: false },
  { key: 'whse', label: 'Whse', visible: false },
  { key: 'taxAmount', label: 'Tax Amount (LC)', visible: false },
  { key: 'totalBeforeTax', label: 'Total Before Tax', visible: false },
  { key: 'branch', label: 'Branch', visible: false },
];

const getOptionValue = (option) => (typeof option === 'string' ? option : option?.value ?? '');

const getDefaultUdfValue = (field) => {
  if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
    return field.defaultValue;
  }

  if (field.required && field.type === 'select' && Array.isArray(field.options)) {
    return field.options.map(getOptionValue).find((value) => String(value || '').trim() !== '') ?? '';
  }

  return field.defaultValue ?? '';
};

const createUdfState = (definitions = [], values = {}) =>
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
    acc[field.key] = {
      visible: field.visible !== undefined ? field.visible : true,
      active: true,
    };
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

const readSavedFormSettings = (
  headerUdfs = HEADER_UDF_DEFINITIONS,
  rowUdfs = ROW_UDF_DEFINITIONS,
  storageKey = FORM_SETTINGS_STORAGE_KEY,
) => {
  const defaults = createDefaultFormSettings(headerUdfs, rowUdfs);

  try {
    const raw = localStorage.getItem(storageKey);
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
