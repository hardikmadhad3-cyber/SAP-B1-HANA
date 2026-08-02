import { calculateServiceInvoiceLine } from './serviceInvoiceLineCalculations';

describe('calculateServiceInvoiceLine', () => {
  test('uses a newly entered price after discount as the initial base price', () => {
    expect(calculateServiceInvoiceLine({
      unitPrice: '1.02',
      discountPercent: '',
      priceAfterDisc: '1200',
      totalLC: '',
      sQty: '',
    }, 'priceAfterDisc')).toMatchObject({
      unitPrice: '1200.00',
      priceAfterDisc: '1200',
      totalLC: '1200.00',
    });
  });

  test('matches SAP B1 when a 2 percent discount is applied to 1200', () => {
    expect(calculateServiceInvoiceLine({
      unitPrice: '1200',
      _priceBaselineEstablished: true,
      discountPercent: '2',
      priceAfterDisc: '1200',
      totalLC: '1200',
      sQty: '',
    }, 'discountPercent')).toMatchObject({
      priceAfterDisc: '1176.00',
      totalLC: '1176.00',
    });
  });

  test('keeps discount stable and updates total when price after discount changes', () => {
    expect(calculateServiceInvoiceLine({
      unitPrice: '1200',
      _priceBaselineEstablished: true,
      discountPercent: '2',
      priceAfterDisc: '1176',
      totalLC: '1200',
      sQty: '2',
    }, 'priceAfterDisc', 12)).toMatchObject({
      discountPercent: '2',
      unitPrice: '1200.00',
      totalLC: '2352.00',
      taxAmountLC: '282.24',
    });
  });

  test('derives price after discount while keeping discount stable when total changes', () => {
    expect(calculateServiceInvoiceLine({
      unitPrice: '1200',
      _priceBaselineEstablished: true,
      discountPercent: '2',
      priceAfterDisc: '1200',
      totalLC: '2352',
      sQty: '2',
    }, 'totalLC')).toMatchObject({
      discountPercent: '2',
      priceAfterDisc: '1176.00',
      unitPrice: '1200.00',
    });
  });

  test('uses the visible price as the base when discount is the first edit', () => {
    expect(calculateServiceInvoiceLine({
      unitPrice: '1.02',
      discountPercent: '2',
      priceAfterDisc: '1200',
      totalLC: '1200',
      sQty: '',
    }, 'discountPercent')).toMatchObject({
      unitPrice: '1200.00',
      discountPercent: '2',
      priceAfterDisc: '1176.00',
      totalLC: '1176.00',
    });
  });

  test('does not create a negative discount while 1200 is typed character by character', () => {
    let line = {
      unitPrice: '1.02',
      discountPercent: '',
      priceAfterDisc: '',
      totalLC: '',
      sQty: '',
    };

    ['1', '12', '120', '1200'].forEach((value) => {
      line = calculateServiceInvoiceLine({ ...line, priceAfterDisc: value }, 'priceAfterDisc');
    });

    expect(line).toMatchObject({
      unitPrice: '1200.00',
      discountPercent: '',
      priceAfterDisc: '1200',
      totalLC: '1200.00',
    });
  });

  test('keeps a discount entered first and applies it when price entry is complete', () => {
    let line = {
      unitPrice: '',
      discountPercent: '2',
      priceAfterDisc: '',
      totalLC: '',
      sQty: '',
      _priceBaselineEstablished: false,
    };

    ['1', '12', '120', '1200'].forEach((value) => {
      line = calculateServiceInvoiceLine({ ...line, priceAfterDisc: value }, 'priceAfterDisc');
    });
    line = calculateServiceInvoiceLine(line, 'priceAfterDiscCommit');

    expect(line).toMatchObject({
      unitPrice: '1200.00',
      discountPercent: '2',
      priceAfterDisc: '1176.00',
      totalLC: '1176.00',
      _pendingPriceDiscountApplication: false,
    });
  });
});
