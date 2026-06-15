import React, { useEffect, useRef, useState } from "react";
import { lookupProductionOrders } from "../../../api/issueForProductionApi";

const TYPE_LABELS = {
  bopotStandard: "Standard",
  bopotSpecial: "Special",
  bopotDisassemble: "Disassembly",
};

export default function ProductionOrderSearchModal({
  title = "List of Production Orders",
  type = "",
  onSelect,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const selected = results[selectedIndex] || null;

  const search = async (q) => {
    setLoading(true);
    try {
      const data = await lookupProductionOrders(q, type);
      setResults(Array.isArray(data) ? data : []);
      setSelectedIndex(0);
    } catch {
      setResults([]);
      setSelectedIndex(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    search("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = () => {
    if (selected) onSelect(selected);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      if (query) search(query);
      else choose();
    }
    if (event.key === "Escape") onClose();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(results.length - 1, prev + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
  };

  return (
    <div className="ifp-po-modal-overlay" onClick={onClose}>
      <div className="ifp-po-modal ifp-sap-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ifp-sap-modal__titlebar">
          <span>{title}</span>
          <div className="ifp-sap-modal__controls">
            <button type="button" disabled>-</button>
            <button type="button" disabled>[]</button>
            <button type="button" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="ifp-sap-modal__body">
          <div className="ifp-sap-find-row">
            <label>Find</label>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button type="button" className="im-btn" onClick={() => search(query)} disabled={loading}>
              Find
            </button>
          </div>

          <div className="ifp-sap-list-wrap">
            <table className="ifp-sap-list-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th style={{ width: 58 }}>Document</th>
                  <th style={{ width: 88 }}>Series Name</th>
                  <th style={{ width: 118 }}>Production Order Type</th>
                  <th style={{ width: 76 }}>Due Date</th>
                  <th style={{ width: 92 }}>Product No.</th>
                  <th style={{ width: 130 }}>Product Description</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="ifp-sap-empty-cell">Loading...</td>
                  </tr>
                )}
                {!loading && results.length === 0 && (
                  <tr>
                    <td colSpan={7} className="ifp-sap-empty-cell">No production orders found.</td>
                  </tr>
                )}
                {!loading && results.map((order, index) => (
                  <tr
                    key={order.DocEntry}
                    className={index === selectedIndex ? "is-selected" : ""}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => onSelect(order)}
                  >
                    <td>{index + 1}</td>
                    <td>{order.DocNum}</td>
                    <td>{order.SeriesName}</td>
                    <td>{TYPE_LABELS[order.Type] || order.Type || "Standard"}</td>
                    <td>{order.DueDate}</td>
                    <td>{order.ItemNo}</td>
                    <td>{order.ProductDescription}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ifp-sap-modal__footer">
          <button type="button" className="im-btn im-btn--primary" onClick={choose} disabled={!selected || loading}>
            Choose
          </button>
          <button type="button" className="im-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
