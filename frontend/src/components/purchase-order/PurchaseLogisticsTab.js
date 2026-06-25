import React from 'react';

export const PURCHASE_LOGISTICS_LANGUAGE_OPTIONS = [
  { value: '3', label: 'English' },
  { value: '8', label: 'Hindi' },
  { value: '26', label: 'Gujarati' },
];

export const PURCHASE_LOGISTICS_SELECT_OPTION = { value: '', label: 'Select' };

export const formatPurchaseLogisticsAddress = (address) => {
  if (!address) return '';

  return [
    [address.Street, address.StreetNo],
    [address.Block, address.Building, address.Address2, address.Address3],
    [address.City, address.County, address.State, address.ZipCode],
    [address.Country],
  ]
    .map((parts) => parts.filter(Boolean).join(', '))
    .filter(Boolean)
    .join('\n');
};

export default function PurchaseLogisticsTab({
  header,
  onHeaderChange,
  vendorPayToAddresses = [],
  vendorBillToAddresses = [],
  shippingTypeOptions = [],
  onPayToCodeChange,
  onOpenAddressModal,
}) {
  const payToOptions = vendorPayToAddresses.length ? vendorPayToAddresses : vendorBillToAddresses;
  const hasCurrentLanguageOption = PURCHASE_LOGISTICS_LANGUAGE_OPTIONS.some((option) => String(option.value) === String(header.language || ''));

  const emitHeaderChange = (name, value, type = 'text', checked = false) => {
    onHeaderChange?.({ target: { name, value, type, checked } });
  };

  const handlePayToChange = (event) => {
    if (onPayToCodeChange) {
      onPayToCodeChange(event);
      return;
    }

    const selectedCode = event.target.value;
    const selectedAddress = payToOptions.find((address) => String(address.Address || '') === String(selectedCode || ''));
    const formattedAddress = selectedAddress ? formatPurchaseLogisticsAddress(selectedAddress) : '';

    emitHeaderChange('payToCode', selectedCode);
    emitHeaderChange('payTo', formattedAddress);
    emitHeaderChange('payToAddress', formattedAddress);
  };

  return (
    <div className="po-tab-panel po-logistics-tab">
      <div className="po-logistics-grid">
        <div className="po-logistics-left">
          <div className="po-field po-logistics-address-field">
            <label className="po-field__label">Bill To</label>
            <div className="po-logistics-address-control">
              <textarea
                className="po-textarea"
                rows={3}
                name="billTo"
                value={header.billToAddress || header.billTo || ''}
                onChange={onHeaderChange}
              />
              <button
                type="button"
                className="po-lookup-btn"
                onClick={() => onOpenAddressModal('billTo')}
                title="Select Address"
              >
                ...
              </button>
            </div>
          </div>

          <div className="po-field">
            <label className="po-field__label">Pay to</label>
            <div className="po-logistics-code-control">
              <select
                className="po-field__select"
                name="payToCode"
                value={header.payToCode || ''}
                onChange={handlePayToChange}
              >
                <option value={PURCHASE_LOGISTICS_SELECT_OPTION.value}>{PURCHASE_LOGISTICS_SELECT_OPTION.label}</option>
                {payToOptions.map((addr) => (
                  <option key={addr.Address} value={addr.Address}>
                    {addr.AddressName || addr.Address || addr.CardCode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="po-field po-logistics-address-field">
            <label className="po-field__label" />
            <div className="po-logistics-address-control">
              <textarea
                className="po-textarea"
                rows={3}
                name="payTo"
                value={header.payToAddress || header.payTo || ''}
                onChange={onHeaderChange}
              />
              <button
                type="button"
                className="po-lookup-btn"
                onClick={() => onOpenAddressModal('payTo')}
                title="Select Address"
              >
                ...
              </button>
            </div>
          </div>

          <div className="po-field">
            <label className="po-field__label">Shipping Type</label>
            <select
              className="po-field__select"
              name="shippingType"
              value={header.shippingType || ''}
              onChange={onHeaderChange}
            >
              <option value={PURCHASE_LOGISTICS_SELECT_OPTION.value}>{PURCHASE_LOGISTICS_SELECT_OPTION.label}</option>
              {shippingTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="po-field">
            <label className="po-field__label" />
            <label className="po-checkbox-label">
              <input
                type="checkbox"
                name="usePayToForTax"
                checked={header.usePayToForTax || false}
                onChange={onHeaderChange}
              />
              <span>Use Pay to Address to Determine Tax</span>
            </label>
          </div>
        </div>

        <div className="po-logistics-right">
          <div className="po-field">
            <label className="po-field__label">Language</label>
            <select
              className="po-field__select"
              name="language"
              value={header.language || ''}
              onChange={onHeaderChange}
            >
              <option value={PURCHASE_LOGISTICS_SELECT_OPTION.value}>{PURCHASE_LOGISTICS_SELECT_OPTION.label}</option>
              {PURCHASE_LOGISTICS_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              {header.language && !hasCurrentLanguageOption && (
                <option value={header.language}>{header.language}</option>
              )}
            </select>
          </div>

          <div className="po-field">
            <label className="po-field__label" />
            <label className="po-checkbox-label">
              <input type="checkbox" name="splitPurchaseOrder" checked={header.splitPurchaseOrder || false} onChange={onHeaderChange} />
              <span>Split Purchase Order</span>
            </label>
          </div>

          <div className="po-field">
            <label className="po-field__label" />
            <label className="po-checkbox-label">
              <input type="checkbox" name="confirmed" checked={header.confirmed || false} onChange={onHeaderChange} />
              <span>Approved</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
