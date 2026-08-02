export const normalizeAddressText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const resolveAddressForModal = (addressCode, addresses = [], fallbackText = '', formatAddress) => {
  const normalizedCode = String(addressCode || '').trim();
  if (normalizedCode) {
    const exactMatch = addresses.find((address) => String(address?.Address || '').trim() === normalizedCode);
    if (exactMatch) return exactMatch;
  }

  if (typeof formatAddress === 'function') {
    const normalizedFallbackText = normalizeAddressText(fallbackText);
    if (normalizedFallbackText) {
      return addresses.find((address) => normalizeAddressText(formatAddress(address)) === normalizedFallbackText) || null;
    }
  }

  return null;
};

const normalizeAddressKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const getAddressValue = (address, aliases = []) => {
  if (!address) return '';
  const entries = Object.entries(address);
  for (const alias of aliases) {
    const normalizedAlias = normalizeAddressKey(alias);
    const match = entries.find(([key]) => normalizeAddressKey(key) === normalizedAlias);
    if (match && match[1] != null && String(match[1]).trim() !== '') return match[1];
  }
  return '';
};

const normalizeAddressType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'B' || normalized.includes('BILL')) return 'B';
  if (normalized === 'S' || normalized.includes('SHIP')) return 'S';
  return normalized;
};

export const normalizeBusinessPartnerAddress = (address = {}, fallbackCardCode = '') => {
  const gstin = getAddressValue(address, ['GSTIN', 'GSTRegnNo']);

  return {
    ...address,
    CardCode: String(getAddressValue(address, ['CardCode']) || fallbackCardCode || '').trim(),
    Address: String(getAddressValue(address, ['Address', 'AddressName']) || '').trim(),
    AdresType: normalizeAddressType(getAddressValue(address, ['AdresType', 'AddressType'])),
    Street: getAddressValue(address, ['Street']),
    StreetNo: getAddressValue(address, ['StreetNo', 'StreetNumber']),
    Block: getAddressValue(address, ['Block']),
    Building: getAddressValue(address, ['Building', 'BuildingFloorRoom']),
    Address2: getAddressValue(address, ['Address2', 'AddressName2']),
    Address3: getAddressValue(address, ['Address3', 'AddressName3']),
    City: getAddressValue(address, ['City']),
    County: getAddressValue(address, ['County']),
    State: getAddressValue(address, ['State', 'StateCode']),
    ZipCode: getAddressValue(address, ['ZipCode', 'Zip']),
    Country: getAddressValue(address, ['Country', 'CountryCode']),
    GlblLocNum: getAddressValue(address, ['GlblLocNum', 'GlobalLocationNumber', 'GLN']),
    GSTIN: gstin,
    GSTRegnNo: gstin,
    GSTType: getAddressValue(address, ['GSTType', 'GstType']),
  };
};

const formatDateValue = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s)/);
  return isoDate ? isoDate[1] : text;
};

export const mapAddressFields = (address) => ({
  streetPoBox: getAddressValue(address, ['Street', 'StreetPOBox']),
  streetNo: getAddressValue(address, ['StreetNo', 'StreetNumber']),
  buildingFloorRoom: getAddressValue(address, ['Building', 'BuildingFloorRoom']),
  block: getAddressValue(address, ['Block']),
  city: getAddressValue(address, ['City']),
  zipCode: getAddressValue(address, ['ZipCode', 'Zip']),
  county: getAddressValue(address, ['County']),
  state: getAddressValue(address, ['State', 'StateCode']),
  countryRegion: getAddressValue(address, ['Country', 'CountryCode']),
  addressName2: getAddressValue(address, ['Address2', 'AddressName2']),
  addressName3: getAddressValue(address, ['Address3', 'AddressName3']),
  gln: getAddressValue(address, ['GlblLocNum', 'GlobalLocationNumber', 'GLN']),
  erpAddress: getAddressValue(address, ['U_ERPAddress', 'U_ERP_Address', 'ERPAddress']),
  contactPerson: getAddressValue(address, ['U_ContactPerson', 'U_CONTACT_PERSON', 'U_Contact_Person', 'ContactPerson']),
  mobile: getAddressValue(address, ['U_Mobile', 'U_MOBILE', 'Mobile', 'MobilePhone']),
  dateOfRegistration: formatDateValue(getAddressValue(address, ['U_DateOfRegistration', 'U_Date_Of_Registration', 'DateOfRegistration'])),
  dateDetailsOfRegistration: formatDateValue(getAddressValue(address, ['U_DateDetlOfReg', 'U_Date_Detl_Of_Reg', 'DateDetlOfReg'])),
  addressStatus: getAddressValue(address, ['U_Status', 'AddressStatus', 'Status']),
  gstin: getAddressValue(address, ['GSTRegnNo', 'GSTIN', 'U_GSTIN_No', 'U_GSTINNo', 'U_GSTIN']),
});

export const mapAddressToModalForm = (address, existing = {}) => ({
  shipToCode: existing.shipToCode || '',
  shipToAddress: existing.shipToAddress || '',
  billToCode: existing.billToCode || '',
  billToAddress: existing.billToAddress || '',
  ...mapAddressFields(address),
});

const cleanAddressValue = (value) => String(value ?? '').trim();
const joinAddressLine = (...parts) => parts.map(cleanAddressValue).filter(Boolean).join(', ');

export const pickAddressComponentFields = (form = {}) => ({
  streetPoBox: form.streetPoBox || '',
  streetNo: form.streetNo || '',
  buildingFloorRoom: form.buildingFloorRoom || '',
  block: form.block || '',
  city: form.city || '',
  zipCode: form.zipCode || '',
  county: form.county || '',
  state: form.state || '',
  countryRegion: form.countryRegion || '',
  addressName2: form.addressName2 || '',
  addressName3: form.addressName3 || '',
  gln: form.gln || '',
  erpAddress: form.erpAddress || '',
  contactPerson: form.contactPerson || '',
  mobile: form.mobile || '',
  dateOfRegistration: form.dateOfRegistration || '',
  dateDetailsOfRegistration: form.dateDetailsOfRegistration || '',
  addressStatus: form.addressStatus || '',
  gstin: form.gstin || '',
});

export const formatAddressComponent = (form = {}) => [
  joinAddressLine(form.streetPoBox, form.streetNo),
  cleanAddressValue(form.buildingFloorRoom),
  cleanAddressValue(form.block),
  cleanAddressValue(form.city),
  cleanAddressValue(form.zipCode),
  cleanAddressValue(form.county),
  cleanAddressValue(form.state),
  cleanAddressValue(form.countryRegion),
  cleanAddressValue(form.addressName2),
  cleanAddressValue(form.addressName3),
].filter(Boolean).join('\n');
