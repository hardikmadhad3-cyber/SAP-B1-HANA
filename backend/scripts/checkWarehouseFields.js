const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  const login = await axios.post('https://silverdemo.silvertouch.com:50000/b1s/v2/Login', {
    UserName: '2501', Password: '1234', CompanyDB: 'WMS_DEV_UK'
  }, { httpsAgent: agent });
  const cookie = login.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // Try warehouse '01'
  try {
    const res = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/Warehouses('01')", {
      headers: { Cookie: cookie }, httpsAgent: agent
    });
    const wh = res.data;
    console.log('=== WAREHOUSE 01 FIELDS ===');
    Object.entries(wh).forEach(([k, v]) => console.log(k + ' = ' + JSON.stringify(v)));
  } catch (e) {
    console.log('01 not found, trying list...');
    const res2 = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/Warehouses", {
      headers: { Cookie: cookie }, httpsAgent: agent
    });
    const list = res2.data.value || [];
    console.log('Available warehouses:', list.map(w => w.WarehouseCode));
    if (list.length > 0) {
      const code = list[0].WarehouseCode;
      const res3 = await axios.get(`https://silverdemo.silvertouch.com:50000/b1s/v2/Warehouses('${code}')`, {
        headers: { Cookie: cookie }, httpsAgent: agent
      });
      console.log('=== WAREHOUSE', code, 'FIELDS ===');
      Object.entries(res3.data).forEach(([k, v]) => console.log(k + ' = ' + JSON.stringify(v)));
    }
  }
}
run().catch(e => console.error(e.response?.data || e.message));
