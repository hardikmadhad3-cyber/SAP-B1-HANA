import React, { useState, useEffect, useRef } from "react";

/**
 * SAP-style lookup field: text input + "..." button that opens a search modal.
 * Props:
 *   name, value, onChange  — standard field props
 *   displayValue           — human-readable label shown next to the code
 *   onSelect(row)          — called when user picks a row; row = { code, name }
 *   fetchOptions(query)    — async fn returning [{ code, name }]
 *   placeholder
 *   readOnly
 */
export default function LookupField({
  name,
  value = "",
  onChange,
  displayValue = "",
  onSelect,
  fetchOptions,
  columns = [
    { label: "Code", key: "code" },
    { label: "Name", key: "name" },
  ],
  placeholder = "",
  readOnly = false,
  allowManualEntry = true,
  style = {},
  onDefineNew, // New prop: callback to open setup modal
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const searchRef             = useRef(null);

  const openModal = async () => {
    if (readOnly) return;
    setOpen(true);
    setQuery("");
    setSelectedIdx(-1);
    await load("");
  };

  const load = async (q) => {
    setLoading(true);
    try {
      const data = await fetchOptions(q);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const handleSearch = (e) => {
    const q = e.target.value;
    setQuery(q);
    load(q);
  };

  const handlePick = (row) => {
    onSelect(row);
    setOpen(false);
  };

  const handleChoose = () => {
    if (selectedIdx >= 0 && rows[selectedIdx]) {
      handlePick(rows[selectedIdx]);
    }
  };

  const handleDefineNew = () => {
    setOpen(false);
    if (onDefineNew) onDefineNew();
  };

  return (
    <>
      <div className="im-lookup-wrap">
        <input
          className="im-field__input"
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly || !allowManualEntry}
          style={style}
        />
        {displayValue && (
          <span className="im-lookup-display">{displayValue}</span>
        )}
        {!readOnly && (
          <button
            type="button"
            className="im-lookup-btn"
            onClick={openModal}
            title="Browse"
          >
            …
          </button>
        )}
      </div>

      {open && (
        <div className="im-modal-overlay" onClick={() => setOpen(false)}>
          <div className="im-modal im-modal--cfl" onClick={(e) => e.stopPropagation()}>
            <div className="im-modal__header">
              <span>List of {placeholder || name}</span>
              <button className="im-modal__close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="im-modal__search" style={{ background: "#f5f5f5", borderBottom: "1px solid #c8d0da" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: 12 }}>Find</span>
                <input
                  ref={searchRef}
                  className="im-field__input"
                  style={{ width: "200px", background: "#FFFFCC" }}
                  value={query}
                  onChange={handleSearch}
                />
              </div>
            </div>
            <div className="im-modal__body">
              {loading ? (
                <div className="im-modal__empty">Loading...</div>
              ) : (
                <table className="im-lookup-table">
                  <thead>
                    <tr>
                      <th style={{ width: "30px", textAlign: "center" }}>#</th>
                      {columns.map((col, idx) => (
                        <th key={idx}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length + 1} className="im-modal__empty" style={{ padding: "40px", color: "#666" }}>
                          No records found in SAP. 
                          <br/>
                          <small>Please check if HSN/SAC codes are defined in your SAP database.</small>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`im-lookup-table__row ${selectedIdx === idx ? "selected" : ""}`}
                          onClick={() => setSelectedIdx(idx)}
                          onDoubleClick={() => handlePick(row)}
                          style={selectedIdx === idx ? { background: "#FFFFCC" } : {}}
                        >
                          <td style={{ textAlign: "center", color: "#666" }}>{idx + 1}</td>
                          {columns.map((col, cIdx) => (
                            <td key={cIdx}>{row[col.key]}</td>
                          ))}
                        </tr>
                      ))
                    )}
                    {onDefineNew && (
                      <tr
                        className="im-lookup-table__row im-lookup-table__row--define-new"
                        onClick={handleDefineNew}
                      >
                        <td colSpan={columns.length + 1} style={{ color: "#005a9e", fontWeight: "bold" }}>
                          Define New...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <div className="im-modal__footer">
              <button 
                type="button" 
                className="im-btn im-btn--primary" 
                onClick={handleChoose}
                disabled={selectedIdx === -1}
              >
                Choose
              </button>
              <button 
                type="button" 
                className="im-btn" 
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              {onDefineNew && (
                <button 
                  type="button" 
                  className="im-btn" 
                  onClick={handleDefineNew}
                >
                  New
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
