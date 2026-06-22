const normalizeLayoutToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^u_/, '')
    .replace(/[^a-z0-9]+/g, '');

const COLUMN_ALIASES = {
  itemNo: ['ItemCode', 'Item No.', 'ItemNo'],
  itemDescription: ['Dscription', 'Description', 'Item Description'],
  description: ['Dscription', 'Description', 'Item Description'],
  hsnCode: ['HsnEntry', 'HsnCode', 'HSN', 'HSN/SAC'],
  sac: ['SacEntry', 'SacCode', 'SAC'],
  sacCode: ['SacEntry', 'SacCode', 'SAC'],
  quantity: ['Quantity', 'Qty', 'Quoted Qty.'],
  requiredQty: ['ReqQty', 'Required Qty.', 'Required Quantity'],
  requiredDate: ['ReqDate', 'Required Date'],
  quotedDate: ['ShipDate', 'Quoted Date', 'Delivery Date'],
  uomCode: ['UomCode', 'unitMsr', 'UoM Code', 'UoM'],
  uomName: ['UomName', 'UoM Name'],
  unitPrice: ['Price', 'PriceBefDi', 'UnitPrice', 'Unit Price'],
  unitPriceUdf: ['U_PRICE', 'U_Price'],
  stdDiscount: ['DiscPrcnt', 'Discount %', 'Disc%'],
  taxCode: ['TaxCode', 'VatGroup', 'Tax Code'],
  taxAmount: ['VatSum', 'Tax Amount (LC)'],
  taxAmountLC: ['VatSum', 'Tax Amount (LC)'],
  totalBeforeTax: ['LineTotal', 'Total Before Tax'],
  totalLC: ['LineTotal', 'Total (LC)', 'Total'],
  total: ['LineTotal', 'GTotal', 'Total', 'Total (LC)'],
  whse: ['WhsCode', 'Warehouse', 'Whse'],
  openQty: ['OpenQty', 'Open Qty', 'Ordered Qty'],
  distRule: ['OcrCode', 'DistributionRule', 'Distr. Rule'],
  glAccount: ['AcctCode', 'AccountCode', 'G/L Account', 'GL Account'],
  glAccountName: ['AcctName', 'AccountName', 'G/L Account Name'],
  wtaxLiable: ['WTLiable', 'WTax Liable'],
  loc: ['LocCode', 'Location', 'Loc.'],
  countryOfOrigin: ['CountryOrg', 'Country/Region of Origin'],
  blanketAgreementNo: ['AgrNo', 'Blanket Agreement No.'],
  U_Cost_Sheet: ['U_Cost_Sheet', 'U_COST_SHEET', 'U_COSTSHEET', 'Cost-Sheet'],
  U_PackingType: ['U_PackingType', 'U_PACKINGTYPE', 'U_Packing_Type', 'Packing-Type', 'PackingType'],
  U_ContainerType: ['U_ContainerType', 'U_CONTAINERTYPE', 'U_Container_Type', 'Container Type'],
  U_GrossWt: ['U_GrossWt', 'U_GROSSWT', 'U_Gross_Wt', 'GrossWt', 'Gross Weight'],
  U_TotalPackage: ['U_TotalPackage', 'U_TOTALPACKAGE', 'U_Total_Package', 'Total-Package', 'TotalPackage'],
  taxCodeRepeat: ['U_TAXCODE', 'TaxCode'],
  price: ['U_PRICE', 'U_Price', 'Price'],
  saudaNodeRef: ['U_SaudaNodeRef', 'Sauda Node Ref'],
  apInvDocKey: ['U_APInvDocKey', 'AP Inv DocKey', 'AP Inv DocEntry'],
  apInvDocNum: ['U_APInvDocNum', 'AP Inv DocNum'],
  apInvLineNum: ['U_APInvLineNum', 'AP Inv LineNum'],
  rg23dNo: ['U_RG23DNo', 'RG23DNo'],
  rg23DNo: ['U_RG23DNo', 'RG23DNo'],
  specialRebate: ['U_SPLRBT', 'Special Rebate'],
  commPercent: ['Commission', 'CommissionPercent', 'Commission Percentage', 'Comm. %', 'CommPercent', 'CommPrcnt', 'CommPrCnt'],
  commission: ['U_COMPRC', 'Commision', 'Commission'],
  commision: ['U_COMPRC', 'Commision', 'Commission'],
  sellerItem: ['U_S_Item', 'S_Item', 'S Item'],
  sItem: ['U_S_Item', 'S_Item', 'S Item'],
  sellerQty: ['U_S_Qty', 'S_Qty', 'S Qty'],
  sQty: ['U_S_Qty', 'S_Qty', 'S Qty'],
  sellerBrokeragePerQty: ['U_S_BrokPerQty', 'BrokPerQty'],
  brokPerQty: ['U_S_BrokPerQty', 'BrokPerQty'],
  U_Fix_Brock_B: ['U_Fix_Brock_B', 'U_Fix_Brok_B', 'U_FIX_BROK_BUYER', 'U_FIXBROKBUYER', 'FIX Brok BUYER'],
  U_Fix_Brock_S: ['U_Fix_Brock_S', 'U_Fix_Brok_S', 'U_FIXBROCKSELLER', 'U_FIXBROKSELLER', 'Fix Brock Seller'],
  sellerBrokerage: ['U_Brok_Seller', 'Seller Brokerage'],
  buyerBrokerage: ['U_Brok_Buyer', 'Buyer Brokerage'],
  buyerDelivery: ['U_Buyer_Delivery', 'Buyer - Delivery'],
  sellerDelivery: ['U_Seller_Delivery', 'Seller - Delivery'],
  buyerPaymentTerms: ['U_Buyer_Payment_Terms', 'Buyer - Terms of payment'],
  buyerTermsOfPayment: ['U_Buyer_Payment_Terms', 'Buyer - Terms of payment'],
  sellerPaymentTerms: ['U_Seller_Payment_Term', 'U_Seller_Payment_Terms', 'Seller - Terms of Payment'],
  sellerTermsOfPayment: ['U_Seller_Payment_Term', 'U_Seller_Payment_Terms', 'Seller - Terms of Payment'],
  buyerQuality: ['U_Buyer_Quality', 'Buyer - Quality'],
  sellerQuality: ['U_Seller_Quality', 'Seller - Quality'],
  buyerPrice: ['U_Buyer_Price', 'Buyer - Price'],
  sellerPrice: ['U_Seller_Price', 'Seller - Price'],
  buyerSpecialInstruction: ['U_Buyer_SPINS', 'Buyer - Special Instruction'],
  sellerSpecialInstruction: ['U_Seller_SPINS', 'Seller - Special Instruction'],
  sellerBrokerageAmtPer: ['U_Sel_Brok_AP', 'Seller Brokerage(Amt./Per)'],
  sellerBrokeragePercent: ['U_Seller_Brok_Per', 'Seller Brokerage in Percentage'],
  sellerBrokeragePercentage: ['U_Seller_Brok_Per', 'Seller Brokerage in Percentage'],
  buyerBillDiscount: ['U_BuyerBillDiscount', 'Buyer Bill Discount'],
  sellerBillDiscount: ['U_SellerBillDiscount', 'Seller Bill Discount'],
  stcode: ['U_SELLTCODE', 'U_STCODE', 'STCODE'],
  freightPurchase: ['U_FreightPurchase', 'Freight Purchase'],
  freightSales: ['U_FreightSales', 'Freight Sales'],
  freightProvider: ['U_FreightProvider', 'Freight Provider'],
  freightProviderName: ['U_FreightProviderName', 'Freight Provider Name'],
  documentCreated: ['U_DocumentCreated', 'Document Created'],
  brokerageNumber: ['U_BrokerageNumber', 'Brokerage Number'],
};

