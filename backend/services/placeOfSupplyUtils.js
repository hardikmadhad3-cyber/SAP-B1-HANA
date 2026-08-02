const { isBlankUdfValue, normalizeUdfValue } = require('./udfPayloadUtils');

const PLACE_OF_SUPPLY_UDF_ALIASES = [
  'PlaceOfSupply',
  'PlaceOfSupplyCode',
];

const normalizeUdfAlias = (value) =>
  String(value || '')
    .replace(/^U_/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

const findPlaceOfSupplyUdfKey = (definitionsByKey) => {
  if (!(definitionsByKey instanceof Map)) return null;

  const aliases = new Set(PLACE_OF_SUPPLY_UDF_ALIASES.map(normalizeUdfAlias));
  return Array.from(definitionsByKey.keys()).find((key) => aliases.has(normalizeUdfAlias(key))) || null;
};

const applyPlaceOfSupplyUdf = (target, definitionsByKey, value) => {
  if (value === undefined) return target;

  const key = findPlaceOfSupplyUdfKey(definitionsByKey);
  if (!key) return target;

  if (isBlankUdfValue(value)) {
    target[key] = null;
    return target;
  }

  const normalizedValue = normalizeUdfValue(value, definitionsByKey.get(key), key);
  if (normalizedValue !== undefined) target[key] = normalizedValue;
  return target;
};

const getPlaceOfSupplyUdfValue = (udfs = {}) => {
  const aliases = new Set(PLACE_OF_SUPPLY_UDF_ALIASES.map(normalizeUdfAlias));
  const match = Object.entries(udfs || {}).find(([key, value]) => (
    aliases.has(normalizeUdfAlias(key)) &&
    !isBlankUdfValue(value)
  ));

  return match ? String(match[1]) : '';
};

module.exports = {
  applyPlaceOfSupplyUdf,
  findPlaceOfSupplyUdfKey,
  getPlaceOfSupplyUdfValue,
};
