const FORM_SETTINGS_STORAGE_KEY = 'sapb1.apInvoice.formSettings.v1';

const HEADER_UDF_DEFINITIONS = [];
const ROW_UDF_DEFINITIONS = [];

const BASE_MATRIX_COLUMNS = [
  { key: 'itemNo', label: 'Item No.', minWidth: 160 },
  { key: 'itemDescription', label: 'Item Description', minWidth: 220 },
  { key: 'quantity', label: 'Quantity', minWidth: 90 },
  { key: 'unitPrice', label: 'Unit Price', minWidth: 110 },
  { key: 'stdDiscount', label: 'Discount %', minWidth: 95 },
  { key: 'rate', label: 'Rate', minWidth: 90, readOnly: true },
  { key: 'taxCode', label: 'Tax Code', minWidth: 120 },
  { key: 'grossPriceAfterDisc', label: 'Gross Price after Disc.', minWidth: 160, readOnly: true },
  { key: 'wtaxLiable', label: 'WTax Liable', minWidth: 115, type: 'select', options: ['Y', 'N'], udfLabels: ['WTax Liable'] },
  { key: 'total', label: 'Total (LC)', minWidth: 120, readOnly: true },
  { key: 'whse', label: 'Whse', minWidth: 95 },
  { key: 'glAccount', label: 'G/L Account', minWidth: 130 },
  { key: 'distRule', label: 'Distr. Rule', minWidth: 115 },
  { key: 'consolidatingBp', label: 'Consolidating BP', minWidth: 145, udfLabels: ['Consolidating BP'] },
  { key: 'priceSource', label: 'Price Source', minWidth: 130 },
  { key: 'taxAmountLC', label: 'Tax Amount (LC)', minWidth: 135, readOnly: true },
  { key: 'freight1', label: 'Freight 1', minWidth: 110, udfLabels: ['Freight 1'] },
  { key: 'freight1LC', label: 'Freight 1 (LC)', minWidth: 125, udfLabels: ['Freight 1 (LC)'] },
  { key: 'freight1TaxCode', label: 'Freight 1 Tax Code', minWidth: 150, udfLabels: ['Freight 1 Tax Code'] },
  { key: 'freight1TaxLC', label: 'Freight 1 Tax (LC)', minWidth: 150, udfLabels: ['Freight 1 Tax (LC)'] },
  { key: 'uomCode', label: 'UoM Code', minWidth: 105 },
  { key: 'countryOfOrigin', label: 'Country/Region of Origin', minWidth: 190 },
  { key: 'loc', label: 'Loc.', minWidth: 115, readOnly: true },
  { key: 'blanketAgreementNo', label: 'Blanket Agreement No.', minWidth: 170 },
  { key: 'saudaNodeRef', label: 'Sauda Node Ref', minWidth: 145, udfLabels: ['Sauda Node Ref'] },
  { key: 'apInvDocKey', label: 'AP Inv DocKey', minWidth: 135, udfLabels: ['AP Inv DocKey'] },
  { key: 'apInvDocNum', label: 'AP Inv DocNum', minWidth: 140, udfLabels: ['AP Inv DocNum'] },
  { key: 'apInvLineNum', label: 'AP Inv LineNum', minWidth: 145, udfLabels: ['AP Inv LineNum'] },
  { key: 'assessableValue', label: 'Assessable Value', minWidth: 145, udfLabels: ['Assessable Value'] },
  { key: 'bedRate', label: 'BED Rate', minWidth: 105, udfLabels: ['BED Rate'] },
  { key: 'bedAmount', label: 'BED Amount', minWidth: 120, udfLabels: ['BED Amount'] },
  { key: 'rg23dNo', label: 'RG23DNo', minWidth: 115, udfLabels: ['RG23DNo'] },
  { key: 'specialRebate', label: 'Special Rebate', minWidth: 135, udfLabels: ['Special Rebate'] },
  { key: 'commision', label: 'Commision', minWidth: 115, udfLabels: ['Commision', 'Commission'] },
  { key: 'brokPerQty', label: 'BrokPerQty', minWidth: 120, udfLabels: ['BrokPerQty'] },
  { key: 'sellerItem', label: 'S_Item', minWidth: 115, udfLabels: ['S_Item'] },
  { key: 'sellerUnitPrice', label: 'Unit Price', minWidth: 110, udfLabels: ['Seller Unit Price', 'S Unit Price'] },
  { key: 'sellerQuantity', label: 'S_Qty', minWidth: 95, udfLabels: ['S_Qty'] },
  { key: 'sellerBrokerage', label: 'Seller Brokerage', minWidth: 150, udfLabels: ['Seller Brokerage'] },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage', minWidth: 145, udfLabels: ['Buyer Brokerage'] },
  { key: 'buyerDelivery', label: 'Buyer - Delivery', minWidth: 145, udfLabels: ['Buyer - Delivery'] },
  { key: 'sellerDelivery', label: 'Seller - Delivery', minWidth: 145, udfLabels: ['Seller - Delivery'] },
  { key: 'buyerQuality', label: 'Buyer - Quality', minWidth: 140, udfLabels: ['Buyer - Quality'] },
  { key: 'sellerQuality', label: 'Seller - Quality', minWidth: 145, udfLabels: ['Seller - Quality'] },
  { key: 'buyerPrice', label: 'Buyer - Price', minWidth: 130, udfLabels: ['Buyer - Price'] },
  { key: 'sellerPrice', label: 'Seller - Price', minWidth: 130, udfLabels: ['Seller - Price'] },
  { key: 'buyerSpecialInstruction', label: 'Buyer - Special Instruction', minWidth: 210, udfLabels: ['Buyer - Special Instruction'] },
  { key: 'sellerSpecialInstruction', label: 'Seller - Special Instruction', minWidth: 210, udfLabels: ['Seller - Special Instruction'] },
  { key: 'hsnCode', label: 'HSN', minWidth: 115, udfLabels: ['HSN'] },
  { key: 'sellerBrokerageAmountPer', label: 'Seller Brokerage(Amt./Per)', minWidth: 210, udfLabels: ['Seller Brokerage(Amt./Per)', 'Seller Brokerage Amt Per'] },
  { key: 'sellerBrokeragePercentage', label: 'Seller Brokerage in Percentage', minWidth: 225, udfLabels: ['Seller Brokerage in Percentage'] },
  { key: 'buyerBillDiscount', label: 'Buyer Bill Discount', minWidth: 165, udfLabels: ['Buyer Bill Discount'] },
  { key: 'sellerBillDiscount', label: 'Seller Bill Discount', minWidth: 170, udfLabels: ['Seller Bill Discount'] },
  { key: 'sac', label: 'SAC', minWidth: 105, udfLabels: ['SAC'] },
  { key: 'stcode', label: 'STCODE', minWidth: 115, udfLabels: ['STCODE'] },
  { key: 'buyerTermsOfPayment', label: 'Buyer - Terms of payment', minWidth: 200, udfLabels: ['Buyer - Terms of payment', 'Buyer - Terms of Payment'] },
  { key: 'sellerTermsOfPayment', label: 'Seller - Terms of Payment', minWidth: 205, udfLabels: ['Seller - Terms of Payment'] },
  { key: 'freightPurchase', label: 'Freight Purchase', minWidth: 150, udfLabels: ['Freight Purchase'] },
  { key: 'freightSales', label: 'Freight Sales', minWidth: 130, udfLabels: ['Freight Sales'] },
  { key: 'freightProvider', label: 'Freight Provider', minWidth: 155, udfLabels: ['Freight Provider'] },
  { key: 'freightProviderName', label: 'Freight Provider Name', minWidth: 180, udfLabels: ['Freight Provider Name'] },
  { key: 'documentCreated', label: 'Document Created', minWidth: 160, udfLabels: ['Document Created'] },
  { key: 'brokerageNumber', label: 'Brokerage Number', minWidth: 160, udfLabels: ['Brokerage Number'] },
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
