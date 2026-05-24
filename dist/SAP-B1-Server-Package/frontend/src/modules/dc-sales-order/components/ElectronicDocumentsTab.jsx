import React from 'react';

export default function ElectronicDocumentsTab() {
  return (
    <div className="so-tab-panel">
      <h6 className="so-section-title">E-Way Bill</h6>
      <div className="so-field-grid">
        <div className="so-field">
          <label className="so-field__label">eDoc Generation Type</label>
          <select className="so-field__select">
            <option value="Not Relevant">Not Relevant</option>
            <option value="Manual">Manual</option>
            <option value="Automatic">Automatic</option>
          </select>
        </div>
        <div className="so-field">
          <label className="so-field__label">eDoc Format</label>
          <select className="so-field__select">
            <option value="">— Select —</option>
            <option>JSON</option>
            <option>XML</option>
          </select>
        </div>
        <div className="so-field">
          <label className="so-field__label">Documents Mapping Determination</label>
          <input
            className="so-field__input"
            value="Double-click to open"
            readOnly
            style={{ background: '#f5f5f5' }}
          />
        </div>
        <div className="so-field">
          <label className="so-field__label">Document Status</label>
          <input className="so-field__input" readOnly style={{ background: '#f5f5f5' }} />
        </div>
        <div className="so-field" style={{ gridColumn: '1 / -1' }}>
          <button type="button" className="so-btn so-btn--primary">
            E-Way Bill Details ...
          </button>
        </div>
      </div>
    </div>
  );
}
