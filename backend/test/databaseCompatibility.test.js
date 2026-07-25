const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BUSINESS_PARTNER_ADDRESS_SQL,
  buildBusinessPartnerAddressResponse,
  loadBusinessPartnerAddresses,
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
  const hanaSql = normalizeSql(BUSINESS_PARTNER_ADDRESS_SQL);
  const bound = bindParams(hanaSql, { cardCode: 'C0003' });

  assert.match(bound.sql, /FROM "CRD1" T0/);
  assert.match(bound.sql, /T0\."CardCode"/);
  assert.match(bound.sql, /\?/);
  assert.doesNotMatch(bound.sql, /@cardCode/);
  assert.deepEqual(bound.values, ['C0003']);
});

test('loads and splits one shared address result for every document module', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return {
        recordset: [
          { CARDCODE: 'C0004', ADDRESS: 'BILL', ADRESTYPE: 'B', STREET: 'Billing Street' },
          { CardCode: 'C0004', Address: 'SHIP', AdresType: 'bo_ShipTo', Street: 'Shipping Street' },
        ],
      };
    },
    getDialect: async () => 'sqlserver',
  };

  const groups = await loadBusinessPartnerAddresses(db, ' C0004 ', { context: 'Test Document' });
  const response = buildBusinessPartnerAddressResponse(groups);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, { cardCode: 'C0004' });
  assert.equal(response.pay_to_addresses.length, 1);
  assert.equal(response.bill_to_addresses.length, 1);
  assert.equal(response.ship_to_addresses.length, 1);
  assert.equal(response.ship_to_addresses[0].Street, 'Shipping Street');
});

test('does not hide shared address query failures as empty arrays', async () => {
  const expected = new Error('Invalid column or database unavailable');
  const db = {
    query: async () => {
      throw expected;
    },
    getDialect: async () => 'sqlserver',
  };
  const originalError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(
      loadBusinessPartnerAddresses(db, 'C0005', { context: 'Test Document' }),
      expected,
    );
  } finally {
    console.error = originalError;
  }
});
