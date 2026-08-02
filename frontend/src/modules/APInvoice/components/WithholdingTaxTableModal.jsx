import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { matchesSapSearchText } from '../../../utils/sapSearch';
import { resolveWithholdingTaxBaseAmount } from '../../../utils/withholdingTax';

const parseNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatMoney = (value) => {
  const number = parseNumber(value);
  return `${number.toLocaleString('en-IN', {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  })} INR`;
};

const formatRate = (value) => parseNumber(value).toFixed(2);

const WITHHOLDING_DETAIL_COLUMNS = [
  { key: 'cessGstAccount', label: 'Cess GST Account', type: 'text' },
  { key: 'tdsRate', label: 'TCS/TDS Rate', type: 'rate', fallback: 'rate' },
  { key: 'surchargeRate', label: 'Surcharge Rate', type: 'rate' },
  { key: 'cessRate', label: 'Cess Rate', type: 'rate' },
  { key: 'hscRate', label: 'HSC Rate', type: 'rate' },
  { key: 'igstRate', label: 'IGST Rate', type: 'rate' },
  { key: 'cgstRate', label: 'CGST Rate', type: 'rate' },
  { key: 'sgstRate', label: 'SGST Rate', type: 'rate' },
  { key: 'utgstRate', label: 'UTGST Rate', type: 'rate' },
  { key: 'cessGstRate', label: 'Cess GST Rate', type: 'rate' },
  { key: 'tdsBaseAmount', label: 'TCS/TDS Base Amount', type: 'money', fallback: 'baseAmount' },
  { key: 'surchargeBaseAmount', label: 'Surcharge Base Amount', type: 'money' },
  { key: 'cessBaseAmount', label: 'Cess Base Amount', type: 'money' },
  { key: 'hscBaseAmount', label: 'HSC Base Amount', type: 'money' },
  { key: 'igstBaseAmount', label: 'IGST Base Amount', type: 'money' },
  { key: 'cgstBaseAmount', label: 'CGST Base Amount', type: 'money' },
  { key: 'sgstBaseAmount', label: 'SGST Base Amount', type: 'money' },
  { key: 'utgstBaseAmount', label: 'UTGST Base Amount', type: 'money' },
  { key: 'cessGstBaseAmount', label: 'Cess GST Base Amount', type: 'money' },
  { key: 'tdsTaxAmount', label: 'TCS/TDS Tax Amount', type: 'money', fallback: 'wtaxAmount' },
  { key: 'surchargeTaxAmount', label: 'Surcharge Tax Amount', type: 'money' },
  { key: 'cessTaxAmount', label: 'Cess Tax Amount', type: 'money' },
  { key: 'hscTaxAmount', label: 'HSC Tax Amount', type: 'money' },
  { key: 'igstTaxAmount', label: 'IGST Tax Amount', type: 'money' },
  { key: 'cgstTaxAmount', label: 'CGST Tax Amount', type: 'money' },
  { key: 'sgstTaxAmount', label: 'SGST Tax Amount', type: 'money' },
  { key: 'utgstTaxAmount', label: 'UTGST Tax Amount', type: 'money' },
  { key: 'cessGstTaxAmount', label: 'Cess GST Tax Amount', type: 'money' },
];

