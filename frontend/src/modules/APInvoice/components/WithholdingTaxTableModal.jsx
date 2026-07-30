import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { matchesSapSearchText } from '../../../utils/sapSearch';

const parseNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatMoney = (value) => {
  const number = parseNumber(value);
  return `INR ${number.toFixed(2)}`;
};

const getCodeLabel = (row = {}) => {
  const code = row.code || row.WTCode || '';
  const name = row.name || row.WTName || '';
  return name ? `${code} - ${name}` : code;
};

export default function WithholdingTaxTableModal({
  isOpen,
  onClose,
  rows,
  allowedCodes,
  onRowsChange,
  baseAmount,
  allowManualRows = true,
  workspaceRef,
}) {
  const [lookup, setLookup] = useState({ open: false, rowIndex: -1, query: '' });
  const [workspaceBounds, setWorkspaceBounds] = useState(null);
  const lookupOptions = useMemo(() => {
    const query = lookup.query.trim();
    return (allowedCodes || []).filter((code) => {
      if (!query) return true;
      return matchesSapSearchText(`${code.code || ''} ${code.name || ''}`, query);
    });
  }, [allowedCodes, lookup.query]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const updateBounds = () => {
      const rect = workspaceRef?.current?.getBoundingClientRect?.();
      if (!rect) {
        setWorkspaceBounds(null);
        return;
      }
      const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect?.().bottom || 0;
      const top = Math.max(0, rect.top, topbarBottom);
      const left = Math.max(0, rect.left);
      setWorkspaceBounds({
        top,
        left,
        right: 'auto',
        bottom: 'auto',
        width: Math.max(320, window.innerWidth - left),
        height: Math.max(240, window.innerHeight - top),
      });
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, true);
    return () => {
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds, true);
    };
  }, [isOpen, workspaceRef]);

  if (!isOpen) return null;

  const updateRow = (rowIndex, patch) => {
    onRowsChange(rows.map((row, index) => (index === rowIndex ? { ...row, ...patch } : row)));
  };

  const chooseCode = (rowIndex, codeRow) => {
    const rate = parseNumber(codeRow.rate);
    updateRow(rowIndex, {
      code: codeRow.code || '',
      name: codeRow.name || '',
      rate,
      baseAmount,
      taxableAmount: baseAmount,
      wtaxAmount: baseAmount * rate / 100,
      category: codeRow.taxCategory || '',
      criteria: 'Cash',
      tdsType: 'eTDS',
    });
    setLookup({ open: false, rowIndex: -1, query: '' });
  };

  const addRow = () => {
    onRowsChange([
      ...rows,
      {
        code: '',
        name: '',
        rate: 0,
        baseAmount,
        taxableAmount: baseAmount,
        wtaxAmount: 0,
        category: 'Invoice',
        baseType: 'Net',
        criteria: 'Cash',
        tdsType: 'eTDS',
        tdsAccount: '',
        surchargeAccount: '',
        cessAccount: '',
        hscAccount: '',
        igstAccount: '',
        cgstAccount: '',
        sgstAccount: '',
        utgstAccount: '',
      },
    ]);
  };

  const removeRow = (rowIndex) => {
    onRowsChange(rows.filter((_, index) => index !== rowIndex));
  };

  return createPortal(
    <div
      className="del-modal-overlay ap-wtax-overlay"
      style={workspaceBounds || undefined}
      onClick={onClose}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="del-modal ap-wtax-window" onClick={(event) => event.stopPropagation()}>
        <div className="del-modal__header ap-wtax-titlebar">
          <strong>Withholding Tax Table</strong>
          <button type="button" className="del-modal__close ap-wtax-titlebar__button" onClick={onClose}>x</button>
        </div>

        <div className="ap-wtax-toolbar">
          <label>WT Tax Category</label>
          <input value={rows[0]?.category || ''} readOnly />
          <span>Details</span>
          <input value={rows[0]?.name || ''} readOnly />
        </div>

        <div className="ap-wtax-grid-wrap">
          <table className="ap-wtax-grid">
            <thead>
              <tr>
                <th style={{ width: 38 }}>#</th>
                <th style={{ width: 95 }}>Code</th>
                <th style={{ width: 170 }}>Name</th>
                <th style={{ width: 85 }}>Rate</th>
                <th style={{ width: 120 }}>Base Amount</th>
                <th style={{ width: 135 }}>Taxable Amount</th>
                <th style={{ width: 125 }}>WTax Amount</th>
                <th style={{ width: 90 }}>Category</th>
                <th style={{ width: 90 }}>Base Type</th>
                <th style={{ width: 85 }}>Criteria</th>
                <th style={{ width: 110 }}>TCS/TDS Type</th>
                <th style={{ width: 130 }}>TCS/TDS Account</th>
                <th style={{ width: 140 }}>Surcharge Account</th>
                <th style={{ width: 120 }}>Cess Account</th>
                <th style={{ width: 120 }}>HSC Account</th>
                <th style={{ width: 120 }}>IGST Account</th>
                <th style={{ width: 120 }}>CGST Account</th>
                <th style={{ width: 120 }}>SGST Account</th>
                <th style={{ width: 125 }}>UTGST Account</th>
                <th style={{ width: 42 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${row.code || 'new'}-${rowIndex}`}>
                  <td className="ap-wtax-grid__muted">{rowIndex + 1}</td>
                  <td>
                    <div className="ap-wtax-code-cell">
                      <input value={row.code || ''} readOnly={!allowManualRows} onChange={(event) => updateRow(rowIndex, { code: event.target.value })} />
                      {allowManualRows && (
                        <button type="button" onClick={() => setLookup({ open: true, rowIndex, query: '' })}>...</button>
                      )}
                    </div>
                  </td>
                  <td><input value={row.name || ''} readOnly /></td>
                  <td><input value={parseNumber(row.rate).toFixed(3)} readOnly /></td>
                  <td><input value={formatMoney(row.baseAmount)} readOnly /></td>
                  <td><input value={formatMoney(row.taxableAmount)} readOnly /></td>
                  <td><input value={formatMoney(row.wtaxAmount)} readOnly /></td>
                  <td><input value={row.category || 'Invoice'} readOnly /></td>
                  <td><input value={row.baseType || 'Net'} readOnly /></td>
                  <td><input value={row.criteria || 'Cash'} readOnly /></td>
                  <td><input value={row.tdsType || 'eTDS'} readOnly /></td>
                  <td><input value={row.tdsAccount || ''} readOnly /></td>
                  <td><input value={row.surchargeAccount || ''} readOnly /></td>
                  <td><input value={row.cessAccount || ''} readOnly /></td>
                  <td><input value={row.hscAccount || ''} readOnly /></td>
                  <td><input value={row.igstAccount || ''} readOnly /></td>
                  <td><input value={row.cgstAccount || ''} readOnly /></td>
                  <td><input value={row.sgstAccount || ''} readOnly /></td>
                  <td><input value={row.utgstAccount || ''} readOnly /></td>
                  <td>
                    {allowManualRows && (
                      <button type="button" className="ap-wtax-remove" onClick={() => removeRow(rowIndex)}>x</button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && !allowManualRows && (
                <tr>
                  <td colSpan={20} className="ap-wtax-empty">No withholding tax codes are applicable.</td>
                </tr>
              )}
              {allowManualRows && (
                <tr>
                  <td className="ap-wtax-grid__muted">{rows.length + 1}</td>
                  <td><button type="button" className="ap-wtax-add-row" onClick={addRow}>+</button></td>
                  <td colSpan={18}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="del-modal__footer ap-wtax-footer">
          <button type="button" className="del-btn del-btn--primary ap-wtax-ok" onClick={onClose}>OK</button>
          <button type="button" className="del-btn" onClick={onClose}>Cancel</button>
        </div>

        {lookup.open && (
          <div className="ap-wtax-lookup" onClick={(event) => event.stopPropagation()}>
            <div className="ap-wtax-titlebar">
              <span>List of Withholding Tax</span>
              <button type="button" className="ap-wtax-titlebar__button" onClick={() => setLookup({ open: false, rowIndex: -1, query: '' })}>X</button>
            </div>
            <div className="ap-wtax-lookup__find">
              <label>Find</label>
              <input autoFocus value={lookup.query} onChange={(event) => setLookup((prev) => ({ ...prev, query: event.target.value }))} />
              <button type="button">Text Search</button>
            </div>
            <div className="ap-wtax-lookup__grid">
              <table className="ap-wtax-grid">
                <thead>
                  <tr>
                    <th style={{ width: 38 }}>#</th>
                    <th style={{ width: 95 }}>Code</th>
                    <th style={{ width: 220 }}>Name</th>
                    <th style={{ width: 90 }}>Rate</th>
                    <th style={{ width: 100 }}>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {lookupOptions.map((row, index) => (
                    <tr key={row.code} onDoubleClick={() => chooseCode(lookup.rowIndex, row)}>
                      <td className="ap-wtax-grid__muted">{index + 1}</td>
                      <td>{row.code}</td>
                      <td>{getCodeLabel(row).replace(`${row.code} - `, '')}</td>
                      <td>{parseNumber(row.rate).toFixed(3)}</td>
                      <td>{row.taxCategory || ''}</td>
                    </tr>
                  ))}
                  {!lookupOptions.length && (
                    <tr>
                      <td colSpan={5} className="ap-wtax-empty">No withholding tax codes found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="ap-wtax-footer">
              <button
                type="button"
                className="ap-wtax-ok"
                disabled={!lookupOptions.length}
                onClick={() => lookupOptions[0] && chooseCode(lookup.rowIndex, lookupOptions[0])}
              >
                Choose
              </button>
              <button type="button" onClick={() => setLookup({ open: false, rowIndex: -1, query: '' })}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
