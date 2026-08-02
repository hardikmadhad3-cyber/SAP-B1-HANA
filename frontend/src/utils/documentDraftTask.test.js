import { buildDocumentDraftTask } from './documentDraftTask';

test('keeps a Copy To window identity while attaching the current document draft', () => {
  const task = buildDocumentDraftTask({
    routedWindow: {
      id: 'page-window:grpo-copy-from-purchase-order-101',
      path: '/grpo',
      title: 'Goods Receipt PO - Purchase Order #1001',
    },
    pathname: '/grpo',
    title: 'Goods Receipt PO',
    draftState: {
      grpoDraft: {
        header: { vendor: 'V100' },
        lines: [{ itemNo: 'RM-001', quantity: '2' }],
      },
    },
  });

  expect(task.id).toBe('page-window:grpo-copy-from-purchase-order-101');
  expect(task.path).toBe('/grpo');
  expect(task.state.sapWindow.id).toBe(task.id);
  expect(task.state.grpoDraft.header.vendor).toBe('V100');
  expect(task.state.grpoDraft.lines).toEqual([{ itemNo: 'RM-001', quantity: '2' }]);
});

test('creates the same fallback task id used by normal route minimization', () => {
  const task = buildDocumentDraftTask({
    pathname: '/grpo',
    title: 'Goods Receipt PO',
    draftState: {
      grpoDraft: {
        lines: [{ itemNo: 'RM-002' }],
      },
    },
  });

  expect(task.id).toBe('page-window:/grpo');
  expect(task.state.sapWindow.id).toBe('page-window:/grpo');
  expect(task.state.grpoDraft.lines[0].itemNo).toBe('RM-002');
});
