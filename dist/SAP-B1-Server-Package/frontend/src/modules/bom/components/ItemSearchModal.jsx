import React, { useEffect, useMemo, useRef, useState } from "react";

export default function ItemSearchModal({
  onSelect,
  onClose,
  fetchItems,
  columns,
  title,
  allowNew = false,
  onNew,
  autoSearchOnOpen = true,
  emptyMessage = "No items found.",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const defaultColumns = [
    { key: "ItemCode", label: "Item Code" },
    { key: "ItemName", label: "Item Name" },
    { key: "InventoryUOM", label: "UoM" },
  ];

  const displayColumns = useMemo(() => columns || defaultColumns, [columns]);
  const selectedRow = results[selectedIndex] || null;

  const search = async (q) => {
    setLoading(true);
    try {
      const data = await fetchItems(q);
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
    if (autoSearchOnOpen) search("");
  }, [autoSearchOnOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKey = (e) => {
    if (e.key === "Enter") {
      if (results.length && document.activeElement !== inputRef.current) {
        onSelect(results[selectedIndex]);
      } else {
        search(query);
      }
    }
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const chooseSelected = () => {
    if (selectedRow) onSelect(selectedRow);
  };

  const displayValue = (item, col) => {
    if (typeof col.render === "function") return col.render(item[col.key], item);
    return item[col.key];
  };

  return (
    <div className="im-modal-overlay im-modal-overlay--bom-list" onClick={onClose} onKeyDown={handleKey}>
      <div className="im-modal im-modal--bom-list" onClick={(e) => e.stopPropagation()}>
        <div className="im-modal__header">
          {title || "List of Items"}
          <button type="button" className="im-modal__close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="im-modal__search im-modal__search--sap-list">
          <span className="im-modal__find-label">Find</span>
          <input
            ref={inputRef}
            className="im-field__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <button type="button" className="im-btn" onClick={() => search(query)}>
            {loading ? "..." : "Text Search"}
          </button>
        </div>

        <div className="im-modal__body">
          {results.length === 0 && !loading && emptyMessage && <div className="im-modal__empty">{emptyMessage}</div>}
          <table className="im-lookup-table">
            <thead>
              <tr>
                <th className="im-lookup-table__rowno">#</th>
                {displayColumns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((item, idx) => (
                <tr
                  key={item[displayColumns[0].key] || idx}
                  className={`im-lookup-table__row${
                    selectedIndex === idx ? " im-lookup-table__row--selected" : ""
                  }`}
                  onClick={() => setSelectedIndex(idx)}
                  onDoubleClick={() => onSelect(item)}
                >
                  <td className="im-lookup-table__rowno">{idx + 1}</td>
                  {displayColumns.map((col) => (
                    <td key={col.key} className={col.className || ""}>
                      {displayValue(item, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="im-modal__footer im-modal__footer--sap-list">
          <button type="button" className="im-btn im-btn--primary" onClick={chooseSelected} disabled={!selectedRow}>
            Choose
          </button>
          <button type="button" className="im-btn" onClick={onClose}>
            Cancel
          </button>
          {allowNew && (
            <button type="button" className="im-btn" onClick={onNew}>
              New
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
