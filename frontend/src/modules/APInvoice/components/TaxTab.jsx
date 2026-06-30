import React from 'react';

const SELECT_PLACEHOLDER = '— Select —';

function TaxField({ label, name, value, onChange, isEditable, type = 'text', error }) {
  return (
    <div className="po-field">
      <label className="po-field__label">{label}</label>
      <input
        type={type}
        className={`po-field__input${error ? ' po-field__input--error' : ''}`}
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={!isEditable}
      />
    </div>
  );
}

function TaxSelect({ label, name, value, onChange, isEditable, children }) {
  return (
    <div className="po-field">
      <label className="po-field__label">{label}</label>
      <select className="po-field__select" name={name} value={value || ''} onChange={onChange} disabled={!isEditable}>
        {children}
      </select>
    </div>
  );
}

export default function TaxTab({
  onOpenTaxInfoModal,
  header = {},
  onHeaderChange,
  showTaxInvoiceReference = false,
  taxInvoiceReferenceRequired = false,
  errors = {},
  isEditable = true,
}) {
  const showCreditMemoFields = showTaxInvoiceReference;
  const canEditFields = isEditable && typeof onHeaderChange === 'function';

  return (
    <div className="po-tab-panel po-sapb1-tab-panel po-sapb1-tax-tab">
      <div className="po-sapb1-tab-surface po-sapb1-tax-layout">
        <div className="po-sapb1-tax-left">
          <div className="po-field po-sapb1-tax-info-field">
            <label className="po-field__label">Tax Information</label>
            <button type="button" className="po-btn po-btn--primary po-sapb1-ellipsis-btn" onClick={onOpenTaxInfoModal} disabled={!isEditable}>
              ...
            </button>
          </div>

          <TaxSelect label="Transaction Category" name="transactionCategory" value={header.transactionCategory} onChange={onHeaderChange} isEditable={canEditFields}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
            <option value="Export">Export</option>
            <option value="SEZ">SEZ</option>
          </TaxSelect>

          <TaxField label="Form No." name="formNo" value={header.formNo} onChange={onHeaderChange} isEditable={canEditFields} />

          {showCreditMemoFields && (
            <>
              <div className="po-sapb1-tax-spacer" />
              <TaxField label="Reference Number" name="referenceNumber" value={header.referenceNumber} onChange={onHeaderChange} isEditable={canEditFields} />
              <TaxField label="Ref. Date" name="referenceDate" value={header.referenceDate} onChange={onHeaderChange} isEditable={canEditFields} type="date" />
              <div className="po-field po-sapb1-checkbox-row">
                <label className="po-field__label" />
                <label className="po-checkbox-label">
                  <input type="checkbox" name="revision" checked={!!header.revision} onChange={onHeaderChange} disabled={!canEditFields} />
                  <span>Revision</span>
                </label>
              </div>
              <TaxField
                label={`Original Ref. No.${taxInvoiceReferenceRequired ? ' *' : ''}`}
                name="taxInvoiceNo"
                value={header.taxInvoiceNo}
                onChange={onHeaderChange}
                isEditable={canEditFields}
                error={errors.taxInvoiceNo}
              />
              <TaxField
                label={`Original Ref. Date${taxInvoiceReferenceRequired ? ' *' : ''}`}
                name="taxInvoiceDate"
                value={header.taxInvoiceDate}
                onChange={onHeaderChange}
                isEditable={canEditFields}
                type="date"
                error={errors.taxInvoiceDate}
              />
            </>
          )}

          <div className="po-sapb1-tax-bottom">
            {showCreditMemoFields && (
              <>
                <TaxSelect label="Reason for Issuing Note" name="reasonForIssuingNote" value={header.reasonForIssuingNote || 'Sales Return'} onChange={onHeaderChange} isEditable={canEditFields}>
                  <option value="Sales Return">Sales Return</option>
                  <option value="Post Sale Discount">Post Sale Discount</option>
                  <option value="Deficiency in Services">Deficiency in Services</option>
                  <option value="Correction in Invoice">Correction in Invoice</option>
                </TaxSelect>

                <div className="po-field po-sapb1-checkbox-row">
                  <label className="po-field__label" />
                  <label className="po-checkbox-label">
                    <input type="checkbox" name="supplyCoveredIgstSec7" checked={!!header.supplyCoveredIgstSec7} onChange={onHeaderChange} disabled={!canEditFields} />
                    <span>Supply Covered under Sec 7 of IGST Act</span>
                  </label>
                </div>
              </>
            )}

            <TaxSelect label="Differential % of Tax Rate" name="differentialTaxRate" value={header.differentialTaxRate || '100'} onChange={onHeaderChange} isEditable={canEditFields}>
              <option value="100">100</option>
              <option value="75">75</option>
              <option value="50">50</option>
              <option value="25">25</option>
            </TaxSelect>
          </div>
        </div>

        <div className="po-sapb1-tax-right">
          <label className="po-checkbox-label">
            <input type="checkbox" name="import" checked={!!header.import} onChange={onHeaderChange} disabled={!canEditFields} />
            <span>Import</span>
          </label>
        </div>
      </div>
    </div>
  );
}
