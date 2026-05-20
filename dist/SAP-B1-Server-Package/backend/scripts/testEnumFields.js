require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sapService = require('../services/sapService');

async function run() {
  const d = await sapService.getItem('00008-SM-000-0001');
  // Print all fields that could be enum-related
  const enumFields = [
    'IssuePrimarilyBy', 'IssueMethod', 'SRIAndBatchManageMethod',
    'ComponentWarehouse', 'PlanningSystem', 'ProcurementMethod',
    'TypeOfAdvancedRules', 'TreeType', 'ItemType', 'ItemClass',
    'MaterialType', 'CostAccountingMethod', 'GLMethod', 'TaxType',
    'ManageSerialNumbers', 'ManageBatchNumbers', 'ForceSelectionOfSerialNumber',
    'ManageSerialNumbersOnReleaseOnly', 'AutoCreateSerialNumbersOnRelease',
    'Valid', 'Frozen', 'VatLiable', 'WTLiable', 'IndirectTax',
    'IsPhantom', 'NoDiscounts', 'InCostRollup', 'ManageStockByWarehouse',
    'ManageByQuantity', 'AssetItem', 'InventoryItem', 'SalesItem', 'PurchaseItem',
  ];
  console.log('=== Enum field values from live SAP ===');
  enumFields.forEach(f => console.log(`${f}: "${d[f]}"`));
}
run().catch(e => console.error(e.response?.data?.error?.message?.value || e.message));
