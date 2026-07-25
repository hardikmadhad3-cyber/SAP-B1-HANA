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

const toInputValue = (value) => {
  if (value === '' || value == null) return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  const rounded = Math.round((num + Number.EPSILON) * 1000000) / 1000000;
  return String(rounded);
};

const sanitizeNumericInput = (value) => String(value || '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
const clampBatchQty = (requestedQty, availableQty) =>
  Math.min(Math.max(parseBatchNumber(requestedQty), 0), parseBatchNumber(availableQty));

export default function BatchAllocationModal({
  isOpen,
  line,
  availableBatches = [],
  loading = false,
  error = '',
  onClose,
  onSave,
}) {
  const [rows, setRows] = useState([]);
  const lineQty = parseBatchNumber(line?.quantity);
  const uomFactor = getLineUomFactor(line);
  const baseQty = getRequiredBatchQty(line);
  const documentUoM = getDocumentUomLabel(line);
  const inventoryUoM = getBatchInventoryUom(line);
  const hasDocumentUomConversion = uomFactor > 0;

  useEffect(() => {
    if (!isOpen) return;

    const existingAllocations = new Map(
      (Array.isArray(line?.batches) ? line.batches : []).map((batch) => [
        String(batch.batchNumber || '').trim(),
        {
          quantity: toInputValue(batch.quantity),
          expiryDate: batch.expiryDate || '',
        },
      ])
    );

    setRows(
      (Array.isArray(availableBatches) ? availableBatches : []).map((batch) => {
        const batchNumber = String(batch.BatchNumber || '').trim();
        const existing = existingAllocations.get(batchNumber);
        const availableQty = parseBatchNumber(batch.AvailableQty);
        const existingBaseQty = clampBatchQty(existing?.quantity, availableQty);
        return {
          batchNumber,
          availableQty,
          expiryDate: batch.ExpiryDate ? String(batch.ExpiryDate).slice(0, 10) : '',
          quantity: existing?.quantity ? toInputValue(existingBaseQty) : '',
          documentQuantity:
            existing?.quantity && uomFactor > 0
              ? toInputValue(existingBaseQty / uomFactor)
              : '',
        };
      })
    );
  }, [availableBatches, isOpen, line, uomFactor]);

  const assignedQty = useMemo(() => sumBatchQty(rows), [rows]);

  const availabilityErrors = useMemo(
    () =>
      rows
        .filter((row) => parseBatchNumber(row.quantity) > 0)
        .filter((row) => parseBatchNumber(row.quantity) - parseBatchNumber(row.availableQty) > BATCH_QTY_TOLERANCE)
        .map(
          (row) =>
            `${row.batchNumber} exceeds available quantity (${parseBatchNumber(row.availableQty).toFixed(2)} ${inventoryUoM})`
        ),
    [inventoryUoM, rows]
  );

  const qtyMismatch = Math.abs(assignedQty - baseQty) > BATCH_QTY_TOLERANCE;
  const allocatedDocumentQty = hasDocumentUomConversion ? assignedQty / uomFactor : assignedQty;
  const canSave = assignedQty > 0 && availabilityErrors.length === 0;

  if (!isOpen || !line) return null;

  const updateQty = (batchNumber, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.batchNumber !== batchNumber) return row;
        const numericValue = sanitizeNumericInput(value);
        const cappedBaseQty = clampBatchQty(numericValue, row.availableQty);
        return {
          ...row,
          quantity: numericValue === '' ? '' : toInputValue(cappedBaseQty),
          documentQuantity:
            numericValue === '' || !hasDocumentUomConversion
              ? ''
              : toInputValue(cappedBaseQty / uomFactor),
        };
      })
    );
  };

  const updateDocumentQty = (batchNumber, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.batchNumber !== batchNumber) return row;
        const numericValue = sanitizeNumericInput(value);
        const requestedBaseQty = parseBatchNumber(numericValue) * uomFactor;
        const cappedBaseQty = clampBatchQty(requestedBaseQty, row.availableQty);
        return {
          ...row,
          documentQuantity:
            numericValue === '' || !hasDocumentUomConversion
              ? ''
              : toInputValue(cappedBaseQty / uomFactor),
          quantity:
            numericValue === '' || !hasDocumentUomConversion
              ? ''
              : toInputValue(cappedBaseQty),
        };
      })
    );
  };

  const handleSave = () => {
    if (assignedQty === 0) {
      alert('Please allocate at least one batch');
      return;
    }

    if (availabilityErrors.length > 0) {
      alert(availabilityErrors.join('\n'));
      return;
    }

    const normalized = rows
      .filter((row) => parseBatchNumber(row.quantity) > 0)
      .map((row) => ({
        batchNumber: row.batchNumber,
        quantity: String(parseBatchNumber(row.quantity)),
        expiryDate: row.expiryDate,
      }));
    onSave(normalized);
  };

  return createPortal(
    <div className="del-modal-overlay" onClick={onClose}>
      <div
        className="del-modal"
        style={{ width: 'min(980px, 100%)', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="del-modal__header">
          <div>
            <h6 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 600 }}>Allocate Delivery Batches</h6>
            <div style={{ fontSize: '11px', color: '#666' }}>
              {line.itemNo || 'Item'} | Document Qty: {line.quantity || '0'}
              {documentUoM ? ` ${documentUoM}` : ''} | Whse: {line.whse || '-'}
              <span style={{ marginLeft: '8px', color: '#0066cc' }}>
                (Required Batch Qty: {baseQty.toFixed(2)} {inventoryUoM})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              padding: 0,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            x
          </button>
        </div>

        <div className="del-modal__body">
          {error && <div className="del-alert del-alert--warning">{error}</div>}

          <div style={{ fontSize: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Assigned Qty:</strong>{' '}
              <strong style={{ color: qtyMismatch ? '#cc7a00' : '#1a7a30' }}>{assignedQty.toFixed(2)}</strong> / {baseQty.toFixed(2)} {inventoryUoM}
              {qtyMismatch && assignedQty > 0 && (
                <span style={{ color: '#cc7a00', marginLeft: '8px', fontSize: '11px' }}>
                  Partial stock
                </span>
              )}
              {uomFactor !== 1 && inventoryUoM && (
                <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                  Calculation: {lineQty.toFixed(2)} x {uomFactor} = {baseQty.toFixed(2)} {inventoryUoM}
                </div>
              )}
            </div>
            <span style={{ fontSize: '11px', color: '#666' }}>
              Batches must be allocated in Base UoM ({inventoryUoM})
            </span>
          </div>

          {availabilityErrors.length > 0 && (
            <div className="del-alert del-alert--warning" style={{ marginBottom: '12px', fontSize: '11px' }}>
              <strong>Available quantity exceeded:</strong> {availabilityErrors.join(', ')}
            </div>
          )}

          {qtyMismatch && assignedQty > 0 && (
            <div className="del-alert del-alert--warning" style={{ marginBottom: '12px', fontSize: '11px' }}>
              <strong>Partial allocation:</strong> Saving will update the line quantity to {toInputValue(allocatedDocumentQty)} {documentUoM || inventoryUoM}
              {' '}based on the allocated batch stock ({assignedQty.toFixed(2)} {inventoryUoM}).
            </div>
          )}

          {loading ? (
            <div style={{ fontSize: '12px', color: '#666' }}>Loading available batches...</div>
          ) : rows.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="del-grid" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Available Qty ({inventoryUoM})</th>
                    <th>Available UOM {documentUoM ? `(${documentUoM})` : ''}</th>
                    <th>Allocate Qty UOM {documentUoM ? `(${documentUoM})` : ''}</th>
                    <th>Allocate Qty ({inventoryUoM})</th>
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.batchNumber}>
                      <td>{row.batchNumber}</td>
                      <td style={{ textAlign: 'right' }}>{row.availableQty.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {hasDocumentUomConversion
                          ? (row.availableQty / uomFactor).toFixed(2)
                          : '0.00'}
                      </td>
                      <td style={{ minWidth: '140px' }}>
                        <input
                          className="del-grid__input"
                          value={row.documentQuantity || ''}
                          onChange={(e) => updateDocumentQty(row.batchNumber, e.target.value)}
                          placeholder="0"
                          style={{ textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ minWidth: '140px' }}>
                        <input
                          className="del-grid__input"
                          value={row.quantity}
                          onChange={(e) => updateQty(row.batchNumber, e.target.value)}
                          placeholder="0"
                          style={{ textAlign: 'right' }}
                        />
                      </td>
                      <td>{row.expiryDate || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#666' }}>No warehouse batches found for the selected item and warehouse.</div>
          )}
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
              assignedQty === 0
                  ? 'Allocate at least one batch'
                  : availabilityErrors.length > 0
                    ? availabilityErrors.join(', ')
                    : qtyMismatch
                      ? `Save batches and update line quantity to ${toInputValue(allocatedDocumentQty)} ${documentUoM || inventoryUoM}`
                    : 'Save batch allocations'
            }
            style={{
              opacity: canSave ? 1 : 0.5,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            Save Batches
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
