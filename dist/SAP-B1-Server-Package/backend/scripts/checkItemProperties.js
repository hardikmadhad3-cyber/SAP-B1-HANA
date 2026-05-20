const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  const login = await axios.post('https://silverdemo.silvertouch.com:50000/b1s/v2/Login', {
    UserName: '2501', Password: '1234', CompanyDB: 'WMS_DEV_UK'
  }, { httpsAgent: agent });
  const cookie = login.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // 1. Fetch ItemProperties (the property name definitions)
  console.log('=== ItemProperties (property name definitions) ===');
  try {
    const r = await axios.get('https://silverdemo.silvertouch.com:50000/b1s/v2/ItemProperties', {
      headers: { Cookie: cookie }, httpsAgent: agent
    });
    const props = r.data.value || [];
    props.forEach(p => console.log(JSON.stringify(p)));
    console.log('Total:', props.length);
  } catch(e) { console.log('ItemProperties error:', e.response?.data || e.message); }

  // 2. Check QryGroup fields on a real item
  console.log('\n=== Item QryGroup fields (from item 00008-SM-000-0001) ===');
  try {
    const r2 = await axios.get("https://silverdemo.silvertouch.com:50000/b1s/v2/Items('00008-SM-000-0001')?$select=ItemCode,QryGroup1,QryGroup2,QryGroup3,QryGroup4,QryGroup5,QryGroup6,QryGroup7,QryGroup8,QryGroup9,QryGroup10,QryGroup11,QryGroup12,QryGroup13,QryGroup14,QryGroup15,QryGroup16,QryGroup17,QryGroup18,QryGroup19,QryGroup20,QryGroup21,QryGroup22,QryGroup23,QryGroup24,QryGroup25,QryGroup26,QryGroup27,QryGroup28,QryGroup29,QryGroup30,QryGroup31,QryGroup32,QryGroup33,QryGroup34,QryGroup35,QryGroup36,QryGroup37,QryGroup38,QryGroup39,QryGroup40,QryGroup41,QryGroup42,QryGroup43,QryGroup44,QryGroup45,QryGroup46,QryGroup47,QryGroup48,QryGroup49,QryGroup50,QryGroup51,QryGroup52,QryGroup53,QryGroup54,QryGroup55,QryGroup56,QryGroup57,QryGroup58,QryGroup59,QryGroup60,QryGroup61,QryGroup62,QryGroup63,QryGroup64", {
      headers: { Cookie: cookie }, httpsAgent: agent
    });
    Object.entries(r2.data).forEach(([k,v]) => { if(k !== '@odata.context') console.log(k, '=', JSON.stringify(v)); });
  } catch(e) { console.log('Item QryGroup error:', e.response?.data || e.message); }
}
run().catch(e => console.error(e.response?.data || e.message));
