export const getDefaultInventoryPriceList = (priceLists = []) =>
  priceLists.find((priceList) => priceList.id === 'lastPurchase') || priceLists[0] || null;

export const getInventoryItemPrice = (item, priceList) => {
  if (!item) return 0;

  if (priceList === 'lastPurchase') {
    return Number(item.lastPurchasePrice || 0);
  }

  if (priceList === 'lastEvaluated') {
    return Number(item.lastEvaluatedPrice || 0);
  }

  if (priceList && item.prices?.[String(priceList)] != null) {
    return Number(item.prices[String(priceList)] || 0);
  }

  return Number(item.lastPurchasePrice || item.itemCost || 0);
};
