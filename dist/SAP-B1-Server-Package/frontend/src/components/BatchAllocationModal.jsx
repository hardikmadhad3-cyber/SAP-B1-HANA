import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const createBatchRow = () => ({
  batchNumber: '',
  quantity: '',
  expiryDate: '',
});

const parseNum = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export default function BatchAllocationModal({
  isOpen,
  mode = 'issue',
  line,
  availableBatches = [],
  loading = false,
  error = '',
  onClose,
  onSave,
}) {
  const [rows, setRows] = useState([createBatchRow()]);
  const isIssueMode = mode === 'issue';
  const batchOptions = Array.isArray(availableBatches) ? availableBatches : [];
  const itemLabel = line?.itemNo || line?.itemCode || 'Item';
  const warehouseLabel = line?.whse || line?.warehouse || '-';

  useEffect(() => {
    if (!isOpen) return;
    const nextRows = Array.isArray(line?.batches) && line.batches.length
      ? line.batches.map((batch) => ({
        batchNumber: batch.batchNumber || '',
        quantity: batch.quantity || '',
        expiryDate: batch.expiryDate || '',
      }))
      : [createBatchRow()];
    setRows(nextRows);
  }, [isOpen, line]);

  const assignedQty = useMemo(
    () => rows.reduce((sum, row) => sum + parseNum(row.quantity), 0),
    [rows]
  );

  if (!isOpen || !line) return null;

  const updateRow = (index, key, value) => {
    setRows((prev) => prev.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [key]: value } : row
    )));
  };

  const addRow = (preset = {}) => {
    setRows((prev) => [...prev, { ...createBatchRow(), ...preset }]);
  };

  const removeRow = (index) => {
    setRows((prev) => (prev.length === 1 ? [createBatchRow()] : prev.filter((_, rowIndex) => rowIndex !== index)));
  };

  const handleSave = () => {
    const validBatchNumbers = new Set(batchOptions.map((batch) => String(batch.BatchNumber || '').trim()));
    const normalized = rows
      .map((row) => ({
        batchNumber: String(row.batchNumber || '').trim(),
        quantity: String(row.quantity || '').trim(),
        expiryDate: String(row.expiryDate || '').trim(),
      }))
      .filter((row) => {
        if (!row.batchNumber || parseNum(row.quantity) <= 0) return false;
        return !isIssueMode || validBatchNumbers.has(row.batchNumber);
      });
    onSave(normalized);
  };

  return createPortal((
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1060,
        padding: 16,
      }}
    >
      <div className="card shadow" style={{ width: 'min(980px, 100%)', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="card-header d-flex justify-content-between align-items-center">
          <div>
            <div style={{ fontWeight: 700 }}>Assign Batch</div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {itemLabel} | Qty: {line.quantity || '0'} | Whse: {warehouseLabel}
            </div>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="card-body">
          {error ? <div className="alert alert-warning py-2">{error}</div> : null}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div style={{ fontSize: 13 }}>
              Assigned Qty: <strong>{assignedQty}</strong> / {line.quantity || '0'}
            </div>
            {!isIssueMode ? (
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addRow()}>
                + Add Batch
              </button>
            ) : (
              <span className="text-muted" style={{ fontSize: 12 }}>
                Delivery can only allocate existing warehouse batches.
              </span>
            )}
          </div>

          <div className="table-responsive mb-3">
            <table className="table table-bordered table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '45%' }}>Batch Number</th>
                  <th style={{ width: '25%' }}>Quantity</th>
                    {mode === 'receipt' ? <th style={{ width: '20%' }}>Expiry Date</th> : null}
                    <th style={{ width: '10%' }}></th>
                  </tr>
                </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>
                      {isIssueMode ? (
                        <select
                          className="form-control form-control-sm"
                          value={row.batchNumber}
                          onChange={(e) => updateRow(index, 'batchNumber', e.target.value)}
                        >
                          <option value="">Select batch</option>
                          {batchOptions.map((batch) => (
                            <option key={`${batch.BatchNumber}-${batch.ExpiryDate || ''}`} value={batch.BatchNumber}>
                              {batch.BatchNumber} ({batch.AvailableQty})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="form-control form-control-sm"
                          value={row.batchNumber}
                          onChange={(e) => updateRow(index, 'batchNumber', e.target.value)}
                          placeholder="Enter batch number"
                        />
                      )}
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={row.quantity}
                        onChange={(e) => updateRow(index, 'quantity', e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    {mode === 'receipt' ? (
                      <td>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={row.expiryDate}
                          onChange={(e) => updateRow(index, 'expiryDate', e.target.value)}
                        />
                      </td>
                    ) : null}
                    <td>
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeRow(index)}>
                        x
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row g-3">
            <div className="col-md-12">
              <div className="border rounded p-2" style={{ background: '#f8fafc' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  {isIssueMode ? 'Available Warehouse Batches' : 'Existing Warehouse Batches'}
                </div>
                {loading ? (
                  <div className="text-muted" style={{ fontSize: 12 }}>Loading batches...</div>
                ) : batchOptions.length ? (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Batch</th>
                          <th>Available Qty</th>
                          <th>Expiry</th>
                          {isIssueMode ? <th></th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {batchOptions.map((batch) => (
                          <tr key={`${batch.BatchNumber}-${batch.ExpiryDate || ''}`}>
                            <td>{batch.BatchNumber}</td>
                            <td>{batch.AvailableQty}</td>
                            <td>{batch.ExpiryDate ? String(batch.ExpiryDate).slice(0, 10) : '-'}</td>
                            {isIssueMode ? (
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => {
                                    const batchNumber = String(batch.BatchNumber || '');
                                    setRows((prev) => {
                                      const emptyIndex = prev.findIndex((row) => !String(row.batchNumber || '').trim());
                                      if (emptyIndex >= 0) {
                                        return prev.map((row, index) => (
                                          index === emptyIndex
                                            ? {
                                              ...row,
                                              batchNumber,
                                              expiryDate: batch.ExpiryDate ? String(batch.ExpiryDate).slice(0, 10) : '',
                                            }
                                            : row
                                        ));
                                      }
                                      return [
                                        ...prev,
                                        {
                                          ...createBatchRow(),
                                          batchNumber,
                                          expiryDate: batch.ExpiryDate ? String(batch.ExpiryDate).slice(0, 10) : '',
                                        },
                                      ];
                                    });
                                  }}
                                >
                                  Use
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted" style={{ fontSize: 12 }}>No warehouse batches found.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card-footer d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>Save Batches</button>
        </div>
      </div>
    </div>
  ), document.body);
}
