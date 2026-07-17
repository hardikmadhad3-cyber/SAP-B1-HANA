import React from 'react';

const ensureSavedOption = (options, value) => {
  const normalized = String(value || '');
  if (!normalized || options.some((option) => String(option.value) === normalized)) return options;
  return [...options, { value: normalized, label: normalized }];
};

export default function TaxTab({
  header,
  onHeaderChange,
  onOpenTaxInfoModal,
  isEditable = true,
}) {
  const transactionOptions = ensureSavedOption([
    { value: 'B2B', label: 'B2B' },
    { value: 'B2C', label: 'B2C' },
    { value: 'SEZ', label: 'SEZ' },
    { value: 'EXP', label: 'Export' },
  ], header.transactionCategory);
  const dutyOptions = ensureSavedOption([
    { value: 'Y', label: 'With Payment of Duty' },
    { value: 'N', label: 'Without Payment of Duty' },
  ], header.dutyStatus);

  return (
    <div className="sap-tab-panel so-tab-panel so-tax-panel">
      <div className="so-tax-b1-layout">
        <div className="so-tax-b1-top">
          <div className="so-tax-b1-left">
          <div className="sap-section-heading-row">
            <div className="sap-section-title">Tax Information</div>
            <button type="button" className="so-btn so-btn--primary so-tax-info-btn" onClick={onOpenTaxInfoModal} disabled={!isEditable}>...</button>
          </div>

          <div className="sap-form-row">
            <label className="so-tax-label">Transaction Category</label>
            <select className="so-field__select" name="transactionCategory" value={header.transactionCategory || ''} onChange={onHeaderChange} disabled={!isEditable}>
              <option value=""></option>
              {transactionOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="sap-form-row">
            <label className="so-tax-label">Form No.</label>
            <input className="so-field__input" name="taxFormNo" value={header.taxFormNo || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          <div className="sap-form-row">
            <label className="so-tax-label">Duty Status</label>
            <select className="so-field__select" name="dutyStatus" value={header.dutyStatus || 'Y'} onChange={onHeaderChange} disabled={!isEditable}>
              {dutyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          </div>

          <label className="sap-checkbox-row so-tax-b1-export-check">
            <input type="checkbox" name="exportFlag" checked={Boolean(header.exportFlag)} onChange={onHeaderChange} disabled={!isEditable} />
            <span>Export</span>
          </label>
        </div>

        <div className="so-tax-b1-bottom">
          <label className="sap-checkbox-row so-tax-b1-supply-check">
            <input type="checkbox" name="supplyCovered" checked={header.supplyCovered !== false} onChange={onHeaderChange} disabled={!isEditable} />
            <span>Supply Covered under Sec 7 of IGST Act</span>
          </label>

          <div className="sap-form-row so-tax-b1-rate-row">
            <label className="so-tax-label">Differential % of Tax Rate</label>
            <select className="so-field__select" name="differentialTaxRate" value={header.differentialTaxRate || '100'} onChange={onHeaderChange} disabled={!isEditable}>
              {[100, 75, 50, 25].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
