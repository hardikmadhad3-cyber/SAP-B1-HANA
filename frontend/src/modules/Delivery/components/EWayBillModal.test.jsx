jest.mock('../../../api/hsnCodeApi', () => ({
  fetchHSNCodes: jest.fn(),
}));

import { buildInitialForm } from './EWayBillModal';

describe('buildInitialForm', () => {
  const definitions = [
    { key: 'U_TrfMode', sapField: 'U_TrfMode' },
  ];

  test('uses the standard saved E-Way Bill mode instead of a conflicting header UDF', () => {
    const form = buildInitialForm(
      { U_TrfMode: '4' },
      definitions,
      { mode: '1', modeLabel: 'Road' },
    );

    expect(form.mode).toBe('1');
  });

  test('falls back to the header UDF when the standard E-Way Bill mode is empty', () => {
    const form = buildInitialForm(
      { U_TrfMode: '4' },
      definitions,
      { mode: '' },
    );

    expect(form.mode).toBe('4');
  });
});
