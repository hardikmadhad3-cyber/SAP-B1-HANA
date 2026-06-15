import {
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createDefaultFormSettings,
  createUdfState,
} from './APInvoiceForm';

export {
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createDefaultFormSettings,
  createUdfState,
};

export const FORM_SETTINGS_STORAGE_KEY = 'sapb1.apCreditMemo.formSettings.v1';

export const BASE_MATRIX_COLUMNS = [
  { key: 'itemNo', label: 'Item No.', minWidth: 160 },
  { key: 'quantity', label: 'Quantity', minWidth: 90 },
  { key: 'unitPrice', label: 'Unit Price', minWidth: 110 },
  { key: 'stdDiscount', label: 'Discount %', minWidth: 95 },
  { key: 'taxCode', label: 'Tax Code', minWidth: 120 },
  { key: 'wtaxLiable', label: 'WTax Liable', minWidth: 115, type: 'select', options: ['Y', 'N'] },
  { key: 'total', label: 'Total (LC)', minWidth: 120, readOnly: true },
  { key: 'whse', label: 'Whse', minWidth: 95 },
  { key: 'distRule', label: 'Distr. Rule', minWidth: 115, lookup: 'distRule' },
  { key: 'uomCode', label: 'UoM Code', minWidth: 105 },
  { key: 'countryOfOrigin', label: 'Country/Region of Origin', minWidth: 190, lookup: 'country' },
  { key: 'loc', label: 'Loc.', minWidth: 115, lookup: 'location' },
  { key: 'blanketAgreementNo', label: 'Blanket Agreement No.', minWidth: 170 },
  { key: 'saudaNodeRef', label: 'Sauda Node Ref', minWidth: 145, udfLabels: ['Sauda Nodh Ref', 'Sauda Nodh No', 'U_SaudaNodeRef', 'U_SaudaNodhRef'] },
  { key: 'apInvDocKey', label: 'AP Inv DocKey', minWidth: 135, udfLabels: ['U_APInvDocKey', 'U_APInvDocEntry'] },
  { key: 'apInvDocNum', label: 'AP Inv DocNum', minWidth: 140, udfLabels: ['U_APInvDocNum'] },
  { key: 'apInvLineNum', label: 'AP Inv LineNum', minWidth: 145, udfLabels: ['U_APInvLineNum'] },
  { key: 'assessableValue', label: 'Assessable Value', minWidth: 145, udfLabels: ['U_AssessableValue'] },
  { key: 'bedRate', label: 'BED Rate', minWidth: 105, udfLabels: ['BEDRATE', 'U_BEDRate'] },
  { key: 'bedAmount', label: 'BED Amount', minWidth: 120, udfLabels: ['BEDAMOUNT', 'U_BEDAmount'] },
  { key: 'rg23dNo', label: 'RG23DNo', minWidth: 115, udfLabels: ['RG23DNO', 'U_RG23DNo', 'U_RG23DNO'] },
  { key: 'specialRebate', label: 'Special Rebate', minWidth: 135, udfLabels: ['U_SPLRBT', 'U_SpecialRebate'] },
  { key: 'commision', label: 'Commision', minWidth: 115, udfLabels: ['Commission', 'U_COMPRC', 'U_Commision', 'U_Commission'] },
  { key: 'sellerItem', label: 'S_Item', minWidth: 115, lookup: 'item', udfLabels: ['U_S_Item', 'U_SItem'] },
  { key: 'sellerUnitPrice', label: 'Unit Price', minWidth: 110, udfLabels: ['Seller Unit Price', 'S Unit Price', 'U_Unit_Price'] },
  { key: 'sellerQuantity', label: 'S_Qty', minWidth: 95, udfLabels: ['U_S_Qty', 'U_SQty'] },
  { key: 'brokPerQty', label: 'BrokPerQty', minWidth: 120, udfLabels: ['U_S_BrokPerQty', 'U_BrokPerQty'] },
  { key: 'sellerBrokerage', label: 'Seller Brokerage', minWidth: 150, lookup: 'businessPartner', udfLabels: ['U_Brok_Seller', 'U_SellerBrokerage'] },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage', minWidth: 145, lookup: 'businessPartner', udfLabels: ['U_Brok_Buyer', 'U_BuyerBrokerage'] },
  { key: 'buyerDelivery', label: 'Buyer - Delivery', minWidth: 145, udfLabels: ['U_Buyer_Delivery', 'U_BuyerDelivery'] },
  { key: 'sellerDelivery', label: 'Seller - Delivery', minWidth: 145, udfLabels: ['U_Seller_Delivery', 'U_SellerDelivery'] },
  { key: 'buyerQuality', label: 'Buyer - Quality', minWidth: 140, udfLabels: ['U_Buyer_Quality', 'U_BuyerQuality'] },
  { key: 'sellerQuality', label: 'Seller - Quality', minWidth: 145, udfLabels: ['U_Seller_Quality', 'U_SellerQuality'] },
  { key: 'buyerPrice', label: 'Buyer - Price', minWidth: 130, udfLabels: ['U_Buyer_Price', 'U_BuyerPrice'] },
  { key: 'sellerPrice', label: 'Seller - Price', minWidth: 130, udfLabels: ['U_Seller_Price', 'U_SellerPrice'] },
  { key: 'buyerSpecialInstruction', label: 'Buyer - Special Instruction', minWidth: 210, udfLabels: ['U_Buyer_SPINS', 'U_BuyerSpecialInstruction', 'U_BuyerSplInst'] },
  { key: 'sellerSpecialInstruction', label: 'Seller - Special Instruction', minWidth: 210, udfLabels: ['U_Seller_SPINS', 'U_SellerSpecialInstruction', 'U_SellerSplInst'] },
  { key: 'hsnCode', label: 'HSN', minWidth: 115, udfLabels: ['U_HSN'] },
  { key: 'sellerBrokerageAmountPer', label: 'Seller Brokerage(Amt./Per)', minWidth: 210, udfLabels: ['Seller Brokerage Amt Per', 'U_Sel_Brok_AP', 'U_SellerBrokerageAmtPer', 'U_SellBrkAmtPer'] },
  { key: 'sellerBrokeragePercentage', label: 'Seller Brokerage in Percentage', minWidth: 225, udfLabels: ['U_Seller_Brok_Per', 'U_SellerBrokeragePercentage', 'U_SellerBrkPct'] },
  { key: 'buyerBillDiscount', label: 'Buyer Bill Discount', minWidth: 165, udfLabels: ['U_Buyer_Bill_Disc', 'U_BuyerBillDiscount'] },
  { key: 'sellerBillDiscount', label: 'Seller Bill Discount', minWidth: 170, udfLabels: ['U_Seller_Bill_Disc', 'U_SellerBillDiscount'] },
  { key: 'sac', label: 'SAC', minWidth: 105, udfLabels: ['SAC Code', 'U_SAC', 'U_SACCode'] },
  { key: 'stcode', label: 'STCODE', minWidth: 115, udfLabels: ['STCode', 'U_SELLTCODE', 'U_STCODE'] },
  { key: 'buyerTermsOfPayment', label: 'Buyer - Terms of payment', minWidth: 200, lookup: 'paymentTerm', udfLabels: ['Buyer - Terms of Payment', 'U_Buyer_Payment_Terms', 'U_BuyerTermsOfPayment', 'U_BuyerPayTerms'] },
  { key: 'sellerTermsOfPayment', label: 'Seller - Terms of Payment', minWidth: 205, lookup: 'paymentTerm', udfLabels: ['U_Seller_Payment_Terms', 'U_SellerTermsOfPayment', 'U_SellerPayTerms'] },
  { key: 'freightPurchase', label: 'Freight Purchase', minWidth: 150, udfLabels: ['U_Freight_pur', 'U_FreightPurchase'] },
  { key: 'freightSales', label: 'Freight Sales', minWidth: 130, udfLabels: ['U_Freight_sales', 'U_FreightSales'] },
  { key: 'freightProvider', label: 'Freight Provider', minWidth: 155, lookup: 'businessPartner', udfLabels: ['U_Fr_trans', 'U_FreightProvider'] },
  { key: 'freightProviderName', label: 'Freight Provider Name', minWidth: 180, udfLabels: ['U_Fr_trans_name', 'U_FreightProviderName'] },
  { key: 'documentCreated', label: 'Document Created', minWidth: 160, udfLabels: ['U_DocumentCreated'] },
  { key: 'brokerageNumber', label: 'Brokerage Number', minWidth: 160, udfLabels: ['Brokerage No', 'U_BDNum', 'U_BrokerageNumber', 'U_BrokerageNo'] },
];

const buildVisibilitySettings = (definitions = []) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = {
      visible: field.visible !== false,
      active: field.active !== false,
    };
    return acc;
  }, {});

const createDefaultFormSettingsForCreditMemo = (headerUdfs = [], rowUdfs = []) => ({
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
