/**
 * Run: node scripts/checkItemFields.js
 * Logs in to SAP and prints all writable properties of the Items entity.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });
const BASE  = process.env.SAP_BASE_URL;

(async () => {
  // 1. Login
  const loginRes = await axios.post(`${BASE}/Login`, {
    UserName:  process.env.SAP_USERNAME,
    Password:  process.env.SAP_PASSWORD,
    CompanyDB: process.env.SAP_COMPANY_DB,
  }, { httpsAgent: agent });

  const cookie = loginRes.headers['set-cookie']
    .map(c => c.split(';')[0]).join('; ');

  console.log('[SAP] Logged in\n');

  // 2. Try a minimal POST to get the exact error for each suspect field
  const suspectFields = {
    ValuationMethod:    'vmMovingAverage',
    IssueMethod:        'im_Manual',
    PlanningSystem:     'bop_None',
    ProcurementMethod:  'bom_Buy',
    ManageSerialNumbers:'bomm_None',
    ManageBatchNumbers: 'bomm_None',
    ItemType:           'itItems',
    Valid:              'tYES',
    InventoryItem:      'tYES',
    SalesItem:          'tYES',
    PurchaseItem:       'tYES',
    AssetItem:          'tYES',
  };

  for (const [field, value] of Object.entries(suspectFields)) {
    try {
      await axios.post(`${BASE}/Items`, {
        ItemCode: `__TEST_${Date.now()}`,
        ItemName: 'Test',
        [field]: value,
      }, { headers: { Cookie: cookie }, httpsAgent: agent });
      console.log(`✅  ${field}: "${value}" — ACCEPTED`);
    } catch (err) {
      const msg = err.response?.data?.error?.message?.value
        || err.response?.data?.error?.message
        || err.message;
      if (msg && msg.includes('invalid')) {
        console.log(`❌  ${field}: "${value}" — INVALID FIELD`);
      } else {
        console.log(`⚠️  ${field}: "${value}" — other error: ${msg}`);
      }
    }
  }
})();
