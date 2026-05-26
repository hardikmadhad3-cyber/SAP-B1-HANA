import React from 'react';

export default function LogisticsTab({
  header,
  onHeaderChange,
  vendorPayToAddresses,
  vendorShipToAddresses,
  vendorBillToAddresses,
  shipTypeOpts,
  onOpenAddressModal,
  onOpenEWayBillModal,
}) {
  return (
    <div className="im-tab-panel">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
        {/* Left Column */}
        <div>
          <div className="im-section-title">Shipping Information</div>
          
          <div className="im-field">
            <label className="im-field__label">Ship To Code</label>
            <div className="im-lookup-wrap">
              <select
                className="im-field__select"
                name="shipToCode"
                value={header.shipToCode}
                onChange={onHeaderChange}
                style={{ flex: 1 }}
              >
                <option value="">Select</option>
                {(vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses).map(addr => (
                  <option key={addr.Address} value={addr.Address}>
                    {addr.AddressName || addr.Address || addr.CardCode} - {addr.State || 'No State'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="im-lookup-btn"
                onClick={() => onOpenAddressModal('shipTo')}
                title="Select Address"
              >
                ...
              </button>
            </div>
          </div>

          <div className="im-field" style={{ alignItems: 'flex-start' }}>
            <label className="im-field__label" style={{ paddingTop: '4px' }}>Ship To Address</label>
            <textarea
              className="im-textarea"
              rows={3}
              name="shipTo"
              value={header.shipToAddress || ''}
              onChange={onHeaderChange}
              style={{ flex: 1 }}
            />
          </div>

          <div className="im-field">
            <label className="im-field__label">Bill To Code</label>
            <div className="im-lookup-wrap">
              <select
                className="im-field__select"
                name="payToCode"
                value={header.billToCode}
                onChange={onHeaderChange}
                style={{ flex: 1 }}
              >
                <option value="">Select</option>
                {(vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses).map(addr => (
                  <option key={addr.Address} value={addr.Address}>
                    {addr.AddressName || addr.Address || addr.CardCode} - {addr.State || 'No State'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="im-lookup-btn"
                onClick={() => onOpenAddressModal('billTo')}
                title="Select Address"
              >
                ...
              </button>
            </div>
          </div>

          <div className="im-field" style={{ alignItems: 'flex-start' }}>
            <label className="im-field__label" style={{ paddingTop: '4px' }}>Bill To Address</label>
            <textarea
              className="im-textarea"
              rows={3}
              name="payTo"
              value={header.billToAddress || ''}
              onChange={onHeaderChange}
              style={{ flex: 1 }}
            />
          </div>

          <div className="im-field">
            <label className="im-field__label"></label>
            <label className="im-checkbox-label">
              <input 
                type="checkbox" 
                id="useBillToForTax" 
                name="useBillToForTax"
                checked={header.useBillToForTax || false}
                onChange={onHeaderChange}
              />
              <span>Use Bill to Address to Determine Tax</span>
            </label>
          </div>

          <div className="im-field">
            <label className="im-field__label">E-Way Bill Details</label>
            <button
              type="button"
              className="im-lookup-btn"
              onClick={onOpenEWayBillModal}
              title="E-Way Bill Details"
              style={{ width: '80px', fontSize: '11px' }}
            >
              ...
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div>
          <div className="im-section-title">Delivery Information</div>
          
          <div className="im-field">
            <label className="im-field__label">Shipping Type</label>
            <select
              className="im-field__select"
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

          <div className="im-field">
            <label className="im-field__label">Language</label>
            <select className="im-field__select">
              <option value="">Select</option>
              <option>English</option>
              <option>Hindi</option>
              <option>Gujarati</option>
            </select>
          </div>

          <div className="im-field">
            <label className="im-field__label">Tracking No.</label>
            <input className="im-field__input" />
          </div>

          <div className="im-field">
            <label className="im-field__label">Stamp No.</label>
            <input className="im-field__input" />
          </div>

          <div className="im-field">
            <label className="im-field__label">Pick and Pack Remarks</label>
            <input className="im-field__input" />
          </div>

          <div className="im-field">
            <label className="im-field__label">BP Channel Name</label>
            <input className="im-field__input" />
          </div>

          <div className="im-field">
            <label className="im-field__label">BP Channel Contact</label>
            <select className="im-field__select">
              <option value="">Select</option>
            </select>
          </div>

          <div className="im-field">
            <label className="im-field__label"></label>
            <label className="im-checkbox-label">
              <input
                type="checkbox"
                name="confirmed"
                checked={header.confirmed}
                onChange={onHeaderChange}
              />
              <span>Confirmed</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

