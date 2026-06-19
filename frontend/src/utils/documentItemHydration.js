const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

export const mergeItemMaster = (selectedItem = {}, items = []) => {
  const itemCode = selectedItem.ItemCode || selectedItem.itemCode || '';
  const masterItem = (items || []).find(
    (candidate) => String(candidate.ItemCode || candidate.itemCode || '') === String(itemCode)
  ) || {};

  return { ...masterItem, ...selectedItem };
};

export const getItemPrice = (item = {}, side = 'sales') => {
  const values = side === 'purchase'
    ? [item.UnitPrice, item.Price, item.LastPurPrc, item.LastPurchasePrice, item.MovingAveragePrice, item.AvgStdPrice]
    : [item.UnitPrice, item.Price, item.SalesPrice, item.MovingAveragePrice, item.AvgStdPrice];

  const value = values.find(hasValue);
  return hasValue(value) ? String(value) : '';
};

const firstItemValue = (item = {}, keys = []) => {
  const value = keys.map((key) => item[key]).find(hasValue);
  return hasValue(value) ? String(value) : '';
};

export const hydrateDocumentLineFromItem = (line = {}, item = {}, {
  side = 'sales',
  hsnCode = '',
  fallbackWarehouse = '',
  resolveLineLocation,
  headerBranch = '',
  preservePrice = false,
  preserveQuantity = true,
  syncUnitPriceUdf = true,
  calcLineTotal,
  formatTotal,
} = {}) => {
  const itemCode = item.ItemCode || item.itemCode || '';
  const uomCode = side === 'purchase'
    ? String(item.PurchaseUnit || item.InventoryUOM || '').trim()
    : String(item.SalesUnit || item.InventoryUOM || '').trim();
  const defaultWarehouse = item.DefaultWarehouse || item.WarehouseCode || fallbackWarehouse || '';
  const itemPrice = getItemPrice(item, side);
  const salesGlAccount = firstItemValue(item, [
    'SalesGLAccount',
    'IncomeAccount',
    'IncomeAcct',
    'RevenuesAccount',
    'RevenueAccount',
    'RevenuesAc',
    'AccountCode',
    'AcctCode',
  ]);
  const distributionRule = firstItemValue(item, ['DistributionRule', 'OcrCode']);
  const cogsDistributionRule = firstItemValue(item, [
    'COGSDistributionRule',
    'COGSCostingCode',
    'CogsOcrCod',
    'CogsOcrCode',
    'CogsOcrCode1',
    'DistributionRule',
    'OcrCode',
  ]);

  const next = {
    ...line,
    itemNo: itemCode,
    itemDescription: item.ItemName || item.itemName || line.itemDescription || '',
    hsnCode: hsnCode || item.HSNCode || item.SWW || item.U_HSNCode || line.hsnCode || '',
    uomCode: uomCode || line.uomCode || '',
    uomName: line.uomName || uomCode || line.uomCode || '',
    countryOfOrigin: item.ItemCountryOrg || item.CountryOrg || line.countryOfOrigin || '',
    sacCode: item.SACEntry != null ? String(item.SACEntry) : (line.sacCode || ''),
    glAccount: line.glAccount || salesGlAccount || '',
    distRule: line.distRule || distributionRule || '',
    cogsDistRule: line.cogsDistRule || cogsDistributionRule || line.distRule || distributionRule || '',
    whse: line.whse || defaultWarehouse,
    inventoryUOM: item.InventoryUOM || line.inventoryUOM || '',
    batchManaged: item.BatchManaged === 'Y' || item.ManageBatchNumbers === 'tYES' || item.ManBtchNum === 'Y' || line.batchManaged || false,
  };

  if (side === 'sales') {
    next.sellerItem = line.sellerItem || itemCode;
    next.stcode = line.stcode || '';
  } else if (!line.taxCodeManuallyOverridden) {
    next.taxCode = line.taxCode || item.TaxCodeAP || item.VatGroupPu || item.ApTaxCode || '';
  }

  if (!preservePrice || !hasValue(next.unitPrice)) {
    if (hasValue(itemPrice)) {
      next.unitPrice = itemPrice;
      if (syncUnitPriceUdf) {
        next.unitPriceUdf = line.unitPriceUdf || itemPrice;
      }
    }
  }

  if (preserveQuantity && !hasValue(next.quantity)) {
    next.quantity = '1';
  }

  if (resolveLineLocation) {
    next.loc = resolveLineLocation(next.whse, next.branch || headerBranch);
  }

  if (calcLineTotal && formatTotal) {
    next.total = formatTotal(calcLineTotal(next));
  }

  return next;
};
