const normalizeKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const BUSINESS_PARTNER_ADDRESS_SQL = `
  SELECT T0.*
  FROM CRD1 T0
  WHERE UPPER(LTRIM(RTRIM(T0.CardCode))) = UPPER(LTRIM(RTRIM(@cardCode)))
  ORDER BY T0.AdresType, T0.Address
`;

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

const buildBusinessPartnerAddressResponse = ({ billTo = [], shipTo = [] } = {}) => ({
  pay_to_addresses: billTo,
  bill_to_addresses: billTo,
  ship_to_addresses: shipTo,
});

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
    const rows = Array.isArray(result) ? result : (result?.recordset || []);
    return splitBusinessPartnerAddresses(rows, normalizedCardCode);
  } catch (error) {
    const dialect = typeof db.getDialect === 'function'
      ? await db.getDialect().catch(() => 'unknown')
      : 'unknown';
    const context = normalizeText(options.context) || 'Business Partner';
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
