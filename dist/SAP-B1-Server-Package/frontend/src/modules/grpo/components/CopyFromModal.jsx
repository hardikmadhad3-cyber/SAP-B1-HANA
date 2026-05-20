import React, { useState, useEffect } from 'react';
import { fetchOpenPurchaseOrders } from '../../../api/grpoApi';

export default function CopyFromModal({ isOpen, onClose, onCopy, vendorCode }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen, vendorCode]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetchOpenPurchaseOrders(vendorCode);
      setOrders(res.data.orders || []);
    } catch (err) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (selected) {
      onCopy(selected);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Copy From Purchase Order</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {loading ? (
              <div className="text-center py-4">Loading...</div>
            ) : orders.length === 0 ? (
              <div className="alert alert-info">No open purchase orders found{vendorCode ? ' for this vendor' : ''}.</div>
            ) : (
              <table className="table table-hover table-sm">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th>Doc No.</th>
                    <th>Vendor</th>
                    <th>Date</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr 
                      key={order.DocEntry} 
                      onClick={() => setSelected(order.DocEntry)} 
                      style={{ cursor: 'pointer' }}
                      className={selected === order.DocEntry ? 'table-active' : ''}
                    >
                      <td>
                        <input
                          type="radio"
                          className="form-check-input"
                          checked={selected === order.DocEntry}
                          onChange={() => setSelected(order.DocEntry)}
                        />
                      </td>
                      <td>{order.DocNum}</td>
                      <td>{order.CardName}</td>
                      <td>{order.DocDate ? new Date(order.DocDate).toLocaleDateString() : ''}</td>
                      <td className="text-end">{order.DocTotal ? Number(order.DocTotal).toFixed(2) : '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCopy} disabled={!selected}>
              Copy Selected Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
