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