const getColumnTokens = (column = {}) => [
  column.key,
  column.label,
  column.sapField,
  column.fieldName,
  column.columnTitle,
  column.columnUid,
  ...(column.aliases || []),
  ...(COLUMN_ALIASES[column.key] || []),
].map(normalizeLayoutToken).filter(Boolean);

const getLayoutTokens = (column = {}) => [
  column.fieldName,
  column.columnTitle,
  column.columnUid,
  column.key,
  column.label,
].map(normalizeLayoutToken).filter(Boolean);

const isUdfIdentifier = (value) => String(value || '').trim().toUpperCase().startsWith('U_');

const isUdfColumn = (column = {}) => Boolean(column.isUdf) || [
  column.key,
  column.sapField,
  column.fieldName,
  column.columnUid,
  ...(column.aliases || []),
].some(isUdfIdentifier);

const isUdfLayoutColumn = (column = {}) => [
  column.fieldName,
  column.columnUid,
  column.key,
].some(isUdfIdentifier);

const indexColumnsByToken = (columns = []) => {
  const index = new Map();
  columns.forEach((column) => {
    getColumnTokens(column).forEach((token) => {
      if (!index.has(token)) index.set(token, []);
      index.get(token).push(column);
    });
  });
  return index;
};

const pickMatchingColumn = (layoutColumn, index, usedKeys) => {
  const layoutIsUdf = isUdfLayoutColumn(layoutColumn);
  for (const token of getLayoutTokens(layoutColumn)) {
    const matches = index.get(token) || [];
    const unused = matches.find((column) => (
      !usedKeys.has(column.key) &&
      (!layoutIsUdf || isUdfColumn(column))
    ));
    if (unused) return unused;
  }
  return null;
};

