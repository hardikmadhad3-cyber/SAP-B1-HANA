import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';
import { getLineTotalsForDisplay } from '../../../utils/lineTotals';
import { useSapItemCodeTab } from '../../../utils/sapTabNavigation';
import { BASE_MATRIX_COLUMNS } from '../../../config/purchaseOrderForm';

const DEFAULT_MATRIX_COLS = [
  { key: 'itemNo', label: 'Item No.', minWidth: 160 },
  { key: 'itemDescription', label: 'Description', minWidth: 220 },
  { key: 'hsnCode', label: 'HSN', minWidth: 115 },
  { key: 'quantity', label: 'Qty', minWidth: 80 },
  { key: 'unitPrice', label: 'Price', minWidth: 95 },
  { key: 'uomCode', label: 'UoM', minWidth: 85 },
  { key: 'stdDiscount', label: 'Disc%', minWidth: 85 },
  { key: 'taxCode', label: 'Tax Code', minWidth: 115 },
  { key: 'totalBeforeTax', label: 'Total Before Tax', minWidth: 135 },
  { key: 'total', label: 'Total', minWidth: 105 },
  { key: 'whse', label: 'Whse', minWidth: 90 },
  { key: 'loc', label: 'LOC', minWidth: 115 },
  { key: 'branch', label: 'Branch', minWidth: 115 },
];

const INDEX_COL_WIDTH = 42;
const ACTION_COL_WIDTH = 48;
const pickerButtonStyle = {
  padding: '0 6px',
  fontSize: 11,
  border: '1px solid #a0aab4',
  background: 'linear-gradient(180deg, #fff 0%, #e8ecf0 100%)',
  minWidth: '24px',
  height: '22px',
  cursor: 'pointer',
  borderRadius: '2px',
};

const withWidths = (columns = []) => columns.map((column) => ({
  ...column,
  minWidth: Number(column.minWidth || column.width) ||
    DEFAULT_MATRIX_COLS.find((entry) => entry.key === column.key)?.minWidth ||
    125,
}));

