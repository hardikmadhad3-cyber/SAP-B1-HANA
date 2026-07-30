const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDocumentReferencesPayload } = require('../services/documentReferencesPayloadUtils');

test('maps a sales order reference to SAP Service Layer reference payload', () => {
  const payload = buildDocumentReferencesPayload([
    {
      transactionType: '17',
      docEntry: '464',
      docNumber: '464',
      remark: 'Copied from Sales Order',
    },
  ]);

  assert.deepEqual(payload, [
    {
      RefObjType: '17',
      RefDocEntr: 464,
      RefDocNum: 464,
      Remark: 'Copied from Sales Order',
    },
  ]);
});

test('defaults missing reference type from the copied base document type', () => {
  const payload = buildDocumentReferencesPayload([
    {
      docEntry: '464',
      docNumber: '464',
    },
  ], { defaultObjectType: '17' });

  assert.deepEqual(payload, [
    {
      RefObjType: '17',
      RefDocEntr: 464,
      RefDocNum: 464,
    },
  ]);
});

test('rejects invalid reference transaction type before SAP submit', () => {
  assert.throws(
    () => buildDocumentReferencesPayload([
      {
        transactionType: 'Unknown Document',
        docNumber: '123',
      },
    ]),
    /invalid transaction type/,
  );
});
