const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  const login = await axios.post('https://silverdemo.silvertouch.com:50000/b1s/v2/Login', {
    UserName: '2501', Password: '1234', CompanyDB: 'WMS_DEV_UK'
  }, { httpsAgent: agent });
  const cookie = login.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // Get full item and look for property-related fields
  const r = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/Items('00008-SM-000-0001')", {
    headers: { Cookie: cookie }, httpsAgent: agent
  });
  const item = r.data;

  console.log('=== All item fields containing "prop", "qry", "group", "property" (case-insensitive) ===');
  Object.entries(item).forEach(([k, v]) => {
    if (/prop|qry|group|propert/i.test(k)) {
      console.log(k, '=', JSON.stringify(v));
    }
  });

  console.log('\n=== All tYES/tNO fields (potential property checkboxes) ===');
  Object.entries(item).forEach(([k, v]) => {
    if (v === 'tYES' || v === 'tNO') console.log(k, '=', v);
  });

  console.log('\n=== Total fields:', Object.keys(item).length);
}
run().catch(e => console.error(e.response?.data || e.message));
