import React, { useState, useEffect, useRef } from "react";

export default function CustomerSearchModal({ onSelect, onClose, fetchCustomers }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const columns = [
    { key: "CardCode", label: "Customer Code" },
    { key: "CardName", label: "Customer Name" },
  ];

  useEffect(() => {
    inputRef.current?.focus();
    search("");
  }, []); // eslint-disable-line

  const search = async (q) => {
    setLoading(true);
    try {
      const data = await fetchCustomers(q);
      setResults(data);
    } catch { 
      setResults([]); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") search(query);
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="im-modal-overlay" onClick={onClose}>
      <div className="im-modal" onClick={(e) => e.stopPropagation()}>
        <div className="im-modal__header">
          Customer Search
          <button className="im-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="im-modal__search">
          <input
            ref={inputRef}
            className="im-field__input"
            style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="Search by code or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <button className="im-btn" style={{ marginTop: 6 }} onClick={() => search(query)}>
            {loading ? "…" : "Search"}
          </button>
        </div>
        <div className="im-modal__body">
          {results.length === 0 && !loading && (
            <div className="im-modal__empty">No customers found.</div>
          )}
          <table className="im-lookup-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((customer, idx) => (
                <tr
                  key={customer.CardCode || idx}
                  className="im-lookup-table__row"
                  onClick={() => onSelect(customer)}
                >
                  {columns.map(col => (
                    <td key={col.key}>{customer[col.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
