import React, { useState, useEffect } from "react";
import { fetchProductionOrders } from "../../../api/productionOrderApi";
import "../../item-master/styles/itemMaster.css";
import "../productionOrder.css";

const STATUS_BADGE = {
  Planned:    "planned",
  Released:   "released",
  Closed:     "closed",
  Cancelled:  "cancelled",
};

export default function ProductionOrderList({ onSelect, initialQuery = "" }) {
  const [orders,  setOrders]  = useState([]);
  const [query,   setQuery]   = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const load = async (q = "") => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductionOrders({ query: q });
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setQuery(initialQuery);
    load(initialQuery);
  }, [initialQuery]); // eslint-disable-line

  return (
    <div className="im-page" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div className="im-toolbar">
        <span className="im-toolbar__title">Production Orders</span>
        <button className="im-btn im-btn--primary" onClick={() => onSelect(null)}>New</button>
      </div>

      {error && <div className="im-alert im-alert--error">{error}</div>}

      {/* Search bar */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e0e6ed", background: "#f8fafc" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            className="im-field__input"
            placeholder="Search by document no., item code, or description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(query)}
            style={{ width: "350px" }}
          />
          <button className="im-btn" onClick={() => load(query)} disabled={loading} style={{ minWidth: "80px" }}>
            {loading ? "Searching..." : "Search"}
          </button>
          <button className="im-btn" onClick={() => { setQuery(""); load(""); }} style={{ minWidth: "70px" }}>
            Clear
          </button>
        </div>
      </div>

      {/* List table */}
      <div style={{ flex: 1, overflow: "auto", padding: "0" }}>
        <table className="po-list-table">
          <thead>
            <tr>
              <th style={{ minWidth: "80px" }}>Doc No.</th>
              <th style={{ minWidth: "120px" }}>Item Code</th>
              <th style={{ minWidth: "250px" }}>Description</th>
              <th style={{ minWidth: "100px" }}>Type</th>
              <th style={{ minWidth: "100px" }}>Status</th>
              <th style={{ minWidth: "110px", textAlign: "right" }}>Planned Qty</th>
              <th style={{ minWidth: "120px", textAlign: "right" }}>Completed Qty</th>
              <th style={{ minWidth: "100px" }}>Due Date</th>
              <th style={{ minWidth: "100px" }}>Warehouse</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#888" }}>
                  Loading production orders...
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "#888", padding: "40px" }}>
                  No production orders found.
                </td>
              </tr>
            )}
            {!loading && orders.map((o) => (
              <tr key={o.doc_entry} onClick={() => onSelect(o.doc_entry)} className="po-list-row">
                <td style={{ fontWeight: 600, color: "#0070c0" }}>{o.doc_num}</td>
                <td>{o.item_code}</td>
                <td>{o.item_name}</td>
                <td>{o.type}</td>
                <td>
                  <span className={`po-status-badge po-status-badge--${STATUS_BADGE[o.status] || "planned"}`}>
                    {o.status}
                  </span>
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {Number(o.planned_qty).toFixed(2)}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {Number(o.completed_qty).toFixed(2)}
                </td>
                <td>{o.due_date}</td>
                <td>{o.warehouse}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
