import {
  buildGRPOLineUdfPayload,
  getLineUdfValue,
  hydrateGRPOLineUdfFields,
  resolveUdfDefinitionKey,
} from './grpoLineUdfMapping';

const rowUdfDefinitions = [
  { key: 'U_PACKINGTYPE', type: 'select', label: 'Packing-Type' },
  { key: 'U_PackingStatus', type: 'select', label: 'Packing Status' },
  { key: 'U_GrossWt', type: 'number', label: 'GrossWt' },
  { key: 'U_TotalPackage', type: 'number', label: 'Total-Package' },
  { key: 'U_Brok_Buyer', type: 'number', label: 'Buyer Brokerage' },
  { key: 'U_PRICE', type: 'number' },
  { key: 'U_S_ITEM', type: 'text' },
];

test('maps GRPO matrix fields to live SAP UDF keys case-insensitively', () => {
  const payload = buildGRPOLineUdfPayload(
    {
      packingType: 'BAG',
      grossWt: '1200.0000',
      totalPackage: '122',
      buyerBrokerage: '15.50',
      unitPrice: '125.00',
      itemNo: 'RM-001',
      price: '',
      sellerItem: '',
      udf: {},
    },
    rowUdfDefinitions,
    {}
  );

  expect(payload).toEqual({
    U_PACKINGTYPE: 'BAG',
    U_GrossWt: '1200.0000',
    U_TotalPackage: '122',
    U_Brok_Buyer: '15.50',
  });
});

test('does not copy standard price or item code into GRPO UDF fields', () => {
  const payload = buildGRPOLineUdfPayload(
    {
      itemNo: 'RM-001',
      unitPrice: '125.00',
      udf: {},
    },
    rowUdfDefinitions,
    {}
  );

  expect(payload).not.toHaveProperty('U_PRICE');
  expect(payload).not.toHaveProperty('U_S_ITEM');
});

test('reads explicit SAP UDF values by alias without treating standard fields as UDFs', () => {
  expect(resolveUdfDefinitionKey('U_PackingType', rowUdfDefinitions)).toBe('U_PACKINGTYPE');
  expect(getLineUdfValue({ unitPrice: '125.00', U_PRICE: '130.00' }, ['U_PRICE'])).toBe('130.00');
  expect(getLineUdfValue({ unitPrice: '125.00', price: '125.00' }, ['U_PRICE'])).toBe('');
});

test('hydrates mapped GRPO fields from live SAP UDF aliases only', () => {
  const hydrated = hydrateGRPOLineUdfFields({
    ItemCode: 'RM-001',
    UnitPrice: '125.00',
    Price: '125.00',
    udf: {
      U_PackingStatus: 'Pallet',
      U_GrossWt: '1200.0000',
      U_TotalPackage: '122',
      U_Buyer_Brokerage: '15.50',
      U_PRICE: '130.00',
    },
  });

  expect(hydrated.packingType).toBe('Pallet');
  expect(hydrated.grossWt).toBe('1200.0000');
  expect(hydrated.totalPackage).toBe('122');
  expect(hydrated.buyerBrokerage).toBe('15.50');
  expect(hydrated.price).toBe('130.00');
  expect(hydrated.itemNo).toBeUndefined();
  expect(hydrated.unitPrice).toBeUndefined();
});

test('hydrates mapped GRPO fields from exact SAP mixed-case UDF names', () => {
  const hydrated = hydrateGRPOLineUdfFields({
    udf: {
      U_PackingType: 'Pallet',
      U_GrossWt: '1200.0000',
      U_TotalPackage: '122',
    },
  });

  expect(hydrated.packingType).toBe('Pallet');
  expect(hydrated.grossWt).toBe('1200.0000');
  expect(hydrated.totalPackage).toBe('122');
});

test('writes packing type to the exact live SAP metadata key', () => {
  const payload = buildGRPOLineUdfPayload(
    {
      packingType: 'Pallet',
      udf: {},
    },
    [{ key: 'U_PackingStatus', type: 'select', label: 'Packing Status' }],
    {}
  );

  expect(payload).toEqual({ U_PackingStatus: 'Pallet' });
});

test('writes GRPO mapped UDF values to configured SAP keys when metadata is not loaded yet', () => {
  const payload = buildGRPOLineUdfPayload(
    {
      packingType: 'Bag',
      grossWt: '1200.0000',
      totalPackage: '122',
      buyerBrokerage: '15.50',
      udf: {},
    },
    [],
    {}
  );

  expect(payload).toEqual({
    U_PackingType: 'Bag',
    U_GrossWt: '1200.0000',
    U_TotalPackage: '122',
    U_Brok_Buyer: '15.50',
  });
});
