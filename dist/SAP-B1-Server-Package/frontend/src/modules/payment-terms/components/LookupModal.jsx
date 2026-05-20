import React, { useState, useEffect } from "react";

export default function LookupModal({ title, onClose, onSelect, fetchOptions, columns }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadResults("");
  }, []);

  const loadResults = async (searchQuery) => {
    setLoading(true);
    try {
      const data = await fetchOptions(searchQuery);
      setResults(data);
    } catch (err) {
      console.error("Failed to load results:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadResults(query);
  };

  return (
    <div className="pt-modal-overlay" onClick={onClose}>
      <div className="pt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pt-modal__header">
          <span>{title}</span>
          <button className="pt-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="pt-modal__search">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              className="pt-modal__search-input"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button type="submit" className="pt-btn pt-btn--small">
              Search
            </button>
          </form>
        </div>

        <div className="pt-modal__body">
          {loading ? (
            <div className="pt-modal__empty">Loading...</div>
          ) : results.length === 0 ? (
            <div className="pt-modal__empty">No results found</div>
          ) : (
            <table className="pt-lookup-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => (
                  <tr
                    key={index}
                    className="pt-lookup-table__row"
                    onClick={() => onSelect(row)}
                  >
                    {columns.map((col) => (
                      <td key={col.key}>{row[col.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
