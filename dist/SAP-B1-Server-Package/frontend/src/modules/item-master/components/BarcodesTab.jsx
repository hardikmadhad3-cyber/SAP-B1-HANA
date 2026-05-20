import React from "react";

/**
 * Barcodes tab — ItemBarCodeCollection
 * props:
 *   barcodes: [{ Barcode, UoMEntry, Quantity }]
 *   onChange(newBarcodes)
 */
export default function BarcodesTab({ barcodes = [], onChange }) {
  const addRow = () =>
    onChange([...barcodes, { Barcode: "", UoMEntry: "", Quantity: 1 }]);

  const removeRow = (i) =>
    onChange(barcodes.filter((_, idx) => idx !== i));

  const updateRow = (i, field, value) => {
    const updated = barcodes.map((row, idx) =>
      idx === i ? { ...row, [field]: value } : row
    );
    onChange(updated);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="im-section-title" style={{ marginBottom: 0 }}>Barcodes</div>
        <button type="button" className="im-btn im-btn--primary" onClick={addRow}>+ Add Row</button>
      </div>

      {barcodes.length === 0 ? (
        <div className="im-tab-placeholder">No barcodes defined. Click "+ Add Row" to add one.</div>
      ) : (
        <div className="im-grid-wrap">
          <table className="im-grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Barcode</th>
                <th>UoM Entry</th>
                <th className="im-grid__cell--num">Quantity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {barcodes.map((row, i) => (
                <tr key={i}>
                  <td className="im-grid__cell--muted">{i + 1}</td>
                  <td>
                    <input className="im-grid__input" style={{ textAlign: "left" }}
                      value={row.Barcode || ""}
                      onChange={(e) => updateRow(i, "Barcode", e.target.value)} />
                  </td>
                  <td>
                    <input className="im-grid__input im-grid__input--sm" style={{ textAlign: "left" }}
                      type="number" value={row.UoMEntry || ""}
                      onChange={(e) => updateRow(i, "UoMEntry", e.target.value)} />
                  </td>
                  <td>
                    <input className="im-grid__input im-grid__input--sm" type="number"
                      value={row.Quantity ?? 1}
                      onChange={(e) => updateRow(i, "Quantity", e.target.value)} />
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
