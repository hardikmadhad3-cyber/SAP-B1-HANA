import React, { useState, useEffect, useRef } from "react";
import { lookupProductionOrdersForReceipt } from "../../../api/receiptFromProductionApi";

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
      const data = await lookupProductionOrdersForReceipt(q);
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
    <div className="rfp-po-modal-overlay" onClick={onClose}>
      <div className="rfp-po-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rfp-po-modal__header">
          Select Production Order for Receipt
          <button className="rfp-po-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="rfp-po-modal__search">
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

        <div className="rfp-po-modal__body">
          {results.length === 0 && !loading && (
            <div className="rfp-po-modal__empty">No open production orders found.</div>
          )}
          <table className="rfp-list-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Doc No.</th>
                <th>Item Code</th>
                <th>Description</th>
                <th>Status</th>
                <th>Planned Qty</th>
                <th>Completed Qty</th>
                <th>Remaining</th>
                <th>Due Date</th>
                <th>Warehouse</th>
              </tr>
            </thead>
            <tbody>
              {results.map((o) => {
                const planned   = Number(o.PlannedQuantity   || 0);
                const completed = Number(o.CompletedQuantity || 0);
                const remaining = Math.max(0, planned - completed);
                return (
                  <tr key={o.DocEntry} onClick={() => onSelect(o)}>
                    <td>{o.DocNum}</td>
                    <td>{o.ItemNo}</td>
                    <td>{o.ProductDescription}</td>
                    <td>{STATUS_LABEL[o.ProductionOrderStatus] || o.ProductionOrderStatus}</td>
                    <td style={{ textAlign: "right" }}>{planned.toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>{completed.toFixed(2)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: remaining > 0 ? "#7c5c00" : "#aaa" }}>
                      {remaining.toFixed(2)}
                    </td>
                    <td>{o.DueDate ? String(o.DueDate).split("T")[0] : ""}</td>
                    <td>{o.Warehouse}</td>
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
