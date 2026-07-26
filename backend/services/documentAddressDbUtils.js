const normalizeDbScalar = (value) => {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return value == null ? '' : String(value);
};

const resolveColumnName = (fieldMetadata = {}, candidateColumnName) => {
  if (!candidateColumnName) return null;
  if (fieldMetadata[candidateColumnName] !== undefined) return candidateColumnName;
  const normalized = String(candidateColumnName).toLowerCase();
  return Object.keys(fieldMetadata).find((columnName) => columnName.toLowerCase() === normalized) || null;
};

const ADDRESS_EXTENSION_SELECTS = [
  { alias: 'ShipToStreet', candidates: ['StreetS', 'ShipToStreet'] },
  { alias: 'ShipToStreetNo', candidates: ['StreetNoS', 'ShipToStreetNo'] },
  { alias: 'ShipToBuilding', candidates: ['BuildingS', 'ShipToBuilding'] },
  { alias: 'ShipToBlock', candidates: ['BlockS', 'ShipToBlock'] },
  { alias: 'ShipToCity', candidates: ['CityS', 'ShipToCity'] },
  { alias: 'ShipToZipCode', candidates: ['ZipCodeS', 'ShipToZipCode'] },
  { alias: 'ShipToCounty', candidates: ['CountyS', 'ShipToCounty'] },
  { alias: 'ShipToState', candidates: ['StateS', 'ShipToState'] },
  { alias: 'ShipToCountry', candidates: ['CountryS', 'ShipToCountry'] },
  { alias: 'ShipToAddress2', candidates: ['Address2S', 'ShipToAddress2'] },
  { alias: 'ShipToAddress3', candidates: ['Address3S', 'ShipToAddress3'] },
  { alias: 'ShipToGlobalLocationNumber', candidates: ['GlblLocNumS', 'GlobalLocationNumberS', 'ShipToGlobalLocationNumber'] },
  { alias: 'BillToStreet', candidates: ['StreetB', 'BillToStreet'] },
  { alias: 'BillToStreetNo', candidates: ['StreetNoB', 'BillToStreetNo'] },
  { alias: 'BillToBuilding', candidates: ['BuildingB', 'BillToBuilding'] },
  { alias: 'BillToBlock', candidates: ['BlockB', 'BillToBlock'] },
  { alias: 'BillToCity', candidates: ['CityB', 'BillToCity'] },
  { alias: 'BillToZipCode', candidates: ['ZipCodeB', 'BillToZipCode'] },
  { alias: 'BillToCounty', candidates: ['CountyB', 'BillToCounty'] },
  { alias: 'BillToState', candidates: ['StateB', 'BillToState'] },
  { alias: 'BillToCountry', candidates: ['CountryB', 'BillToCountry'] },
  { alias: 'BillToAddress2', candidates: ['Address2B', 'BillToAddress2'] },
  { alias: 'BillToAddress3', candidates: ['Address3B', 'BillToAddress3'] },
  { alias: 'BillToGlobalLocationNumber', candidates: ['GlblLocNumB', 'GlobalLocationNumberB', 'BillToGlobalLocationNumber'] },
];

const buildAddressExtensionSelectFields = ({
  fieldMetadata = {},
  tableAlias = 'T12',
  quoteIdentifier = (identifier) => `[${String(identifier || '').replace(/]/g, ']]')}]`,
  quoteAlias = quoteIdentifier,
  fallback = "''",
} = {}) => ADDRESS_EXTENSION_SELECTS.map(({ alias, candidates }) => {
  const columnName = candidates
    .map((candidate) => resolveColumnName(fieldMetadata, candidate))
    .find(Boolean);
  return columnName
    ? `${tableAlias}.${quoteIdentifier(columnName)} AS ${quoteAlias(alias)}`
    : `${fallback} AS ${quoteAlias(alias)}`;
});

const buildDocumentAddressComponents = (row = {}, prefix = 'ShipTo') => {
  const components = {
    streetPoBox: normalizeDbScalar(row[`${prefix}Street`]),
    streetNo: normalizeDbScalar(row[`${prefix}StreetNo`]),
    buildingFloorRoom: normalizeDbScalar(row[`${prefix}Building`]),
    block: normalizeDbScalar(row[`${prefix}Block`]),
    city: normalizeDbScalar(row[`${prefix}City`]),
    zipCode: normalizeDbScalar(row[`${prefix}ZipCode`]),
    county: normalizeDbScalar(row[`${prefix}County`]),
    state: normalizeDbScalar(row[`${prefix}State`]),
    countryRegion: normalizeDbScalar(row[`${prefix}Country`]),
    addressName2: normalizeDbScalar(row[`${prefix}Address2`]),
    addressName3: normalizeDbScalar(row[`${prefix}Address3`]),
    gln: normalizeDbScalar(row[`${prefix}GlobalLocationNumber`]),
  };

  return Object.values(components).some((value) => String(value || '').trim()) ? components : null;
};

module.exports = {
  buildAddressExtensionSelectFields,
  buildDocumentAddressComponents,
};
