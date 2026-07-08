const SYSTEM_PRICE_LISTS = [
  { id: 'lastPurchase', name: 'Last Purchase Price', system: true },
  { id: 'lastEvaluated', name: 'Last Evaluated Price', system: true },
];

const mapInventoryPriceLists = (rows = []) => [
  ...rows.map((row) => ({
    id: String(row.ListNum),
    name: row.ListName,
    system: false,
  })),
  ...SYSTEM_PRICE_LISTS,
];

module.exports = { mapInventoryPriceLists };
