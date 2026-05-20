import React from 'react';

export default function ElectronicDocumentsTab() {
  return (
    <div className="del-tab-panel">
      <h6 className="del-section-title">E-Way Bill</h6>
      <div className="del-field-grid">
        <div className="del-field">
          <label className="del-field__label">eDoc Generation Type</label>
          <select className="del-field__select">
            <option value="Not Relevant">Not Relevant</option>
            <option value="Manual">Manual</option>
            <option value="Automatic">Automatic</option>
          </select>
        </div>
        <div className="del-field">
          <label className="del-field__label">eDoc Format</label>
          <select className="del-field__select">
            <option value="">— Select —</option>
            <option>JSON</option>
            <option>XML</option>
          </select>
        </div>
        <div className="del-field">
          <label className="del-field__label">Documents Mapping Determination</label>
          <input
            className="del-field__input"
            value="Double-click to open"
            readOnly
            style={{ background: '#f5f5f5' }}
          />
        </div>
        <div className="del-field">
          <label className="del-field__label">Document Status</label>
          <input className="del-field__input" readOnly style={{ background: '#f5f5f5' }} />
        </div>
        <div className="del-field" style={{ gridColumn: '1 / -1' }}>
          <button type="button" className="del-btn del-btn--primary">
            E-Way Bill Details ...
          </button>
        </div>
      </div>
    </div>
  );
}

