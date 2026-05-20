import React from "react";

export default function GeneralTab({ form, onChange }) {
  return (
    <div>
      <div className="im-section-title">General Information</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Foreign Name</label>
          {/* BPLNameForeign: string */}
          <input
            className="im-field__input"
            name="BPLNameForeign"
            value={form.BPLNameForeign || ""}
            onChange={onChange}
            tabIndex={3}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">VAT Reg. No.</label>
          {/* VATRegNum: string — VAT registration number */}
          <input
            className="im-field__input"
            name="VATRegNum"
            value={form.VATRegNum || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Rep. Name</label>
          {/* RepName: string — representative name */}
          <input
            className="im-field__input"
            name="RepName"
            value={form.RepName || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Industry</label>
          {/* Industry: string */}
          <input
            className="im-field__input"
            name="Industry"
            value={form.Industry || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Disabled</label>
          {/* Disabled: BoYesNoEnum */}
          <select
            className="im-field__select"
            name="Disabled"
            value={form.Disabled || "tNO"}
            onChange={onChange}
          >
            <option value="tNO">No</option>
            <option value="tYES">Yes</option>
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Default Warehouse</label>
          {/* DefaultWarehouseCode: string */}
          <input
            className="im-field__input"
            name="DefaultWarehouseCode"
            value={form.DefaultWarehouseCode || ""}
            onChange={onChange}
            placeholder="Warehouse Code"
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Custom 1</label>
          {/* Custom1: string — user-defined field */}
          <input
            className="im-field__input"
            name="Custom1"
            value={form.Custom1 || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Custom 2</label>
          <input
            className="im-field__input"
            name="Custom2"
            value={form.Custom2 || ""}
            onChange={onChange}
          />
        </div>

      </div>
    </div>
  );
}
