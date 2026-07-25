const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  const login = await axios.post('https://silverdemo.silvertouch.com:50000/b1s/v2/Login', {
    UserName: '2501', Password: '1234', CompanyDB: 'WMS_DEV_UK'
  }, { httpsAgent: agent });
  const cookie = login.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // Full BOM header fields
  const r = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/ProductTrees('LM4029')", {
    headers: { Cookie: cookie }, httpsAgent: agent
  });
  const bom = r.data;

  console.log('=== HEADER FIELDS ===');
  Object.entries(bom).forEach(([k, v]) => {
    if (k === '@odata.context') return;
    if (!Array.isArray(v)) console.log(`${k} | ${typeof v} | ${JSON.stringify(v)}`);
  });

  console.log('\n=== ProductTreeLines[0] ALL FIELDS ===');
  const line = bom.ProductTreeLines?.[0] || {};
  Object.entries(line).forEach(([k, v]) => console.log(`${k} | ${typeof v} | ${JSON.stringify(v)}`));

  // Check ItemType enum values across all lines
  console.log('\n=== Unique ItemType values ===');
  const types = new Set(bom.ProductTreeLines.map(l => l.ItemType));
  console.log([...types]);

  // Check IssueMethod enum values
  console.log('\n=== Unique IssueMethod values ===');
  const methods = new Set(bom.ProductTreeLines.map(l => l.IssueMethod));
  console.log([...methods]);

  // Check another BOM with different data
  const r2 = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/ProductTrees('LM4029PS')", {
    headers: { Cookie: cookie }, httpsAgent: agent
  });
  console.log('\n=== TreeType values seen ===');
  // Get all tree types from list
  const rList = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/ProductTrees?$select=TreeCode,TreeType", {
    headers: { Cookie: cookie }, httpsAgent: agent
  });
  const treeTypes = new Set((rList.data.value || []).map(b => b.TreeType));
  console.log([...treeTypes]);

  // Check DistributionRules
  console.log('\n=== DistributionRules (first 5) ===');
  try {
    const dr = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/DistributionRules?$select=FactorCode,FactorDescription&$top=5", {
      headers: { Cookie: cookie }, httpsAgent: agent
    });
    (dr.data.value || []).forEach(d => console.log(d.FactorCode, '|', d.FactorDescription));
  } catch(e) { console.log('DR error:', e.response?.data?.error?.message || e.message); }

  // Check Projects
  console.log('\n=== Projects (first 5) ===');
  try {
    const pr = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/Projects?$select=Code,Name&$top=5", {
      headers: { Cookie: cookie }, httpsAgent: agent
    });
    (pr.data.value || []).forEach(p => console.log(p.Code, '|', p.Name));
  } catch(e) { console.log('Projects error:', e.response?.data?.error?.message || e.message); }

  // Check GL Accounts for WIP
  console.log('\n=== ChartOfAccounts sample (first 3) ===');
  try {
    const gl = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/ChartOfAccounts?$select=Code,Name&$top=3", {
      headers: { Cookie: cookie }, httpsAgent: agent
    });
    (gl.data.value || []).forEach(a => console.log(a.Code, '|', a.Name));
  } catch(e) { console.log('GL error:', e.response?.data?.error?.message || e.message); }
}
run().catch(e => console.error(e.response?.data || e.message));
