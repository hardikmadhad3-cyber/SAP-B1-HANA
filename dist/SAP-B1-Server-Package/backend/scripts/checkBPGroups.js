/**
 * checkBPGroups.js — find the correct SAP endpoint for BP Groups
 * Run: node scripts/checkBPGroups.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const https = require('https');

const BASE  = process.env.SAP_BASE_URL;
const agent = new https.Agent({ rejectUnauthorized: false });
let cookie  = '';

async function login() {
  const res = await axios.post(`${BASE}/Login`,
    { CompanyDB: process.env.SAP_COMPANY_DB, UserName: process.env.SAP_USERNAME, Password: process.env.SAP_PASSWORD },
    { httpsAgent: agent }
  );
  const raw = res.headers['set-cookie'];
  cookie = (Array.isArray(raw) ? raw : [raw]).map((c) => String(c).split(';')[0]).join('; ');
  console.log('[Login OK]');
}

const get = (url) => axios.get(`${BASE}${url}`, { httpsAgent: agent, headers: { Cookie: cookie } });

async function tryEndpoint(name) {
  try {
    const res = await get(`/${name}?$top=5`);
    const items = res.data.value || [];
    console.log(`\n✓ /${name} — ${items.length} items`);
    if (items[0]) console.log('  Sample:', JSON.stringify(items[0]));
    return true;
  } catch (e) {
    console.log(`✗ /${name} — ${e.response?.status || e.message}`);
    return false;
  }
}

(async () => {
  await login();
  console.log('\n--- Trying BP Group endpoints ---');
  await tryEndpoint('BusinessPartnerGroups');
  await tryEndpoint('BPGroups');
  await tryEndpoint('CardGroups');

  console.log('\n--- Checking GroupCode values on real BPs ---');
  const res = await get('/BusinessPartners?$select=CardCode,CardName,CardType,GroupCode&$top=10');
  const bps = res.data.value || [];
  bps.forEach((b) => console.log(`  ${b.CardCode.padEnd(20)} type=${b.CardType}  GroupCode=${b.GroupCode}`));
})().catch((e) => console.error('Error:', e.response?.data || e.message));
