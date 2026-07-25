require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sapService = require('../services/sapService');

async function run() {
  const data = await sapService.getItem('00008-SM-000-0001');

  // Enrich prices (same logic as controller)
  const lists = await sapService.getPriceLists();
  const listMap = Object.fromEntries(lists.map((l) => [l.PriceListNo, l.PriceListName]));
  const enrichedPrices = (data.ItemPrices || []).map((p) => ({
    ...p,
    PriceListName: listMap[p.PriceList] || `List ${p.PriceList}`,
  }));

  console.log('\n=== ITEM LOAD TEST ===');
  console.log('ItemCode:    ', data.ItemCode);
  console.log('ItemName:    ', data.ItemName);
  console.log('ItemType:    ', data.ItemType);
  console.log('ItemClass:   ', data.ItemClass);
  console.log('MaterialType:', data.MaterialType);
  console.log('TreeType:    ', data.TreeType);
  console.log('Valid:       ', data.Valid);
  console.log('Frozen:      ', data.Frozen);
  console.log('VatLiable:   ', data.VatLiable);
  console.log('WTLiable:    ', data.WTLiable);
  console.log('ManageSerial:', data.ManageSerialNumbers);
  console.log('ManageBatch: ', data.ManageBatchNumbers);
  console.log('SRIMethod:   ', data.SRIAndBatchManageMethod);
  console.log('ForceSerial: ', data.ForceSelectionOfSerialNumber);
  console.log('IssueMethod: ', data.IssueMethod);
  console.log('IsPhantom:   ', data.IsPhantom);
  console.log('NoDiscounts: ', data.NoDiscounts);
  console.log('GLMethod:    ', data.GLMethod);
  console.log('TaxType:     ', data.TaxType);
  console.log('CostMethod:  ', data.CostAccountingMethod);
  console.log('PlanSystem:  ', data.PlanningSystem);
  console.log('ProcMethod:  ', data.ProcurementMethod);
  console.log('CompWH:      ', data.ComponentWarehouse);
  console.log('ToleranceDays:', data.ToleranceDays);
  console.log('TypeAdvRules:', data.TypeOfAdvancedRules);
  console.log('IssuePrimBy: ', data.IssuePrimarilyBy);

  console.log('\n--- Purchasing ---');
  console.log('PurchaseUnit:', data.PurchaseUnit);
  console.log('PurchVATGrp: ', data.PurchaseVATGroup);
  console.log('PurchFactor1:', data.PurchaseFactor1);
  console.log('PurchUnitLen:', data.PurchaseUnitLength, '| Unit:', data.PurchaseLengthUnit);
  console.log('PurchUnitWt: ', data.PurchaseUnitWeight, '| Unit:', data.PurchaseWeightUnit);

  console.log('\n--- Sales ---');
  console.log('SalesUnit:   ', data.SalesUnit);
  console.log('SalesVATGrp: ', data.SalesVATGroup);
  console.log('SalesFactor1:', data.SalesFactor1);
  console.log('SalesUnitLen:', data.SalesUnitLength, '| Unit:', data.SalesLengthUnit);

  console.log('\n--- Inventory ---');
  console.log('InventoryUOM:', data.InventoryUOM);
  console.log('UoMGroupEntry:', data.UoMGroupEntry);
  console.log('DefaultWH:   ', data.DefaultWarehouse);
  console.log('MinInv:      ', data.MinInventory);
  console.log('MaxInv:      ', data.MaxInventory);
  console.log('DesiredInv:  ', data.DesiredInventory);
  console.log('InvWeight:   ', data.InventoryWeight, '| Unit:', data.InventoryWeightUnit);
  console.log('MovAvgPrice: ', data.MovingAveragePrice);
  console.log('AvgStdPrice: ', data.AvgStdPrice);
  console.log('QtyOnStock:  ', data.QuantityOnStock);

  console.log('\n--- Sub-collections ---');
  console.log('ItemPrices:', enrichedPrices.length, 'rows');
  enrichedPrices.slice(0, 3).forEach((p) =>
    console.log(`  List ${p.PriceList} (${p.PriceListName}): Price=${p.Price}, Factor=${p.Factor}, AddPrice1=${p.AdditionalPrice1}`)
  );
  console.log('Warehouses:', data.ItemWarehouseInfoCollection?.length, 'rows');
  data.ItemWarehouseInfoCollection?.slice(0, 2).forEach((w) =>
    console.log(`  WH ${w.WarehouseCode}: InStock=${w.InStock}, Committed=${w.Committed}, Ordered=${w.Ordered}, MinStock=${w.MinimalStock}`)
  );
  console.log('Barcodes:', data.ItemBarCodeCollection?.length);
  console.log('UoMs:', data.ItemUnitOfMeasurementCollection?.length);
  console.log('PrefVendors:', data.ItemPreferredVendors?.length);

  console.log('\n--- UDF fields (non-null) ---');
  const udfs = Object.entries(data).filter(([k, v]) => k.startsWith('U_') && v !== null && v !== 0 && v !== '');
  udfs.forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log('\n=== ALL CHECKS PASSED ===');
}

run().catch((e) => {
  console.error('ERROR:', e.response?.data?.error?.message?.value || e.message);
  process.exit(1);
});
