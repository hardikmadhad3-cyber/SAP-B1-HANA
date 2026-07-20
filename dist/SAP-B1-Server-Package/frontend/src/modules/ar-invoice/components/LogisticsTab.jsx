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
    <div className="sap-tab-panel del-tab-panel">
      <div className="sap-tab-grid">
        <div className="sap-tab-column">
          <div className="sap-section-title">Shipping Information</div>

          <div className="sap-form-row">
            <label className="del-field__label">Ship To Code</label>
            <div className="sap-input-group">
              <select className="del-field__select" name="shipToCode" value={header.shipToCode || ''} onChange={onHeaderChange} disabled={!isEditable}>
                <option value="">Select</option>
                {shipToOptions.map(a => (
                  <option key={a.Address} value={a.Address}>{a.Address}</option>
                ))}
                {header.shipToCode && !shipToOptions.some(a => a.Address === header.shipToCode) && (
                  <option value={header.shipToCode}>{header.shipToCode}</option>
                )}
              </select>
              <button type="button" className="del-btn" onClick={() => onOpenAddressModal('shipTo')} disabled={!isEditable}>...</button>
            </div>
          </div>

          <div className="sap-form-row sap-form-row--stacked">
            <label className="del-field__label">Ship To Address</label>
            <textarea className="del-textarea" rows={4} name="shipToAddress" value={header.shipToAddress || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Bill To Code</label>
            <div className="sap-input-group">
              <select className="del-field__select" name="billToCode" value={header.billToCode || ''} onChange={onHeaderChange} disabled={!isEditable}>
                <option value="">Select</option>
                {billToOptions.map(a => (
                  <option key={a.Address} value={a.Address}>{a.Address}</option>
                ))}
                {header.billToCode && !billToOptions.some(a => a.Address === header.billToCode) && (
                  <option value={header.billToCode}>{header.billToCode}</option>
                )}
              </select>
              <button type="button" className="del-btn" onClick={() => onOpenAddressModal('billTo')} disabled={!isEditable}>...</button>
            </div>
          </div>

          <div className="sap-form-row sap-form-row--stacked">
            <label className="del-field__label">Bill To Address</label>
            <textarea className="del-textarea" rows={4} name="billToAddress" value={header.billToAddress || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          <div className="sap-form-row sap-form-row--full">
            <label className="sap-checkbox-row">
              <input type="checkbox" id="useBillToAddress" name="useBillToForTax" checked={!!header.useBillToForTax} onChange={onHeaderChange} disabled={!isEditable} />
              <span>Use Bill to Address to Determine Tax</span>
            </label>
          </div>
        </div>

        <div className="sap-tab-column">
          <div className="sap-section-title">Delivery Information</div>

          <div className="sap-form-row">
            <label className="del-field__label">Shipping Type</label>
            <select className="del-field__select" name="shippingType" value={header.shippingType} onChange={onHeaderChange} disabled={!isEditable}>
              <option value="">Select</option>
              {shippingOptions.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Language</label>
            <select className="del-field__select" name="language" value={header.language || ''} onChange={onHeaderChange} disabled={!isEditable}>
              <option value="">Select</option>
              <option value="8">English</option>
              <option value="56">Hindi</option>
              <option value="59">Gujarati</option>
              {header.language && !['8', '56', '59'].includes(String(header.language)) && (
                <option value={header.language}>{header.language}</option>
              )}
            </select>
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Tracking No.</label>
            <input className="del-field__input" name="trackingNo" value={header.trackingNo || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Stamp No.</label>
            <input className="del-field__input" name="stampNo" value={header.stampNo || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">Pick and Pack Remarks</label>
            <input className="del-field__input" name="pickPackRemarks" value={header.pickPackRemarks || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">BP Channel Name</label>
            <input className="del-field__input" name="bpChannelName" value={header.bpChannelName || ''} onChange={onHeaderChange} disabled={!isEditable} />
          </div>

          <div className="sap-form-row">
            <label className="del-field__label">BP Channel Contact</label>
            <select className="del-field__select" name="bpChannelContact" value={header.bpChannelContact || ''} onChange={onHeaderChange} disabled={!isEditable}>
              <option value="">Select</option>
              {header.bpChannelContact && (
                <option value={header.bpChannelContact}>{header.bpChannelContact}</option>
              )}
            </select>
          </div>

          <div className="sap-form-row sap-form-row--full">
            <label className="sap-checkbox-row">
              <input type="checkbox" name="confirmed" checked={header.confirmed} onChange={onHeaderChange} disabled={!isEditable} />
              <span>Confirmed</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
