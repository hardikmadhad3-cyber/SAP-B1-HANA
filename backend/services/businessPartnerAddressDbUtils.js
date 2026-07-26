/**
 * Shared Business Partner (customer/vendor) address loader.
 *
 * SAP B1 stores every BP address (both Bill To and Ship To) as rows in CRD1,
 * keyed by CardCode + AdresType. Every document module used to run its own
 * near-identical CRD1 query and its own ad hoc column-casing/whitespace
 * handling, which worked against SAP HANA (case-sensitive, exact-match
 * friendly) but silently returned zero rows on Microsoft SQL Server whenever
 * CardCode had different casing or incidental leading/trailing whitespace.
 *
 * This module gives every caller ONE CRD1 query and ONE normalization path
 * that is dialect-agnostic (works with both `db.query()` result shapes: SQL
 * Server's `{ recordset }` and HANA's array-of-rows) and column-casing
 * agnostic (SQL Server tends to preserve `CardCode`/`Address`/`AdresType`;
 * HANA drivers commonly return uppercase column names).
 */

const normalizeKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Portable SQL: plain ANSI functions (UPPER/LTRIM/RTRIM) that both SQL Server
// and HANA understand, and a single bound parameter. backend/db/hanaDb.js
// rewrites this (quoting identifiers, `@name` -> `?`) for HANA at query time;
// SQL Server (via the `mssql` package) consumes it as-is.
const BUSINESS_PARTNER_ADDRESS_SQL = `
  SELECT T0.*
  FROM CRD1 T0
  WHERE UPPER(LTRIM(RTRIM(T0.CardCode))) = UPPER(LTRIM(RTRIM(@cardCode)))
  ORDER BY T0.AdresType, T0.Address
`;

// Looks up a value on a row regardless of the column's exact case/casing
// convention (e.g. `CardCode` on SQL Server vs `CARDCODE` on HANA).
const getRowValue = (row = {}, aliases = []) => {
  const entries = Object.entries(row || {});
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const match = entries.find(([key]) => normalizeKey(key) === normalizedAlias);
    if (match && match[1] !== undefined && match[1] !== null) {
      if (typeof match[1] === 'string' && !match[1].trim()) {
        continue;
      }
      return match[1];
    }
  }
  return undefined;
};

const normalizeText = (value) => (value === undefined || value === null ? '' : String(value).trim());

// SAP B1 represents the address type either as the raw CRD1 code ('B'/'S')
// or, in some service-layer/DI-API payloads, as the enum string
// bo_BillTo / bo_ShipTo. Recognize both so every module behaves the same.
const normalizeAddressType = (value) => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'B' || normalized.includes('BILL')) return 'B';
  if (normalized === 'S' || normalized.includes('SHIP')) return 'S';
  return normalized;
};

const normalizeBusinessPartnerAddress = (row = {}, fallbackCardCode = '') => {
  const gstin = normalizeText(getRowValue(row, ['GSTIN', 'GSTRegnNo']));
  const gstType = getRowValue(row, ['GSTType', 'GstType']);

  return {
    ...row,
    CardCode: normalizeText(getRowValue(row, ['CardCode'])) || normalizeText(fallbackCardCode),
    Address: normalizeText(getRowValue(row, ['Address', 'AddressName'])),
    AdresType: normalizeAddressType(getRowValue(row, ['AdresType', 'AddressType'])),
    Street: normalizeText(getRowValue(row, ['Street'])),
    StreetNo: normalizeText(getRowValue(row, ['StreetNo', 'StreetNumber'])),
    Block: normalizeText(getRowValue(row, ['Block'])),
    Building: normalizeText(getRowValue(row, ['Building', 'BuildingFloorRoom'])),
    Address2: normalizeText(getRowValue(row, ['Address2', 'AddressName2'])),
    Address3: normalizeText(getRowValue(row, ['Address3', 'AddressName3'])),
    City: normalizeText(getRowValue(row, ['City'])),
    County: normalizeText(getRowValue(row, ['County'])),
    State: normalizeText(getRowValue(row, ['State', 'StateCode'])),
    ZipCode: normalizeText(getRowValue(row, ['ZipCode', 'Zip'])),
    Country: normalizeText(getRowValue(row, ['Country', 'CountryCode'])),
    GlblLocNum: normalizeText(getRowValue(row, ['GlblLocNum', 'GlobalLocationNumber', 'GLN'])),
    GSTIN: gstin,
    GSTRegnNo: gstin,
    GSTType: gstType === undefined || gstType === null ? '' : gstType,
  };
};

const splitBusinessPartnerAddresses = (rows = [], fallbackCardCode = '') => {
  const addresses = (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeBusinessPartnerAddress(row, fallbackCardCode))
    .filter((address) => address.Address);

  return {
    addresses,
    billTo: addresses.filter((address) => address.AdresType === 'B'),
    shipTo: addresses.filter((address) => address.AdresType === 'S'),
  };
};

// Every document module's API response is expected to expose all three keys,
// even though "pay to" and "bill to" are the same underlying address list.
const buildBusinessPartnerAddressResponse = ({ billTo = [], shipTo = [] } = {}) => ({
  pay_to_addresses: billTo,
  bill_to_addresses: billTo,
  ship_to_addresses: shipTo,
});

/**
 * Loads and splits every CRD1 address row for one Business Partner.
 *
 * @param {{query: Function, getDialect?: Function}} db - a db access object
 *   shaped like backend/services/dbService.js (works for both SQL Server and
 *   HANA connections, since dbService.query() already resolves the dialect).
 * @param {string} cardCode - Customer or Vendor CardCode (BP type is not
 *   distinguished at the CRD1 level; the caller already knows which BP type
 *   it is from context/route).
 * @param {{context?: string}} [options] - `context` is a short label (e.g.
 *   "AR Invoice", "Purchase Order") used only for error log messages.
 */
const loadBusinessPartnerAddresses = async (db, cardCode, options = {}) => {
  const normalizedCardCode = normalizeText(cardCode);
  if (!normalizedCardCode) {
    return splitBusinessPartnerAddresses([], '');
  }
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('A database query service is required to load business partner addresses.');
  }

  try {
    const result = await db.query(BUSINESS_PARTNER_ADDRESS_SQL, { cardCode: normalizedCardCode });
    // SQL Server (`mssql`) resolves to `{ recordset: [...] }`; HANA's own
    // query() (backend/db/hanaDb.js) also returns `{ recordset: [...] }`,
    // but guard for a bare array too in case a caller passes a raw db client.
    const rows = Array.isArray(result) ? result : (result?.recordset || []);
    return splitBusinessPartnerAddresses(rows, normalizedCardCode);
  } catch (error) {
    const dialect = typeof db.getDialect === 'function'
      ? await db.getDialect().catch(() => 'unknown')
      : 'unknown';
    const context = normalizeText(options.context) || 'Business Partner';
    // Intentionally NOT swallowed into an empty-array fallback: a failed
    // address lookup must surface as an actionable error, not silently look
    // like "this BP has no addresses."
    console.error(
      `[${context} DB] Failed to load CRD1 addresses for ${normalizedCardCode} using ${dialect}:`,
      error.message,
    );
    throw error;
  }
};

module.exports = {
  BUSINESS_PARTNER_ADDRESS_SQL,
  buildBusinessPartnerAddressResponse,
  getRowValue,
  loadBusinessPartnerAddresses,
  normalizeAddressType,
  normalizeBusinessPartnerAddress,
  splitBusinessPartnerAddresses,
};
