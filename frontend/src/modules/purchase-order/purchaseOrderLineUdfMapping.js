import { buildVisibleEnteredRowUdfPayload } from '../../utils/rowUdfPayload';

export const PURCHASE_ORDER_LINE_UDF_FIELD_MAP = {
  packingType: ['U_PackingType', 'U_PACKINGTYPE', 'U_Packing_Type', 'U_PackingStatus', 'U_PACKINGSTATUS'],
  containerType: ['U_ContainerType', 'U_CONTAINERTYPE', 'U_Container_Type'],
  costSheet: ['U_Cost_Sheet', 'U_COSTSHEET', 'U_CostSheet'],
  sac: ['U_SAC', 'U_SACCode', 'U_SAC_CODE'],
  grossWt: ['U_GrossWt', 'U_GROSSWT', 'U_Gross_Wt', 'U_GrossWeight', 'U_GROSSWEIGHT'],
  totalPackage: ['U_TotalPackage', 'U_TOTALPACKAGE', 'U_Total_Package', 'U_TotalPackge'],
  forRate: ['U_ForRate', 'U_FORRATE', 'U_ForPrice', 'U_FORPRICE', 'U_FOR_PRICE', 'U_FORPrice', 'U_FOR_Price'],
  taxCodeRepeat: 'U_TAXCODE',
  price: ['U_PRICE', 'U_Price'],
  sellerBrokerage: 'U_Brok_Seller',
  buyerBrokerage: ['U_Brok_Buyer', 'U_Buyer_Brokerage', 'U_BUYERBROKERAGE', 'U_Brokerage_Buyer'],
  buyerDelivery: 'U_Buyer_Delivery',
  sellerDelivery: 'U_Seller_Delivery',
  buyerPaymentTerms: 'U_Buyer_Payment_Terms',
  sellerPaymentTerms: 'U_Seller_Payment_Term',
  buyerQuality: 'U_Buyer_Quality',
  sellerQuality: 'U_Seller_Quality',
  buyerPrice: 'U_Buyer_Price',
  sellerPrice: 'U_Seller_Price',
  buyerSpecialInstruction: 'U_Buyer_SPINS',
  sellerSpecialInstruction: 'U_Seller_SPINS',
  sellerBrokerageAmtPer: 'U_Sel_Brok_AP',
  sellerBrokeragePercent: 'U_Seller_Brok_Per',
  stcode: 'U_SELLTCODE',
  sellerItem: 'U_S_Item',
  sellerQty: 'U_S_Qty',
  specialRebate: 'U_SPLRBT',
  commission: 'U_COMPRC',
  sellerBrokeragePerQty: 'U_S_BrokPerQty',
  fixBrokBuyer: 'U_Fix_Brock_B',
  fixBrockSeller: 'U_Fix_Brock_S',
};

export const getFirstLineValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value) !== '') return value;
  }
  return '';
};

export const normalizePurchaseOrderUdfKey = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^U_/, '')
    .replace(/[^A-Z0-9]/g, '');

export const getUdfValueByKey = (udf = {}, targetKey = '') => {
  const targetKeys = Array.isArray(targetKey) ? targetKey : [targetKey];
  for (const key of targetKeys) {
    if (Object.prototype.hasOwnProperty.call(udf, key)) return udf[key];
  }

  const targetTokens = new Set(targetKeys.map(normalizePurchaseOrderUdfKey).filter(Boolean));
  const match = Object.entries(udf || {}).find(([key, value]) =>
    targetTokens.has(normalizePurchaseOrderUdfKey(key)) &&
    value !== undefined &&
    value !== null &&
    String(value) !== ''
  );
  return match ? match[1] : undefined;
};

export const hydratePurchaseOrderLineUdfFields = (line = {}) => {
  const udf = line.udf || {};
  const next = Object.entries(PURCHASE_ORDER_LINE_UDF_FIELD_MAP).reduce((mappedLine, [lineKey, udfKey]) => {
    mappedLine[lineKey] = getFirstLineValue(line[lineKey], getUdfValueByKey(udf, udfKey));
    return mappedLine;
  }, { ...line });

  next.commPercent = getFirstLineValue(line.commPercent, line.CommissionPercent, line.CommPercent);
  return next;
};

export const buildPurchaseOrderLineUdfPayload = (line = {}, rowUdfDefinitions = [], formSettings = {}) => {
  const udf = buildVisibleEnteredRowUdfPayload(rowUdfDefinitions, line.udf || {}, formSettings);
  const knownUdfKeyByToken = new Map();

  (rowUdfDefinitions || []).forEach((field) => {
    [
      field?.key,
      field?.sapField,
      field?.aliasId,
      field?.label,
      field?.description,
      field?.Descr,
    ].forEach((candidate) => {
      const token = normalizePurchaseOrderUdfKey(candidate);
      if (field?.key && token && !knownUdfKeyByToken.has(token)) {
        knownUdfKeyByToken.set(token, field.key);
      }
    });
  });

  Object.entries(PURCHASE_ORDER_LINE_UDF_FIELD_MAP).forEach(([lineKey, udfKey]) => {
    const value = line[lineKey];
    const udfKeys = Array.isArray(udfKey) ? udfKey : [udfKey];
    const actualUdfKey = udfKeys.map((key) => knownUdfKeyByToken.get(normalizePurchaseOrderUdfKey(key))).find(Boolean) || udfKeys[0];
    if (actualUdfKey && value !== undefined && value !== null && String(value).trim() !== '') {
      udf[actualUdfKey] = value;
    }
  });

  return udf;
};
