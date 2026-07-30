const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isManualDocumentSeries,
  buildDocumentSeriesPayload,
} = require('../services/documentSeriesPayloadUtils');

test('builds SAP payload fields for a manual document series', () => {
  assert.equal(isManualDocumentSeries('-1'), true);
  assert.deepEqual(
    buildDocumentSeriesPayload({ series: '-1', nextNumber: '1001' }),
    { Series: -1, DocNum: 1001 },
  );
});

test('builds SAP payload fields for an automatic document series', () => {
  assert.deepEqual(
    buildDocumentSeriesPayload({ series: '42', nextNumber: '1001' }),
    { Series: 42 },
  );
});

test('rejects an invalid manual document number', () => {
  assert.throws(
    () => buildDocumentSeriesPayload({ series: '-1', nextNumber: '' }),
    /positive integer/,
  );
});
