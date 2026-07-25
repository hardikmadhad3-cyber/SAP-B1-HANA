import React from 'react';

function ReadOnlyField({ label, value = '' }) {
  return (
    <div className="po-field">
      <label className="po-field__label">{label}</label>
      <input className="po-field__input" value={value} readOnly />
    </div>
  );
}

export default function ElectronicDocumentsTab({ isEditable = true }) {
  return (
    <div className="po-tab-panel po-sapb1-tab-panel po-sapb1-edoc-tab">
      <div className="po-sapb1-tab-surface">
        <div className="po-sapb1-edoc-section">
          <h6 className="po-sapb1-section-heading">E-Way Bill</h6>
          <ReadOnlyField label="eDoc Generation Type" value="Not Relevant" />
          <ReadOnlyField label="eDoc Format" />
          <ReadOnlyField label="Documents Mapping Determination" value="Double-click to open" />
          <ReadOnlyField label="Document Status" />
          <div className="po-field">
            <label className="po-field__label">E-Way Bill Details</label>
            <button type="button" className="po-btn po-sapb1-ellipsis-btn" disabled={!isEditable}>...</button>
          </div>
        </div>

        <div className="po-sapb1-edoc-section po-sapb1-edoc-generic">
          <h6 className="po-sapb1-section-heading">Generic eDoc Protocol</h6>
          <ReadOnlyField label="eDoc Format" />
          <ReadOnlyField label="Document Status" />
          <ReadOnlyField label="Total of Imported Document" value="0.00000 INR" />
          <ReadOnlyField label="Date Received" />
        </div>
      </div>
    </div>
  );
}
