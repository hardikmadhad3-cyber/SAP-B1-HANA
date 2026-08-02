jest.mock('./client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import { normaliseDocumentLine } from './copyFromApi';

describe('normaliseDocumentLine', () => {
  test('preserves a TDS-liable GRPO line when copying to A/P Invoice', () => {
    const line = normaliseDocumentLine(
      { ItemCode: 'ITEM-1', WTLiable: 'Y' },
      0,
      42,
      20,
    );

    expect(line.wtaxLiable).toBe('Y');
  });

  test('normalizes Service Layer TDS yes values', () => {
    const line = normaliseDocumentLine(
      { ItemCode: 'ITEM-1', wTaxLiable: 'tYES' },
      0,
      42,
      20,
    );

    expect(line.wtaxLiable).toBe('Y');
  });
});
