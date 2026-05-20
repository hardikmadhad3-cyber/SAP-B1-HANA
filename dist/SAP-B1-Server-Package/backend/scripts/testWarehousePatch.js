/**
 * Tests patching an item WITH ItemWarehouseInfoCollection to find the bad field.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sapService = require('../services/sapService');

async function run() {
  const d = await sapService.getItem('00008-SM-000-0001');
  const wh = d.ItemWarehouseInfoCollection?.[0];
  console.log('Testing PATCH with ItemWarehouseInfoCollection...');

  // Test 1: patch with full warehouse collection as-is from SAP
  try {
    await sapService.request({
      method: 'PATCH',
      url: `/Items('${encodeURIComponent(d.ItemCode)}')`,
      data: { ItemWarehouseInfoCollection: d.ItemWarehouseInfoCollection },
    });
    console.log('PASS: Full warehouse collection OK');
  } catch(e) {
    console.error('FAIL:', e.response?.data?.error?.message?.value || e.message);
  }

  // Test 2: patch with ItemPrices as-is
  try {
    await sapService.request({
      method: 'PATCH',
      url: `/Items('${encodeURIComponent(d.ItemCode)}')`,
      data: { ItemPrices: d.ItemPrices },
    });
    console.log('PASS: ItemPrices OK');
  } catch(e) {
    console.error('FAIL ItemPrices:', e.response?.data?.error?.message?.value || e.message);
  }

  // Test 3: check if ItemCycleCounts inside warehouse is the problem
  console.log('\nItemCycleCounts in WH[0]:', JSON.stringify(wh?.ItemCycleCounts));

  // Test 4: patch with warehouse but strip ItemCycleCounts
  const cleanWH = d.ItemWarehouseInfoCollection.map(w => {
    const { ItemCycleCounts, ...rest } = w;
    return rest;
  });
  try {
    await sapService.request({
      method: 'PATCH',
      url: `/Items('${encodeURIComponent(d.ItemCode)}')`,
      data: { ItemWarehouseInfoCollection: cleanWH },
    });
    console.log('PASS: Warehouse without ItemCycleCounts OK');
  } catch(e) {
    console.error('FAIL stripped WH:', e.response?.data?.error?.message?.value || e.message);
  }

  // Test 5: check all string values in warehouse for anything suspicious
  console.log('\nAll string values in WH[0]:');
  Object.entries(wh).forEach(([k,v]) => {
    if (typeof v === 'string' && v) console.log(`  ${k}: "${v}"`);
  });
}

run().catch(e => console.error('Script error:', e.message));
