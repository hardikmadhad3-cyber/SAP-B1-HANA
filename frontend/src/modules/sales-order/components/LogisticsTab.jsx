import React from 'react';

export default function LogisticsTab({
  header,
  onHeaderChange,
  vendorPayToAddresses,
  vendorShipToAddresses,
  vendorBillToAddresses,
  shipTypeOpts,
  onOpenAddressModal,
}) {
  const shipToOptions = vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses;
  const billToOptions = vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses;

  return (
    <div className="sap-tab-panel so-tab-panel so-logistics-panel">
      <div className="so-logistics-grid">
        <section className="so-logistics-column so-logistics-column--left">
          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Ship To</label>
            <div className="sap-input-group so-logistics-field-with-button">
              <select className="so-field__select" name="shipToCode" value={header.shipToCode} onChange={onHeaderChange}>
                <option value="">Select</option>
                {shipToOptions.map(addr => (
                  <option key={addr.Address} value={addr.Address}>{addr.AddressName || addr.Address || addr.CardCode} - {addr.State || 'No State'}</option>
                ))}
              </select>
              <button type="button" className="so-btn so-btn--lookup" onClick={() => onOpenAddressModal('shipTo')} title="Select Address">...</button>
            </div>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--address">
            <span aria-hidden="true" />
            <textarea className="so-textarea" rows={3} name="shipToAddress" value={header.shipToAddress || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Bill To</label>
            <div className="sap-input-group so-logistics-field-with-button">
              <select className="so-field__select" name="billToCode" value={header.billToCode} onChange={onHeaderChange}>
                <option value="">Select</option>
                {billToOptions.map(addr => (
                  <option key={addr.Address} value={addr.Address}>{addr.AddressName || addr.Address || addr.CardCode} - {addr.State || 'No State'}</option>
                ))}
              </select>
              <button type="button" className="so-btn so-btn--lookup" onClick={() => onOpenAddressModal('billTo')} title="Select Address">...</button>
            </div>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--address">
            <span aria-hidden="true" />
            <textarea className="so-textarea" rows={3} name="billToAddress" value={header.billToAddress || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Shipping Type</label>
            <select className="so-field__select" name="shippingType" value={header.shippingType} onChange={onHeaderChange}>
              <option value="">Select</option>
              {shipTypeOpts.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--checkbox">
            <label className="sap-checkbox-row so-logistics-checkbox-row">
              <input type="checkbox" id="useBillToForTax" name="useBillToForTax" checked={header.useBillToForTax || false} onChange={onHeaderChange} />
              <span>Use Bill to Address to Determine Tax</span>
            </label>
          </div>

        </section>

        <section className="so-logistics-column so-logistics-column--right">
          <div className="sap-form-row so-logistics-row so-logistics-row--checkbox">
            <label className="sap-checkbox-row so-logistics-checkbox-row">
              <input type="checkbox" name="printPickingSheet" checked={Boolean(header.printPickingSheet)} onChange={onHeaderChange} />
              <span>Print Picking Sheet</span>
            </label>
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Language</label>
            <select className="so-field__select" name="language" value={header.language || '8'} onChange={onHeaderChange}>
              <option value="">Select</option>
              <option value="8">English (UK)</option>
              <option value="3">English (US)</option>
              <option value="26">Hindi</option>
            </select>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--checkbox">
            <label className="sap-checkbox-row so-logistics-checkbox-row">
              <input type="checkbox" name="procureNonDropShipItems" checked={Boolean(header.procureNonDropShipItems)} onChange={onHeaderChange} />
              <span>Procure Non Drop-Ship Items</span>
            </label>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--checkbox">
            <label className="sap-checkbox-row so-logistics-checkbox-row">
              <input type="checkbox" name="procureDropShipItems" checked={header.procureDropShipItems !== false} onChange={onHeaderChange} />
              <span>Procure Drop-Ship Items</span>
            </label>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--checkbox">
            <label className="sap-checkbox-row so-logistics-checkbox-row">
              <input type="checkbox" name="confirmed" checked={Boolean(header.confirmed)} onChange={onHeaderChange} />
              <span>Approved</span>
            </label>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--checkbox">
            <label className="sap-checkbox-row so-logistics-checkbox-row">
              <input type="checkbox" name="allowPartialDelivery" checked={header.allowPartialDelivery !== false} onChange={onHeaderChange} />
              <span>Allow Partial Delivery</span>
            </label>
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Pick and Pack Remarks</label>
            <input className="so-field__input" name="pickAndPackRemarks" value={header.pickAndPackRemarks || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">BP Channel Name</label>
            <input className="so-field__input" name="bpChannelName" value={header.bpChannelName || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">BP Channel Contact</label>
            <select className="so-field__select" name="bpChannelContact" value={header.bpChannelContact || ''} onChange={onHeaderChange}>
              <option value="">Select</option>
            </select>
          </div>
        </section>
      </div>
    </div>
  );
}

