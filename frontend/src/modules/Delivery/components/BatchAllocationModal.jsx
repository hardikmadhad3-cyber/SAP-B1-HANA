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
const getBatchWarehouseCode = (batch = {}) =>
  String(batch.WhsCode || batch.whsCode || batch.warehouse || '').trim();
const getBatchRowKey = (batchNumber, whsCode) => `${String(batchNumber || '').trim()}__${String(whsCode || '').trim()}`;

export default function BatchAllocationModal({
  isOpen,
  line,
  availableBatches = [],
  loading = false,
  error = '',
  workspaceRef,
  onClose,
  onSave,
}) {
  const [rows, setRows] = useState([]);
  const [workspaceBounds, setWorkspaceBounds] = useState(null);
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
        getBatchRowKey(batch.batchNumber, batch.whse || batch.WhsCode),
        {
          quantity: toInputValue(batch.quantity),
          expiryDate: batch.expiryDate || '',
        },
      ])
    );

    setRows(
      (Array.isArray(availableBatches) ? availableBatches : []).map((batch) => {
        const batchNumber = String(batch.BatchNumber || '').trim();
        const whsCode = getBatchWarehouseCode(batch);
        const existing = existingAllocations.get(getBatchRowKey(batchNumber, whsCode));
        const availableQty = parseBatchNumber(batch.AvailableQty);
        const existingBaseQty = clampBatchQty(existing?.quantity, availableQty);
        return {
          key: getBatchRowKey(batchNumber, whsCode),
          batchNumber,
          whsCode,
          whsName: String(batch.WhsName || batch.whsName || '').trim(),
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

  useEffect(() => {
    if (!isOpen) return undefined;
    const updateBounds = () => {
      const rect = workspaceRef?.current?.getBoundingClientRect?.();
      if (!rect) {
        setWorkspaceBounds(null);
        return;
      }
      const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect?.().bottom || 0;
      const top = Math.max(0, rect.top, topbarBottom);
      const left = Math.max(0, rect.left);
      setWorkspaceBounds({
        top,
        left,
        right: 'auto',
        bottom: 'auto',
        width: Math.max(320, window.innerWidth - left),
        height: Math.max(240, window.innerHeight - top),
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

  const assignedQty = useMemo(() => sumBatchQty(rows), [rows]);
  const selectedWarehouse = String(line?.whse || '').trim();
  const otherWarehouseRows = useMemo(
    () => rows.filter((row) => row.whsCode && selectedWarehouse && row.whsCode !== selectedWarehouse),
    [rows, selectedWarehouse]
  );

  const availabilityErrors = useMemo(
    () =>
      rows
        .filter((row) => parseBatchNumber(row.quantity) > 0)
        .filter((row) => parseBatchNumber(row.quantity) - parseBatchNumber(row.availableQty) > BATCH_QTY_TOLERANCE)
        .map(
          (row) =>
            `${row.batchNumber} (${row.whsCode || '-'}) exceeds available quantity (${parseBatchNumber(row.availableQty).toFixed(2)} ${inventoryUoM})`
        ),
    [inventoryUoM, rows]
  );

  const qtyMismatch = Math.abs(assignedQty - baseQty) > BATCH_QTY_TOLERANCE;
  const allocatedDocumentQty = hasDocumentUomConversion ? assignedQty / uomFactor : assignedQty;
  const canSave = assignedQty > 0 && availabilityErrors.length === 0;

  if (!isOpen || !line) return null;

  const updateQty = (rowKey, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row;
        const numericValue = sanitizeNumericInput(value);
        const hasCompleteNumber = numericValue !== '' && numericValue !== '.';
        const baseQtyValue = hasCompleteNumber ? parseBatchNumber(numericValue) : 0;
        return {
          ...row,
          quantity: numericValue,
          documentQuantity:
            !hasCompleteNumber || !hasDocumentUomConversion
              ? ''
              : toInputValue(baseQtyValue / uomFactor),
        };
      })
    );
  };

  const updateDocumentQty = (rowKey, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row;
        const numericValue = sanitizeNumericInput(value);
        const hasCompleteNumber = numericValue !== '' && numericValue !== '.';
        const requestedBaseQty = hasCompleteNumber ? parseBatchNumber(numericValue) * uomFactor : 0;
        return {
          ...row,
          documentQuantity: hasDocumentUomConversion ? numericValue : '',
          quantity:
            !hasCompleteNumber || !hasDocumentUomConversion
              ? ''
              : toInputValue(requestedBaseQty),
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

    const selectedRows = rows.filter((row) => parseBatchNumber(row.quantity) > 0);
    const selectedWarehouses = [...new Set(selectedRows.map((row) => row.whsCode).filter(Boolean))];
    if (selectedWarehouses.length > 1) {
      alert('Select batches from one warehouse only.');
      return;
    }

    const normalized = selectedRows.map((row) => ({
        batchNumber: row.batchNumber,
        quantity: String(parseBatchNumber(row.quantity)),
        expiryDate: row.expiryDate,
        whse: row.whsCode,
        warehouse: row.whsCode,
      }));
    onSave(normalized);
  };

  return createPortal(
    <div
      className="del-modal-overlay del-batch-modal-overlay"
      style={workspaceBounds || undefined}
      onClick={onClose}
    >
      <div
        className="del-modal del-batch-modal"
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
          {!loading && rows.length > 0 && otherWarehouseRows.length > 0 && (
            <div className="del-alert del-alert--warning" style={{ marginBottom: '12px', fontSize: '11px' }}>
              Selected warehouse {selectedWarehouse || '-'} has no available batch quantity. Showing available stock from other warehouses; saving will change the line warehouse to the selected batch warehouse.
            </div>
          )}

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
                    <th>Whse</th>
                    <th>Available Qty ({inventoryUoM})</th>
                    <th>Available UOM {documentUoM ? `(${documentUoM})` : ''}</th>
                    <th>Allocate Qty UOM {documentUoM ? `(${documentUoM})` : ''}</th>
                    <th>Allocate Qty ({inventoryUoM})</th>
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.batchNumber}</td>
                      <td>{row.whsCode}{row.whsName ? ` - ${row.whsName}` : ''}</td>
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
                          onChange={(e) => updateDocumentQty(row.key, e.target.value)}
                          placeholder="0"
                          style={{ textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ minWidth: '140px' }}>
                        <input
                          className="del-grid__input"
                          value={row.quantity}
                          onChange={(e) => updateQty(row.key, e.target.value)}
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
