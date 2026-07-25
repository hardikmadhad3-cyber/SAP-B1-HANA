const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  const login = await axios.post('https://silverdemo.silvertouch.com:50000/b1s/v2/Login', {
    UserName: '2501', Password: '1234', CompanyDB: 'WMS_DEV_UK'
  }, { httpsAgent: agent });
  const cookie = login.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // Get warehouse 01 — full field dump
  const res = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/Warehouses('01')", {
    headers: { Cookie: cookie }, httpsAgent: agent
  });

  const wh = res.data;
  console.log('=== ALL FIELDS (name | type | value) ===');
  Object.entries(wh).forEach(([k, v]) => {
    const type = v === null ? 'null' : typeof v;
    console.log(`${k} | ${type} | ${JSON.stringify(v)}`);
  });

  // Also get warehouse 05 (has different enum values) for comparison
  const res2 = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/Warehouses('05')", {
    headers: { Cookie: cookie }, httpsAgent: agent
  });
  console.log('\n=== WH 05 — DIFFERENT VALUES ONLY ===');
  Object.entries(res2.data).forEach(([k, v]) => {
    if (JSON.stringify(v) !== JSON.stringify(wh[k])) {
      console.log(`${k} | ${JSON.stringify(v)}`);
    }
  });
}
run().catch(e => console.error(e.response?.data || e.message));
