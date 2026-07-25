import React, { useState, useEffect } from "react";
import { getUoMGroup, updateUoMGroup } from "../../../api/uomGroupApi";

const EMPTY_LINE = {
  AlternateUoM: "",
  BaseQuantity: 1,
  AlternateQuantity: 1,
};

export default function GroupDefinitionModal({ group, uomOptions, onClose, onSave }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadGroupDefinition();
  }, [group.AbsEntry]);

  const loadGroupDefinition = async () => {
    try {
      const data = await getUoMGroup(group.AbsEntry);
      const existingLines = data.UoMGroupDefinitionCollection || [];
      setLines(existingLines.length > 0 ? existingLines : [{ ...EMPTY_LINE }]);
    } catch (err) {
      console.error("Failed to load definition:", err);
      setLines([{ ...EMPTY_LINE }]);
    }
  };

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleCellChange = (rowIndex, field, value) => {
    const newLines = [...lines];
    newLines[rowIndex] = { ...newLines[rowIndex], [field]: value };
    setLines(newLines);
  };

  const handleAddRow = () => {
    setLines([...lines, { ...EMPTY_LINE }]);
  };

  const handleDeleteRow = (rowIndex) => {
    setLines(lines.filter((_, idx) => idx !== rowIndex));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const filledLines = lines.filter((l) => l.AlternateUoM);
      
      await updateUoMGroup(group.AbsEntry, {
        UoMGroupDefinitionCollection: filledLines.map((l) => ({
          AlternateUoM: parseInt(l.AlternateUoM),
          BaseQuantity: parseFloat(l.BaseQuantity) || 1,
          AlternateQuantity: parseFloat(l.AlternateQuantity) || 1,
        })),
      });

      showAlert("success", "Group Definition saved successfully.");
      setTimeout(() => {
        onSave();
        onClose();
      }, 1000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to save definition.";
      showAlert("error", msg);
    } finally {
      setLoading(false);
    }
  };

  // Ensure minimum 3 rows
  const displayLines = [...lines];
  while (displayLines.length < 3) {
    displayLines.push({ ...EMPTY_LINE });
  }

  return (
    <div className="uom-modal-overlay" onClick={onClose}>
      <div className="uom-modal" onClick={(e) => e.stopPropagation()}>
        <div className="uom-modal__header">
          <span>Units of Measure - Setup [Group: {group.Code}]</span>
          <button className="uom-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        {alert && <div className={`uom-alert uom-alert--${alert.type}`}>{alert.msg}</div>}

        <div className="uom-modal__body">
          <div className="uom-def-grid-wrap">
            <table className="uom-def-grid">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th style={{ width: "200px" }}>Alternate UoM*</th>
                  <th style={{ width: "120px" }}>Base Quantity</th>
                  <th style={{ width: "120px" }}>Alternate Quantity</th>
                  <th style={{ width: "60px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayLines.map((line, idx) => (
                  <tr key={idx}>
                    <td className="uom-grid__cell--center">{idx + 1}</td>
                    <td>
                      <select
                        className="uom-def-grid__select"
                        value={line.AlternateUoM || ""}
                        onChange={(e) => handleCellChange(idx, "AlternateUoM", e.target.value)}
                      >
                        <option value="">-- Select --</option>
                        {uomOptions.map((uom) => (
                          <option key={uom.code} value={uom.code}>
                            {uom.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="uom-def-grid__input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.BaseQuantity || ""}
                        onChange={(e) => handleCellChange(idx, "BaseQuantity", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="uom-def-grid__input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.AlternateQuantity || ""}
                        onChange={(e) => handleCellChange(idx, "AlternateQuantity", e.target.value)}
                      />
                    </td>
                    <td className="uom-grid__cell--center">
                      <button
                        className="uom-def-grid__delete-btn"
                        onClick={() => handleDeleteRow(idx)}
                        title="Delete Row"
                      >
                        ✕
                      </button>
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

        <div className="uom-modal__footer">
          <button className="uom-btn uom-btn--primary" onClick={handleSave} disabled={loading}>
            {loading ? "..." : "OK"}
          </button>
          <button className="uom-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
