import React from 'react';

const savedOption = (value) => value ? <option value={value}>{value}</option> : null;

export default function AccountingTab({
  header,
  onHeaderChange,
  payTermOpts,
  paymentMethodOpts = [],
  referenceDocuments = [],
  onOpenReferenceDocuments,
  isEditable = true,
}) {
  const referenceCount = (referenceDocuments || [])
    .filter((row) => String(row.transactionType || row.docNumber || row.docEntry || row.extDocNumber || '').trim())
    .length;
  const paymentMethods = [...paymentMethodOpts];
  const currentPaymentMethod = String(header.paymentMethod || '').trim();
  if (currentPaymentMethod && !paymentMethods.some((method) => String(method.value) === currentPaymentMethod)) {
    paymentMethods.push({ value: currentPaymentMethod, label: currentPaymentMethod });
  }

  return (
    <div className="del-tab-panel">
      <div className="del-field-grid">
        <div className="del-field">
          <label className="del-field__label">Journal Remark</label>
          <input className="del-field__input" name="journalRemark" value={header.journalRemark || ''} onChange={onHeaderChange} disabled={!isEditable} />
        </div>
        <div className="del-field">
          <label className="del-field__label">Payment Terms</label>
          <select className="del-field__select" name="paymentTerms" value={header.paymentTerms || ''} onChange={onHeaderChange} disabled={!isEditable}>
            <option value="">-- Select --</option>
            {payTermOpts.map((term) => <option key={term.value} value={term.value}>{term.label}</option>)}
          </select>
        </div>
        <div className="del-field">
          <label className="del-field__label">Payment Method</label>
          <select className="del-field__select" name="paymentMethod" value={header.paymentMethod || ''} onChange={onHeaderChange} disabled={!isEditable}>
            <option value="">-- Select --</option>
            {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </select>
        </div>
        <div className="del-field">
          <label className="del-field__label">Central Bank Ind.</label>
          <select className="del-field__select" name="centralBankIndicator" value={header.centralBankIndicator || ''} onChange={onHeaderChange} disabled={!isEditable}>
            <option value="">-- Select --</option>
            {savedOption(header.centralBankIndicator)}
          </select>
        </div>
        <div className="del-field">
          <label className="del-field__label">Business Partner Project</label>
          <input className="del-field__input" name="projectCode" value={header.projectCode || ''} onChange={onHeaderChange} disabled={!isEditable} />
        </div>
        <div className="del-field">
          <label className="del-field__label">Create QR Code From</label>
          <input className="del-field__input" name="qrCodeSource" value={header.qrCodeSource || ''} onChange={onHeaderChange} disabled={!isEditable} />
        </div>
        <div className="del-field">
          <label className="del-field__label">Indicator</label>
          <select className="del-field__select" name="indicator" value={header.indicator || ''} onChange={onHeaderChange} disabled={!isEditable}>
            <option value="">-- Select --</option>
            {savedOption(header.indicator)}
          </select>
        </div>
        <div className="del-field">
          <label className="del-field__label">Order Number</label>
          <input className="del-field__input" name="orderNumber" value={header.orderNumber || ''} onChange={onHeaderChange} disabled={!isEditable} />
        </div>
        <div className="del-field">
          <label className="del-field__label">Referenced Document</label>
          <div className="sap-input-group">
            <input className="del-field__input" readOnly value={referenceCount ? `(${referenceCount})` : ''} />
            <button type="button" className="del-btn del-btn--lookup" onClick={onOpenReferenceDocuments} disabled={!isEditable && !referenceCount}>
              ...
            </button>
          </div>
        </div>
        <div className="del-field">
          <label className="del-field__label">Owner</label>
          <input className="del-field__input" name="owner" value={header.owner || ''} onChange={onHeaderChange} disabled={!isEditable} />
        </div>
        <div className="del-field" style={{ gridColumn: '1 / -1' }}>
          <label className="del-field__label">Remarks / Instructions</label>
          <textarea className="del-textarea" rows={4} name="otherInstruction" value={header.otherInstruction || ''} onChange={onHeaderChange} disabled={!isEditable} />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 110 }} />
          <input type="checkbox" id="useShippedGoods" name="useShippedGoodsAccount" checked={!!header.useShippedGoodsAccount} onChange={onHeaderChange} disabled={!isEditable} />
          <label htmlFor="useShippedGoods" style={{ margin: 0, fontSize: 12 }}>Use Shipped Goods Account</label>
        </div>
        <div className="del-field">
          <label className="del-field__label">Consolidation Type</label>
          <select className="del-field__select" name="consolidationType" value={header.consolidationType || ''} onChange={onHeaderChange} disabled={!isEditable}>
            <option value="">-- Select --</option>
            {savedOption(header.consolidationType)}
          </select>
        </div>
        <div className="del-field">
          <label className="del-field__label">Consolidating BP</label>
          <input className="del-field__input" name="consolidatingBP" value={header.consolidatingBP || ''} onChange={onHeaderChange} disabled={!isEditable} />
        </div>
      </div>
    </div>
  );
}
