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

const sanitizeNumericInput = (value) =>
  String(value || '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

export default function BatchAllocationModal({
  isOpen,
  mode = 'issue',
  line,
  availableBatches = [],
  loading = false,
  error = '',
  onGenerateBatchNumber,
  onClose,
  onSave,
}) {
  const [rows, setRows] = useState([createBatchRow()]);
  const [generatingRow, setGeneratingRow] = useState(null);

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
    const nextValue = key === 'quantity' ? sanitizeNumericInput(value) : value;
    setRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: nextValue } : row))
    );
  };

  const incrementBatchNumber = (batchNumber) => {
    const match = String(batchNumber || '').trim().match(/^([A-Za-z]*)(\d+)$/);
    if (!match) return batchNumber;
    const [, prefix, numericPart] = match;
    return `${prefix}${String(Number(numericPart) + 1).padStart(numericPart.length, '0')}`;
  };

  const getUniqueBatchNumber = (candidate, currentIndex) => {
    const used = new Set(
      rows
        .filter((_, index) => index !== currentIndex)
        .map((row) => String(row.batchNumber || '').trim())
        .filter(Boolean)
    );
    let next = String(candidate || '').trim();
    while (next && used.has(next)) {
      next = incrementBatchNumber(next);
    }
    return next;
  };

  const generateBatchNumber = async (index) => {
    if (typeof onGenerateBatchNumber !== 'function') return;
    setGeneratingRow(index);
    try {
      const response = await onGenerateBatchNumber();
      const candidate = response?.data?.nextBatchNumber || response?.nextBatchNumber || '';
      const nextBatchNumber = getUniqueBatchNumber(candidate, index);
      if (nextBatchNumber) {
        updateRow(index, 'batchNumber', nextBatchNumber);
      }
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to generate batch number.');
    } finally {
      setGeneratingRow(null);
    }
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
    <div className="del-modal-overlay" onClick={onClose}>
      <div
        className="del-modal grpo-batch-modal"
        style={{ width: 'min(980px, 100%)', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="del-modal__header">
          <div>
            <h6 style={{ margin: '0 0 6px 0', fontSize: 12, fontWeight: 600 }}>Allocate GRPO Batches</h6>
            <div style={{ fontSize: 11, color: '#666' }}>
              {line.itemNo || 'Item'} | Document Qty: {line.quantity || '0'}
              {documentUoM ? ` ${documentUoM}` : ''} | Whse: {line.whse || '-'}
              <span style={{ marginLeft: 8, color: '#0066cc' }}>
                (Required Batch Qty: {requiredQty.toFixed(2)} {inventoryUoM})
              </span>
            </div>
            {uomFactor !== 1 && inventoryUoM ? (
              <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                Calculation: {lineQty.toFixed(2)} x {uomFactor} = {requiredQty.toFixed(2)} {inventoryUoM}
              </div>
            ) : null}
          </div>
          <button type="button" className="del-modal__close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="del-modal__body">
          {error ? <div className="del-alert del-alert--warning">{error}</div> : null}
          {availabilityErrors.length > 0 ? (
            <div className="del-alert del-alert--warning">
              <strong>Available quantity exceeded:</strong> {availabilityErrors.join(', ')}
            </div>
          ) : null}
          {qtyMismatch && assignedQty > 0 ? (
            <div className="del-alert del-alert--warning">
              <strong>SAP B1 Standard:</strong> Batch quantity ({assignedQty.toFixed(2)} {inventoryUoM}) must exactly match required base quantity ({requiredQty.toFixed(2)} {inventoryUoM}).
            </div>
          ) : null}

          <div className="grpo-batch-modal__summary">
            <div style={{ fontSize: 12 }}>
              <strong>Assigned Qty:</strong>{' '}
              <strong style={{ color: qtyMismatch ? '#cc7a00' : '#1a7a30' }}>{assignedQty.toFixed(2)}</strong>
              {' '} / {requiredQty.toFixed(2)} {inventoryUoM}
            </div>
            <button type="button" className="del-btn del-btn--primary" onClick={() => addRow()}>
              + Add Batch
            </button>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <table className="del-grid grpo-batch-modal__grid" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{mode === 'receipt' ? 'JKL Lot No.' : 'Batch Number'}</th>
                  <th>Quantity ({inventoryUoM})</th>
                  {mode === 'receipt' ? <th>Expiry Date</th> : null}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>
                      {mode === 'issue' ? (
                        <select
                          className="del-grid__input"
                          value={row.batchNumber}
                          onChange={(event) => updateRow(index, 'batchNumber', event.target.value)}
                        >
                          <option value="">Select batch</option>
                          {availableBatches.map((batch) => (
                            <option key={`${batch.BatchNumber}-${batch.ExpiryDate || ''}`} value={batch.BatchNumber}>
                              {batch.BatchNumber} ({batch.AvailableQty})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            className="del-grid__input"
                            value={row.batchNumber}
                            onChange={(event) => updateRow(index, 'batchNumber', event.target.value)}
                            placeholder="JKL Lot No."
                          />
                          <button
                            type="button"
                            className="del-btn"
                            onClick={() => generateBatchNumber(index)}
                            disabled={generatingRow === index}
                            title="Auto number"
                            style={{ minWidth: 28, padding: '2px 7px' }}
                          >
                            {generatingRow === index ? '...' : '#'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        className="del-grid__input"
                        value={row.quantity}
                        onChange={(event) => updateRow(index, 'quantity', event.target.value)}
                        placeholder="0"
                        style={{ textAlign: 'right' }}
                      />
                    </td>
                    {mode === 'receipt' ? (
                      <td>
                        <input
                          type="date"
                          className="del-grid__input"
                          value={row.expiryDate}
                          onChange={(event) => updateRow(index, 'expiryDate', event.target.value)}
                        />
                      </td>
                    ) : null}
                    <td>
                      <button type="button" className="del-btn del-btn--danger" onClick={() => removeRow(index)}>
                        x
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grpo-batch-modal__existing">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              {mode === 'issue' ? 'Available Warehouse Batches' : 'Existing Warehouse Batches'}
            </div>
            {loading ? (
              <div style={{ fontSize: 12, color: '#666' }}>Loading batches...</div>
            ) : availableBatches.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="del-grid" style={{ width: '100%' }}>
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
                        <td style={{ textAlign: 'right' }}>{parseBatchNumber(batch.AvailableQty).toFixed(2)}</td>
                        <td>{batch.ExpiryDate ? String(batch.ExpiryDate).slice(0, 10) : '-'}</td>
                        {mode === 'issue' ? (
                          <td>
                            <button
                              type="button"
                              className="del-btn"
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
              <div style={{ fontSize: 12, color: '#666' }}>No warehouse batches found.</div>
            )}
          </div>
        </div>

        <div className="del-modal__footer">
          <button type="button" className="del-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="del-btn del-btn--primary"
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
