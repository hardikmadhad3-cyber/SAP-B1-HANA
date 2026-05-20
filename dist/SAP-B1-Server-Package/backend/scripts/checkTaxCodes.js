require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const https = require('https');

const BASE_URL = process.env.SAP_BASE_URL;
const agent = new https.Agent({ rejectUnauthorized: false });
let cookie = '';

async function login() {
  const res = await axios.post(`${BASE_URL}/Login`, {
    CompanyDB: process.env.SAP_COMPANY_DB,
    UserName: process.env.SAP_USERNAME,
    Password: process.env.SAP_PASSWORD,
  }, { httpsAgent: agent });
  const raw = res.headers['set-cookie'];
  cookie = (Array.isArray(raw) ? raw : [raw]).map((c) => String(c).split(';')[0]).join('; ');
  console.log('[Login OK]\n');
}

const get = (url) =>
  axios.get(`${BASE_URL}${url}`, { httpsAgent: agent, headers: { Cookie: cookie } });

(async () => {
  try {
    await login();
    const res = await get('/VatGroups?$select=Code,Name,Category,TaxAccount&$top=50');
    const items = res.data?.value || [];
    console.log('VatGroups count:', items.length);
    items.forEach((item) => {
      console.log('  Code=' + item.Code + '  Name=' + item.Name + '  Category=' + item.Category);
    });
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    process.exit(1);
  }
})();
