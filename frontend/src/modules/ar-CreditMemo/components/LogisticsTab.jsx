import React from 'react';

export default function LogisticsTab({
  header,
  onHeaderChange,
  effectiveWhseAddrs,
  vendorPayToAddresses,
  vendorShipToAddresses,
  vendorBillToAddresses,
  shipTypeOpts,
  onOpenAddressModal,
}) {
  return (
    <div className="sap-tab-panel del-tab-panel">
      <div className="sap-tab-grid">
        <div className="sap-tab-column">
          <div className="sap-section-title">Shipping Information</div>

          <div className="sap-form-row">
            <label className="del-field__label">Ship To Code</label>
            <div className="sap-input-group">
              <select className="del-field__select" name="shipToCode" value={header.shipToCode || ''} onChange={onHeaderChange}>
                <option value="">Select</option>
                {(vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses).map(a => (
                  <option key={a.Address} value={a.Address}>{a.Address}</option>
                ))}
                {header.shipToCode && !(vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses).some(a => a.Address === header.shipToCode) && (
                  <option value={header.shipToCode}>{header.shipToCode}</option>
                )}
              </select>
              <button type="button" className="del-btn" onClick={() => onOpenAddressModal('shipTo')}>...</button>
            </div>
          </div>

          <div className="sap-form-row sap-form-row--stacked">
            <label className="del-field__label">Ship To Address</label>
            <textarea className="del-textarea" rows={4} name="shipToAddress" value={header.shipToAddress || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Bill To Code</label>
            <div className="sap-input-group">
              <select className="del-field__select" name="billToCode" value={header.billToCode || ''} onChange={onHeaderChange}>
                <option value="">Select</option>
                {(vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses).map(a => (
                  <option key={a.Address} value={a.Address}>{a.Address}</option>
                ))}
                {header.billToCode && !(vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses).some(a => a.Address === header.billToCode) && (
                  <option value={header.billToCode}>{header.billToCode}</option>
                )}
              </select>
              <button type="button" className="del-btn" onClick={() => onOpenAddressModal('billTo')}>...</button>
            </div>
          </div>

          <div className="sap-form-row sap-form-row--stacked">
            <label className="del-field__label">Bill To Address</label>
            <textarea className="del-textarea" rows={4} name="billToAddress" value={header.billToAddress || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row sap-form-row--full">
            <label className="sap-checkbox-row">
              <input type="checkbox" id="useBillToAddress" />
              <span>Use Bill to Address to Determine Tax</span>
            </label>
          </div>
        </div>

        <div className="sap-tab-column">
          <div className="sap-section-title">Delivery Information</div>

          <div className="sap-form-row">
            <label className="del-field__label">Shipping Type</label>
            <select className="del-field__select" name="shippingType" value={header.shippingType} onChange={onHeaderChange}>
              <option value="">Select</option>
              {shipTypeOpts.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Language</label>
            <select className="del-field__select"><option value="">Select</option><option>English</option><option>Hindi</option><option>Gujarati</option></select>
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Tracking No.</label>
            <input className="del-field__input" />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Stamp No.</label>
            <input className="del-field__input" />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Pick and Pack Remarks</label>
            <input className="del-field__input" />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">BP Channel Name</label>
            <input className="del-field__input" />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">BP Channel Contact</label>
            <select className="del-field__select"><option value="">Select</option></select>
          </div>

          <div className="sap-form-row sap-form-row--full">
            <label className="sap-checkbox-row"><input type="checkbox" name="confirmed" checked={header.confirmed} onChange={onHeaderChange} /><span>Confirmed</span></label>
          </div>
        </div>
      </div>
    </div>
  );
}
