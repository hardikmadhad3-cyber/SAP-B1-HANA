import React from "react";
import LookupField from "./LookupField";

/**
 * Preferred Vendors tab — ItemPreferredVendors collection
 * props:
 *   vendors: [{ VendorCode, VendorName, Priority }]
 *   onChange(newVendors)
 *   fetchVendors(query) — lookup function
 */
export default function PreferredVendorsTab({ vendors = [], onChange, fetchVendors }) {
  const addRow = () =>
    onChange([...vendors, { VendorCode: "", VendorName: "", Priority: vendors.length + 1 }]);

  const removeRow = (i) => onChange(vendors.filter((_, idx) => idx !== i));

  const updateRow = (i, field, value) =>
    onChange(vendors.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const handleVendorSelect = (i) => (row) => {
    onChange(vendors.map((v, idx) =>
      idx === i ? { ...v, VendorCode: row.code, VendorName: row.name } : v
    ));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="im-section-title" style={{ marginBottom: 0 }}>Preferred Vendors</div>
        <button type="button" className="im-btn im-btn--primary" onClick={addRow}>+ Add Row</button>
      </div>

      {vendors.length === 0 ? (
        <div className="im-tab-placeholder">No preferred vendors defined. Click "+ Add Row" to add one.</div>
      ) : (
        <div className="im-grid-wrap">
          <table className="im-grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Vendor Code</th>
                <th>Vendor Name</th>
                <th className="im-grid__cell--num">Priority</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((row, i) => (
                <tr key={i}>
                  <td className="im-grid__cell--muted">{i + 1}</td>
                  <td style={{ minWidth: 200 }}>
                    <LookupField
                      name={`vendor_code_${i}`}
                      value={row.VendorCode || ""}
                      displayValue={row.VendorName || ""}
                      onChange={(e) => updateRow(i, "VendorCode", e.target.value)}
                      onSelect={handleVendorSelect(i)}
                      fetchOptions={fetchVendors}
                      placeholder="Vendor"
                    />
                  </td>
                  <td className="im-grid__cell--muted">{row.VendorName || "—"}</td>
                  <td>
                    <input className="im-grid__input im-grid__input--sm" type="number"
                      value={row.Priority ?? i + 1}
                      onChange={(e) => updateRow(i, "Priority", e.target.value)} />
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
