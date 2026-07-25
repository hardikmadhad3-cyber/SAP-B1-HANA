/**
 * Sends the exact same payload that buildPayload() produces for a new item
 * with all EMPTY_FORM defaults, to find which field triggers the BoDocWhsAutoIssueMethod error.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sapService = require('../services/sapService');

// Replicate EMPTY_FORM defaults from ItemMaster.jsx
const EMPTY_FORM = {
  ItemCode: "TEST-ENUM-001", ItemName: "Test Enum Item",
  InventoryItem: "tYES", SalesItem: "tYES", PurchaseItem: "tYES", AssetItem: "tNO",
  ItemType: "itItems", ItemClass: "itcMaterial",
  MaterialType: "", TreeType: "iNotATree", IsPhantom: "tNO", NoDiscounts: "tNO",
  IssueMethod: "im_Manual", VatLiable: "tYES", WTLiable: "tYES", IndirectTax: "tNO",
  ManageSerialNumbers: "tNO", ManageBatchNumbers: "tNO",
  SRIAndBatchManageMethod: "bomm_OnEveryTransaction",
  ForceSelectionOfSerialNumber: "tNO", ManageSerialNumbersOnReleaseOnly: "tNO",
  AutoCreateSerialNumbersOnRelease: "tNO", IssuePrimarilyBy: "ipbSerialAndBatchNumbers",
  Valid: "tYES", Frozen: "tNO",
  CostAccountingMethod: "bis_MovingAverage", GLMethod: "glm_WH", TaxType: "tt_Yes",
  ManageStockByWarehouse: "tNO", InCostRollup: "tYES",
  PlanningSystem: "bop_None", ProcurementMethod: "bom_Buy",
  ComponentWarehouse: "bomcw_BOM", TypeOfAdvancedRules: "toarGeneral",
};

async function run() {
  // Binary search — send fields in batches to find the bad one
  const fields = Object.entries(EMPTY_FORM).filter(([k]) => k !== 'ItemCode' && k !== 'ItemName');

  console.log('Testing full payload...');
  try {
    await sapService.request({
      method: 'POST', url: '/Items',
      data: Object.fromEntries([['ItemCode','TEST-ENUM-001'],['ItemName','Test'],['InventoryItem','tYES'],['SalesItem','tYES'],['PurchaseItem','tYES'], ...fields]),
    });
    console.log('PASS — no error with full payload');
  } catch(e) {
    const msg = e.response?.data?.error?.message?.value || e.message;
    console.error('FAIL:', msg);

    // Now test each field individually
    console.log('\nTesting each field individually...');
    for (const [key, val] of fields) {
      if (!val) continue;
      try {
        await sapService.request({
          method: 'POST', url: '/Items',
          data: { ItemCode: `TEST-${Date.now()}`, ItemName: 'Test', InventoryItem:'tYES', SalesItem:'tYES', PurchaseItem:'tYES', [key]: val },
        });
        // If it created, delete it
        await sapService.request({ method: 'DELETE', url: `/Items('TEST-${Date.now()}')` }).catch(()=>{});
      } catch(e2) {
        const msg2 = e2.response?.data?.error?.message?.value || e2.message;
        if (msg2.includes('BoDocWhsAutoIssueMethod') || msg2.includes('aao') || msg2.includes('Enum')) {
          console.error(`  BAD FIELD: ${key} = "${val}" → ${msg2}`);
        }
      }
    }
  }
}

run().catch(e => console.error('Script error:', e.message));
