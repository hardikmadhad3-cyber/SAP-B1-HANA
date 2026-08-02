import { getCopyableSourceLines } from './documentCopyService';

describe('getCopyableSourceLines', () => {
  test('keeps only GRPO rows with remaining open quantity', () => {
    const lines = getCopyableSourceLines('grpo', [
      { lineNum: 0, lineStatus: 'Closed', openQty: '0', quantity: '122' },
      { lineNum: 1, lineStatus: 'Open', openQty: '4', quantity: '10' },
      { lineNum: 2, lineStatus: 'O', openQty: '0', quantity: '3' },
    ]);

    expect(lines).toEqual([
      { lineNum: 1, lineStatus: 'Open', openQty: '4', quantity: '10' },
    ]);
  });

  test('does not filter unrelated document types', () => {
    const lines = [{ lineStatus: 'Closed', openQty: '0' }];
    expect(getCopyableSourceLines('apInvoice', lines)).toBe(lines);
  });
});
