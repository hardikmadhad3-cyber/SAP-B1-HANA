import { mergeWindowTaskState } from './windowTaskState';

describe('mergeWindowTaskState', () => {
  it('keeps a saved GRPO draft when a delayed route-only update arrives', () => {
    const grpoDraft = {
      header: { vendorCode: 'V1000' },
      lines: [{ itemCode: 'A1000', unitPrice: 244 }],
    };

    const mergedState = mergeWindowTaskState(
      {
        grpoDraft,
        sapWindow: {
          id: 'copy-po-to-grpo:42',
          path: '/grpo',
          title: 'Goods Receipt PO',
        },
      },
      {
        sapWindow: {
          id: 'copy-po-to-grpo:42',
          path: '/grpo',
          title: 'Goods Receipt PO',
        },
      },
    );

    expect(mergedState.grpoDraft).toEqual(grpoDraft);
    expect(mergedState.sapWindow.path).toBe('/grpo');
  });

  it('uses the newest complete document draft', () => {
    const mergedState = mergeWindowTaskState(
      {
        grpoDraft: {
          lines: [{ unitPrice: 246 }],
        },
      },
      {
        grpoDraft: {
          lines: [{ unitPrice: 244 }],
        },
      },
    );

    expect(mergedState.grpoDraft.lines[0].unitPrice).toBe(244);
  });

  it('makes a live draft authoritative over the original Copy From payload', () => {
    const mergedState = mergeWindowTaskState(
      {
        copyFrom: {
          type: 'grpo',
          lines: [{ unitPrice: 246 }],
        },
        sapWindow: {
          id: 'page-window:ap-invoice-copy-from-grpo-42',
          path: '/ap-invoice',
        },
      },
      {
        apInvoiceDraft: {
          lines: [{ unitPrice: 244 }],
        },
        sapWindow: {
          id: 'page-window:ap-invoice-copy-from-grpo-42',
          path: '/ap-invoice',
        },
      },
    );

    expect(mergedState.copyFrom).toBeUndefined();
    expect(mergedState.apInvoiceDraft.lines[0].unitPrice).toBe(244);
  });

  it('does not reintroduce Copy From data after a live draft was saved', () => {
    const liveDraftState = {
      apInvoiceDraft: {
        lines: [{ unitPrice: 244 }],
      },
      sapWindow: {
        id: 'page-window:ap-invoice-copy-from-grpo-42',
        path: '/ap-invoice',
      },
    };

    const mergedState = mergeWindowTaskState(liveDraftState, {
      copyFrom: {
        type: 'grpo',
        lines: [{ unitPrice: 246 }],
      },
      sapWindow: liveDraftState.sapWindow,
    });

    expect(mergedState.copyFrom).toBeUndefined();
    expect(mergedState.apInvoiceDraft.lines[0].unitPrice).toBe(244);
  });

  it('retains the original Copy From payload when a page clears its route state', () => {
    const copyFrom = {
      type: 'grpo',
      docEntry: 42,
      lines: [{ itemCode: 'A1000', unitPrice: 246 }],
    };

    const mergedState = mergeWindowTaskState(
      {
        copyFrom,
        sapWindow: {
          id: 'page-window:ap-invoice-copy-from-grpo-42',
          path: '/ap-invoice',
        },
      },
      {
        sapWindow: {
          id: 'page-window:ap-invoice-copy-from-grpo-42',
          path: '/ap-invoice',
        },
      },
    );

    expect(mergedState.copyFrom).toEqual(copyFrom);
  });

  it('allows an explicit null state to clear saved state', () => {
    expect(mergeWindowTaskState({ grpoDraft: {} }, null)).toBeNull();
  });
});
