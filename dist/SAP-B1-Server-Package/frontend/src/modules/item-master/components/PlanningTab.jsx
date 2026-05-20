import React from "react";

export default function PlanningTab({ form, onChange }) {
  return (
    <div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Planning Method</label>
          <select className="im-field__select" name="PlanningSystem" value={form.PlanningSystem || "bop_None"} onChange={onChange}>
            <option value="bop_None">None</option>
            <option value="bop_MRP">MRP</option>
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Procurement Method</label>
          <select className="im-field__select" name="ProcurementMethod" value={form.ProcurementMethod || "bom_Buy"} onChange={onChange}>
            <option value="bom_Buy">Buy</option>
            <option value="bom_Make">Make</option>
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Order Interval</label>
          <input className="im-field__input" name="OrderIntervals" type="number" value={form.OrderIntervals || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Order Multiple</label>
          <input className="im-field__input" name="OrderMultiple" type="number" value={form.OrderMultiple || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Minimum Order Qty</label>
          <input className="im-field__input" name="MinOrderQuantity" type="number" value={form.MinOrderQuantity || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Lead Time</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input className="im-field__input" name="LeadTime" type="number" value={form.LeadTime || ""} onChange={onChange} />
            <span style={{ fontSize: 12, color: "#666" }}>Days</span>
          </div>
        </div>

        <div className="im-field">
          <label className="im-field__label">Tolerance Days</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input className="im-field__input" name="ToleranceDays" type="number" value={form.ToleranceDays || ""} onChange={onChange} />
            <span style={{ fontSize: 12, color: "#666" }}>Days</span>
          </div>
        </div>

      </div>
    </div>
  );
}
