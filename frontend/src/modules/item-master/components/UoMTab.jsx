import React from "react";

/**
 * UoM Collection tab — ItemUnitOfMeasurementCollection
 * props:
 *   uoms: [{ AlternateUoM, BaseQuantity, AlternateQuantity, UoMType }]
 *   onChange(newUoms)
 */
export default function UoMTab({ uoms = [], onChange }) {
  const addRow = () =>
    onChange([...uoms, { AlternateUoM: "", BaseQuantity: 1, AlternateQuantity: 1, UoMType: "uomtPurchasing" }]);

  const removeRow = (i) => onChange(uoms.filter((_, idx) => idx !== i));

  const updateRow = (i, field, value) =>
    onChange(uoms.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="im-section-title" style={{ marginBottom: 0 }}>Unit of Measurement Conversions</div>
        <button type="button" className="im-btn im-btn--primary" onClick={addRow}>+ Add Row</button>
      </div>

      {uoms.length === 0 ? (
        <div className="im-tab-placeholder">No UoM conversions defined. Click "+ Add Row" to add one.</div>
      ) : (
        <div className="im-grid-wrap">
          <table className="im-grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Alternate UoM</th>
                <th className="im-grid__cell--num">Base Qty</th>
                <th className="im-grid__cell--num">Alt. Qty</th>
                <th>UoM Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {uoms.map((row, i) => (
                <tr key={i}>
                  <td className="im-grid__cell--muted">{i + 1}</td>
                  <td>
                    <input className="im-grid__input" style={{ textAlign: "left" }}
                      type="number" value={row.AlternateUoM || ""}
                      onChange={(e) => updateRow(i, "AlternateUoM", e.target.value)} />
                  </td>
                  <td>
                    <input className="im-grid__input" type="number" value={row.BaseQuantity ?? 1}
                      onChange={(e) => updateRow(i, "BaseQuantity", e.target.value)} />
                  </td>
                  <td>
                    <input className="im-grid__input" type="number" value={row.AlternateQuantity ?? 1}
                      onChange={(e) => updateRow(i, "AlternateQuantity", e.target.value)} />
                  </td>
                  <td>
                    <select style={{ fontSize: 11, height: 20 }} value={row.UoMType || "uomtPurchasing"}
                      onChange={(e) => updateRow(i, "UoMType", e.target.value)}>
                      <option value="uomtPurchasing">Purchasing</option>
                      <option value="uomtSales">Sales</option>
                      <option value="uomtInventory">Inventory</option>
                      <option value="uomtAdditional">Additional</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" className="im-btn im-btn--danger"
                      style={{ padding: "1px 8px", fontSize: 11 }}
                      onClick={() => removeRow(i)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
