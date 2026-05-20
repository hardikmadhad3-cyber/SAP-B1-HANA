import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';
import { getLineTotalsForDisplay } from '../../../utils/lineTotals';

const MATRIX_COLS = [
  { key: 'itemNo', label: 'Item No.', minWidth: 160 },
  { key: 'itemDescription', label: 'Description', minWidth: 220 },
  { key: 'hsnCode', label: 'HSN', minWidth: 115 },
  { key: 'quantity', label: 'Qty', minWidth: 80 },
  { key: 'openQty', label: 'Open Qty', minWidth: 95 },
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
  onOpenHSNModal,
  onOpenItemModal,
  lineItemOptions,
  getUomOptions,
  effectiveTaxCodes,
  effectiveWarehouses,
  fmtTaxLabel,
  getBranchName,
  valErrors,
  isEditable = true,
  rowUdfFields = [],
  onRowUdfChange,
}) {
  const matrixCols = [
    ...MATRIX_COLS,
    ...rowUdfFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      minWidth: field.type === 'textarea' ? 180 : 125,
    })),
  ];
  const tableMinWidth = INDEX_COL_WIDTH + ACTION_COL_WIDTH + matrixCols.reduce((total, col) => total + col.minWidth, 0);

  return (
    <div className="del-tab-panel" style={{ overflow: 'visible', minWidth: 0, maxWidth: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="del-section-title" style={{ margin: 0 }}>Document Lines</div>
        <button type="button" className="del-btn del-btn--primary" onClick={onAddLine} disabled={!isEditable}>
          + Add Line
        </button>
      </div>
      <div className="del-grid-wrap del-grid-wrap--contents">
        <div className="del-grid-wrap__scroller del-grid-wrap__scroller--contents">
          <table
            className="del-grid del-grid--contents"
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
                  <td className="del-grid__cell--muted" style={{ textAlign: 'center', fontSize: 11 }}>{i + 1}</td>

                  {/* Item No */}
                  <td>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <input
                        className={`del-grid__input${valErrors.lines[i]?.itemNo ? ' del-field__input--error' : ''}`}
                        style={{ flex: 1, textAlign: 'left' }}
                        name="itemNo"
                        value={line.itemNo}
                        onChange={e => onLineChange(i, e)}
                        placeholder="Item Code"
                        disabled={!isEditable}
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
                        disabled={!isEditable}
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
                      className="del-grid__input"
                      style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      name="itemDescription"
                      value={line.itemDescription}
                      onChange={e => onLineChange(i, e)}
                      title={line.itemDescription}
                      disabled={!isEditable}
                    />
                  </td>

                  {/* HSN Code */}
                  <td>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <input
                        className={`del-grid__input${valErrors.lines[i]?.hsnCode ? ' del-field__input--error' : ''}`}
                        style={{ flex: 1, textAlign: 'left' }}
                        name="hsnCode"
                        value={line.hsnCode}
                        onChange={e => onLineChange(i, e)}
                        placeholder="HSN/SAC"
                        disabled={!isEditable}
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
                          height: '20px',
                          cursor: 'pointer',
                          borderRadius: '2px',
                        }}
                        title="Select HSN Code"
                        disabled={!isEditable}
                      >
                        ...
                      </button>
                    </div>
                  </td>

                  {/* Quantity */}
                  <td>
                    <input
                      className={`del-grid__input${valErrors.lines[i]?.quantity ? ' del-field__input--error' : ''}`}
                      name="quantity"
                      value={line.quantity}
                      onChange={e => onLineChange(i, e)}
                      onBlur={() => onNumBlur('quantity', 'line', i)}
                      disabled={!isEditable}
                    />
                  </td>

                  {/* Open Quantity */}
                  <td>
                    <input
                      className="del-grid__input"
                      name="openQty"
                      value={line.openQty || ''}
                      readOnly
                      disabled
                    />
                  </td>

                  {/* Unit Price */}
                  <td>
                    <input
                      className={`del-grid__input${valErrors.lines[i]?.unitPrice ? ' del-field__input--error' : ''}`}
                      name="unitPrice"
                      value={line.unitPrice}
                      onChange={e => onLineChange(i, e)}
                      onBlur={() => onNumBlur('unitPrice', 'line', i)}
                      disabled={!isEditable}
                    />
                  </td>

                  {/* UoM */}
                  <td>
                    <select
                      className={`del-grid__input${valErrors.lines[i]?.uomCode ? ' del-field__select--error' : ''}`}
                      style={{ textAlign: 'center', height: '20px', padding: '0 4px' }}
                      name="uomCode"
                      value={line.uomCode}
                      onChange={e => onLineChange(i, e)}
                      disabled={!isEditable}
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
                      className="del-grid__input"
                      name="stdDiscount"
                      value={line.stdDiscount}
                      onChange={e => onLineChange(i, e)}
                      onBlur={() => onNumBlur('stdDiscount', 'line', i)}
                      disabled={!isEditable}
                    />
                  </td>

                  {/* Tax Code */}
                  <td>
                    <TaxCodeLookup
                      className="del-grid__input"
                      style={{ textAlign: 'left', height: '20px', padding: '0 4px' }}
                      name="taxCode"
                      value={line.taxCode}
                      onChange={e => onLineChange(i, e)}
                      disabled={!isEditable}
                      taxCodes={effectiveTaxCodes}
                    />
                  </td>

                  {/* Total Before Tax */}
                  <td>
                    <input
                      className="del-grid__input"
                      value={lineTotals.beforeTax}
                      readOnly
                    />
                  </td>

                  {/* Total */}
                  <td>
                    <input
                      className="del-grid__input"
                      value={lineTotals.total}
                      readOnly
                    />
                  </td>

                  {/* Warehouse - dropdown with all values */}
                  <td>
                    <select
                      className={`del-grid__input${valErrors.lines[i]?.whse ? ' del-field__select--error' : ''}`}
                      style={{ textAlign: 'left', height: '20px', padding: '0 4px' }}
                      name="whse"
                      value={line.whse || ''}
                      onChange={e => onLineChange(i, e)}
                      disabled={!isEditable}
                    >
                      <option value="">Select</option>
                      {effectiveWarehouses.map(w => (
                        <option key={w.WhsCode} value={w.WhsCode}>{w.WhsCode}</option>
                      ))}
                      {line.whse && !effectiveWarehouses.some(w => w.WhsCode === line.whse) && (
                        <option value={line.whse}>{line.whse}</option>
                      )}
                    </select>
                  </td>

                  {/* LOC - disabled, shows branch name */}
                  <td>
                    <input
                      className="del-grid__input"
                      value={getBranchName ? getBranchName(line.branch) : line.loc || ''}
                      disabled
                      style={{ background: '#f5f5f5', cursor: 'not-allowed', textAlign: 'left' }}
                      title="LOC is synced from branch"
                    />
                  </td>

                  {/* Branch - disabled, shows branch name */}
                  <td>
                    <input
                      className="del-grid__input"
                      value={getBranchName ? getBranchName(line.branch) : line.branch || ''}
                      disabled
                      style={{ background: '#f5f5f5', cursor: 'not-allowed', textAlign: 'left' }}
                      title="Branch is synced from header"
                    />
                  </td>

                  {rowUdfFields.map((field) => (
                    <td key={field.key}>
                      {field.type === 'select' ? (
                        <select
                          className="del-grid__input"
                          value={line.udf?.[field.key] || ''}
                          onChange={(e) => onRowUdfChange && onRowUdfChange(i, field.key, e.target.value)}
                          disabled={!isEditable || field.active === false}
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
                          className="del-grid__input"
                          type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                          value={line.udf?.[field.key] || ''}
                          onChange={(e) => onRowUdfChange && onRowUdfChange(i, field.key, e.target.value)}
                          disabled={!isEditable || field.active === false}
                        />
                      )}
                    </td>
                  ))}

                  {/* Remove */}
                  <td>
                    <button
                      type="button"
                      className="del-btn del-btn--danger"
                      style={{ padding: '2px 6px' }}
                      onClick={() => onRemoveLine(i)}
                      disabled={!isEditable}
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
