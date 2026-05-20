import React from "react";

const EMPTY_ROW = {
  Code: "",
  Name: "",
  BaseUoM: "",
  isNew: true,
};

export default function UoMGroupsGrid({ groups, setGroups, uomOptions, onOpenDefinition }) {
  // Ensure minimum 5 rows
  const displayRows = [...groups];
  while (displayRows.length < 5) {
    displayRows.push({ ...EMPTY_ROW });
  }

  const handleCellChange = (rowIndex, field, value) => {
    const newGroups = [...displayRows];
    newGroups[rowIndex] = {
      ...newGroups[rowIndex],
      [field]: value,
      isModified: !newGroups[rowIndex].isNew,
    };
    setGroups(newGroups);
  };

  const handleAddRow = () => {
    setGroups([...displayRows, { ...EMPTY_ROW }]);
  };

  return (
    <div className="uom-grid-section">
      <div className="uom-grid-wrap">
        <table className="uom-grid">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>#</th>
              <th style={{ width: "120px" }}>Code*</th>
              <th style={{ width: "300px" }}>Name*</th>
              <th style={{ width: "200px" }}>Base UoM*</th>
              <th style={{ width: "80px" }}>...</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => (
              <tr key={idx}>
                <td className="uom-grid__cell--center">{idx + 1}</td>
                <td>
                  <input
                    className="uom-grid__input"
                    value={row.Code || ""}
                    onChange={(e) => handleCellChange(idx, "Code", e.target.value)}
                    maxLength={8}
                    placeholder="Max 8 chars"
                    readOnly={!row.isNew}
                  />
                </td>
                <td>
                  <input
                    className="uom-grid__input"
                    value={row.Name || ""}
                    onChange={(e) => handleCellChange(idx, "Name", e.target.value)}
                    maxLength={50}
                    placeholder="Group name"
                  />
                </td>
                <td>
                  <select
                    className="uom-grid__select"
                    value={row.BaseUoM || ""}
                    onChange={(e) => handleCellChange(idx, "BaseUoM", e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {uomOptions.map((uom) => (
                      <option key={uom.code} value={uom.code}>
                        {uom.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="uom-grid__cell--center">
                  {row.AbsEntry && (
                    <button
                      className="uom-grid__def-btn"
                      onClick={() => onOpenDefinition(row)}
                      title="Group Definition"
                    >
                      ...
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="uom-grid-actions">
        <button className="uom-btn uom-btn--small" onClick={handleAddRow}>
          + Add Row
        </button>
      </div>
    </div>
  );
}
