import React, { useState, useEffect, useRef } from "react";
import { lookupProductionOrders } from "../../../api/issueForProductionApi";

const STATUS_LABEL = {
  boposReleased: "Released",
  boposPlanned:  "Planned",
};

export default function ProductionOrderSearchModal({ onSelect, onClose }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    search("");
  }, []); // eslint-disable-line

  const search = async (q) => {
    setLoading(true);
    try {
      const data = await lookupProductionOrders(q);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter")  search(query);
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="ifp-po-modal-overlay" onClick={onClose}>
      <div className="ifp-po-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ifp-po-modal__header">
          Select Production Order
          <button className="ifp-po-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="ifp-po-modal__search">
          <input
            ref={inputRef}
            className="im-field__input"
            style={{ flex: 1 }}
            placeholder="Search by Doc No., Item Code or Description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <button className="im-btn" onClick={() => search(query)}>
            {loading ? "…" : "Search"}
          </button>
        </div>

        <div className="ifp-po-modal__body">
          {results.length === 0 && !loading && (
            <div className="ifp-po-modal__empty">No open production orders found.</div>
          )}
          <table className="ifp-list-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Doc No.</th>
                <th>Item Code</th>
                <th>Description</th>
                <th>Status</th>
                <th>Planned Qty</th>
                <th>Completed Qty</th>
                <th>Warehouse</th>
              </tr>
            </thead>
            <tbody>
              {results.map((o) => (
                <tr key={o.DocEntry} onClick={() => onSelect(o)}>
                  <td>{o.DocNum}</td>
                  <td>{o.ItemNo}</td>
                  <td>{o.ProductDescription}</td>
                  <td>{STATUS_LABEL[o.ProductionOrderStatus] || o.ProductionOrderStatus}</td>
                  <td style={{ textAlign: "right" }}>{Number(o.PlannedQuantity || 0).toFixed(2)}</td>
                  <td style={{ textAlign: "right" }}>{Number(o.CompletedQuantity || 0).toFixed(2)}</td>
                  <td>{o.Warehouse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
