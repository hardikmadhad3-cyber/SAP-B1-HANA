import React from "react";

/**
 * UoMLinesTab — manages the UnitOfMeasurementGroupLines collection.
 *
 * SAP B1 /UnitOfMeasurementGroups lines fields (exact Service Layer names):
 *   AlternateUoM   — integer (AbsEntry of UnitOfMeasurements)
 *   BaseQuantity   — decimal — qty of base UoM
 *   AlternateQuantity — decimal — qty of alternate UoM
 *   UoMType        — BoUoMTypeEnum: uomtSales | uomtPurchasing | uomtInventory | uomtAdditional
 */

const UOM_TYPES = [
  { value: "uomtSales",      label: "Sales" },
  { value: "uomtPurchasing", label: "Purchasing" },
  { value: "uomtInventory",  label: "Inventory" },
  { value: "uomtAdditional", label: "Additional" },
];

const EMPTY_LINE = {
  AlternateUoM:       "",
  AlternateUoMCode:   "",   // display only — not sent to SAP
  BaseQuantity:       "1",
  AlternateQuantity:  "1",
  UoMType:            "uomtSales",
};

export default function UoMLinesTab({ form, setForm, uomOptions }) {
  const lines = form.UnitOfMeasurementGroupLines || [];

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      UnitOfMeasurementGroupLines: [...lines, { ...EMPTY_LINE }],
    }));
  };

  const removeLine = (idx) => {
    setForm((prev) => ({
      ...prev,
      UnitOfMeasurementGroupLines: lines.filter((_, i) => i !== idx),
    }));
  };

  const updateLine = (idx, field, value) => {
    setForm((prev) => {
      const updated = prev.UnitOfMeasurementGroupLines.map((l, i) =>
        i === idx ? { ...l, [field]: value } : l
      );
      return { ...prev, UnitOfMeasurementGroupLines: updated };
    });
  };

  const handleUoMSelect = (idx, e) => {
    const absEntry = e.target.value;
    const opt = uomOptions.find((u) => u.code === absEntry);
    updateLine(idx, "AlternateUoM", absEntry ? Number(absEntry) : "");
    updateLine(idx, "AlternateUoMCode", opt?.uomCode || "");
  };

  return (
    <div>
      <div className="im-section-title">
        Alternate UoM Lines
        <button
          type="button"
          className="im-btn"
          style={{ marginLeft: 12, padding: "2px 10px", fontSize: 11 }}
          onClick={addLine}
        >
          + Add Row
        </button>
      </div>

      {lines.length === 0 ? (
        <div className="im-tab-placeholder">
          No alternate UoMs defined. Click "+ Add Row" to add one.
        </div>
      ) : (
        <div className="im-grid-wrap">
          <table className="im-grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Alternate UoM</th>
                <th>Base Qty</th>
                <th>Alt. Qty</th>
                <th>Factor (Alt/Base)</th>
                <th>UoM Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const factor =
                  line.BaseQuantity && line.AlternateQuantity && Number(line.BaseQuantity) !== 0
                    ? (Number(line.AlternateQuantity) / Number(line.BaseQuantity)).toFixed(6)
                    : "";
                return (
                  <tr key={idx}>
                    <td className="im-grid__cell--muted" style={{ width: 32, textAlign: "center" }}>
                      {idx + 1}
                    </td>

                    {/* AlternateUoM — AbsEntry integer of UnitOfMeasurements */}
                    <td style={{ minWidth: 160 }}>
                      <select
                        className="im-field__select"
                        style={{ width: "100%", height: 22 }}
                        value={line.AlternateUoM !== "" ? String(line.AlternateUoM) : ""}
                        onChange={(e) => handleUoMSelect(idx, e)}
                      >
                        <option value="">-- Select UoM --</option>
                        {uomOptions.map((u) => (
                          <option key={u.code} value={u.code}>{u.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* BaseQuantity */}
                    <td style={{ width: 90 }}>
                      <input
                        className="im-grid__input"
                        type="number"
                        min="0"
                        step="0.0001"
                        value={line.BaseQuantity}
                        onChange={(e) => updateLine(idx, "BaseQuantity", e.target.value)}
                      />
                    </td>

                    {/* AlternateQuantity */}
                    <td style={{ width: 90 }}>
                      <input
                        className="im-grid__input"
                        type="number"
                        min="0"
                        step="0.0001"
                        value={line.AlternateQuantity}
                        onChange={(e) => updateLine(idx, "AlternateQuantity", e.target.value)}
                      />
                    </td>

                    {/* Computed factor — read-only display */}
                    <td className="im-grid__cell--num im-grid__cell--muted" style={{ width: 100 }}>
                      {factor}
                    </td>

                    {/* UoMType: BoUoMTypeEnum */}
                    <td style={{ minWidth: 120 }}>
                      <select
                        className="im-field__select"
                        style={{ width: "100%", height: 22 }}
                        value={line.UoMType || "uomtSales"}
                        onChange={(e) => updateLine(idx, "UoMType", e.target.value)}
                      >
                        {UOM_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </td>

                    <td style={{ width: 32, textAlign: "center" }}>
                      <button
                        type="button"
                        className="im-btn im-btn--danger"
                        style={{ padding: "1px 7px", fontSize: 11 }}
                        onClick={() => removeLine(idx)}
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: "#888" }}>
        Factor = Alternate Qty ÷ Base Qty. Base UoM is set in the header.
      </div>
    </div>
  );
}