const getLayoutWidth = (layoutColumn, fallback) => (
  Number(layoutColumn?.width) || Number(layoutColumn?.minWidth) || fallback || 125
);

const buildMatrixColumnsFromSapLayout = ({
  baseColumns = [],
  layoutColumns = [],
  fallbackColumns = baseColumns,
} = {}) => {
  const localColumns = Array.isArray(baseColumns) && baseColumns.length ? baseColumns : fallbackColumns;
  const visibleLayout = Array.isArray(layoutColumns) ? layoutColumns : [];
  if (!visibleLayout.length) return localColumns;

  const index = indexColumnsByToken(localColumns);
  const usedKeys = new Set();
  const ordered = [];

  visibleLayout
    .slice()
    .sort((left, right) => Number(left.columnOrder ?? 0) - Number(right.columnOrder ?? 0))
    .forEach((layoutColumn) => {
      const matched = pickMatchingColumn(layoutColumn, index, usedKeys);
      if (!matched?.key) return;
      usedKeys.add(matched.key);
      ordered.push({
        ...matched,
        label: layoutColumn.columnTitle || matched.label,
        minWidth: getLayoutWidth(layoutColumn, matched.minWidth || matched.width),
        width: getLayoutWidth(layoutColumn, matched.width || matched.minWidth),
        visible: layoutColumn.visible !== false,
        active: layoutColumn.editable !== false,
        sapLayoutColumn: layoutColumn,
      });
    });

  localColumns.forEach((column) => {
    if (usedKeys.has(column.key)) return;
    ordered.push({
      ...column,
      visible: column.visible !== false,
      active: column.active !== false,
    });
  });

  return ordered;
};

const mergeLiveMatrixSettings = (defaults = {}, previous = {}, forceLiveMatrix = false) => ({
  ...defaults,
  ...previous,
  matrixColumns: forceLiveMatrix
    ? {
        ...(defaults.matrixColumns || {}),
      }
    : {
        ...(defaults.matrixColumns || {}),
        ...(previous.matrixColumns || {}),
      },
  headerUdfs: {
    ...(defaults.headerUdfs || {}),
    ...(previous.headerUdfs || {}),
  },
  rowUdfs: {
    ...(defaults.rowUdfs || {}),
    ...(previous.rowUdfs || {}),
  },
});

export {
  buildMatrixColumnsFromSapLayout,
  mergeLiveMatrixSettings,
  normalizeLayoutToken,
};
