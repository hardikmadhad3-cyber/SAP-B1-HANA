import React, { useState } from "react";
import { createItemGroup, fetchUoMGroups } from "../../../api/itemApi";
import LookupField from "./LookupField";

export default function ItemGroupSetup({ onClose, onSave, showAlert }) {
  const [tab, setTab] = useState(0); // 0: General, 1: Accounting
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    GroupName: "",
    DefaultUoMGroup: "",
    DefaultUoMGroupName: "",
    PlanningSystem: "bop_None",
    ProcurementMethod: "bom_Buy",
    OrderIntervals: "",
    OrderMultiple: "0.000",
    MinimumOrderQuantity: "0.000",
    LeadTime: "",
    ToleranceDays: "",
    CycleCode: "",
    Alert: "tNO",
    InventorySystem: "bis_MovingAverage",
    ItemClass: "itcMaterial",
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (checked ? "tYES" : "tNO") : value,
    }));
  };

  const handleSave = async () => {
    if (!form.GroupName.trim()) {
      showAlert("error", "Group Name is required.");
      return;
    }

    setLoading(true);
    try {
      const result = await createItemGroup(form);
      showAlert("success", `Item Group "${result.name}" created.`);
      onSave(result);
      onClose();
    } catch (err) {
      showAlert("error", err.response?.data?.message || "Failed to create Item Group.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="im-modal-overlay" onClick={onClose}>
      <div className="im-modal im-modal--setup" style={{ width: "600px", minHeight: "500px" }} onClick={(e) => e.stopPropagation()}>
        <div className="im-modal__header">
          <span>Item Groups - Setup</span>
          <button className="im-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* Header Field: Group Name */}
        <div className="im-modal__body" style={{ padding: "10px 20px" }}>
          <div className="im-field">
            <label className="im-field__label">Group Name</label>
            <input
              className="im-field__input"
              name="GroupName"
              value={form.GroupName}
              onChange={handleChange}
              autoFocus
              placeholder="Enter group name"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="im-tabs" style={{ margin: "0 20px" }}>
          <button className={`im-tab ${tab === 0 ? "im-tab--active" : ""}`} onClick={() => setTab(0)}>General</button>
          <button className={`im-tab ${tab === 1 ? "im-tab--active" : ""}`} onClick={() => setTab(1)}>Accounting</button>
        </div>

        <div className="im-modal__body" style={{ flex: 1, padding: "20px" }}>
          {tab === 0 && (
            <div className="im-setup-grid">
              <div className="im-field">
                <label className="im-field__label">Default UoM Group</label>
                <LookupField
                  name="DefaultUoMGroup"
                  value={form.DefaultUoMGroup}
                  displayValue={form.DefaultUoMGroupName}
                  fetchOptions={fetchUoMGroups}
                  onSelect={(r) => setForm(p => ({ ...p, DefaultUoMGroup: r.code, DefaultUoMGroupName: r.name }))}
                  onChange={handleChange}
                />
              </div>

              <div style={{ marginTop: 15 }}>
                <div className="im-field">
                  <label className="im-field__label">Planning Method</label>
                  <select className="im-field__select" name="PlanningSystem" value={form.PlanningSystem} onChange={handleChange}>
                    <option value="bop_None">None</option>
                    <option value="bop_MRP">MRP</option>
                  </select>
                </div>
                <div className="im-field">
                  <label className="im-field__label">Procurement Method</label>
                  <select className="im-field__select" name="ProcurementMethod" value={form.ProcurementMethod} onChange={handleChange}>
                    <option value="bom_Buy">Buy</option>
                    <option value="bom_Make">Make</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 15 }}>
                <div className="im-field">
                  <label className="im-field__label">Order Interval</label>
                  <input className="im-field__input" name="OrderIntervals" value={form.OrderIntervals} onChange={handleChange} />
                </div>
                <div className="im-field">
                  <label className="im-field__label">Order Multiple</label>
                  <input className="im-field__input" name="OrderMultiple" type="number" step="0.001" value={form.OrderMultiple} onChange={handleChange} />
                </div>
                <div className="im-field">
                  <label className="im-field__label">Minimum Order Qty</label>
                  <div style={{ display: "flex", gap: 5, flex: 1 }}>
                    <input className="im-field__input" name="MinimumOrderQuantity" type="number" step="0.001" value={form.MinimumOrderQuantity} onChange={handleChange} />
                    <span style={{ fontSize: 11, alignSelf: "center" }}>Inventory UoM</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 15 }}>
                <div className="im-field">
                  <label className="im-field__label">Lead Time</label>
                  <div style={{ display: "flex", gap: 5, flex: 1 }}>
                    <input className="im-field__input" name="LeadTime" type="number" value={form.LeadTime} onChange={handleChange} />
                    <span style={{ fontSize: 11, alignSelf: "center" }}>Days</span>
                  </div>
                </div>
                <div className="im-field">
                  <label className="im-field__label">Tolerance Days</label>
                  <div style={{ display: "flex", gap: 5, flex: 1 }}>
                    <input className="im-field__input" name="ToleranceDays" type="number" value={form.ToleranceDays} onChange={handleChange} />
                    <span style={{ fontSize: 11, alignSelf: "center" }}>Days</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 15 }}>
                <div className="im-field">
                  <label className="im-field__label">Cycle Code</label>
                  <select className="im-field__select" name="CycleCode" value={form.CycleCode} onChange={handleChange}>
                    <option value="">-- Select --</option>
                  </select>
                </div>
                <div className="im-field">
                  <label className="im-checkbox-label">
                    <input type="checkbox" name="Alert" checked={form.Alert === "tYES"} onChange={handleChange} />
                    Alert
                  </label>
                </div>
                <div className="im-field">
                  <label className="im-field__label">Default Valuation Method</label>
                  <select className="im-field__select" name="InventorySystem" value={form.InventorySystem} onChange={handleChange}>
                    <option value="bis_MovingAverage">Moving Average</option>
                    <option value="bis_Standard">Standard</option>
                    <option value="bis_FIFO">FIFO</option>
                  </select>
                </div>
              </div>

              <div className="im-field" style={{ marginTop: 15 }}>
                <label className="im-field__label">Item Category</label>
                <div style={{ display: "flex", gap: 20 }}>
                  <label className="im-checkbox-label">
                    <input type="radio" name="ItemClass" value="itcService" checked={form.ItemClass === "itcService"} onChange={handleChange} />
                    Service
                  </label>
                  <label className="im-checkbox-label">
                    <input type="radio" name="ItemClass" value="itcMaterial" checked={form.ItemClass === "itcMaterial"} onChange={handleChange} />
                    Material
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === 1 && (
            <div className="im-modal__empty">Accounting settings coming soon...</div>
          )}
        </div>

        <div className="im-modal__footer" style={{ justifyContent: "flex-start", gap: 8, padding: "10px 20px" }}>
          <button className="im-btn im-btn--primary" style={{ width: 80 }} onClick={handleSave} disabled={loading}>
            {loading ? "..." : "Add"}
          </button>
          <button className="im-btn" style={{ width: 80 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
