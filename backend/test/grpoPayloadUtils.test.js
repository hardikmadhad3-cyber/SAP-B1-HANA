const test = require('node:test');
const assert = require('node:assert/strict');

const { buildGRPODocumentLine } = require('../services/grpoPayloadUtils');

test('preserves edited destination values on a PO-based GRPO line', () => {
  const documentLine = buildGRPODocumentLine({
    itemNo: 'RM-001',
    itemDescription: 'Edited description',
    quantity: '3.5',
    unitPrice: '244',
    stdDiscount: '2.25',
    taxCode: 'GST18',
    whse: 'WH-02',
    uomCode: 'KG',
    commPercent: '1.5',
    baseEntry: '101',
    baseType: '22',
    baseLine: '0',
    udf: {
      U_PackingType: 'Bag',
    },
  });

  assert.deepEqual(documentLine, {
    ItemCode: 'RM-001',
    ItemDescription: 'Edited description',
    Quantity: 3.5,
    UnitPrice: 244,
    Price: 244,
    DiscountPercent: 2.25,
    TaxCode: 'GST18',
    WarehouseCode: 'WH-02',
    UoMCode: 'KG',
    CommissionPercent: 1.5,
    BaseEntry: 101,
    BaseType: 22,
    BaseLine: 0,
    U_PackingType: 'Bag',
  });
});

test('overrides copied discount and commission when they are changed to zero', () => {
  const documentLine = buildGRPODocumentLine({
    itemNo: 'RM-002',
    quantity: '1',
    unitPrice: '100',
    stdDiscount: '0',
    commPercent: '0',
    baseEntry: 102,
    baseType: 22,
    baseLine: 1,
  });

  assert.equal(documentLine.DiscountPercent, 0);
  assert.equal(documentLine.CommissionPercent, 0);
});

test('keeps manual GRPO line values without adding base references', () => {
  const documentLine = buildGRPODocumentLine({
    itemNo: 'RM-003',
    itemDescription: 'Manual line',
    quantity: 2,
    unitPrice: 50,
    taxCode: 'GST12',
    whse: 'WH-01',
    uomCode: 'PCS',
  });

  assert.equal(documentLine.UnitPrice, 50);
  assert.equal(documentLine.Price, 50);
  assert.equal(documentLine.TaxCode, 'GST12');
  assert.equal(documentLine.UoMCode, 'PCS');
  assert.equal(documentLine.BaseEntry, undefined);
  assert.equal(documentLine.BaseType, undefined);
  assert.equal(documentLine.BaseLine, undefined);
});
