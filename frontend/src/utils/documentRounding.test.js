import { calculateDocumentRounding } from './documentRounding';

describe('calculateDocumentRounding', () => {
  test('rounds a purchasing document total to the nearest whole currency unit', () => {
    expect(calculateDocumentRounding(31220.3776, true, 4)).toEqual({
      totalBeforeRounding: 31220.3776,
      roundingAmount: -0.3776,
      total: 31220,
    });
  });

  test('keeps the calculated total unchanged when rounding is disabled', () => {
    expect(calculateDocumentRounding(31220.3776, false, 4)).toEqual({
      totalBeforeRounding: 31220.3776,
      roundingAmount: 0,
      total: 31220.3776,
    });
  });
});
