import React, { useEffect, useState } from "react";
import { fetchItemProperties } from "../../../api/itemApi";

const TOTAL = 64;

// Build fallback list in case API is slow / fails
const fallback = Array.from({ length: TOTAL }, (_, i) => ({
  number: i + 1,
  name: `Property ${i + 1}`,
}));

export default function PropertiesTab({ form, onChange }) {
  const [properties, setProperties] = useState(fallback);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetchItemProperties()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setProperties(data);
      })
      .catch(() => {/* keep fallback */})
      .finally(() => setLoading(false));
  }, []);

  const handleCheck = (number, checked) => {
    onChange({
      target: {
        name:  `Properties${number}`,
        value: checked ? "tYES" : "tNO",
        type:  "select",
      },
    });
  };

  const handleSelectAll = () => {
    for (let i = 1; i <= TOTAL; i++) {
      onChange({ target: { name: `Properties${i}`, value: "tYES", type: "select" } });
    }
  };

  const handleClearAll = () => {
    for (let i = 1; i <= TOTAL; i++) {
      onChange({ target: { name: `Properties${i}`, value: "tNO", type: "select" } });
    }
  };

  // Count how many are checked
  const checkedCount = properties.filter((p) => form[`Properties${p.number}`] === "tYES").length;

  return (
    <div>
      <div className="im-section-title">
        Item Properties
        {!loading && (
          <span style={{ fontWeight: "normal", fontSize: 12, marginLeft: 8, color: "#666" }}>
            {checkedCount} selected
          </span>
        )}
      </div>

      <div className="im-props-toolbar">
        <button type="button" className="im-btn" onClick={handleSelectAll}>Select All</button>
        <button type="button" className="im-btn" onClick={handleClearAll}>Clear All</button>
      </div>

      {loading ? (
        <div style={{ padding: 16, color: "#888" }}>Loading property names...</div>
      ) : (
        <div className="im-props-grid">
          {properties.map(({ number, name }) => {
            const key     = `Properties${number}`;
            const checked = form[key] === "tYES";
            return (
              <label
                key={key}
                className={`im-prop-item${checked ? " im-prop-item--checked" : ""}`}
                title={`SAP field: ${key}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => handleCheck(number, e.target.checked)}
                />
                <span className="im-prop-num">{number}</span>
                <span className="im-prop-name">{name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
