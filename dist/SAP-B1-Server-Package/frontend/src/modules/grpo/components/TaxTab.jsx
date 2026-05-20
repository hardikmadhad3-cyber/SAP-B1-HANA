import React from 'react';

export default function TaxTab({ header, onHeaderChange, onOpenTaxInfoModal }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="po-section-title" style={{ marginBottom: 0 }}>Tax Details</div>
        <button type="button" className="po-btn po-btn--primary" onClick={onOpenTaxInfoModal}>Tax Information</button>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {/* LEFT */}
        <div style={{ flex: 1 }}>
          <div className="po-field">
            <label className="po-field__label">Tax Information</label>
            <input className="po-field__input" name="taxInformation" value={header.taxInformation} onChange={onHeaderChange} />
          </div>
          <div className="po-field">
            <label className="po-field__label">Transaction Category</label>
            <select className="po-field__select" name="transactionCategory" value={header.transactionCategory} onChange={onHeaderChange}>
              <option value="">Select</option>
              <option>B2B</option>
              <option>B2C</option>
              <option>Import</option>
              <option>Export</option>
              <option>SEZ</option>
            </select>
          </div>
          <div className="po-field">
            <label className="po-field__label">Form No.</label>
            <input className="po-field__input" name="formNo" value={header.formNo} onChange={onHeaderChange} />
          </div>
          <div className="po-field">
            <label className="po-field__label">Duty Status</label>
            <select className="po-field__select" name="dutyStatus" value={header.dutyStatus} onChange={onHeaderChange}>
              <option value="With Payment of Duty">With Payment of Duty</option>
              <option value="Without Payment of Duty">Without Payment of Duty</option>
              <option value="Exempted">Exempted</option>
            </select>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ flex: 1 }}>
          <div className="po-checkboxes" style={{ flexDirection: 'column', gap: 10 }}>
            <label className="po-checkbox-label">
              <input type="checkbox" name="importTax" checked={header.importTax} onChange={onHeaderChange} />
              Import Tax
            </label>
            <label className="po-checkbox-label">
              <input type="checkbox" name="supplyCovered" checked={header.supplyCovered} onChange={onHeaderChange} />
              Supply Covered under Sec 2 of IGST Act
            </label>
          </div>
          <div className="po-field" style={{ marginTop: 12 }}>
            <label className="po-field__label">Differential % of Tax Rate</label>
            <select className="po-field__select" name="differentialTaxRate" value={header.differentialTaxRate} onChange={onHeaderChange}>
              <option value="100">100</option>
              <option value="75">75</option>
              <option value="50">50</option>
              <option value="25">25</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
