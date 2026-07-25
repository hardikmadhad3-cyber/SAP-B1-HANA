/**
 * checkBPFields.js
 * Fetches one BusinessPartner from SAP B1 Service Layer and prints:
 *   1. All field names + their current values (so you know exact names)
 *   2. The OData $metadata definition for BusinessPartners entity
 *
 * Run from backend folder:
 *   node scripts/checkBPFields.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const https = require('https');

const BASE_URL = process.env.SAP_BASE_URL;
const agent    = new https.Agent({ rejectUnauthorized: false });

let cookie = '';

// ── 1. Login ──────────────────────────────────────────────────────────────────
async function login() {
  console.log('\n[1] Logging in to SAP Service Layer...');
  const res = await axios.post(
    `${BASE_URL}/Login`,
    {
      CompanyDB: process.env.SAP_COMPANY_DB,
      UserName:  process.env.SAP_USERNAME,
      Password:  process.env.SAP_PASSWORD,
    },
    { httpsAgent: agent }
  );
  const raw = res.headers['set-cookie'];
  cookie = (Array.isArray(raw) ? raw : [raw])
    .map((c) => String(c).split(';')[0])
    .join('; ');
  console.log('[1] Login OK');
}

const get = (url) =>
  axios.get(`${BASE_URL}${url}`, {
    httpsAgent: agent,
    headers: { Cookie: cookie },
  });

// ── 2. Fetch one real BP record ───────────────────────────────────────────────
async function fetchSampleBP() {
  console.log('\n[2] Fetching first BusinessPartner record...');
  const res = await get('/BusinessPartners?$top=1');
  const bp  = (res.data.value || [])[0];
  if (!bp) { console.log('   No BP records found in this company DB.'); return null; }

  console.log(`\n   CardCode : ${bp.CardCode}`);
  console.log(`   CardName : ${bp.CardName}`);
  console.log(`   CardType : ${bp.CardType}  (cCustomer | cSupplier | cLead)\n`);

  console.log('── ALL FIELDS (name → value) ─────────────────────────────────────');
  Object.entries(bp).forEach(([k, v]) => {
    // skip nested arrays/objects for readability
    if (Array.isArray(v))        console.log(`  ${k.padEnd(40)} [array, ${v.length} items]`);
    else if (v && typeof v === 'object') console.log(`  ${k.padEnd(40)} [object]`);
    else                         console.log(`  ${k.padEnd(40)} ${JSON.stringify(v)}`);
  });

  return bp;
}

// ── 3. Fetch $metadata for BusinessPartners ───────────────────────────────────
async function fetchMetadata() {
  console.log('\n[3] Fetching $metadata...');
  const res = await axios.get(`${BASE_URL}/$metadata`, {
    httpsAgent: agent,
    headers: { Cookie: cookie },
    responseType: 'text',
  });

  const xml = res.data;

  // Extract just the BusinessPartners EntityType block
  const match = xml.match(
    /<EntityType Name="BusinessPartner"[\s\S]*?<\/EntityType>/
  );

  if (!match) {
    console.log('   Could not isolate BusinessPartner entity — printing full metadata (large!)');
    console.log(xml.slice(0, 5000), '...[truncated]');
    return;
  }

  console.log('\n── BusinessPartner EntityType (from $metadata) ──────────────────');
  // Parse out Property lines
  const propRegex = /<Property Name="([^"]+)" Type="([^"]+)"(?:[^/]*)\/>/g;
  let m;
  const props = [];
  while ((m = propRegex.exec(match[0])) !== null) {
    props.push({ name: m[1], type: m[2] });
  }

  props.forEach(({ name, type }) => {
    console.log(`  ${name.padEnd(45)} ${type}`);
  });

  console.log(`\n  Total properties: ${props.length}`);
}

// ── 4. Fetch enum values for CardType ─────────────────────────────────────────
async function fetchEnumHints(bp) {
  if (!bp) return;
  console.log('\n[4] Checking a few key enum fields on the sample record:');
  const enumFields = [
    'CardType', 'GroupCode', 'Currency', 'PayTermsGrpCode',
    'PriceListNum', 'VatStatus', 'IndustryCode', 'ShipType',
    'DebitorAccount', 'ControlAccount',
  ];
  enumFields.forEach((f) => {
    if (f in bp) console.log(`  ${f.padEnd(30)} = ${JSON.stringify(bp[f])}`);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await login();
    const bp = await fetchSampleBP();
    await fetchMetadata();
    await fetchEnumHints(bp);
    console.log('\n✓ Done. Use the field names above in your BusinessPartner create payload.\n');
  } catch (err) {
    const detail = err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    console.error('\n✗ Error:', detail);
    process.exit(1);
  }
})();
