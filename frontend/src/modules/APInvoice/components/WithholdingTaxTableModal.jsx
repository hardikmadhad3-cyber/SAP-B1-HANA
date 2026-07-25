import React, { useMemo, useState } from 'react';

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
}) {
  const [lookup, setLookup] = useState({ open: false, rowIndex: -1, query: '' });
  const lookupOptions = useMemo(() => {
    const query = lookup.query.trim().toLowerCase();
    return (allowedCodes || []).filter((code) => {
      if (!query) return true;
      return `${code.code || ''} ${code.name || ''}`.toLowerCase().includes(query);
    });
  }, [allowedCodes, lookup.query]);

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

  return (
    <div className="ap-wtax-overlay" onClick={onClose} onContextMenu={(event) => event.stopPropagation()}>
      <div className="ap-wtax-window" onClick={(event) => event.stopPropagation()}>
        <div className="ap-wtax-titlebar">
          <span>Withholding Tax Table</span>
          <button type="button" className="ap-wtax-titlebar__button" onClick={onClose}>X</button>
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
                      <input value={row.code || ''} onChange={(event) => updateRow(rowIndex, { code: event.target.value })} />
                      <button type="button" onClick={() => setLookup({ open: true, rowIndex, query: '' })}>...</button>
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
                  <td><button type="button" className="ap-wtax-remove" onClick={() => removeRow(rowIndex)}>x</button></td>
                </tr>
              ))}
              <tr>
                <td className="ap-wtax-grid__muted">{rows.length + 1}</td>
                <td><button type="button" className="ap-wtax-add-row" onClick={addRow}>+</button></td>
                <td colSpan={18}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ap-wtax-footer">
          <button type="button" className="ap-wtax-ok" onClick={onClose}>OK</button>
          <button type="button" onClick={onClose}>Cancel</button>
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
    </div>
  );
}
