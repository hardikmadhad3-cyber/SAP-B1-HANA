import React from 'react';

const ensureSavedOption = (options, value) => {
  const normalized = String(value || '');
  if (!normalized || options.some((option) => String(option.value) === normalized)) return options;
  return [...options, { value: normalized, label: normalized }];
};

export default function TaxTab({ header, onHeaderChange, onOpenTaxInfoModal, isEditable = true }) {
  const transactionOptions = ensureSavedOption([
    { value: 'B2B', label: 'B2B' }, { value: 'B2C', label: 'B2C' },
    { value: 'SEZ', label: 'SEZ' }, { value: 'EXP', label: 'Export' },
  ], header.transactionCategory);
  const dutyOptions = ensureSavedOption([
    { value: 'Y', label: 'With Payment of Duty' },
    { value: 'N', label: 'Without Payment of Duty' },
  ], header.dutyStatus);

  return (
    <div className="del-tab-panel">
      <div className="del-field-grid">
        <div className="del-field" style={{ gridColumn: '1 / -1' }}>
          <label className="del-field__label"></label>
          <div style={{ flex: 1 }}>
            <div role="button" tabIndex={0} className="del-btn del-btn--primary" onClick={onOpenTaxInfoModal} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpenTaxInfoModal(); }} style={{ display: 'inline-block' }}>Tax Information</div>
          </div>
        </div>
        <div className="del-field">
          <label className="del-field__label">Transaction Category</label>
          <select className="del-field__select" name="transactionCategory" value={header.transactionCategory || ''} onChange={onHeaderChange} disabled={!isEditable}>
            <option value="">— Select —</option>
            {transactionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="del-field">
          <label className="del-field__label">Form No.</label>
          <input className="del-field__input" name="taxFormNo" value={header.taxFormNo || ''} onChange={onHeaderChange} disabled={!isEditable} />
        </div>
        <div className="del-field">
          <label className="del-field__label">Duty Status</label>
          <select className="del-field__select" name="dutyStatus" value={header.dutyStatus || ''} onChange={onHeaderChange} disabled={!isEditable}>
            <option value="">— Select —</option>
            {dutyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="del-field">
          <label className="del-field__label">Differential % of Tax Rate</label>
          <select className="del-field__select" name="differentialTaxRate" value={header.differentialTaxRate || '100'} onChange={onHeaderChange} disabled={!isEditable}>
            {[100, 75, 50, 25].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
          <span style={{ width: 110 }}></span>
          <input type="checkbox" id="exportCheck" name="exportFlag" checked={!!header.exportFlag} onChange={onHeaderChange} disabled={!isEditable} />
          <label htmlFor="exportCheck" style={{ margin: 0, fontSize: 12 }}>Export</label>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
          <span style={{ width: 110 }}></span>
          <input type="checkbox" id="supplyCoveredCheck" name="supplyCovered" checked={!!header.supplyCovered} onChange={onHeaderChange} disabled={!isEditable} />
          <label htmlFor="supplyCoveredCheck" style={{ margin: 0, fontSize: 12 }}>Supply Covered under Sec 7 of IGST Act</label>
        </div>
      </div>
    </div>
  );
}
