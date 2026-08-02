const TAX_FIELDS = [
  ['panNo', 'P.A.N. No.'],
  ['panCircleNo', 'P.A.N. Circle No.'],
  ['panWardNo', 'P.A.N. Ward No.'],
  ['panAssessingOfficer', 'P.A.N. Assessing Officer'],
  ['deducteeRefNo', 'Deductee Ref. No.'],
  ['lstVatNo', 'LST/VAT No.'],
  ['cstNo', 'CST No.'],
  ['tanNo', 'TAN No.'],
  ['serviceTaxNo', 'Service Tax No.'],
  ['companyType', 'Company Type'],
  ['natureOfBusiness', 'Nature of Business'],
  ['assesseeType', 'Assessee Type'],
  ['tinNo', 'TIN No.'],
];

export default function TaxInfoModal({ isOpen, onClose, onSave, taxInfoForm = {}, onFormChange }) {
  if (!isOpen) return null;

  return (
    <div className="ap-tax-info-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="ap-tax-info-window" role="dialog" aria-modal="true" aria-labelledby="ap-tax-info-title">
        <header className="ap-tax-info-titlebar">
          <span id="ap-tax-info-title">Tax Information</span>
          <button type="button" onClick={onClose} aria-label="Close Tax Information">×</button>
        </header>

        <div className="ap-tax-info-body">
          {TAX_FIELDS.map(([name, label]) => (
            <label className="ap-tax-info-field" key={name}>
              <span>{label}</span>
              <input name={name} value={taxInfoForm[name] || ''} onChange={onFormChange} />
            </label>
          ))}

          <label className="ap-tax-info-field">
            <span>GST Type</span>
            <select name="gstType" value={taxInfoForm.gstType || ''} onChange={onFormChange}>
              <option value="">— Select —</option>
              <option value="Regular/TDS/ISD">Regular/TDS/ISD</option>
              <option value="Composition">Composition</option>
              <option value="Casual Taxable Person">Casual Taxable Person</option>
              <option value="Unregistered">Unregistered</option>
            </select>
          </label>

          <label className="ap-tax-info-field">
            <span>GSTIN</span>
            <input name="gstin" value={taxInfoForm.gstin || ''} onChange={onFormChange} maxLength={15} />
          </label>
        </div>

        <footer className="ap-tax-info-footer">
          <button type="button" className="ap-tax-info-ok" onClick={onSave}>OK</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </footer>
      </section>
    </div>
  );
}
