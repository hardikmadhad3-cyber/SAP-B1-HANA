import React from "react";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const modalStyle = {
  width: "min(900px, calc(100vw - 32px))",
  maxHeight: "min(80vh, 720px)",
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const closeButtonStyle = {
  border: "none",
  background: "transparent",
  fontSize: "18px",
  cursor: "pointer",
  color: "#475569",
};

const tableWrapStyle = {
  overflow: "auto",
};

const cellStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
  fontSize: "14px",
};

const rowStyle = {
  cursor: "pointer",
};

export default function FindResultsModal({
  open,
  title = "Find Results",
  columns = [],
  rows = [],
  onClose,
  onSelect,
  getRowKey,
}) {
  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <strong>{title}</strong>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
            x
          </button>
        </div>

        <div style={{ padding: "12px 16px", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
          Multiple matches found. Select the record you want to open.
        </div>

        <div style={tableWrapStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {columns.map((column) => (
                  <th key={column.key} style={cellStyle}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={getRowKey ? getRowKey(row, index) : index}
                  style={rowStyle}
                  onClick={() => onSelect(row)}
                  onDoubleClick={() => onSelect(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} style={cellStyle}>
                      {row[column.key] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
