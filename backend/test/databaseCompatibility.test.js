const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeBusinessPartnerAddress,
  splitBusinessPartnerAddresses,
} = require('../services/businessPartnerAddressDbUtils');
const { bindParams, normalizeSql } = require('../db/hanaDb');

test('normalizes SQL Server-style CRD1 rows', () => {
  const address = normalizeBusinessPartnerAddress({
    CardCode: ' C0001 ',
    Address: ' MAIN ',
    AdresType: 'B',
    Street: 'Market Road',
    GSTIN: ' ',
    GSTRegnNo: '24ABCDE1234F1Z5',
  });

  assert.equal(address.CardCode, 'C0001');
  assert.equal(address.Address, 'MAIN');
  assert.equal(address.AdresType, 'B');
  assert.equal(address.Street, 'Market Road');
  assert.equal(address.GSTIN, '24ABCDE1234F1Z5');
});

test('normalizes HANA-style uppercase aliases and service-layer address types', () => {
  const { billTo, shipTo } = splitBusinessPartnerAddresses([
    {
      CARDCODE: 'C0002',
      ADDRESS: 'BILLING',
      ADDRESSTYPE: 'bo_BillTo',
      STREET: 'First Street',
    },
    {
      CARDCODE: 'C0002',
      ADDRESS: 'SHIPPING',
      ADRESTYPE: 'S ',
      STREET: 'Second Street',
    },
  ]);

  assert.equal(billTo.length, 1);
  assert.equal(billTo[0].Address, 'BILLING');
  assert.equal(shipTo.length, 1);
  assert.equal(shipTo[0].Address, 'SHIPPING');
});

test('converts the portable CRD1 query for HANA and binds its parameter', () => {
  const sourceSql = `
    SELECT T0.*
    FROM CRD1 T0
    WHERE UPPER(LTRIM(RTRIM(T0.CardCode))) = UPPER(LTRIM(RTRIM(@cardCode)))
    ORDER BY T0.AdresType, T0.Address
  `;
  const hanaSql = normalizeSql(sourceSql);
  const bound = bindParams(hanaSql, { cardCode: 'C0003' });

  assert.match(bound.sql, /FROM "CRD1" T0/);
  assert.match(bound.sql, /T0\."CardCode"/);
  assert.match(bound.sql, /\?/);
  assert.doesNotMatch(bound.sql, /@cardCode/);
  assert.deepEqual(bound.values, ['C0003']);
});
