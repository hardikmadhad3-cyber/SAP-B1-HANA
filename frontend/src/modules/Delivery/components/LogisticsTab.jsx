import React from 'react';

export default function LogisticsTab({
  header,
  onHeaderChange,
  vendorShipToAddresses,
  vendorBillToAddresses,
  shipTypeOpts,
  onOpenAddressModal,
  isEditable = true,
}) {
  return (
    <div className="sap-tab-panel del-tab-panel">
      <div className="sap-tab-grid">
        
        {/* ══ LEFT COLUMN: SHIPPING INFORMATION ═════════════════════════ */}
        <div className="sap-tab-column">
          <h6 className="del-section-title">Shipping Information</h6>
          
          {/* Ship To Code */}
          <div className="del-field">
            <label className="del-field__label">Ship To Code</label>
            <div className="sap-input-group">
              <select
                className="del-field__select"
                name="shipToCode"
                value={header.shipToCode || ''}
                onChange={onHeaderChange}
              >
                <option value="">Select</option>
                {vendorShipToAddresses.map(a => (
                  <option key={a.Address} value={a.Address}>
                    {a.Address}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="del-btn del-btn--lookup"
                onClick={() => onOpenAddressModal('shipTo')}
              >
                ...
              </button>
            </div>
          </div>

          {/* Ship To Address */}
          <div className="del-field">
            <label className="del-field__label">Ship To Address</label>
            <textarea
              className="del-textarea"
              rows={4}
              name="shipToAddress"
              value={header.shipToAddress || header.shipTo || ''}
              onChange={onHeaderChange}
            />
          </div>

          {/* Bill To Code */}
          <div className="del-field">
            <label className="del-field__label">Bill To Code</label>
            <div className="sap-input-group">
              <select
                className="del-field__select"
                name="billToCode"
                value={header.billToCode || ''}
                onChange={onHeaderChange}
              >
                <option value="">Select</option>
                {vendorBillToAddresses.map(a => (
                  <option key={a.Address} value={a.Address}>
                    {a.Address}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="del-btn del-btn--lookup"
                onClick={() => onOpenAddressModal('billTo')}
              >
                ...
              </button>
            </div>
          </div>

          {/* Bill To Address */}
          <div className="del-field">
            <label className="del-field__label">Bill To Address</label>
            <textarea
              className="del-textarea"
              rows={4}
              name="billToAddress"
              value={header.billToAddress || header.payTo || ''}
              onChange={onHeaderChange}
            />
          </div>

          {/* Use Bill to Address to Determine Tax */}
          <div className="sap-checkbox-row">
            <input
              type="checkbox"
              id="useBillToAddress"
              name="useBillToForTax"
              checked={!!header.useBillToForTax}
              onChange={onHeaderChange}
            />
            <label htmlFor="useBillToAddress">
              Use Bill to Address to Determine Tax
            </label>
          </div>
        </div>

        {/* ══ RIGHT COLUMN: DELIVERY INFORMATION ═════════════════════════ */}
        <div className="sap-tab-column">
          <h6 className="del-section-title">Delivery Information</h6>
          
          {/* Shipping Type */}
          <div className="del-field">
            <label className="del-field__label">Shipping Type</label>
            <select
              className="del-field__select"
              name="shippingType"
              value={header.shippingType}
              onChange={onHeaderChange}
            >
              <option value="">Select</option>
              {shipTypeOpts.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div className="del-field">
            <label className="del-field__label">Language</label>
            <select className="del-field__select" name="languageCode" value={header.languageCode || ''} onChange={onHeaderChange} disabled={!isEditable}>
              <option value="">Select</option>
              <option value="3">English</option>
              <option value="8">Hindi</option>
              <option value="12">Gujarati</option>
              {header.languageCode && !['3', '8', '12'].includes(String(header.languageCode)) ? <option value={header.languageCode}>{header.languageCode}</option> : null}
            </select>
          </div>

          {/* Tracking No. */}
          <div className="del-field">
            <label className="del-field__label">Tracking No.</label>
            <input className="del-field__input" name="trackingNo" value={header.trackingNo || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          {/* Stamp No. */}
          <div className="del-field">
            <label className="del-field__label">Stamp No.</label>
            <input className="del-field__input" name="stampNo" value={header.stampNo || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          {/* Pick and Pack Remarks */}
          <div className="del-field">
            <label className="del-field__label">Pick and Pack Remarks</label>
            <input className="del-field__input" name="pickAndPackRemarks" value={header.pickAndPackRemarks || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          {/* BP Channel Name */}
          <div className="del-field">
            <label className="del-field__label">BP Channel Name</label>
            <input className="del-field__input" name="bpChannelCode" value={header.bpChannelCode || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          {/* BP Channel Contact */}
          <div className="del-field">
            <label className="del-field__label">BP Channel Contact</label>
            <select className="del-field__select" name="bpChannelContact" value={header.bpChannelContact || ''} onChange={onHeaderChange} disabled={!isEditable}>
              <option value="">Select</option>
              {header.bpChannelContact ? <option value={header.bpChannelContact}>{header.bpChannelContact}</option> : null}
            </select>
          </div>

          {/* Confirmed */}
          <div className="sap-checkbox-row">
            <input
              type="checkbox"
              name="confirmed"
              checked={header.confirmed}
              onChange={onHeaderChange}
            />
            <label>
              Confirmed
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
