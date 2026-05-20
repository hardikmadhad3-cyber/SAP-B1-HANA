import React from "react";

const PROP_NAMES = Array.from({ length: 64 }, (_, i) => `Business Partners Property ${i + 1}`);

export default function PropertiesTab({ form, onChange }) {
  const selectAll = () => {
    for (let i = 1; i <= 64; i++) {
      onChange({ target: { type: "checkbox", name: `Properties${i}`, checked: true } });
    }
  };
  const clearAll = () => {
    for (let i = 1; i <= 64; i++) {
      onChange({ target: { type: "checkbox", name: `Properties${i}`, checked: false } });
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 0 }}>
        {/* Properties grid */}
        <div style={{ flex: 1 }}>
          <div className="im-grid-wrap" style={{ maxHeight: 380, overflowY: "auto" }}>
            <table className="im-grid" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Property Name</th>
                  <th style={{ width: 40, textAlign: "center" }}>✓</th>
                </tr>
              </thead>
              <tbody>
                {PROP_NAMES.map((name, i) => {
                  const propKey = `Properties${i + 1}`;
                  const checked = form[propKey] === "tYES";
                  return (
                    <tr key={i} style={{ background: checked ? "#eef4fb" : i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ color: "#999", fontSize: 11 }}>{i + 1}</td>
                      <td style={{ fontSize: 12 }}>{name}</td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          name={propKey}
                          checked={checked}
                          onChange={onChange}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {/* Buttons on right */}
        <div style={{ width: 120, paddingLeft: 12, paddingTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="im-btn" onClick={selectAll}>Select All</button>
          <button className="im-btn" onClick={clearAll}>Clear Selection</button>
        </div>
      </div>
    </div>
  );
}
