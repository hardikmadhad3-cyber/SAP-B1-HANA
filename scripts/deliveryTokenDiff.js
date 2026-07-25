const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_BASE_URL || 'http://localhost:5001/api';
const LAYOUT_ENDPOINT = '/sap/layout/document';
const DELIVERY_DOC_TYPE = 'DELIVERY';

const normalizeToken = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');

const extractDeliveryWorkbookKeys = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const blockMatch = content.match(/export const DELIVERY_WORKBOOK_COLUMNS = withOrder\([\s\S]*?\);/m);
  const block = blockMatch ? blockMatch[0] : content;
  const keyRegex = /key:\s*'([^']+)'/g;
  const labelRegex = /label:\s*'([^']+)'/g;
  const keys = new Set();
  let m;
  while ((m = keyRegex.exec(block)) !== null) keys.add(normalizeToken(m[1]));
  while ((m = labelRegex.exec(block)) !== null) keys.add(normalizeToken(m[1]));
  return Array.from(keys);
};

(async () => {
  try {
    console.log('Fetching layout from', API_URL + LAYOUT_ENDPOINT);
    const url = new URL(API_URL + LAYOUT_ENDPOINT);
    // Request delivery layout explicitly by objectType=15 and optional companyDb
    url.searchParams.set('documentType', DELIVERY_DOC_TYPE);
    url.searchParams.set('objectType', '15');
    if (process.env.DELIVERY_COMPANY_DB) url.searchParams.set('companyDb', process.env.DELIVERY_COMPANY_DB);
    const resp = await fetch(url.toString(), { method: 'GET', headers: { 'Accept': 'application/json' }, timeout: 10000 });
    const layout = await resp.json();
    const columns = Array.isArray(layout.columns) ? layout.columns : (layout.data && Array.isArray(layout.data.columns) ? layout.data.columns : []);
    const layoutTokens = new Set();

    columns.forEach((col) => {
      if (col.fieldName) layoutTokens.add(normalizeToken(col.fieldName));
      if (col.columnUid) layoutTokens.add(normalizeToken(col.columnUid));
      if (col.columnTitle) layoutTokens.add(normalizeToken(col.columnTitle));
    });

    const wbFile = path.resolve(__dirname, '..', 'frontend', 'src', 'config', 'workbookMatrixColumns.js');
    const frontendTokens = new Set(extractDeliveryWorkbookKeys(wbFile));

    const missingInFrontend = Array.from(layoutTokens).filter(t => !frontendTokens.has(t));
    const extraInFrontend = Array.from(frontendTokens).filter(t => !layoutTokens.has(t));

    console.log('\nLayout columns fetched:', columns.length);
    console.log('\n--- Missing in frontend (layout -> frontend) ---');
    missingInFrontend.forEach(t => console.log('  ', t));

    console.log('\n--- Extra in frontend (frontend -> layout) ---');
    extraInFrontend.forEach(t => console.log('  ', t));

    process.exit(0);
  } catch (err) {
    console.error('Error fetching or processing layout:', err.message || err);
    process.exit(2);
  }
})();
