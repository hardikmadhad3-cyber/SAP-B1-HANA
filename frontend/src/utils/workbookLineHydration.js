const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value) !== '') return value;
  }
  return '';
};

const firstString = (...values) => {
  const value = firstValue(...values);
  return value === '' ? '' : String(value);
};

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^U_/, '')
    .replace(/[^A-Z0-9]+/g, '');

const pickUdfs = (source = {}) =>
  Object.entries(source || {}).reduce((acc, [key, value]) => {
    if (String(key).startsWith('U_')) acc[key] = value == null ? '' : value;
    return acc;
  }, {});

const normalizeUdfMap = (source = {}) =>
  Object.entries(source || {}).reduce((acc, [key, value]) => {
    if (key) acc[key] = value == null ? '' : value;
    return acc;
  }, {});

export const getWorkbookLineUdfs = (line = {}) => ({
  ...pickUdfs(line),
  ...normalizeUdfMap(line.line_udfs),
  ...normalizeUdfMap(line.lineUdfs),
  ...normalizeUdfMap(line.udf),
});

const findUdfValue = (udfs = {}, aliases = []) => {
  const entries = Object.entries(udfs || {});
  for (const alias of aliases) {
    const aliasToken = normalizeToken(alias);
    const match = entries.find(([key]) => normalizeToken(key) === aliasToken);
    if (match && match[1] !== undefined && match[1] !== null && String(match[1]) !== '') {
      return match[1];
    }
  }
  return '';
};

const udfAlias = {
  packingType: ['U_PackingType', 'U_Packing_Type', 'Packing-Type'],
  grossWt: ['U_GrossWt', 'U_Gross_Wt', 'GrossWt'],
  totalPackage: ['U_TotalPackage', 'U_Total_Package', 'Total-Package'],
  costSheet: ['U_Cost_Sheet', 'Cost-Sheet'],
  containerType: ['U_ContainerType', 'U_Container_Type', 'Container Type'],
  specialRebate: ['U_SPLRBT', 'Special Rebate'],
  commission: ['U_COMPRC', 'Commision', 'Commission'],
  sellerBrokeragePerQty: ['U_S_BROKPERQTY', 'BrokPerQty'],
  sellerBrokerage: ['U_BROK_SELLER', 'Seller Brokerage'],
  buyerBrokerage: ['U_BROK_BUYER', 'Buyer Brokerage'],
  buyerDelivery: ['U_BUYER_DELIVERY', 'Buyer - Delivery'],
  sellerDelivery: ['U_SELLER_DELIVERY', 'Seller - Delivery'],
  buyerPaymentTerms: ['U_BUYER_PAYMENT_TERMS', 'U_Buyer_Payment_Term', 'Buyer - Terms of payment'],
  sellerPaymentTerms: ['U_SELLER_PAYMENT_TERM', 'U_SELLER_PAYMENT_TERMS', 'U_Seller_Payment_Ter', 'Seller - Terms of Payment'],
  buyerQuality: ['U_BUYER_QUALITY', 'Buyer - Quality'],
  sellerQuality: ['U_SELLER_QUALITY', 'Seller - Quality'],
  buyerPrice: ['U_BUYER_PRICE', 'Buyer - Price'],
  sellerPrice: ['U_SELLER_PRICE', 'Seller - Price'],
  buyerSpecialInstruction: ['U_BUYER_SPINS', 'Buyer - Special Instruction'],
  sellerSpecialInstruction: ['U_SELLER_SPINS', 'Seller - Special Instruction'],
  sellerBrokerageAmtPer: ['U_SEL_BROK_AP', 'Seller Brokerage(Amt./Per)'],
  sellerBrokeragePercent: ['U_SELLER_BROK_PER', 'Seller Brokerage in Percentage'],
  stcode: ['U_SELLTCODE', 'STCODE'],
  sellerItem: ['U_S_ITEM', 'S_Item'],
  sellerQty: ['U_S_QTY', 'S_Qty'],
  fixBrokBuyer: ['U_Fix_Brock_B', 'U_Fix_Brok_B', 'U_FIX_BROK_BUYER', 'U_FIXBROKBUYER', 'FIX Brok BUYER'],
  fixBrockSeller: ['U_Fix_Brock_S', 'U_Fix_Brok_S', 'U_Fix_Brock_Seller', 'U_FIXBROCKSELLER', 'U_FIXBROKSELLER', 'Fix Brock Seller'],
};

const valueFromLineOrUdf = (line, udfs, key, aliases, ...lineAliases) =>
  firstString(
    line?.[key],
    ...lineAliases.map((alias) => line?.[alias]),
    findUdfValue(udfs, aliases)
  );

