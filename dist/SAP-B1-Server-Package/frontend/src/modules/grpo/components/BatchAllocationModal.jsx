import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BATCH_QTY_TOLERANCE,
  getBatchInventoryUom,
  getDocumentUomLabel,
  getLineUomFactor,
  getRequiredBatchQty,
  parseBatchNumber,
  sumBatchQty,
} from '../../../utils/batchQuantity';

const createBatchRow = () => ({
  batchNumber: '',
  quantity: '',
  expiryDate: '',
});

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

  useEffect(() => {
    if (!isOpen) return;
    const nextRows =
      Array.isArray(line?.batches) && line.batches.length
        ? line.batches.map((batch) => ({
            batchNumber: batch.batchNumber || '',
            quantity: batch.quantity || '',
            expiryDate: batch.expiryDate || '',
          }))
        : [createBatchRow()];
    setRows(nextRows);
  }, [isOpen, line]);

  const assignedQty = useMemo(() => sumBatchQty(rows), [rows]);
  const lineQty = parseBatchNumber(line?.quantity);
  const uomFactor = getLineUomFactor(line);
  const requiredQty = getRequiredBatchQty(line);
  const documentUoM = getDocumentUomLabel(line);
  const inventoryUoM = getBatchInventoryUom(line);
  const qtyMismatch = Math.abs(assignedQty - requiredQty) > BATCH_QTY_TOLERANCE;

  const availabilityErrors = useMemo(() => {
    if (mode !== 'issue') return [];

    const availableByBatch = new Map(
      (Array.isArray(availableBatches) ? availableBatches : []).map((batch) => [
        String(batch.BatchNumber || '').trim(),
        parseBatchNumber(batch.AvailableQty),
      ])
    );

    return rows
      .filter((row) => String(row.batchNumber || '').trim() && parseBatchNumber(row.quantity) > 0)
      .filter((row) => {
        const batchNumber = String(row.batchNumber || '').trim();
        return parseBatchNumber(row.quantity) - (availableByBatch.get(batchNumber) || 0) > BATCH_QTY_TOLERANCE;
      })
      .map((row) => {
        const batchNumber = String(row.batchNumber || '').trim();
        return `${batchNumber} exceeds available quantity (${(availableByBatch.get(batchNumber) || 0).toFixed(2)} ${inventoryUoM})`;
      });
  }, [availableBatches, inventoryUoM, mode, rows]);

  if (!isOpen || !line) return null;

  const updateRow = (index, key, value) => {
    const nextValue =
      key === 'quantity'
        ? String(value || '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
        : value;

    setRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: nextValue } : row))
    );
  };

  const addRow = (preset = {}) => {
    setRows((prev) => [...prev, { ...createBatchRow(), ...preset }]);
  };

  const removeRow = (index) => {
    setRows((prev) =>
      prev.length === 1 ? [createBatchRow()] : prev.filter((_, rowIndex) => rowIndex !== index)
    );
  };

  const handleSave = () => {
    const normalized = rows
      .map((row) => ({
        batchNumber: String(row.batchNumber || '').trim(),
        quantity: String(row.quantity || '').trim(),
        expiryDate: String(row.expiryDate || '').trim(),
      }))
      .filter((row) => row.batchNumber && parseBatchNumber(row.quantity) > 0);

    if (!normalized.length) {
      alert('Please allocate at least one batch');
      return;
    }

    if (qtyMismatch) {
      alert(
        `Allocated batch quantity must match the required quantity in base UoM.\n\nRequired: ${requiredQty.toFixed(2)} ${inventoryUoM}\nAllocated: ${assignedQty.toFixed(2)} ${inventoryUoM}`
      );
      return;
    }

    if (availabilityErrors.length > 0) {
      alert(availabilityErrors.join('\n'));
      return;
    }

    onSave(
      normalized.map((row) => ({
        ...row,
        quantity: String(parseBatchNumber(row.quantity)),
      }))
    );
  };

  const canSave = assignedQty > 0 && !qtyMismatch && availabilityErrors.length === 0;

  return createPortal(
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
              {line.itemNo || 'Item'} | Document Qty: {line.quantity || '0'}
              {documentUoM ? ` ${documentUoM}` : ''} | Whse: {line.whse || '-'}
            </div>
            <div style={{ fontSize: 11, color: '#0066cc' }}>
              Required Batch Qty: {requiredQty.toFixed(2)} {inventoryUoM}
            </div>
            {uomFactor !== 1 && inventoryUoM && (
              <div style={{ fontSize: 10, color: '#666' }}>
                Calculation: {lineQty.toFixed(2)} x {uomFactor} = {requiredQty.toFixed(2)} {inventoryUoM}
              </div>
            )}
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="card-body">
          {error ? <div className="alert alert-warning py-2">{error}</div> : null}
          {availabilityErrors.length > 0 ? (
            <div className="alert alert-warning py-2">
              <strong>Available quantity exceeded:</strong> {availabilityErrors.join(', ')}
            </div>
          ) : null}
          {qtyMismatch && assignedQty > 0 ? (
            <div className="alert alert-warning py-2">
              <strong>SAP B1 Standard:</strong> Batch quantity ({assignedQty.toFixed(2)} {inventoryUoM}) must exactly match required base quantity ({requiredQty.toFixed(2)} {inventoryUoM}).
            </div>
          ) : null}

          <div className="d-flex justify-content-between align-items-center mb-3">
            <div style={{ fontSize: 13 }}>
              Assigned Qty: <strong>{assignedQty.toFixed(2)}</strong> / {requiredQty.toFixed(2)} {inventoryUoM}
            </div>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addRow()}>
              + Add Batch
            </button>
          </div>

          <div className="table-responsive mb-3">
            <table className="table table-bordered table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '45%' }}>Batch Number</th>
                  <th style={{ width: '25%' }}>Quantity ({inventoryUoM})</th>
                  {mode === 'receipt' ? <th style={{ width: '20%' }}>Expiry Date</th> : null}
                  <th style={{ width: '10%' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>
                      {mode === 'issue' ? (
                        <select
                          className="form-control form-control-sm"
                          value={row.batchNumber}
                          onChange={(e) => updateRow(index, 'batchNumber', e.target.value)}
                        >
                          <option value="">Select batch</option>
                          {availableBatches.map((batch) => (
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
                  {mode === 'issue' ? 'Available Warehouse Batches' : 'Existing Warehouse Batches'}
                </div>
                {loading ? (
                  <div className="text-muted" style={{ fontSize: 12 }}>Loading batches...</div>
                ) : availableBatches.length ? (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Batch</th>
                          <th>Available Qty ({inventoryUoM})</th>
                          <th>Expiry</th>
                          {mode === 'issue' ? <th></th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {availableBatches.map((batch) => (
                          <tr key={`${batch.BatchNumber}-${batch.ExpiryDate || ''}`}>
                            <td>{batch.BatchNumber}</td>
                            <td>{parseBatchNumber(batch.AvailableQty).toFixed(2)}</td>
                            <td>{batch.ExpiryDate ? String(batch.ExpiryDate).slice(0, 10) : '-'}</td>
                            {mode === 'issue' ? (
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() =>
                                    addRow({
                                      batchNumber: batch.BatchNumber,
                                      quantity: '',
                                      expiryDate: batch.ExpiryDate ? String(batch.ExpiryDate).slice(0, 10) : '',
                                    })
                                  }
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
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={!canSave}
            title={
              qtyMismatch
                ? `Batch quantity must match base quantity (${requiredQty.toFixed(2)} ${inventoryUoM})`
                : assignedQty === 0
                  ? 'Allocate at least one batch'
                  : availabilityErrors.length > 0
                    ? availabilityErrors.join(', ')
                    : 'Save batch allocations'
            }
          >
            Save Batches
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
