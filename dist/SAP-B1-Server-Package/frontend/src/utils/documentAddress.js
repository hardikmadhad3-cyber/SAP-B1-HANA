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

export const mapAddressToModalForm = (address, existing = {}) => ({
  shipToCode: existing.shipToCode || '',
  shipToAddress: existing.shipToAddress || '',
  billToCode: existing.billToCode || '',
  billToAddress: existing.billToAddress || '',
  streetPoBox: address?.Street || '',
  streetNo: address?.StreetNo || '',
  buildingFloorRoom: address?.Building || '',
  block: address?.Block || '',
  city: address?.City || '',
  zipCode: address?.ZipCode || '',
  county: address?.County || '',
  state: address?.State || '',
  countryRegion: address?.Country || '',
  addressName2: address?.Address2 || '',
  addressName3: address?.Address3 || '',
  gln: address?.GLN || '',
  gstin: address?.GSTIN || address?.gstin || '',
});
