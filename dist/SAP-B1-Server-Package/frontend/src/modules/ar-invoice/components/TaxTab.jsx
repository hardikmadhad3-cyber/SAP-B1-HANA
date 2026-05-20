import React from 'react';

export default function TaxTab({ onOpenTaxInfoModal, isEditable = true }) {
  return (
    <div className="del-tab-panel">
      <div className="del-field-grid">
        {/* Tax Information Button */}
        <div className="del-field" style={{ gridColumn: '1 / -1' }}>
          <label className="del-field__label"></label>
          <div style={{ flex: 1 }}>
            <button type="button" className="del-btn del-btn--primary" onClick={onOpenTaxInfoModal} disabled={!isEditable}>
              Tax Information
            </button>
          </div>
        </div>

        {/* Transaction Category */}
        <div className="del-field">
          <label className="del-field__label">Transaction Category</label>
          <select className="del-field__select" disabled={!isEditable}>
            <option value="">— Select —</option>
            <option>B2B</option>
            <option>B2C</option>
            <option>Export</option>
            <option>SEZ</option>
          </select>
        </div>

        {/* Form No. */}
        <div className="del-field">
          <label className="del-field__label">Form No.</label>
          <input className="del-field__input" disabled={!isEditable} />
        </div>

        {/* Duty Status */}
        <div className="del-field">
          <label className="del-field__label">Duty Status</label>
          <select className="del-field__select" disabled={!isEditable}>
            <option value="">— Select —</option>
            <option>Paid</option>
            <option>Unpaid</option>
            <option>Exempted</option>
          </select>
        </div>

        {/* Differential % of Tax Rate */}
        <div className="del-field">
          <label className="del-field__label">Differential % of Tax Rate</label>
          <select className="del-field__select" disabled={!isEditable}>
            <option value="100">100</option>
            <option value="75">75</option>
            <option value="50">50</option>
            <option value="25">25</option>
          </select>
        </div>

        {/* Export Checkbox */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
          <span style={{ width: '110px' }}></span>
          <input type="checkbox" id="exportCheck" style={{ cursor: 'pointer' }} disabled={!isEditable} />
          <label htmlFor="exportCheck" style={{ cursor: 'pointer', margin: 0, fontSize: 12 }}>
            Export
          </label>
        </div>

        {/* Supply Covered under Sec 2 of IGST Act Checkbox */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
          <span style={{ width: '110px' }}></span>
          <input type="checkbox" id="supplyCoveredCheck" style={{ cursor: 'pointer' }} disabled={!isEditable} />
          <label htmlFor="supplyCoveredCheck" style={{ cursor: 'pointer', margin: 0, fontSize: 12 }}>
            Supply Covered under Sec 2 of IGST Act
          </label>
        </div>
      </div>
    </div>
  );
}
