import React from 'react';

export default function TaxTab({ onOpenTaxInfoModal }) {
  return (
    <div className="so-tab-panel">
      <div className="so-field-grid">
        {/* Tax Information Button */}
        <div className="so-field" style={{ gridColumn: '1 / -1' }}>
          <label className="so-field__label"></label>
          <div style={{ flex: 1 }}>
            <button type="button" className="so-btn so-btn--primary" onClick={onOpenTaxInfoModal}>
              Tax Information
            </button>
          </div>
        </div>

        {/* Transaction Category */}
        <div className="so-field">
          <label className="so-field__label">Transaction Category</label>
          <select className="so-field__select">
            <option value="">— Select —</option>
            <option>B2B</option>
            <option>B2C</option>
            <option>Export</option>
            <option>SEZ</option>
          </select>
        </div>

        {/* Form No. */}
        <div className="so-field">
          <label className="so-field__label">Form No.</label>
          <input className="so-field__input" />
        </div>

        {/* Duty Status */}
        <div className="so-field">
          <label className="so-field__label">Duty Status</label>
          <select className="so-field__select">
            <option value="">— Select —</option>
            <option>With Payment of Duty</option>
            <option>Without Payment of Duty</option>
            <option>Exempted</option>
          </select>
        </div>

        {/* Differential % of Tax Rate */}
        <div className="so-field">
          <label className="so-field__label">Differential % of Tax Rate</label>
          <select className="so-field__select">
            <option value="100">100</option>
            <option value="75">75</option>
            <option value="50">50</option>
            <option value="25">25</option>
          </select>
        </div>

        {/* Export Checkbox */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
          <span style={{ width: '110px' }}></span>
          <input type="checkbox" id="exportCheck" style={{ cursor: 'pointer' }} />
          <label htmlFor="exportCheck" style={{ cursor: 'pointer', margin: 0, fontSize: 12 }}>
            Export
          </label>
        </div>

        {/* Supply Covered under Sec 2 of IGST Act Checkbox */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
          <span style={{ width: '110px' }}></span>
          <input type="checkbox" id="supplyCoveredCheck" style={{ cursor: 'pointer' }} />
          <label htmlFor="supplyCoveredCheck" style={{ cursor: 'pointer', margin: 0, fontSize: 12 }}>
            Supply Covered under Sec 2 of IGST Act
          </label>
        </div>
      </div>
    </div>
  );
}
