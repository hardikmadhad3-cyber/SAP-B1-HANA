const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyPlaceOfSupplyUdf,
  getPlaceOfSupplyUdfValue,
} = require('../services/placeOfSupplyUtils');

test('maps place of supply to the live SAP UDF key and option value', () => {
  const target = {};
  const definitions = new Map([
    ['U_PlaceOfSupply', {
      key: 'U_PlaceOfSupply',
      options: [
        { value: 'GJ', label: 'Gujarat' },
      ],
    }],
  ]);

  applyPlaceOfSupplyUdf(target, definitions, 'Gujarat');

  assert.deepEqual(target, { U_PlaceOfSupply: 'GJ' });
});

test('supports a company-specific place of supply code alias', () => {
  const target = {};
  const definitions = new Map([
    ['U_PlaceOfSupplyCode', { key: 'U_PlaceOfSupplyCode' }],
  ]);

  applyPlaceOfSupplyUdf(target, definitions, 'GJ');

  assert.deepEqual(target, { U_PlaceOfSupplyCode: 'GJ' });
});

test('hydrates place of supply from a saved UDF regardless of key formatting', () => {
  assert.equal(getPlaceOfSupplyUdfValue({ U_PLACE_OF_SUPPLY: 'GJ' }), 'GJ');
  assert.equal(getPlaceOfSupplyUdfValue({ U_PlaceOfSupplyCode: 'MH' }), 'MH');
});

test('does not send a made-up UDF when the company has no matching field', () => {
  const target = {};
  applyPlaceOfSupplyUdf(target, new Map([['U_OtherField', { key: 'U_OtherField' }]]), 'GJ');
  assert.deepEqual(target, {});
});
