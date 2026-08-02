import { buildDuplicateHeader, buildDuplicateLines } from './documentDuplicate';

describe('document duplication', () => {
  test('keeps the selected series while clearing document identity', () => {
    expect(buildDuplicateHeader(
      { docNo: '1363', series: '293', seriesName: 'JD2627', status: 'Open' },
      { docNo: '', series: '', status: 'Open', nextNumber: '' },
    )).toMatchObject({
      docNo: '',
      nextNumber: '',
      series: '293',
      seriesName: 'JD2627',
      status: 'Open',
    });
  });

  test('removes GRPO base references from duplicated invoice rows', () => {
    const createLine = () => ({ itemNo: '', quantity: '', baseType: null, baseEntry: null, baseLine: null });
    const duplicated = buildDuplicateLines([{
      itemNo: 'ITEM-1',
      quantity: '4',
      baseType: 20,
      baseEntry: 6,
      baseLine: 0,
    }], createLine, []);

    expect(duplicated[0]).toMatchObject({
      itemNo: 'ITEM-1',
      quantity: '4',
      baseType: null,
      baseEntry: null,
      baseLine: null,
    });
  });
});
