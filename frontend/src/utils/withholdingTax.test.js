import {
  recalcWithholdingRows,
  resolveWithholdingTaxBaseAmount,
} from './withholdingTax';

const amounts = {
  netAmount: 27877.48,
  taxAmount: 3342.8976,
  grossAmount: 31220.3776,
};

describe('withholding tax base calculation', () => {
  test('uses the amount before GST for a Net withholding code', () => {
    expect(resolveWithholdingTaxBaseAmount({ baseType: 'Net' }, amounts, 4)).toBe(27877.48);
  });

  test('uses the tax-inclusive amount for a Gross withholding code', () => {
    expect(resolveWithholdingTaxBaseAmount({ baseTypeCode: 'G' }, amounts, 4)).toBe(31220.3776);
  });

  test('uses only the tax amount for a VAT withholding code', () => {
    expect(resolveWithholdingTaxBaseAmount({ baseTypeCode: 'V' }, amounts, 4)).toBe(3342.8976);
  });

  test('calculates TDS from the configured base percentage and rate', () => {
    const [row] = recalcWithholdingRows([
      { baseTypeCode: 'N', basePercentage: 100, rate: 10 },
    ], amounts, { total: 4, tax: 4 });

    expect(row.baseAmount).toBe(27877.48);
    expect(row.taxableAmount).toBe(27877.48);
    expect(row.wtaxAmount).toBe(2787.748);
  });
});
