const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const firstPresent = (...values) => values.find((value) => value !== undefined && value !== null);
const toSapString = (value) => (value === undefined || value === null ? undefined : String(value));

const addIfPresent = (target, key, value) => {
  if (value === undefined || value === null) return;
  target[key] = String(value);
};

const ADDRESS_EXTENSION_FIELDS = {
  ShipTo: {
    streetPoBox: 'ShipToStreet',
    streetNo: 'ShipToStreetNo',
    buildingFloorRoom: 'ShipToBuilding',
    block: 'ShipToBlock',
    city: 'ShipToCity',
    zipCode: 'ShipToZipCode',
    county: 'ShipToCounty',
    state: 'ShipToState',
    countryRegion: 'ShipToCountry',
    addressName2: 'ShipToAddress2',
    addressName3: 'ShipToAddress3',
    gln: 'ShipToGlobalLocationNumber',
  },
  BillTo: {
    streetPoBox: 'BillToStreet',
    streetNo: 'BillToStreetNo',
    buildingFloorRoom: 'BillToBuilding',
    block: 'BillToBlock',
    city: 'BillToCity',
    zipCode: 'BillToZipCode',
    county: 'BillToCounty',
    state: 'BillToState',
    countryRegion: 'BillToCountry',
    addressName2: 'BillToAddress2',
    addressName3: 'BillToAddress3',
    gln: 'BillToGlobalLocationNumber',
  },
};

const addAddressExtensionFields = (target, prefix, components = {}) => {
  const fieldMap = ADDRESS_EXTENSION_FIELDS[prefix] || {};
  Object.entries(fieldMap).forEach(([sourceKey, sapKey]) => {
    if (hasOwn(components, sourceKey)) {
      target[sapKey] = String(components[sourceKey] ?? '');
    }
  });
};

const buildMarketingDocumentAddressPayload = (header = {}, options = {}) => {
  const addressPayload = {};
  const shipAddressField = options.shipAddressField || 'Address';
  const billAddressField = options.billAddressField || 'Address2';
  const shipToCode = firstPresent(header.shipToCode);
  const payToCode = firstPresent(header.billToCode, header.payToCode);
  const shipToAddress = firstPresent(header.shipToAddress, header.shipTo);
  const billToAddress = firstPresent(header.billToAddress, header.payTo);

  addIfPresent(addressPayload, 'ShipToCode', shipToCode);
  addIfPresent(addressPayload, 'PayToCode', payToCode);
  if (shipToAddress !== undefined) addressPayload[shipAddressField] = toSapString(shipToAddress);
  if (billToAddress !== undefined) addressPayload[billAddressField] = toSapString(billToAddress);

  const addressExtension = {};
  addAddressExtensionFields(addressExtension, 'ShipTo', header.shipToAddressComponents);
  addAddressExtensionFields(addressExtension, 'BillTo', header.billToAddressComponents);
  if (Object.keys(addressExtension).length) {
    addressPayload.AddressExtension = addressExtension;
  }

  return addressPayload;
};

module.exports = {
  buildMarketingDocumentAddressPayload,
};
