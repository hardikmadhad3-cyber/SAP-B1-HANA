import React, { useEffect, useState } from "react";
import "../../modules/item-master/styles/itemMaster.css";

export default function SapLookupModal({
  open,
  title,
  columns,
  fetchOptions,
  onClose,
  onSelect,
  initialQuery = "",
}) {
  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let ignore = false;
    setLoading(true);
    Promise.resolve(fetchOptions(query))
      .then((nextRows) => {
        if (!ignore) setRows(Array.isArray(nextRows) ? nextRows : []);
      })
      .catch(() => {
        if (!ignore) setRows([]);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [open, query, fetchOptions]);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  if (!open) return null;

  return (
    <div className="im-modal-overlay" onClick={onClose}>
      <div className="im-modal" style={{ width: "min(860px, calc(100vw - 40px))" }} onClick={(event) => event.stopPropagation()}>
        <div className="im-modal__header">
          <span>{title}</span>
          <button type="button" className="im-modal__close" onClick={onClose}>x</button>
        </div>
        <div className="im-modal__search" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            className="im-field__input"
            style={{ maxWidth: "260px" }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
          />
          {loading && <span style={{ fontSize: "12px", color: "#666" }}>Loading...</span>}
        </div>
        <div className="im-modal__body">
          {rows.length === 0 ? (
            <div className="im-modal__empty">No matching records found.</div>
          ) : (
            <table className="im-lookup-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.code || row.CardCode || row.ItemCode || index}
                    className="im-lookup-table__row"
                    onDoubleClick={() => onSelect(row)}
                    onClick={() => onSelect(row)}
                  >
                    {columns.map((column) => (
                      <td key={column.key}>{row[column.key] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="im-modal__footer">
          <button type="button" className="im-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
