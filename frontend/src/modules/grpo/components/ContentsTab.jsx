import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';

import { getLineTotalsForDisplay } from '../../../utils/lineTotals';
import { useSapItemCodeTab } from '../../../utils/sapTabNavigation';

export default function ContentsTab({
  lines,
  onLineChange,
  onNumBlur,
  onAddLine,
  onRemoveLine,
  onOpenBatchModal,
  onOpenItemModal,
  onOpenHSNModal,
  lineItemOptions,
  taxCodeOptions,
  warehouseOptions,
  uomOptions,
  formatTaxLabel,
  valErrors,
  visibleColumns,
  visibleRowUdfs,
  onRowUdfChange,
  formSettings,
}) {
  const sapItemTab = useSapItemCodeTab({ lineItemOptions, onLineChange, onOpenItemModal });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="po-section-title" style={{ marginBottom: 0 }}>Item Matrix</div>
        <button type="button" className="po-btn po-btn--primary" onClick={onAddLine}>+ Add Line</button>
      </div>
      <div className="po-grid-wrap" style={{ overflowX: 'auto', overflowY: 'visible' }}>
        <table className="po-grid">
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              {visibleColumns.map(col => <th key={col.key}>{col.label}</th>)}
              {visibleRowUdfs.map(f => <th key={f.key}>{f.label}</th>)}
              <th style={{ minWidth: 110 }}>Batches</th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const lineTotals = getLineTotalsForDisplay(line, taxCodeOptions);
              return (
              <tr key={index}>
                <td className="po-grid__cell--muted" style={{ textAlign: 'center' }}>{index + 1}</td>

                {visibleColumns.map(col => {
                  const isActive = formSettings.matrixColumns[col.key]?.active !== false;
                  const isTotal = col.key === 'total' || col.key === 'totalBeforeTax';

                  if (col.key === 'itemNo') return (
                    <td key={col.key}>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <input
                          className="po-grid__input"
                          style={{ flex: 1, textAlign: 'left', border: valErrors.lines[index]?.itemNo ? '1px solid #c00' : undefined }}
                          name="itemNo" value={line.itemNo || ''} disabled={!isActive}
                          data-sap-lookup="item"
                          data-sap-row-index={index}
                          onKeyDown={(e) => sapItemTab.handleItemCodeTab(e, index)}
                          onChange={e => onLineChange(index, e)}
                          placeholder="Item Code"
                        />
                        {isActive && (
                          <button type="button" onClick={() => onOpenItemModal && onOpenItemModal(index)}
                            style={{ padding: '0 6px', fontSize: 11, border: '1px solid #a0aab4', background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)', minWidth: 24, height: 22, cursor: 'pointer', borderRadius: 2 }}
                            title="Select Item">...</button>
                        )}
                      </div>
                      {valErrors.lines[index]?.itemNo && <div className="po-error-feedback">{valErrors.lines[index].itemNo}</div>}
                    </td>
                  );

                  if (col.key === 'hsnCode') return (
                    <td key={col.key}>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <input
                          className="po-grid__input"
                          style={{ flex: 1, border: valErrors.lines[index]?.hsnCode ? '1px solid #c00' : undefined }}
                          name="hsnCode" value={line.hsnCode || ''} disabled={!isActive}
                          onChange={e => onLineChange(index, e)}
                          placeholder="HSN/SAC"
                        />
                        {isActive && (
                          <button type="button" onClick={() => onOpenHSNModal && onOpenHSNModal(index)}
                            style={{ padding: '0 6px', fontSize: 11, border: '1px solid #a0aab4', background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)', minWidth: 24, height: 22, cursor: 'pointer', borderRadius: 2 }}
                            title="Select HSN Code">...</button>
                        )}
                      </div>
                      {valErrors.lines[index]?.hsnCode && <div className="po-error-feedback">{valErrors.lines[index].hsnCode}</div>}
                    </td>
                  );

                  if (col.key === 'taxCode') return (
                    <td key={col.key}>
                      <TaxCodeLookup
                        className="po-grid__input"
                        style={{ width: '100%', textAlign: 'left', border: valErrors.lines[index]?.taxCode ? '1px solid #c00' : undefined }}
                        name="taxCode" value={line.taxCode || ''} disabled={!isActive}
                        onChange={e => onLineChange(index, e)}
                        taxCodes={taxCodeOptions}
                        error={Boolean(valErrors.lines[index]?.taxCode)}
                      />
                      {valErrors.lines[index]?.taxCode && <div className="po-error-feedback">{valErrors.lines[index].taxCode}</div>}
                    </td>
                  );

                  if (col.key === 'whse') return (
                    <td key={col.key}>
                      <select
                        className="po-grid__input"
                        style={{ width: '100%', textAlign: 'left', border: valErrors.lines[index]?.whse ? '1px solid #c00' : undefined }}
                        name="whse" value={line.whse || ''} disabled={!isActive}
                        onChange={e => onLineChange(index, e)}
                      >
                        <option value="">Select</option>
                        {warehouseOptions.map(w => <option key={w.WhsCode} value={w.WhsCode}>{w.WhsCode}</option>)}
                      </select>
                      {valErrors.lines[index]?.whse && <div className="po-error-feedback">{valErrors.lines[index].whse}</div>}
                    </td>
                  );

                  if (col.key === 'uomCode') return (
                    <td key={col.key}>
                      <select
                        className="po-grid__input"
                        style={{ width: '100%', textAlign: 'left', border: valErrors.lines[index]?.uomCode ? '1px solid #c00' : undefined }}
                        name="uomCode" value={line.uomCode || ''} disabled={!isActive}
                        onChange={e => onLineChange(index, e)}
                      >
                        <option value="">Select</option>
                        {uomOptions[index]?.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                      </select>
                      {valErrors.lines[index]?.uomCode && <div className="po-error-feedback">{valErrors.lines[index].uomCode}</div>}
                    </td>
                  );

                  if (col.key === 'openQty') return (
                    <td key={col.key}>
                      <input
                        className="po-grid__input"
                        name="openQty"
                        value={line.openQty || ''}
                        readOnly
                        disabled
                        style={{ background: '#f5f8fc' }}
                      />
                    </td>
                  );

                  if (col.key === 'totalBeforeTax') return (
                    <td key={col.key}>
                      <input
                        className="po-grid__input"
                        value={lineTotals.beforeTax}
                        readOnly
                        disabled
                        style={{ background: '#f5f8fc' }}
                      />
                    </td>
                  );

                  if (col.key === 'total') return (
                    <td key={col.key}>
                      <input
                        className="po-grid__input"
                        value={lineTotals.total}
                        readOnly
                        disabled
                        style={{ background: '#f5f8fc' }}
                      />
                    </td>
                  );

                  return (
                    <td key={col.key}>
                      <input
                        className="po-grid__input"
                        style={{ border: valErrors.lines[index]?.[col.key] ? '1px solid #c00' : undefined, background: isTotal ? '#f5f8fc' : undefined }}
                        name={col.key} value={line[col.key] || ''}
                        disabled={!isActive || isTotal}
                        onChange={e => onLineChange(index, e)}
                        onBlur={() => onNumBlur && onNumBlur(col.key, 'line', index)}
                      />
                      {valErrors.lines[index]?.[col.key] && <div className="po-error-feedback">{valErrors.lines[index][col.key]}</div>}
                    </td>
                  );
                })}

                {visibleRowUdfs.map(f => (
                  <td key={f.key}>
                    <input className="po-grid__input" value={line.udf?.[f.key] || ''} onChange={e => onRowUdfChange(index, f.key, e.target.value)} />
                  </td>
                ))}

                <td>
                  {line.batchManaged && onOpenBatchModal ? (
                    <button type="button" className="po-btn po-btn--primary" style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); onOpenBatchModal(index); }}>
                      {line.batches?.length ? `${line.batches.length} Assigned` : 'Assign Batch'}
                    </button>
                  ) : (
                    <span className="po-grid__cell--muted" style={{ fontSize: 11 }}>
                      {line.batchManaged ? 'Batch Item' : 'Not Batch Item'}
                    </span>
                  )}
                </td>

                <td>
                  <button type="button" className="po-btn po-btn--danger" style={{ padding: '2px 8px', fontSize: 14 }} onClick={() => onRemoveLine(index)}>×</button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
