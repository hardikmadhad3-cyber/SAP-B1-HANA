import React, { useState, useEffect } from "react";
import apiClient from "../../../api/client";

export default function BatchSerialModal({ line, onSave, onClose }) {
  const [loading, setLoading] = useState(false);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatches, setSelectedBatches] = useState(line.batch_numbers || []);
  const [selectedSerials, setSelectedSerials] = useState(line.serial_numbers || []);
  const [error, setError] = useState(null);

  const isBatchManaged = line.manage_batch;
  const isSerialManaged = line.manage_serial;
  const requiredQty = Number(line.issue_qty) || 0;

  useEffect(() => {
    if (isBatchManaged && line.warehouse) {
      fetchAvailableBatches();
    }
  }, []); // eslint-disable-line

  const fetchAvailableBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.get('/api/batches', {
        params: {
          itemCode: line.item_code,
          warehouse: line.warehouse
        }
      });
      setAvailableBatches(resp.data?.value || []);
      
      if (!resp.data?.value || resp.data.value.length === 0) {
        setError("No batches found in this warehouse. You can manually enter batch numbers below.");
      }
    } catch (err) {
      console.error('[BatchSerialModal] Fetch error:', err);
      setError("Could not fetch batches from SAP. You can manually enter batch numbers below.");
      // Don't block the user - they can still manually enter batches
    } finally {
      setLoading(false);
    }
  };

  const handleBatchQtyChange = (batchNumber, qty) => {
    const numQty = Number(qty) || 0;
    setSelectedBatches(prev => {
      const existing = prev.find(b => b.batch_number === batchNumber);
      if (existing) {
        if (numQty <= 0) {
          return prev.filter(b => b.batch_number !== batchNumber);
        }
        return prev.map(b => b.batch_number === batchNumber ? { ...b, quantity: numQty } : b);
      } else if (numQty > 0) {
        return [...prev, { batch_number: batchNumber, quantity: numQty }];
      }
      return prev;
    });
  };

  const handleSerialToggle = (serialNumber) => {
    setSelectedSerials(prev => {
      const exists = prev.find(s => s.serial_number === serialNumber);
      if (exists) {
        return prev.filter(s => s.serial_number !== serialNumber);
      } else {
        return [...prev, { serial_number: serialNumber }];
      }
    });
  };

  const handleAutoSelectBatches = () => {
    let remaining = requiredQty;
    const selected = [];
    
    for (const batch of availableBatches) {
      if (remaining <= 0) break;
      const batchQty = Math.min(batch.Quantity || 0, remaining);
      if (batchQty > 0) {
        selected.push({ batch_number: batch.BatchNumber, quantity: batchQty });
        remaining -= batchQty;
      }
    }
    
    setSelectedBatches(selected);
  };

  const getTotalSelected = () => {
    if (isBatchManaged) {
      return selectedBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
    }
    if (isSerialManaged) {
      return selectedSerials.length;
    }
    return 0;
  };

  const handleSave = () => {
    const total = getTotalSelected();
    
    if (isBatchManaged && Math.abs(total - requiredQty) > 0.001) {
      setError(`Total batch quantity (${total}) must equal issue quantity (${requiredQty})`);
      return;
    }
    
    if (isSerialManaged && total !== Math.floor(requiredQty)) {
      setError(`Number of serials (${total}) must equal issue quantity (${Math.floor(requiredQty)})`);
      return;
    }
    
    onSave({
      batch_numbers: isBatchManaged ? selectedBatches : [],
      serial_numbers: isSerialManaged ? selectedSerials : [],
    });
  };

  const totalSelected = getTotalSelected();
  const isValid = Math.abs(totalSelected - requiredQty) < 0.001;

  return (
    <div className="batch-serial-modal-overlay" onClick={onClose}>
      <div className="batch-serial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="batch-serial-modal__header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {isBatchManaged ? "Select Batch Numbers" : "Select Serial Numbers"}
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
              Item: {line.item_code} — {line.item_name}
            </div>
          </div>
          <button className="batch-serial-modal__close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="batch-serial-modal__error">
            {error}
          </div>
        )}

        <div className="batch-serial-modal__info">
          <span>Required Qty: <strong>{requiredQty.toFixed(2)}</strong></span>
          <span>Selected: <strong style={{ color: isValid ? "#2e7d32" : "#d32f2f" }}>{totalSelected.toFixed(2)}</strong></span>
          <span>Warehouse: <strong>{line.warehouse}</strong></span>
        </div>

        <div className="batch-serial-modal__body">
          {loading && (
            <div style={{ padding: 20, textAlign: "center", color: "#888" }}>
              Loading available {isBatchManaged ? "batches" : "serials"}...
            </div>
          )}

          {!loading && isBatchManaged && (
            <>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid #e0e6ed", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#555" }}>
                  {availableBatches.length} batch(es) available
                </span>
                {availableBatches.length > 0 && (
                  <button className="im-btn im-btn--sm" onClick={handleAutoSelectBatches}>
                    Auto-Select (FIFO)
                  </button>
                )}
              </div>
              
              {availableBatches.length > 0 ? (
                <table className="batch-serial-table">
                  <thead>
                    <tr>
                      <th>Batch Number</th>
                      <th>Available Qty</th>
                      <th>Expiry Date</th>
                      <th>Issue Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableBatches.map((batch) => {
                      const selected = selectedBatches.find(b => b.batch_number === batch.BatchNumber);
                      return (
                        <tr key={batch.BatchNumber}>
                          <td>{batch.BatchNumber}</td>
                          <td style={{ textAlign: "right" }}>{Number(batch.Quantity || 0).toFixed(2)}</td>
                          <td>{batch.ExpDate ? new Date(batch.ExpDate).toLocaleDateString() : "—"}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={batch.Quantity}
                              step="any"
                              className="batch-qty-input"
                              value={selected?.quantity || ""}
                              onChange={(e) => handleBatchQtyChange(batch.BatchNumber, e.target.value)}
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 14 }}>
                  <div style={{ marginBottom: 10, fontSize: 12, color: "#555" }}>
                    Enter batch numbers manually (format: BatchNumber,Quantity - one per line):
                  </div>
                  <textarea
                    className="serial-input-area"
                    rows={8}
                    placeholder="Example:&#10;BATCH001,50&#10;BATCH002,30"
                    value={selectedBatches.map(b => `${b.batch_number},${b.quantity}`).join("\n")}
                    onChange={(e) => {
                      const lines = e.target.value.split("\n").filter(l => l.trim());
                      const batches = lines.map(l => {
                        const [batchNumber, qty] = l.split(',').map(s => s.trim());
                        return {
                          batch_number: batchNumber || '',
                          quantity: Number(qty) || 0
                        };
                      }).filter(b => b.batch_number && b.quantity > 0);
                      setSelectedBatches(batches);
                    }}
                  />
                  <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
                    {selectedBatches.length} batch(es) entered, Total: {selectedBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0).toFixed(2)}
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && isSerialManaged && (
            <div style={{ padding: 14 }}>
              <div style={{ marginBottom: 10, fontSize: 12, color: "#555" }}>
                Enter serial numbers (one per line):
              </div>
              <textarea
                className="serial-input-area"
                rows={10}
                placeholder="Enter serial numbers..."
                value={selectedSerials.map(s => s.serial_number).join("\n")}
                onChange={(e) => {
                  const lines = e.target.value.split("\n").filter(l => l.trim());
                  setSelectedSerials(lines.map(l => ({ serial_number: l.trim() })));
                }}
              />
              <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
                {selectedSerials.length} serial(s) entered
              </div>
            </div>
          )}
        </div>

        <div className="batch-serial-modal__footer">
          <button className="im-btn" onClick={onClose}>Cancel</button>
          <button 
            className="im-btn im-btn--primary" 
            onClick={handleSave}
            disabled={!isValid}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
