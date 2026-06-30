import React from 'react';

export default function LogisticsTab({
  header = {},
  onHeaderChange,
  effectiveWhseAddrs = [],
  vendorPayToAddresses = [],
  vendorShipToAddresses = [],
  vendorBillToAddresses = [],
  shipTypeOpts = [],
  shippingTypeOptions = [],
  onOpenAddressModal,
  isEditable = true,
}) {
  const payToAddresses = Array.isArray(vendorPayToAddresses) ? vendorPayToAddresses : [];
  const shipToAddresses = Array.isArray(vendorShipToAddresses) ? vendorShipToAddresses : [];
  const billToAddresses = Array.isArray(vendorBillToAddresses) ? vendorBillToAddresses : [];
  const shippingOptions = Array.isArray(shipTypeOpts) && shipTypeOpts.length
    ? shipTypeOpts
    : (Array.isArray(shippingTypeOptions) ? shippingTypeOptions : []);
  const shipToOptions = shipToAddresses.length ? shipToAddresses : payToAddresses;
  const billToOptions = billToAddresses.length ? billToAddresses : payToAddresses;

  return (
    <div className="del-tab-panel">
      <div className="del-field-grid" style={{ gridTemplateColumns: '1fr 1fr', columnGap: '24px' }}>
        
        {/* ══ LEFT COLUMN: SHIPPING INFORMATION ═════════════════════════ */}
        <div>
          <h6 className="del-section-title">Shipping Information</h6>
          
          {/* Ship To Code */}
          <div className="del-field">
            <label className="del-field__label">Ship To Code</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
               <select
                className="del-field__select"
                name="shipToCode"
                value={header.shipToCode || ''}
                onChange={onHeaderChange}
                style={{ flex: 1 }}
                disabled={!isEditable}
              >
                <option value="">Select</option>
                {shipToOptions.map(a => (
                  <option key={a.Address} value={a.Address}>
                    {a.Address}
                  </option>
                ))}
                {/* Show current value if not in list */}
                {header.shipToCode && !shipToOptions.some(a => a.Address === header.shipToCode) && (
                  <option value={header.shipToCode}>{header.shipToCode}</option>
                )}
              </select>
              <button
                type="button"
                className="del-btn"
                onClick={() => onOpenAddressModal('shipTo')}
                style={{ padding: '4px 8px', fontSize: 11, marginTop: 0 }}
                disabled={!isEditable}
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
              value={header.shipToAddress || ''}
              onChange={onHeaderChange}
              style={{ flex: 1 }}
              disabled={!isEditable}
            />
          </div>

          {/* Bill To Code */}
          <div className="del-field">
            <label className="del-field__label">Bill To Code</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
              <select
                className="del-field__select"
                name="billToCode"
                value={header.billToCode || ''}
                onChange={onHeaderChange}
                style={{ flex: 1 }}
                disabled={!isEditable}
              >
                <option value="">Select</option>
                {billToOptions.map(a => (
                  <option key={a.Address} value={a.Address}>
                    {a.Address}
                  </option>
                ))}
                {/* Show current value if not in list */}
                {header.billToCode && !billToOptions.some(a => a.Address === header.billToCode) && (
                  <option value={header.billToCode}>{header.billToCode}</option>
                )}
              </select>
              <button
                type="button"
                className="del-btn"
                onClick={() => onOpenAddressModal('billTo')}
                style={{ padding: '4px 8px', fontSize: 11, marginTop: 0 }}
                disabled={!isEditable}
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
              value={header.billToAddress || ''}
              onChange={onHeaderChange}
              style={{ flex: 1 }}
              disabled={!isEditable}
            />
          </div>

          {/* Use Bill to Address to Determine Tax */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <input
              type="checkbox"
              id="useBillToAddress"
              name="useBillToForTax"
              checked={!!header.useBillToForTax}
              onChange={onHeaderChange}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              disabled={!isEditable}
            />
            <label htmlFor="useBillToAddress" style={{ cursor: 'pointer', margin: 0, fontSize: '12px', color: '#333' }}>
              Use Bill to Address to Determine Tax
            </label>
          </div>
        </div>

        {/* ══ RIGHT COLUMN: DELIVERY INFORMATION ═════════════════════════ */}
        <div>
          <h6 className="del-section-title">Delivery Information</h6>
          
          {/* Shipping Type */}
          <div className="del-field">
            <label className="del-field__label">Shipping Type</label>
            <select
              className="del-field__select"
              name="shippingType"
              value={header.shippingType}
              onChange={onHeaderChange}
              disabled={!isEditable}
            >
              <option value="">Select</option>
              {shippingOptions.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div className="del-field">
            <label className="del-field__label">Language</label>
            <select
              className="del-field__select"
              name="language"
              value={header.language || ''}
              onChange={onHeaderChange}
              disabled={!isEditable}
            >
              <option value="">Select</option>
              <option value="8">English</option>
              <option value="56">Hindi</option>
              <option value="59">Gujarati</option>
              {header.language && !['8', '56', '59'].includes(String(header.language)) && (
                <option value={header.language}>{header.language}</option>
              )}
            </select>
          </div>

          {/* Tracking No. */}
          <div className="del-field">
            <label className="del-field__label">Tracking No.</label>
            <input
              className="del-field__input"
              name="trackingNo"
              value={header.trackingNo || ''}
              onChange={onHeaderChange}
              disabled={!isEditable}
            />
          </div>

          {/* Stamp No. */}
          <div className="del-field">
            <label className="del-field__label">Stamp No.</label>
            <input
              className="del-field__input"
              name="stampNo"
              value={header.stampNo || ''}
              onChange={onHeaderChange}
              disabled={!isEditable}
            />
          </div>

          {/* Pick and Pack Remarks */}
          <div className="del-field">
            <label className="del-field__label">Pick and Pack Remarks</label>
            <input
              className="del-field__input"
              name="pickPackRemarks"
              value={header.pickPackRemarks || ''}
              onChange={onHeaderChange}
              disabled={!isEditable}
            />
          </div>

          {/* BP Channel Name */}
          <div className="del-field">
            <label className="del-field__label">BP Channel Name</label>
            <input
              className="del-field__input"
              name="bpChannelName"
              value={header.bpChannelName || ''}
              onChange={onHeaderChange}
              disabled={!isEditable}
            />
          </div>

          {/* BP Channel Contact */}
          <div className="del-field">
            <label className="del-field__label">BP Channel Contact</label>
            <select
              className="del-field__select"
              name="bpChannelContact"
              value={header.bpChannelContact || ''}
              onChange={onHeaderChange}
              disabled={!isEditable}
            >
              <option value="">Select</option>
              {header.bpChannelContact && (
                <option value={header.bpChannelContact}>{header.bpChannelContact}</option>
              )}
            </select>
          </div>

          {/* Confirmed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <input
              type="checkbox"
              name="confirmed"
              checked={header.confirmed}
              onChange={onHeaderChange}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              disabled={!isEditable}
            />
            <label style={{ cursor: 'pointer', margin: 0, fontSize: '12px', color: '#333' }}>
              Confirmed
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