const formatDetailValue = (row, column) => {
  const value = row[column.key] ?? (column.fallback ? row[column.fallback] : undefined) ?? 0;
  if (column.type === 'money') return formatMoney(value);
  if (column.type === 'rate') return formatRate(value);
  return value || '';
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
  allowManualRows = false,
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
      const workspaceElement = workspaceRef?.current || document.querySelector('.sap-document-page');
      const rect = workspaceElement?.getBoundingClientRect?.();
      if (!rect) {
        setWorkspaceBounds(null);
        return;
      }
      const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect?.().bottom || 0;
      const top = Math.max(0, rect.top, topbarBottom);
      const left = Math.max(0, rect.left);
      const right = Math.min(window.innerWidth, rect.right);
      const bottom = Math.min(window.innerHeight, rect.bottom);
      setWorkspaceBounds({
        top,
        left,
        right: 'auto',
        bottom: 'auto',
        width: Math.max(320, right - left),
        height: Math.max(240, bottom - top),
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
    const rowDefaults = {
      baseTypeCode: codeRow.baseTypeCode || 'N',
      baseType: codeRow.baseType || 'Net',
      basePercentage: codeRow.basePercentage ?? 100,
    };
    const resolvedBaseAmount = resolveWithholdingTaxBaseAmount(rowDefaults, baseAmount, 2);
    updateRow(rowIndex, {
      code: codeRow.code || '',
      name: codeRow.name || '',
      rate,
      baseAmount: resolvedBaseAmount,
      taxableAmount: resolvedBaseAmount,
      wtaxAmount: resolvedBaseAmount * rate / 100,
      category: codeRow.taxCategory || '',
      ...rowDefaults,
      tdsAccount: codeRow.tdsAccount || codeRow.account || '',
      surchargeAccount: codeRow.surchargeAccount || '',
      cessAccount: codeRow.cessAccount || '',
      hscAccount: codeRow.hscAccount || '',
      igstAccount: codeRow.igstAccount || '',
      cgstAccount: codeRow.cgstAccount || '',
      sgstAccount: codeRow.sgstAccount || '',
      utgstAccount: codeRow.utgstAccount || '',
      cessGstAccount: codeRow.cessGstAccount || '',
      tdsRate: rate,
      surchargeRate: parseNumber(codeRow.surchargeRate ?? codeRow.surcharge),
      cessRate: parseNumber(codeRow.cessRate),
      hscRate: parseNumber(codeRow.hscRate),
      igstRate: parseNumber(codeRow.igstRate),
      cgstRate: parseNumber(codeRow.cgstRate),
      sgstRate: parseNumber(codeRow.sgstRate),
      utgstRate: parseNumber(codeRow.utgstRate),
      cessGstRate: parseNumber(codeRow.cessGstRate),
      tdsBaseAmount: resolvedBaseAmount,
      tdsTaxAmount: resolvedBaseAmount * rate / 100,
      criteria: 'Cash',
      criteriaCode: 'C',
      tdsType: codeRow.tdsType || 'eTDS',
      tdsTypeCode: codeRow.tdsTypeCode || 'E',
    });
    setLookup({ open: false, rowIndex: -1, query: '' });
  };

  const addRow = () => {
    const resolvedBaseAmount = resolveWithholdingTaxBaseAmount({ baseTypeCode: 'N' }, baseAmount, 2);
    onRowsChange([
      ...rows,
      {
        code: '',
        name: '',
        rate: 0,
        baseAmount: resolvedBaseAmount,
        taxableAmount: resolvedBaseAmount,
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
        cessGstAccount: '',
        tdsRate: 0,
        surchargeRate: 0,
        cessRate: 0,
        hscRate: 0,
        igstRate: 0,
        cgstRate: 0,
        sgstRate: 0,
        utgstRate: 0,
        cessGstRate: 0,
        tdsBaseAmount: resolvedBaseAmount,
        surchargeBaseAmount: 0,
        cessBaseAmount: 0,
        hscBaseAmount: 0,
        igstBaseAmount: 0,
        cgstBaseAmount: 0,
        sgstBaseAmount: 0,
        utgstBaseAmount: 0,
        cessGstBaseAmount: 0,
        tdsTaxAmount: 0,
        surchargeTaxAmount: 0,
        cessTaxAmount: 0,
        hscTaxAmount: 0,
        igstTaxAmount: 0,
        cgstTaxAmount: 0,
        sgstTaxAmount: 0,
        utgstTaxAmount: 0,
        cessGstTaxAmount: 0,
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
          <input value={rows[0]?.categoryCode || rows[0]?.category || ''} readOnly />
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
                {WITHHOLDING_DETAIL_COLUMNS.map((column) => (
                  <th key={column.key} style={{ width: column.type === 'text' ? 135 : 150 }}>{column.label}</th>
                ))}
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
                  <td><input value={formatRate(row.rate)} readOnly /></td>
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
                  {WITHHOLDING_DETAIL_COLUMNS.map((column) => (
                    <td key={column.key}><input value={formatDetailValue(row, column)} readOnly /></td>
                  ))}
                  <td>
                    {allowManualRows && (
                      <button type="button" className="ap-wtax-remove" onClick={() => removeRow(rowIndex)}>x</button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && !allowManualRows && (
                <tr>
                  <td colSpan={48} className="ap-wtax-empty">No withholding tax codes are applicable.</td>
                </tr>
              )}
              {allowManualRows && (
                <tr>
                  <td className="ap-wtax-grid__muted">{rows.length + 1}</td>
                  <td><button type="button" className="ap-wtax-add-row" onClick={addRow}>+</button></td>
                  <td colSpan={46}></td>
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
