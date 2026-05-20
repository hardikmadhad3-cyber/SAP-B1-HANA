export default function LogisticsTab({
  header,
  onHeaderChange,
  vendorPayToAddresses,
  vendorShipToAddresses,
  vendorBillToAddresses,
  shippingTypeOptions,
  onShipToCodeChange,
  onOpenAddressModal,
}) {
  return (
    <div className="po-tab-panel">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
        {/* Left Column */}
        <div>
          <div className="po-section-title">Shipping Information</div>
          
          <div className="po-field">
            <label className="po-field__label">Ship To Code</label>
            <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
              <select
                className="po-field__select"
                name="shipToCode"
                value={header.shipToCode}
                onChange={onShipToCodeChange}
                style={{ flex: 1 }}
              >
                <option value="">Select</option>
                {(vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses).map(a => (
                  <option key={a.Address} value={a.Address}>
                    {a.AddressName || a.Address} - {a.State || 'No State'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onOpenAddressModal('shipTo')}
                style={{
                  padding: '0 8px',
                  fontSize: 11,
                  border: '1px solid #a0aab4',
                  background: 'linear-gradient(180deg, #fff 0%, #e8ecf0 100%)',
                  minWidth: '28px'
                }}
                title="Edit Address"
              >
                ...
              </button>
            </div>
          </div>

          <div className="po-field" style={{ alignItems: 'flex-start' }}>
            <label className="po-field__label" style={{ paddingTop: '4px' }}>Ship To Address</label>
            <textarea
              className="po-textarea"
              rows={3}
              name="shipTo"
              value={header.shipTo || ''}
              onChange={onHeaderChange}
              style={{ flex: 1 }}
            />
          </div>

          <div className="po-field">
            <label className="po-field__label">Bill To Code</label>
            <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
              <select
                className="po-field__select"
                name="payToCode"
                value={header.payToCode}
                onChange={onHeaderChange}
                style={{ flex: 1 }}
              >
                <option value="">Select</option>
                {(vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses).map(a => (
                  <option key={a.Address} value={a.Address}>
                    {a.AddressName || a.Address} - {a.State || 'No State'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onOpenAddressModal('payTo')}
                style={{
                  padding: '0 8px',
                  fontSize: 11,
                  border: '1px solid #a0aab4',
                  background: 'linear-gradient(180deg, #fff 0%, #e8ecf0 100%)',
                  minWidth: '28px'
                }}
                title="Edit Address"
              >
                ...
              </button>
            </div>
          </div>

          <div className="po-field" style={{ alignItems: 'flex-start' }}>
            <label className="po-field__label" style={{ paddingTop: '4px' }}>Bill To Address</label>
            <textarea
              className="po-textarea"
              rows={3}
              name="payTo"
              value={header.payTo || ''}
              onChange={onHeaderChange}
              style={{ flex: 1 }}
            />
          </div>

          <div className="po-field">
            <label className="po-field__label"></label>
            <label className="po-checkbox-label">
              <input 
                type="checkbox" 
                name="usePayToForTax"
                checked={header.usePayToForTax || false}
                onChange={onHeaderChange}
              />
              <span>Use Bill To Address to Determine Tax</span>
            </label>
          </div>
        </div>

        {/* Right Column */}
        <div>
          <div className="po-section-title">Delivery Information</div>
          
          <div className="po-field">
            <label className="po-field__label">Shipping Type</label>
            <select
              className="po-field__select"
              name="shippingType"
              value={header.shippingType}
              onChange={onHeaderChange}
            >
              <option value="">Select</option>
              {shippingTypeOptions.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="po-field">
            <label className="po-field__label">Language</label>
            <select
              className="po-field__select"
              name="language"
              value={header.language}
              onChange={onHeaderChange}
            >
              <option value="">Select</option>
              <option>English</option>
              <option>Hindi</option>
              <option>Gujarati</option>
            </select>
          </div>

          <div className="po-field">
            <label className="po-field__label">Tracking No.</label>
            <input className="po-field__input" />
          </div>

          <div className="po-field">
            <label className="po-field__label">To Order</label>
            <input
              className="po-field__input"
              name="toOrder"
              value={header.toOrder}
              onChange={onHeaderChange}
            />
          </div>

          <div className="po-field">
            <label className="po-field__label">Notify Party Code</label>
            <input
              className="po-field__input"
              name="notifyPartyCode"
              value={header.notifyPartyCode}
              onChange={onHeaderChange}
            />
          </div>

          <div className="po-field">
            <label className="po-field__label">Notify Party Name</label>
            <input
              className="po-field__input"
              name="notifyPartyName"
              value={header.notifyPartyName}
              onChange={onHeaderChange}
            />
          </div>

          <div className="po-field" style={{ alignItems: 'flex-start' }}>
            <label className="po-field__label" style={{ paddingTop: '4px' }}>Notify Party Address</label>
            <textarea
              className="po-textarea"
              rows={3}
              name="notifyPartyAddress"
              value={header.notifyPartyAddress}
              onChange={onHeaderChange}
              style={{ flex: 1 }}
            />
          </div>

          <div className="po-field">
            <label className="po-field__label"></label>
            <label className="po-checkbox-label">
              <input
                type="checkbox"
                name="splitPurchaseOrder"
                checked={header.splitPurchaseOrder}
                onChange={onHeaderChange}
              />
              <span>Split Purchase Order</span>
            </label>
          </div>

          <div className="po-field">
            <label className="po-field__label"></label>
            <label className="po-checkbox-label">
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
