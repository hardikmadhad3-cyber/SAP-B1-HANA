/**
 * Fetches:
 *  1. Full $metadata for the Items entity from SAP B1 Service Layer
 *  2. First real item record (all fields) from /Items
 * Outputs JSON files for comparison.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const axios = require('axios');
const https = require('https');
const fs    = require('fs');

const BASE_URL  = process.env.SAP_BASE_URL;
const USERNAME  = process.env.SAP_USERNAME;
const PASSWORD  = process.env.SAP_PASSWORD;
const COMPANY   = process.env.SAP_COMPANY_DB;

const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  console.log(`[INFO] Connecting to: ${BASE_URL}`);

  // 1. Login
  const loginRes = await axios.post(`${BASE_URL}/Login`, {
    UserName: USERNAME, Password: PASSWORD, CompanyDB: COMPANY,
  }, { httpsAgent: agent });

  const cookie = (loginRes.headers['set-cookie'] || [])
    .map(c => c.split(';')[0]).join('; ');
  console.log('[INFO] Session established');

  const headers = { Cookie: cookie };

  // 2. Fetch first item (all fields, no $select)
  console.log('[INFO] Fetching first item record...');
  const itemRes = await axios.get(`${BASE_URL}/Items?$top=1`, { headers, httpsAgent: agent });
  const firstItem = itemRes.data.value?.[0];
  if (!firstItem) { console.error('[ERROR] No items found'); process.exit(1); }

  fs.writeFileSync(
    require('path').resolve(__dirname, 'item_first_record.json'),
    JSON.stringify(firstItem, null, 2)
  );
  console.log(`[INFO] First item saved → scripts/item_first_record.json`);
  console.log(`[INFO] Item: ${firstItem.ItemCode} — ${firstItem.ItemName}`);
  console.log(`[INFO] Total fields in record: ${Object.keys(firstItem).length}`);

  // 3. List all top-level field names
  const fields = Object.keys(firstItem);
  const simpleFields = fields.filter(k => typeof firstItem[k] !== 'object' || firstItem[k] === null);
  const collectionFields = fields.filter(k => Array.isArray(firstItem[k]));
  const objectFields = fields.filter(k => typeof firstItem[k] === 'object' && firstItem[k] !== null && !Array.isArray(firstItem[k]));

  console.log(`\n[FIELDS] Simple (${simpleFields.length}):\n`, simpleFields.join(', '));
  console.log(`\n[COLLECTIONS] (${collectionFields.length}):\n`, collectionFields.join(', '));
  console.log(`\n[OBJECTS] (${objectFields.length}):\n`, objectFields.join(', '));

  // 4. For each collection, show its structure (first element keys)
  if (collectionFields.length > 0) {
    console.log('\n[COLLECTION STRUCTURES]:');
    for (const col of collectionFields) {
      const arr = firstItem[col];
      if (arr.length > 0) {
        console.log(`  ${col} (${arr.length} rows) → keys: ${Object.keys(arr[0]).join(', ')}`);
      } else {
        console.log(`  ${col} → empty array`);
      }
    }
  }

  // 5. Save a summary report
  const report = {
    itemCode: firstItem.ItemCode,
    itemName: firstItem.ItemName,
    totalFields: fields.length,
    simpleFields,
    collectionFields: collectionFields.map(col => ({
      name: col,
      rowCount: firstItem[col].length,
      keys: firstItem[col][0] ? Object.keys(firstItem[col][0]) : [],
    })),
    objectFields,
  };
  fs.writeFileSync(
    require('path').resolve(__dirname, 'item_field_report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('\n[INFO] Field report saved → scripts/item_field_report.json');
}

run().catch(err => {
  console.error('[ERROR]', err.response?.data || err.message);
  process.exit(1);
});
