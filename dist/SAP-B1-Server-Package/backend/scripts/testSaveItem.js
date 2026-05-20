/**
 * Simulates exactly what the frontend sends on Save for item 00008-SM-000-0001
 * and catches the exact SAP error with field details.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sapService = require('../services/sapService');

async function run() {
  // Load the item first
  const d = await sapService.getItem('00008-SM-000-0001');
  console.log('Loaded item:', d.ItemCode);

  // Try a minimal PATCH — just ItemName to see if basic save works
  console.log('\n--- Test 1: Minimal PATCH (ItemName only) ---');
  try {
    await sapService.request({
      method: 'PATCH',
      url: `/Items('${encodeURIComponent(d.ItemCode)}')`,
      data: { ItemName: d.ItemName },
    });
    console.log('PASS: Minimal patch OK');
  } catch(e) {
    console.error('FAIL:', e.response?.data?.error?.message?.value || e.message);
  }

  // Test fields that could have BoDocWhsAutoIssueMethod
  // SAP field for bin location issue method is different from IssueMethod
  console.log('\n--- Checking bin-related fields ---');
  const binFields = ['IssuePrimarilyBy','IssueMethod','DefaultBin','EnableBinLocations'];
  binFields.forEach(f => console.log(`  ${f}: "${d[f]}"`));

  // Check warehouse collection for any auto-issue fields
  const wh = d.ItemWarehouseInfoCollection?.[0];
  if (wh) {
    console.log('\n--- Warehouse fields that might be BoDocWhsAutoIssueMethod ---');
    Object.entries(wh).forEach(([k,v]) => {
      if (typeof v === 'string' && (v.includes('aao') || v.includes('Bin') || v.includes('Issue'))) {
        console.log(`  ${k}: "${v}"`);
      }
    });
  }

  // Try PATCH with IssuePrimarilyBy to confirm it's not the problem
  console.log('\n--- Test 2: PATCH with IssuePrimarilyBy ---');
  try {
    await sapService.request({
      method: 'PATCH',
      url: `/Items('${encodeURIComponent(d.ItemCode)}')`,
      data: { IssuePrimarilyBy: d.IssuePrimarilyBy },
    });
    console.log('PASS: IssuePrimarilyBy OK');
  } catch(e) {
    console.error('FAIL:', e.response?.data?.error?.message?.value || e.message);
  }

  // Test ComponentWarehouse
  console.log('\n--- Test 3: PATCH with ComponentWarehouse ---');
  try {
    await sapService.request({
      method: 'PATCH',
      url: `/Items('${encodeURIComponent(d.ItemCode)}')`,
      data: { ComponentWarehouse: d.ComponentWarehouse },
    });
    console.log('PASS: ComponentWarehouse OK, value:', d.ComponentWarehouse);
  } catch(e) {
    console.error('FAIL:', e.response?.data?.error?.message?.value || e.message);
  }

  // The error mentions 'aaoiNone' — search all string fields for anything with 'aao'
  console.log('\n--- Searching all fields for aao* values ---');
  Object.entries(d).forEach(([k,v]) => {
    if (typeof v === 'string' && v.toLowerCase().includes('aao')) {
      console.log(`  FOUND: ${k} = "${v}"`);
    }
  });
}

run().catch(e => console.error('Script error:', e.message));