export const hydrateWorkbookDocumentLine = ({
  line,
  createLine,
  rowUdfDefinitions = [],
  normalizeUdfState,
  items = [],
  fallbackWarehouse = '',
}) => {
  const source = line || {};
  const udfs = getWorkbookLineUdfs(source);
  const itemCode = firstString(source.itemNo, source.ItemCode, source.itemCode, source.AccountCode, source.AcctCode);
  const item = (items || []).find((candidate) => String(candidate?.ItemCode || '').trim() === itemCode) || {};
  const normalizeUdfs = typeof normalizeUdfState === 'function'
    ? normalizeUdfState
    : (_definitions, values) => values || {};
  const normalizedUdfs = normalizeUdfs(rowUdfDefinitions, udfs);
  const baseLine = typeof createLine === 'function' ? createLine(rowUdfDefinitions) : {};
  const quantity = firstString(source.quantity, source.Quantity, source.OpenQty);
  const unitPrice = firstString(source.unitPrice, source.UnitPrice, source.Price);
  const taxCode = firstString(source.taxCode, source.TaxCode, source.VatGroup);

  return {
    ...baseLine,
    ...source,
    itemNo: itemCode,
    itemDescription: firstString(source.itemDescription, source.ItemDescription, source.Dscription, source.description, source.itemName, item.ItemName),
    quantity,
    openQty: firstString(source.openQty, source.OpenQuantity, source.OpenQty, quantity),
    requiredQty: firstString(source.requiredQty, source.RequiredQty, source.RequiredQuantity),
    requiredDate: firstString(source.requiredDate, source.RequiredDate, source.ReqDate),
    quotedDate: firstString(source.quotedDate, source.QuotedDate, source.ShipDate),
    unitPrice,
    price: firstString(source.price, source.Price, unitPrice),
    unitPriceUdf: firstString(source.unitPriceUdf, source.UnitPriceUdf, findUdfValue(udfs, ['U_Unit_Price']), unitPrice),
    stdDiscount: firstString(source.stdDiscount, source.DiscountPercent, source.DiscPrcnt),
    taxCode,
    taxCodeRepeat: taxCode,
    wTaxLiable: firstString(source.wTaxLiable, source.wtaxLiable, source.WTLiable, 'N'),
    total: firstString(source.total, source.LineTotal, source.TotalLC, source.Total),
    totalLC: firstString(source.totalLC, source.total, source.LineTotal, source.TotalLC, source.Total),
    whse: firstString(source.whse, source.Warehouse, source.WarehouseCode, source.WhsCode, fallbackWarehouse),
    glAccount: firstString(source.glAccount, source.GLAccount, source.AccountCode, source.AcctCode),
    distRule: firstString(source.distRule, source.DistributionRule, source.OcrCode),
    cogsDistRule: firstString(source.cogsDistRule, source.COGSDistributionRule, source.CogsOcrCod, source.DistributionRule, source.OcrCode),
    uomCode: firstString(source.uomCode, source.UoMCode, source.UomCode, source.unitMsr),
    uomName: firstString(source.uomName, source.UoMName, source.UomName, source.unitMsr, source.uomCode, source.UoMCode),
    countryOfOrigin: firstString(source.countryOfOrigin, source.CountryOfOrigin, source.CountryOrg),
    loc: firstString(source.loc, source.Loc, source.Location, source.LocCode),
    branch: firstString(source.branch, source.Branch, source.BranchCode),
    hsnCode: firstString(source.hsnCode, source.HSNCode, source.HsnCode, item.HSNCode, item.SWW, item.U_HSNCode),
    sacCode: firstString(source.sacCode, source.SACCode, source.SacCode),
    taxAmount: firstString(source.taxAmount, source.TaxAmount, source.LineTaxAmount, source.VatSum),
    binLocationAllocation: firstString(source.binLocationAllocation, source.BinLocationAllocation),
    priceAfterDiscount: firstString(source.priceAfterDiscount, source.PriceAfterDiscount),
    itemCost: firstString(source.itemCost, source.ItemCost, item.ItemCost, item.AvgPrice),
    commPercent: firstString(source.commPercent, source.CommissionPercent, source.CommPercent),
    assessableValue: firstString(source.assessableValue, source.AssessableValue),
    blanketAgreementNo: firstString(source.blanketAgreementNo, source.BlanketAgreementNo, source.AgrNo),
    enableSettingCost: firstString(source.enableSettingCost, source.EnableSettingCost, source.EnSetCost, 'N'),
    withoutQtyPosting: firstString(source.withoutQtyPosting, source.WithoutQtyPosting, source.WithoutInventoryMovement, 'N'),
    returnCost: firstString(source.returnCost, source.ReturnCost, source.RetCost),
    packingType: valueFromLineOrUdf(source, udfs, 'packingType', udfAlias.packingType),
    grossWt: valueFromLineOrUdf(source, udfs, 'grossWt', udfAlias.grossWt),
    totalPackage: valueFromLineOrUdf(source, udfs, 'totalPackage', udfAlias.totalPackage),
    costSheet: valueFromLineOrUdf(source, udfs, 'costSheet', udfAlias.costSheet),
    containerType: valueFromLineOrUdf(source, udfs, 'containerType', udfAlias.containerType),
    specialRebate: valueFromLineOrUdf(source, udfs, 'specialRebate', udfAlias.specialRebate, 'SpecialRebate'),
    commission: valueFromLineOrUdf(source, udfs, 'commission', udfAlias.commission, 'Commission'),
    sellerBrokeragePerQty: valueFromLineOrUdf(source, udfs, 'sellerBrokeragePerQty', udfAlias.sellerBrokeragePerQty, 'SellerBrokeragePerQty'),
    sellerBrokerage: valueFromLineOrUdf(source, udfs, 'sellerBrokerage', udfAlias.sellerBrokerage, 'SellerBrokerage'),
    buyerBrokerage: valueFromLineOrUdf(source, udfs, 'buyerBrokerage', udfAlias.buyerBrokerage, 'BuyerBrokerage'),
    buyerDelivery: valueFromLineOrUdf(source, udfs, 'buyerDelivery', udfAlias.buyerDelivery, 'BuyerDelivery'),
    sellerDelivery: valueFromLineOrUdf(source, udfs, 'sellerDelivery', udfAlias.sellerDelivery, 'SellerDelivery'),
    buyerPaymentTerms: valueFromLineOrUdf(source, udfs, 'buyerPaymentTerms', udfAlias.buyerPaymentTerms, 'BuyerPaymentTerms'),
    sellerPaymentTerms: valueFromLineOrUdf(source, udfs, 'sellerPaymentTerms', udfAlias.sellerPaymentTerms, 'SellerPaymentTerms', 'SellerPaymentTerm'),
    buyerQuality: valueFromLineOrUdf(source, udfs, 'buyerQuality', udfAlias.buyerQuality, 'BuyerQuality'),
    sellerQuality: valueFromLineOrUdf(source, udfs, 'sellerQuality', udfAlias.sellerQuality, 'SellerQuality'),
    buyerPrice: valueFromLineOrUdf(source, udfs, 'buyerPrice', udfAlias.buyerPrice, 'BuyerPrice'),
    sellerPrice: valueFromLineOrUdf(source, udfs, 'sellerPrice', udfAlias.sellerPrice, 'SellerPrice'),
    buyerSpecialInstruction: valueFromLineOrUdf(source, udfs, 'buyerSpecialInstruction', udfAlias.buyerSpecialInstruction, 'BuyerSpecialInstruction'),
    sellerSpecialInstruction: valueFromLineOrUdf(source, udfs, 'sellerSpecialInstruction', udfAlias.sellerSpecialInstruction, 'SellerSpecialInstruction'),
    sellerBrokerageAmtPer: valueFromLineOrUdf(source, udfs, 'sellerBrokerageAmtPer', udfAlias.sellerBrokerageAmtPer, 'SellerBrokerageAmtPer'),
    sellerBrokeragePercent: valueFromLineOrUdf(source, udfs, 'sellerBrokeragePercent', udfAlias.sellerBrokeragePercent, 'SellerBrokeragePercent'),
    stcode: valueFromLineOrUdf(source, udfs, 'stcode', udfAlias.stcode, 'STCODE', 'STCode', 'STACode') || taxCode,
    sellerItem: valueFromLineOrUdf(source, udfs, 'sellerItem', udfAlias.sellerItem, 'SellerItem'),
    sellerQty: valueFromLineOrUdf(source, udfs, 'sellerQty', udfAlias.sellerQty, 'SellerQty'),
    U_PackingType: firstString(source.U_PackingType, findUdfValue(udfs, udfAlias.packingType)),
    U_GrossWt: firstString(source.U_GrossWt, findUdfValue(udfs, udfAlias.grossWt)),
    U_TotalPackage: firstString(source.U_TotalPackage, findUdfValue(udfs, udfAlias.totalPackage)),
    U_Cost_Sheet: firstString(source.U_Cost_Sheet, findUdfValue(udfs, udfAlias.costSheet)),
    U_ContainerType: firstString(source.U_ContainerType, findUdfValue(udfs, udfAlias.containerType)),
    U_Fix_Brock_B: firstString(source.U_Fix_Brock_B, source.U_FIX_BROK_BUYER, findUdfValue(udfs, udfAlias.fixBrokBuyer)),
    U_Fix_Brock_S: firstString(source.U_Fix_Brock_S, source.U_Fix_Brock_Seller, findUdfValue(udfs, udfAlias.fixBrockSeller)),
    lineNum: source.lineNum ?? source.LineNum,
    baseEntry: source.baseEntry ?? source.BaseEntry ?? null,
    baseType: source.baseType ?? source.BaseType ?? null,
    baseLine: source.baseLine ?? source.BaseLine ?? null,
    udf: normalizedUdfs,
  };
};
