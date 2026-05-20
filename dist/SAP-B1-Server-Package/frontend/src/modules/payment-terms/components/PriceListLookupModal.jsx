import React, { useState, useEffect } from "react";
import { searchPriceLists } from "../../../api/priceListApi";

export default function PriceListLookupModal({ onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadResults("");
  }, []);

  const loadResults = async (searchQuery) => {
    setLoading(true);
    try {
      const data = await searchPriceLists(searchQuery);
      setResults(data);
    } catch (err) {
      console.error("Failed to load price lists:", err);
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
          <span>Select Price List</span>
          <button className="pt-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="pt-modal__search">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              className="pt-modal__search-input"
              placeholder="Search price lists..."
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
            <div className="pt-modal__empty">No price lists found</div>
          ) : (
            <table className="pt-lookup-table">
              <thead>
                <tr>
                  <th>Price List No.</th>
                  <th>Name</th>
                  <th>Base Price List</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr
                    key={row.PriceListNo}
                    className="pt-lookup-table__row"
                    onClick={() => onSelect(row)}
                  >
                    <td>{row.PriceListNo}</td>
                    <td>{row.PriceListName}</td>
                    <td>{row.BasePriceList || "-"}</td>
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
