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
    <div className="sap-tab-panel so-tab-panel">
      <div className="sap-tab-grid">
        <div className="sap-tab-column">
          <div className="sap-section-title">Shipping Information</div>

          <div className="sap-form-row">
            <label className="so-field__label">Ship To Code</label>
            <div className="sap-input-group">
              <select className="so-field__select" name="shipToCode" value={header.shipToCode} onChange={onHeaderChange}>
                <option value="">Select</option>
                {(vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses).map(addr => (
                  <option key={addr.Address} value={addr.Address}>{addr.AddressName || addr.Address || addr.CardCode} - {addr.State || 'No State'}</option>
                ))}
              </select>
              <button type="button" className="so-btn so-btn--lookup" onClick={() => onOpenAddressModal('shipTo')} title="Select Address">...</button>
            </div>
          </div>

          <div className="sap-form-row sap-form-row--stacked">
            <label className="so-field__label">Ship To Address</label>
            <textarea className="so-textarea" rows={3} name="shipTo" value={header.shipToAddress || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row">
            <label className="so-field__label">Bill To Code</label>
            <div className="sap-input-group">
              <select className="so-field__select" name="payToCode" value={header.billToCode} onChange={onHeaderChange}>
                <option value="">Select</option>
                {(vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses).map(addr => (
                  <option key={addr.Address} value={addr.Address}>{addr.AddressName || addr.Address || addr.CardCode} - {addr.State || 'No State'}</option>
                ))}
              </select>
              <button type="button" className="so-btn so-btn--lookup" onClick={() => onOpenAddressModal('billTo')} title="Select Address">...</button>
            </div>
          </div>

          <div className="sap-form-row sap-form-row--stacked">
            <label className="so-field__label">Bill To Address</label>
            <textarea className="so-textarea" rows={3} name="payTo" value={header.billToAddress || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row sap-form-row--full">
            <label className="sap-checkbox-row">
              <input type="checkbox" id="useBillToForTax" name="useBillToForTax" checked={header.useBillToForTax || false} onChange={onHeaderChange} />
              <span>Use Bill to Address to Determine Tax</span>
            </label>
          </div>

          <div className="sap-form-row sap-form-row--full">
            <label className="so-field__label">E-Way Bill Details</label>
            <div className="sap-input-group sap-input-group--compact">
              <button type="button" className="so-btn so-btn--lookup-wide" onClick={onOpenEWayBillModal} title="E-Way Bill Details">...</button>
            </div>
          </div>
        </div>

        <div className="sap-tab-column">
          <div className="sap-section-title">Delivery Information</div>

          <div className="sap-form-row">
            <label className="so-field__label">Shipping Type</label>
            <select className="so-field__select" name="shippingType" value={header.shippingType} onChange={onHeaderChange}>
              <option value="">Select</option>
              {shipTypeOpts.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="sap-form-row">
            <label className="so-field__label">Language</label>
            <select className="so-field__select">
              <option value="">Select</option>
              <option>English</option>
              <option>Hindi</option>
              <option>Gujarati</option>
            </select>
          </div>

          <div className="sap-form-row">
            <label className="so-field__label">Tracking No.</label>
            <input className="so-field__input" />
          </div>

          <div className="sap-form-row">
            <label className="so-field__label">Stamp No.</label>
            <input className="so-field__input" />
          </div>

          <div className="sap-form-row">
            <label className="so-field__label">Pick and Pack Remarks</label>
            <input className="so-field__input" />
          </div>

          <div className="sap-form-row">
            <label className="so-field__label">BP Channel Name</label>
            <input className="so-field__input" />
          </div>

          <div className="sap-form-row">
            <label className="so-field__label">BP Channel Contact</label>
            <select className="so-field__select">
              <option value="">Select</option>
            </select>
          </div>

          <div className="sap-form-row sap-form-row--full">
            <label className="sap-checkbox-row">
              <input type="checkbox" name="confirmed" checked={header.confirmed} onChange={onHeaderChange} />
              <span>Confirmed</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

