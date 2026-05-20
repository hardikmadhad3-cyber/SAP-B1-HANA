const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  const login = await axios.post('https://silverdemo.silvertouch.com:50000/b1s/v2/Login', {
    UserName: '2501', Password: '1234', CompanyDB: 'WMS_DEV_UK'
  }, { httpsAgent: agent });
  const cookie = login.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // 1. List first 3 BOMs
  console.log('=== ProductTrees (first 3) ===');
  try {
    const r = await axios.get('https://silverdemo.silvertouch.com:50000/b1s/v2/ProductTrees', {
      headers: { Cookie: cookie }, httpsAgent: agent
    });
    const list = r.data.value || [];
    console.log('Total:', list.length);
    list.slice(0, 3).forEach(b => console.log(JSON.stringify(b)));

    // 2. Fetch first BOM in full
    if (list.length > 0) {
      const code = list[0].TreeCode;
      console.log('\n=== Full BOM:', code, '===');
      const r2 = await axios.get(`https://silverdemo.silvertouch.com:50000/b1s/v2/ProductTrees('${code}')`, {
        headers: { Cookie: cookie }, httpsAgent: agent
      });
      const bom = r2.data;
      Object.entries(bom).forEach(([k, v]) => {
        if (k === '@odata.context') return;
        if (Array.isArray(v)) console.log(k, '= [', v.length, 'items]', v[0] ? JSON.stringify(v[0]) : '');
        else console.log(k, '=', JSON.stringify(v));
      });
    }
  } catch(e) { console.log('Error:', e.response?.data || e.message); }
}
run().catch(e => console.error(e.response?.data || e.message));
