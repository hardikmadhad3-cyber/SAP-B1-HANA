require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sapService = require('../services/sapService');

async function run() {
  // Test 1: plain fetch (no expand) — check if collections come inline
  console.log('\n--- Test 1: Plain fetch ---');
  try {
    const r = await sapService.request({ method: 'GET', url: "/Items('00008-SM-000-0001')" });
    const cols = Object.keys(r.data).filter(k => Array.isArray(r.data[k]));
    console.log('Collections inline:', cols.map(c => `${c}(${r.data[c].length})`).join(', '));
  } catch(e) {
    console.error('Plain fetch error:', e.response?.data?.error?.message?.value || e.message);
  }

  // Test 2: $expand
  console.log('\n--- Test 2: $expand ---');
  try {
    const r = await sapService.request({
      method: 'GET',
      url: "/Items('00008-SM-000-0001')?$expand=ItemPrices,ItemWarehouseInfoCollection,ItemBarCodeCollection,ItemUnitOfMeasurementCollection,ItemPreferredVendors"
    });
    const cols = Object.keys(r.data).filter(k => Array.isArray(r.data[k]));
    console.log('Expand OK. Collections:', cols.map(c => `${c}(${r.data[c].length})`).join(', '));
  } catch(e) {
    console.error('Expand error:', e.response?.data?.error?.message?.value || e.message);
  }

  // Test 3: $expand with select
  console.log('\n--- Test 3: $expand with $select ---');
  try {
    const r = await sapService.request({
      method: 'GET',
      url: "/Items('00008-SM-000-0001')?$select=ItemCode,ItemName&$expand=ItemPrices"
    });
    console.log('Expand+select OK. ItemPrices:', r.data.ItemPrices?.length);
  } catch(e) {
    console.error('Expand+select error:', e.response?.data?.error?.message?.value || e.message);
  }
}

run().catch(console.error);
