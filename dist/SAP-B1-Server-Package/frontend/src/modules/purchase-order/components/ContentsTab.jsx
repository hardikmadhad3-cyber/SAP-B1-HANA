import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';

import { getLineTotalsForDisplay } from '../../../utils/lineTotals';

const MATRIX_COLS = [
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
  fmtTaxLabel,
  valErrors,
  branches,
  hsnCodes,
  onOpenHSNModal,
  onOpenItemModal,
  getBranchName,
  rowUdfFields = [],
  onRowUdfChange,
}) {
  const matrixCols = [
    ...MATRIX_COLS,
    ...rowUdfFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      minWidth: field.type === 'textarea' ? 180 : 125,
      isUdf: true,
      field,
    })),
  ];
  const tableMinWidth = INDEX_COL_WIDTH + ACTION_COL_WIDTH + matrixCols.reduce((total, col) => total + col.minWidth, 0);

  return (
    <div className="so-tab-panel" style={{ overflow: 'visible', minWidth: 0, maxWidth: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="so-section-title">Document Lines</div>
        <button type="button" className="so-btn so-btn--primary" onClick={onAddLine}>
          + Add Line
        </button>
      </div>
      <div className="so-grid-wrap so-grid-wrap--contents">
        <div className="so-grid-wrap__scroller so-grid-wrap__scroller--contents">
        <table
          className="so-grid so-grid--contents"
          style={{ width: 'max-content', minWidth: tableMinWidth, tableLayout: 'auto' }}
        >
          <colgroup>
            <col style={{ width: INDEX_COL_WIDTH }} />
            {matrixCols.map((column) => (
              <col key={column.key} style={{ width: column.minWidth }} />
            ))}
            <col style={{ width: ACTION_COL_WIDTH }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ width: INDEX_COL_WIDTH }}>#</th>
              {matrixCols.map(c => (
                <th key={c.key} style={{ minWidth: c.minWidth }}>
                  {c.label}
                </th>
              ))}
              <th style={{ width: ACTION_COL_WIDTH }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const uomOpts = getUomOptions(line);
              const lineTotals = getLineTotalsForDisplay(line, effectiveTaxCodes);
              return (
                <tr key={i}>
                  <td className="so-grid__cell--muted" style={{ textAlign: 'center', fontSize: 11 }}>{i + 1}</td>

                  {/* Item No */}
                  <td>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <input
                        className="so-grid__input"
                        style={{ flex: 1, textAlign: 'left', border: valErrors.lines[i]?.itemNo ? '1px solid #c00' : undefined }}
                        name="itemNo"
                        value={line.itemNo}
                        onChange={e => onLineChange(i, e)}
                        placeholder="Item Code"
                      />
                      <button
                        type="button"
                        onClick={() => onOpenItemModal && onOpenItemModal(i)}
                        style={{
                          padding: '0 6px',
                          fontSize: 11,
                          border: '1px solid #a0aab4',
                          background: 'linear-gradient(180deg, #fff 0%, #e8ecf0 100%)',
                          minWidth: '24px',
                          height: '22px',
                          cursor: 'pointer',
                          borderRadius: '2px',
                        }}
                        title="Select Item"
                      >
                        ...
                      </button>
                    </div>
                    {valErrors.lines[i]?.itemNo && (
                      <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].itemNo}</div>
                    )}
                  </td>

                  {/* Description */}
                  <td>
                    <input
                      className="so-grid__input"
                      style={{ width: '100%', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      name="itemDescription"
                      value={line.itemDescription}
                      onChange={e => onLineChange(i, e)}
                      title={line.itemDescription}
                    />
                  </td>

                  {/* HSN Code */}
                  <td>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <input
                        className="so-grid__input"
                        style={{ 
                          flex: 1, 
                          textAlign: 'left', 
                          border: valErrors.lines[i]?.hsnCode ? '1px solid #c00' : undefined 
                        }}
                        name="hsnCode"
                        value={line.hsnCode}
                        onChange={e => onLineChange(i, e)}
                        placeholder="HSN/SAC"
                      />
                      <button
                        type="button"
                        onClick={() => onOpenHSNModal && onOpenHSNModal(i)}
                        style={{
                          padding: '0 6px',
                          fontSize: 11,
                          border: '1px solid #a0aab4',
                          background: 'linear-gradient(180deg, #fff 0%, #e8ecf0 100%)',
                          minWidth: '24px',
                          height: '22px',
                          cursor: 'pointer',
                          borderRadius: '2px',
                        }}
                        title="Select HSN Code"
                      >
                        ...
                      </button>
                    </div>
                    {valErrors.lines[i]?.hsnCode && (
                      <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].hsnCode}</div>
                    )}
                  </td>

                  {/* Quantity */}
                  <td>
                    <input
                      className="so-grid__input"
                      style={{ border: valErrors.lines[i]?.quantity ? '1px solid #c00' : undefined }}
                      name="quantity"
                      value={line.quantity}
                      onChange={e => onLineChange(i, e)}
                      onBlur={() => onNumBlur('quantity', 'line', i)}
                    />
                    {valErrors.lines[i]?.quantity && (
                      <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].quantity}</div>
                    )}
                  </td>

                  {/* Unit Price */}
                  <td>
                    <input
                      className="so-grid__input"
                      style={{ border: valErrors.lines[i]?.unitPrice ? '1px solid #c00' : undefined }}
                      name="unitPrice"
                      value={line.unitPrice}
                      onChange={e => onLineChange(i, e)}
                      onBlur={() => onNumBlur('unitPrice', 'line', i)}
                    />
                    {valErrors.lines[i]?.unitPrice && (
                      <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].unitPrice}</div>
                    )}
                  </td>

                  {/* UoM */}
                  <td>
                    <select
                      className="so-grid__input"
                      style={{ width: '100%', textAlign: 'left', border: valErrors.lines[i]?.uomCode ? '1px solid #c00' : undefined }}
                      name="uomCode"
                      value={line.uomCode}
                      onChange={e => onLineChange(i, e)}
                    >
                      <option value=""></option>
                      {uomOpts.map(u => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      {line.uomCode && !uomOpts.includes(line.uomCode) && (
                        <option value={line.uomCode}>{line.uomCode}</option>
                      )}
                    </select>
                  </td>

                  {/* Discount */}
                  <td>
                    <input
                      className="so-grid__input"
                      name="stdDiscount"
                      value={line.stdDiscount}
                      onChange={e => onLineChange(i, e)}
                      onBlur={() => onNumBlur('stdDiscount', 'line', i)}
                    />
                  </td>

                  {/* Tax Code */}
                  <td>
                    <TaxCodeLookup
                      className="so-grid__input"
                      style={{ width: '100%', textAlign: 'left' }}
                      name="taxCode"
                      value={line.taxCode}
                      onChange={e => onLineChange(i, e)}
                      taxCodes={effectiveTaxCodes}
                    />
                  </td>

                  {/* Total Before Tax */}
                  <td>
                    <input
                      className="so-grid__input"
                      value={lineTotals.beforeTax}
                      readOnly
                      style={{ background: '#f5f8fc' }}
                    />
                  </td>

                  {/* Total */}
                  <td>
                    <input
                      className="so-grid__input"
                      value={lineTotals.total}
                      readOnly
                      style={{ background: '#f5f8fc' }}
                    />
                  </td>

                  {/* Warehouse */}
                  <td>
                    <select
                      className="so-grid__input"
                      style={{ width: '100%', textAlign: 'left', border: valErrors.lines[i]?.whse ? '1px solid #c00' : undefined }}
                      name="whse"
                      value={line.whse}
                      onChange={e => onLineChange(i, e)}
                    >
                      <option value="">Select</option>
                      {effectiveWarehouses.map(w => (
                        <option key={w.WhsCode} value={w.WhsCode}>{w.WhsCode}</option>
                      ))}
                      {line.whse && !effectiveWarehouses.some(w => w.WhsCode === line.whse) && (
                        <option value={line.whse}>{line.whse}</option>
                      )}
                    </select>
                    {valErrors.lines[i]?.whse && (
                      <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].whse}</div>
                    )}
                  </td>

                  {/* LOC (Location) - Shows Branch Name */}
                  <td>
                    <input
                      className="so-grid__input"
                      style={{ 
                        width: '100%', 
                        textAlign: 'left',
                        background: '#f5f8fc'
                      }}
                      name="loc"
                      value={getBranchName ? getBranchName(line.branch) : line.loc || ''}
                      readOnly
                      disabled
                    />
                  </td>

                  {/* Branch - Shows Branch Name */}
                  <td>
                    <input
                      className="so-grid__input"
                      style={{ 
                        width: '100%', 
                        textAlign: 'left',
                        background: '#f5f8fc'
                      }}
                      name="branch"
                      value={getBranchName ? getBranchName(line.branch) : line.branch || ''}
                      readOnly
                      disabled
                    />
                  </td>

                  {rowUdfFields.map((field) => (
                    <td key={field.key}>
                      {field.type === 'select' ? (
                        <select
                          className="so-grid__input"
                          value={line.udf?.[field.key] || ''}
                          onChange={(e) => onRowUdfChange && onRowUdfChange(i, field.key, e.target.value)}
                          disabled={field.active === false}
                        >
                          <option value=""></option>
                          {(field.options || []).map((option) => {
                            const normalizedOption = typeof option === 'object' ? option : { value: option, label: option };
                            return (
                              <option key={normalizedOption.value} value={normalizedOption.value}>
                                {normalizedOption.label}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          className="so-grid__input"
                          type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                          value={line.udf?.[field.key] || ''}
                          onChange={(e) => onRowUdfChange && onRowUdfChange(i, field.key, e.target.value)}
                          disabled={field.active === false}
                        />
                      )}
                    </td>
                  ))}

                  {/* Remove */}
                  <td>
                    <button
                      type="button"
                      className="so-btn so-btn--danger"
                      style={{ padding: '2px 8px', fontSize: 14 }}
                      onClick={() => onRemoveLine(i)}
                    >
                      ×
                    </button>
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
