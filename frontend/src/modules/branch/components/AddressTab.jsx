import React from "react";

export default function AddressTab({ form, onChange }) {
  return (
    <div>
      <div className="im-section-title">Address</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Street</label>
          {/* AddressType / Street: SAP B1 BusinessPlaces address fields */}
          <input className="im-field__input" name="Street" value={form.Street || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Street No.</label>
          <input className="im-field__input" name="StreetNo" value={form.StreetNo || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Block</label>
          <input className="im-field__input" name="Block" value={form.Block || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Building</label>
          <input className="im-field__input" name="Building" value={form.Building || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">City</label>
          <input className="im-field__input" name="City" value={form.City || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Zip Code</label>
          <input className="im-field__input" name="ZipCode" value={form.ZipCode || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">County</label>
          <input className="im-field__input" name="County" value={form.County || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">State</label>
          <input className="im-field__input" name="State" value={form.State || ""} onChange={onChange} placeholder="e.g. CA" />
        </div>

        <div className="im-field">
          <label className="im-field__label">Country</label>
          <input className="im-field__input" name="Country" value={form.Country || ""} onChange={onChange} placeholder="e.g. US" />
        </div>

      </div>

      <div className="im-section-title" style={{ marginTop: 14 }}>Contact</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Phone</label>
          <input className="im-field__input" name="Phone" value={form.Phone || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Fax</label>
          <input className="im-field__input" name="Fax" value={form.Fax || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Email</label>
          <input className="im-field__input" name="Email" value={form.Email || ""} onChange={onChange} />
        </div>

      </div>
    </div>
  );
}