export default function ContentsTab({
  lines,
  onLineChange,
  onNumBlur,
  onAddLine,
  onRemoveLine,
  lineItemOptions,
  getUomOptions,
  effectiveTaxCodes,
  effectiveWarehouses,
  valErrors,
  onOpenHSNModal,
  onOpenItemModal,
  getBranchName,
  formSettings = {},
  matrixFields = BASE_MATRIX_COLUMNS,
}) {
  const sapItemTab = useSapItemCodeTab({ lineItemOptions, onLineChange, onOpenItemModal });
  const matrixCols = withWidths(Array.isArray(matrixFields) && matrixFields.length ? matrixFields : DEFAULT_MATRIX_COLS)
    .filter((column) => formSettings.matrixColumns?.[column.key]?.visible !== false);
  const tableMinWidth = INDEX_COL_WIDTH + ACTION_COL_WIDTH + matrixCols.reduce((total, col) => total + col.minWidth, 0);

  const renderTextInput = (key, line, index, options = {}) => (
    <td key={key}>
      <input
        className="so-grid__input"
        style={{
          width: '100%',
          textAlign: options.readOnly ? 'right' : 'left',
          background: options.readOnly ? '#f5f8fc' : undefined,
          border: valErrors.lines[index]?.[key] ? '1px solid #c00' : undefined,
          ...options.style,
        }}
        name={key}
        value={options.value ?? line[key] ?? ''}
        readOnly={options.readOnly}
        disabled={options.disabled}
        onChange={options.readOnly ? undefined : (event) => onLineChange(index, event)}
        onBlur={options.numeric ? () => onNumBlur(key, 'line', index) : undefined}
        title={line[key] || ''}
      />
      {valErrors.lines[index]?.[key] && (
        <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[index][key]}</div>
      )}
    </td>
  );

  const renderCell = (column, line, index, uomOpts, lineTotals) => {
    if (column.key === 'itemNo') {
      return (
        <td key={column.key}>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1, textAlign: 'left', border: valErrors.lines[index]?.itemNo ? '1px solid #c00' : undefined }}
              name="itemNo"
              data-sap-lookup="item"
              data-sap-row-index={index}
              onKeyDown={(event) => sapItemTab.handleItemCodeTab(event, index)}
              value={line.itemNo || ''}
              onChange={(event) => onLineChange(index, event)}
              placeholder="Item Code"
            />
            <button type="button" onClick={() => onOpenItemModal && onOpenItemModal(index)} style={pickerButtonStyle} title="Select Item">...</button>
          </div>
          {valErrors.lines[index]?.itemNo && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[index].itemNo}</div>
          )}
        </td>
      );
    }

    if (column.key === 'hsnCode') {
      return (
        <td key={column.key}>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1, textAlign: 'left', border: valErrors.lines[index]?.hsnCode ? '1px solid #c00' : undefined }}
              name="hsnCode"
              value={line.hsnCode || ''}
              onChange={(event) => onLineChange(index, event)}
              placeholder="HSN/SAC"
            />
            <button type="button" onClick={() => onOpenHSNModal && onOpenHSNModal(index)} style={pickerButtonStyle} title="Select HSN Code">...</button>
          </div>
          {valErrors.lines[index]?.hsnCode && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[index].hsnCode}</div>
          )}
        </td>
      );
    }

    if (column.key === 'uomCode') {
      return (
        <td key={column.key}>
          <select className="so-grid__input" style={{ width: '100%', textAlign: 'left' }} name="uomCode" value={line.uomCode || ''} onChange={(event) => onLineChange(index, event)}>
            <option value=""></option>
            {uomOpts.map((uom) => <option key={uom} value={uom}>{uom}</option>)}
            {line.uomCode && !uomOpts.includes(line.uomCode) && <option value={line.uomCode}>{line.uomCode}</option>}
          </select>
        </td>
      );
    }

    if (column.key === 'taxCode') {
      return (
        <td key={column.key}>
          <TaxCodeLookup
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left' }}
            name="taxCode"
            value={line.taxCode || ''}
            onChange={(event) => onLineChange(index, event)}
            taxCodes={effectiveTaxCodes}
          />
        </td>
      );
    }

    if (column.key === 'whse') {
      return (
        <td key={column.key}>
          <select
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left', border: valErrors.lines[index]?.whse ? '1px solid #c00' : undefined }}
            name="whse"
            value={line.whse || ''}
            onChange={(event) => onLineChange(index, event)}
          >
            <option value="">Select</option>
            {effectiveWarehouses.map((warehouse) => <option key={warehouse.WhsCode} value={warehouse.WhsCode}>{warehouse.WhsCode}</option>)}
            {line.whse && !effectiveWarehouses.some((warehouse) => warehouse.WhsCode === line.whse) && <option value={line.whse}>{line.whse}</option>}
          </select>
          {valErrors.lines[index]?.whse && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[index].whse}</div>
          )}
        </td>
      );
    }

    if (column.key === 'totalBeforeTax') {
      return renderTextInput(column.key, line, index, { value: lineTotals.beforeTax, readOnly: true });
    }

    if (column.key === 'total') {
      return renderTextInput(column.key, line, index, { value: lineTotals.total, readOnly: true });
    }

    if (column.key === 'loc' || column.key === 'branch') {
      return renderTextInput(column.key, line, index, {
        value: getBranchName ? getBranchName(line.branch) : line[column.key],
        readOnly: true,
        disabled: true,
      });
    }

    return renderTextInput(column.key, line, index, {
      numeric: ['quantity', 'unitPrice', 'stdDiscount'].includes(column.key),
      style: column.key === 'itemDescription' ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined,
    });
  };

  return (
    <div className="so-tab-panel" style={{ overflow: 'visible', minWidth: 0, maxWidth: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="so-section-title">Document Lines</div>
        <button type="button" className="so-btn so-btn--primary" onClick={onAddLine}>+ Add Line</button>
      </div>
      <div className="so-grid-wrap so-grid-wrap--contents">
        <div className="so-grid-wrap__scroller so-grid-wrap__scroller--contents">
          <table className="so-grid so-grid--contents" style={{ width: 'max-content', minWidth: tableMinWidth, tableLayout: 'auto' }}>
            <colgroup>
              <col style={{ width: INDEX_COL_WIDTH }} />
              {matrixCols.map((column) => <col key={column.key} style={{ width: column.minWidth }} />)}
              <col style={{ width: ACTION_COL_WIDTH }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: INDEX_COL_WIDTH }}>#</th>
                {matrixCols.map((column) => <th key={column.key} style={{ minWidth: column.minWidth }}>{column.label}</th>)}
                <th style={{ width: ACTION_COL_WIDTH }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const uomOpts = getUomOptions(line);
                const lineTotals = getLineTotalsForDisplay(line, effectiveTaxCodes);
                return (
                  <tr key={index}>
                    <td className="so-grid__cell--muted" style={{ textAlign: 'center', fontSize: 11 }}>{index + 1}</td>
                    {matrixCols.map((column) => renderCell(column, line, index, uomOpts, lineTotals))}
                    <td>
                      <button type="button" className="so-btn so-btn--danger" style={{ padding: '2px 8px', fontSize: 14 }} onClick={() => onRemoveLine(index)}>x</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
