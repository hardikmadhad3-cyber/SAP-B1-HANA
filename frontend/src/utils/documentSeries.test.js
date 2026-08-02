import {
  SAP_MANUAL_SERIES_VALUE,
  isManualDocumentSeries,
  isValidManualDocumentNumber,
} from './documentSeries';

describe('document series helpers', () => {
  test('recognizes SAP manual series values', () => {
    expect(isManualDocumentSeries(SAP_MANUAL_SERIES_VALUE)).toBe(true);
    expect(isManualDocumentSeries('manual')).toBe(true);
    expect(isManualDocumentSeries('42')).toBe(false);
  });

  test('accepts only positive integer manual document numbers', () => {
    expect(isValidManualDocumentNumber('1001')).toBe(true);
    expect(isValidManualDocumentNumber('0')).toBe(false);
    expect(isValidManualDocumentNumber('-1')).toBe(false);
    expect(isValidManualDocumentNumber('10.5')).toBe(false);
    expect(isValidManualDocumentNumber('')).toBe(false);
  });
});
