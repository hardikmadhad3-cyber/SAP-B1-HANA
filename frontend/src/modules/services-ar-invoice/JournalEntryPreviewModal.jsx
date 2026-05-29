import React, { useEffect, useMemo, useState } from 'react';

const toNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmt = (value) => toNumber(value).toFixed(2);

const createEmptyLine = (index) => ({
  lineId: index + 1,
  account: '',
  name: '',
  debit: 0,
  credit: 0,
  taxCode: '',
  remarks: '',
  project: '',
  location: '',
  profitCenter: '',
});

function JournalEntryPreviewModal({
  isOpen,
  journalEntry,
  onClose,
  onOpenLinkedMaster,
  onOpenSource,
  onRegenerate,
  loading = false,
}) {
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState('Open');

  useEffect(() => {
    setLines((journalEntry?.lines || []).map((line, index) => ({
      ...line,
      lineId: line.lineId || index + 1,
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
    })));
    setStatus('Open');
  }, [journalEntry]);

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
    const totalCredit = lines.reduce((sum, line) => sum + toNumber(line.credit), 0);
    return {
      totalDebit,
      totalCredit,
      difference: totalDebit - totalCredit,
    };
  }, [lines]);

  if (!isOpen) return null;

  const updateLine = (index, field, value) => {
    setLines((prev) => prev.map((line, lineIndex) => (
      lineIndex === index
        ? {
          ...line,
          [field]: ['debit', 'credit'].includes(field) ? toNumber(value) : value,
        }
        : line
    )));
  };

  const addRow = () => {
    setLines((prev) => [...prev, createEmptyLine(prev.length)]);
  };

  const deleteRow = (index) => {
    setLines((prev) => prev.length <= 1
      ? [createEmptyLine(0)]
      : prev.filter((_line, lineIndex) => lineIndex !== index).map((line, lineIndex) => ({ ...line, lineId: lineIndex + 1 })));
  };

  const autoBalance = () => {
    setLines((prev) => {
      const next = prev.length ? [...prev] : [createEmptyLine(0)];
      const totalDebit = next.reduce((sum, line) => sum + toNumber(line.debit), 0);
      const totalCredit = next.reduce((sum, line) => sum + toNumber(line.credit), 0);
      const difference = Number((totalDebit - totalCredit).toFixed(2));
      if (Math.abs(difference) < 0.01) return next;
      const lastIndex = next.length - 1;
      const last = { ...next[lastIndex] };
      if (difference > 0) {
        last.credit = toNumber(last.credit) + difference;
      } else {
        last.debit = toNumber(last.debit) + Math.abs(difference);
      }
      next[lastIndex] = last;
      return next;
    });
  };

  const printJournalEntry = () => {
    const printable = document.querySelector('.service-je-window')?.outerHTML || '';
    const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=760');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Journal Entry ${journalEntry?.number || ''}</title>
          <style>
            body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:16px}
            table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #9ca8b3;padding:4px}
            th{background:#dfe5ea}
            input{border:0;width:100%;font:inherit}
            button,.service-je-actions,.service-je-close{display:none!important}
          </style>
        </head>
        <body>${printable}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const exportPdf = () => {
    printJournalEntry();
  };

  const lineColumns = [
    ['account', 'G/L Acct/BP Code', '150'],
    ['name', 'G/L Acct/BP Name', '240'],
    ['debit', 'Debit', '120'],
    ['credit', 'Credit', '120'],
    ['taxCode', 'Tax Code', '100'],
    ['remarks', 'Remarks', '210'],
    ['project', 'Project', '110'],
    ['location', 'Location', '120'],
    ['profitCenter', 'Profit Center', '130'],
  ];

  const balanced = Math.abs(totals.difference) < 0.01;

  return (
    <div className="service-je-backdrop" role="dialog" aria-modal="true" data-document-dirty-ignore="true">
      <div className="service-je-window">
        <div className="service-je-titlebar">
          <span>Journal Entry</span>
          <button type="button" className="service-je-close" onClick={onClose}>x</button>
        </div>

        <div className="service-je-actions" data-document-dirty-ignore="true">
          <button type="button" className="del-btn" onClick={onRegenerate} disabled={loading}>Find Mode</button>
          <button type="button" className="del-btn" onClick={addRow}>Add Row</button>
          <button type="button" className="del-btn" onClick={autoBalance}>Auto Balance</button>
          <button type="button" className="del-btn" onClick={printJournalEntry}>Print</button>
          <button type="button" className="del-btn" onClick={exportPdf}>PDF</button>
          <button type="button" className="del-btn" onClick={() => setStatus('Cancelled')}>Cancel Journal Entry</button>
          <button type="button" className="del-btn" onClick={() => setStatus('Reversed')}>Reverse Journal Entry</button>
          {journalEntry?.originNo && (
            <button type="button" className="del-btn" onClick={onOpenSource}>Open Source Document</button>
          )}
        </div>

        {journalEntry?.persistenceNote && (
          <div className="service-je-note">{journalEntry.persistenceNote}</div>
        )}

        <div className="service-je-header">
          <div>
            <label>Series</label>
            <input value={journalEntry?.series || ''} readOnly />
          </div>
          <div>
            <label>Number</label>
            <input value={journalEntry?.number || ''} readOnly />
          </div>
          <div>
            <label>Posting Date</label>
            <input type="date" value={journalEntry?.postingDate || ''} readOnly />
          </div>
          <div>
            <label>Due Date</label>
            <input type="date" value={journalEntry?.dueDate || ''} readOnly />
          </div>
          <div>
            <label>Document Date</label>
            <input type="date" value={journalEntry?.documentDate || ''} readOnly />
          </div>
          <div>
            <label>Origin</label>
            <input value={journalEntry?.origin || 'Service A/R Invoice'} readOnly />
          </div>
          <div>
            <label>Origin No</label>
            <input value={journalEntry?.originNo || ''} readOnly />
          </div>
          <div>
            <label>Trans No</label>
            <input value={journalEntry?.transNo || ''} readOnly />
          </div>
          <div>
            <label>Status</label>
            <input value={status} readOnly />
          </div>
          <div className="service-je-header__wide">
            <label>Remarks</label>
            <input value={journalEntry?.remarks || ''} readOnly />
          </div>
          <div>
            <label>Reference 1</label>
            <input value={journalEntry?.reference1 || ''} readOnly />
          </div>
          <div>
            <label>Reference 2</label>
            <input value={journalEntry?.reference2 || ''} readOnly />
          </div>
          <div>
            <label>Reference 3</label>
            <input value={journalEntry?.reference3 || ''} readOnly />
          </div>
          <div>
            <label>Project</label>
            <input value={journalEntry?.project || ''} readOnly />
          </div>
          <div>
            <label>Location</label>
            <input value={journalEntry?.location || ''} readOnly />
          </div>
        </div>

        <div className="service-je-grid-wrap">
          <table className="service-je-grid">
            <colgroup>
              <col style={{ width: 42 }} />
              {lineColumns.map((column) => <col key={column[0]} style={{ width: `${column[2]}px` }} />)}
              <col style={{ width: 58 }} />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                {lineColumns.map((column) => <th key={column[0]}>{column[1]}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.lineId}-${index}`}>
                  <td className="service-je-rownum">{index + 1}</td>
                  {lineColumns.map(([key]) => (
                    <td key={key} className={['debit', 'credit'].includes(key) ? 'service-je-amount' : ''}>
                      <div className="service-je-cell">
                        {key === 'account' && (
                          <button
                            type="button"
                            className="service-je-golden"
                            title="Golden Arrow Navigation"
                            onClick={() => onOpenLinkedMaster?.(line)}
                          >
                            &gt;
                          </button>
                        )}
                        <input
                          value={['debit', 'credit'].includes(key) ? fmt(line[key]) : (line[key] || '')}
                          onChange={(event) => updateLine(index, key, event.target.value)}
                          style={{ textAlign: ['debit', 'credit'].includes(key) ? 'right' : 'left' }}
                        />
                      </div>
                    </td>
                  ))}
                  <td>
                    <button type="button" className="del-btn del-btn--danger service-je-delete" onClick={() => deleteRow(index)}>x</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Grid Footer Totals</td>
                <td className="service-je-total">{fmt(totals.totalDebit)}</td>
                <td className="service-je-total">{fmt(totals.totalCredit)}</td>
                <td colSpan={6}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="service-je-footer">
          <div>Total Debit : <strong>{fmt(totals.totalDebit)}</strong></div>
          <div>Total Credit: <strong>{fmt(totals.totalCredit)}</strong></div>
          <div className={balanced ? 'service-je-balanced' : 'service-je-unbalanced'}>
            Difference : <strong>{fmt(totals.difference)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JournalEntryPreviewModal;
