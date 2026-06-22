import { getLineTotalsForDisplay } from './lineTotals';

test('uses SAP line total values without adding tax again', () => {
  expect(
    getLineTotalsForDisplay(
      { LineTotal: '100.00', taxCode: 'GST18' },
      [{ Code: 'GST18', Rate: 18 }]
    )
  ).toEqual({ beforeTax: '100.00', total: '100.00' });
});

test('prefers explicit total before tax over generic total', () => {
  expect(
    getLineTotalsForDisplay({ totalBeforeTax: '95.00', total: '100.00' }, [])
  ).toEqual({ beforeTax: '95.00', total: '100.00' });
});
