import React from "react";

export default function AccountingTab({ form, onChange }) {
  return (
    <div>
      <div className="im-section-title">Tax &amp; Accounting</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Tax Office Name</label>
          {/* TaxOfficeName: string */}
          <input
            className="im-field__input"
            name="TaxOfficeName"
            value={form.TaxOfficeName || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Tax Office No.</label>
          {/* TaxOfficeNo: string */}
          <input
            className="im-field__input"
            name="TaxOfficeNo"
            value={form.TaxOfficeNo || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">GSTIN</label>
          {/* GSTIN: string — GST Identification Number (India) */}
          <input
            className="im-field__input"
            name="GSTIN"
            value={form.GSTIN || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">GSTType</label>
          {/* GSTType: BoGSTType SAP enum */}
          <select
            className="im-field__select"
            name="GSTType"
            value={form.GSTType || "gstRegular"}
            onChange={onChange}
          >
            <option value="gstRegular">Regular</option>
            <option value="gstComposition">Composition</option>
            <option value="gstUnregistered">Unregistered</option>
            <option value="gstConsumer">Consumer</option>
            <option value="gstOverseas">Overseas</option>
            <option value="gstSpecialEconomicZone">Special Economic Zone</option>
            <option value="gstDeemedExport">Deemed Export</option>
          </select>
        </div>

      </div>

      <div className="im-section-title" style={{ marginTop: 14 }}>Registration Numbers</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Company Reg. No.</label>
          {/* CompanyRegNo: string */}
          <input
            className="im-field__input"
            name="CompanyRegNo"
            value={form.CompanyRegNo || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Federal Tax ID</label>
          {/* FederalTaxID: string */}
          <input
            className="im-field__input"
            name="FederalTaxID"
            value={form.FederalTaxID || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Additional ID</label>
          {/* AdditionalID: string */}
          <input
            className="im-field__input"
            name="AdditionalID"
            value={form.AdditionalID || ""}
            onChange={onChange}
          />
        </div>

      </div>
    </div>
  );
}
