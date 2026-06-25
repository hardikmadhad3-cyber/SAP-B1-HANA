import React from 'react';

export default function AddressModal({
  isOpen,
  onClose,
  onSave,
  addressForm,
  onFormChange,
  states = [],
}) {
  if (!isOpen) return null;

  return (
    <div className="po-modal-overlay" onClick={onClose}>
      <div className="po-modal po-address-modal" onClick={(event) => event.stopPropagation()}>
        <div className="po-modal__header">
          <span>Address Component</span>
          <button type="button" className="po-modal__close" onClick={onClose}>x</button>
        </div>

        <div className="po-modal__body po-address-modal__body">
          <div className="po-address-field">
            <label>Street / PO Box</label>
            <input name="streetPoBox" value={addressForm.streetPoBox || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>Street No.</label>
            <input name="streetNo" value={addressForm.streetNo || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>Building/Floor/Room</label>
            <input name="buildingFloorRoom" value={addressForm.buildingFloorRoom || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>Block</label>
            <input name="block" value={addressForm.block || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>City</label>
            <input name="city" value={addressForm.city || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>Zip Code</label>
            <input name="zipCode" value={addressForm.zipCode || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>County</label>
            <input name="county" value={addressForm.county || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>State</label>
            <select name="state" value={addressForm.state || ''} onChange={onFormChange}>
              <option value="">Select</option>
              {states.map((state) => (
                <option key={state.Code || state.Name} value={state.Code || state.Name}>
                  {state.Name || state.Code}
                </option>
              ))}
              {addressForm.state && !states.some((state) => String(state.Code || state.Name) === String(addressForm.state)) && (
                <option value={addressForm.state}>{addressForm.state}</option>
              )}
            </select>
          </div>
          <div className="po-address-field">
            <label>Country/Region</label>
            <input name="countryRegion" value={addressForm.countryRegion || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>Address Name 2</label>
            <input name="addressName2" value={addressForm.addressName2 || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>Address Name 3</label>
            <input name="addressName3" value={addressForm.addressName3 || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>GLN</label>
            <input name="gln" value={addressForm.gln || ''} onChange={onFormChange} />
          </div>
          <div className="po-address-field">
            <label>GSTIN No</label>
            <input name="gstin" value={addressForm.gstin || ''} onChange={onFormChange} />
          </div>
        </div>

        <div className="po-modal__footer">
          <button type="button" className="po-btn po-btn--primary" onClick={onSave}>OK</button>
          <button type="button" className="po-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
