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

test('normalizes SQL Server-style CRD1 rows (trims whitespace, keeps native casing)', () => {
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

test('normalizes HANA-style uppercase column aliases', () => {
  const address = normalizeBusinessPartnerAddress({
    CARDCODE: 'C0002',
    ADDRESS: 'BILLING',
    ADRESTYPE: 'S',
    STREET: 'First Street',
    CITY: 'Ahmedabad',
  });

  assert.equal(address.CardCode, 'C0002');
  assert.equal(address.Address, 'BILLING');
  assert.equal(address.AdresType, 'S');
  assert.equal(address.Street, 'First Street');
  assert.equal(address.City, 'Ahmedabad');
});

test('classifies both the raw CRD1 code and the bo_BillTo/bo_ShipTo DI-API enum strings', () => {
  const { billTo, shipTo } = splitBusinessPartnerAddresses([
    {
      CARDCODE: 'C0003',
      ADDRESS: 'BILLING',
      ADRESTYPE: 'bo_BillTo',
      STREET: 'First Street',
    },
    {
      CardCode: 'C0003',
      Address: 'SHIPPING',
      AdresType: 'S ',
      Street: 'Second Street',
    },
  ]);

  assert.equal(billTo.length, 1);
  assert.equal(billTo[0].Address, 'BILLING');
  assert.equal(billTo[0].AdresType, 'B');
  assert.equal(shipTo.length, 1);
  assert.equal(shipTo[0].Address, 'SHIPPING');
  assert.equal(shipTo[0].AdresType, 'S');
});

test('drops rows with no address text (e.g. an empty CRD1 line) from both groups', () => {
  const { addresses, billTo, shipTo } = splitBusinessPartnerAddresses([
    { CardCode: 'C0004', Address: '', AdresType: 'B' },
    { CardCode: 'C0004', Address: '  ', AdresType: 'S' },
  ]);

  assert.equal(addresses.length, 0);
  assert.equal(billTo.length, 0);
  assert.equal(shipTo.length, 0);
});

test('converts the portable CRD1 query for HANA and binds its parameter', () => {
  const hanaSql = normalizeSql(BUSINESS_PARTNER_ADDRESS_SQL);
  const bound = bindParams(hanaSql, { cardCode: 'C0005' });

  assert.match(bound.sql, /FROM "CRD1" T0/);
  assert.match(bound.sql, /T0\."CardCode"/);
  assert.match(bound.sql, /\?/);
  assert.doesNotMatch(bound.sql, /@cardCode/);
  assert.deepEqual(bound.values, ['C0005']);
});

test('accepts a SQL Server-shaped { recordset } result', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return {
        recordset: [
          { CardCode: 'C0006', Address: 'BILL', AdresType: 'B', Street: 'Billing Street' },
          { CardCode: 'C0006', Address: 'SHIP', AdresType: 'S', Street: 'Shipping Street' },
        ],
      };
    },
    getDialect: async () => 'sqlserver',
  };

  const groups = await loadBusinessPartnerAddresses(db, ' C0006 ', { context: 'Test Document' });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, { cardCode: 'C0006' });
  assert.equal(groups.billTo.length, 1);
  assert.equal(groups.shipTo.length, 1);
  assert.equal(groups.shipTo[0].Street, 'Shipping Street');
});

test('accepts a HANA-shaped bare array result', async () => {
  const db = {
    query: async () => ([
      { CARDCODE: 'C0007', ADDRESS: 'BILL', ADRESTYPE: 'bo_BillTo', STREET: 'Billing Street' },
      { CARDCODE: 'C0007', ADDRESS: 'SHIP', ADRESTYPE: 'bo_ShipTo', STREET: 'Shipping Street' },
    ]),
    getDialect: async () => 'hana',
  };

  const groups = await loadBusinessPartnerAddresses(db, 'C0007', { context: 'Test Document' });

  assert.equal(groups.billTo.length, 1);
  assert.equal(groups.shipTo.length, 1);
  assert.equal(groups.billTo[0].Street, 'Billing Street');
});

test('builds the consistent pay/bill/ship response contract every document module returns', async () => {
  const db = {
    query: async () => ({
      recordset: [
        { CardCode: 'C0008', Address: 'BILL', AdresType: 'B' },
        { CardCode: 'C0008', Address: 'SHIP', AdresType: 'S' },
      ],
    }),
    getDialect: async () => 'sqlserver',
  };

  const groups = await loadBusinessPartnerAddresses(db, 'C0008', { context: 'Test Document' });
  const response = buildBusinessPartnerAddressResponse(groups);

  assert.equal(response.pay_to_addresses.length, 1);
  assert.equal(response.bill_to_addresses.length, 1);
  assert.equal(response.ship_to_addresses.length, 1);
  assert.deepEqual(response.pay_to_addresses, response.bill_to_addresses);
});

test('returns empty groups without querying when CardCode is blank', async () => {
  let called = false;
  const db = { query: async () => { called = true; return { recordset: [] }; } };

  const groups = await loadBusinessPartnerAddresses(db, '   ', { context: 'Test Document' });

  assert.equal(called, false);
  assert.deepEqual(groups.addresses, []);
  assert.deepEqual(groups.billTo, []);
  assert.deepEqual(groups.shipTo, []);
});

test('does not hide a failed CRD1 query as empty address arrays -- it rethrows', async () => {
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
      loadBusinessPartnerAddresses(db, 'C0009', { context: 'Test Document' }),
      expected,
    );
  } finally {
    console.error = originalError;
  }
});

test('still rethrows the original error when db.getDialect() itself is unavailable', async () => {
  const expected = new Error('Connection reset');
  const db = {
    query: async () => {
      throw expected;
    },
  };
  const originalError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(
      loadBusinessPartnerAddresses(db, 'C0010', { context: 'Test Document' }),
      expected,
    );
  } finally {
    console.error = originalError;
  }
});

test('rejects when no query-capable db is supplied', async () => {
  await assert.rejects(
    loadBusinessPartnerAddresses({}, 'C0011', { context: 'Test Document' }),
    TypeError,
  );
});
