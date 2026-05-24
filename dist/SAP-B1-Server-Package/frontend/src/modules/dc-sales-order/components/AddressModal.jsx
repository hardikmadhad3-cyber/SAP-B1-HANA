import React from 'react';

export default function AddressModal({
  isOpen,
  onClose,
  onSave,
  addressForm,
  onFormChange,
  states,
}) {
  if (!isOpen) return null;

  return (
    <div className="so-modal-overlay" onClick={onClose}>
      <div className="so-modal" onClick={e => e.stopPropagation()}>
        <div className="so-modal__header">
          Address Component
          <button type="button" className="so-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="so-modal__body">
          <div className="so-field-grid">
            {/* Street / PO Box */}
            <div className="so-field">
              <label className="so-field__label">Street / PO Box *</label>
              <input
                className="so-field__input"
                name="streetPoBox"
                value={addressForm.streetPoBox}
                onChange={onFormChange}
              />
            </div>

            {/* Street No. */}
            <div className="so-field">
              <label className="so-field__label">Street No.</label>
              <input
                className="so-field__input"
                name="streetNo"
                value={addressForm.streetNo}
                onChange={onFormChange}
              />
            </div>

            {/* Building/Floor/Room */}
            <div className="so-field">
              <label className="so-field__label">Building/Floor/Room</label>
              <input
                className="so-field__input"
                name="buildingFloorRoom"
                value={addressForm.buildingFloorRoom}
                onChange={onFormChange}
              />
            </div>

            {/* Block */}
            <div className="so-field">
              <label className="so-field__label">Block</label>
              <input
                className="so-field__input"
                name="block"
                value={addressForm.block}
                onChange={onFormChange}
              />
            </div>

            {/* City */}
            <div className="so-field">
              <label className="so-field__label">City</label>
              <input
                className="so-field__input"
                name="city"
                value={addressForm.city}
                onChange={onFormChange}
              />
            </div>

            {/* Zip Code */}
            <div className="so-field">
              <label className="so-field__label">Zip Code</label>
              <input
                className="so-field__input"
                name="zipCode"
                value={addressForm.zipCode}
                onChange={onFormChange}
              />
            </div>

            {/* County */}
            <div className="so-field">
              <label className="so-field__label">County</label>
              <input
                className="so-field__input"
                name="county"
                value={addressForm.county}
                onChange={onFormChange}
              />
            </div>

            {/* State */}
            <div className="so-field">
              <label className="so-field__label">State</label>
              <select
                className="so-field__select"
                name="state"
                value={addressForm.state}
                onChange={onFormChange}
              >
                <option value="">— Select —</option>
                {states.map(st => (
                  <option key={st.Code} value={st.Code}>
                    {st.Name}
                  </option>
                ))}
              </select>
            </div>

            {/* Country/Region */}
            <div className="so-field">
              <label className="so-field__label">Country/Region</label>
              <input
                className="so-field__input"
                name="countryRegion"
                value={addressForm.countryRegion}
                onChange={onFormChange}
              />
            </div>

            {/* Address Name 2 */}
            <div className="so-field">
              <label className="so-field__label">Address Name 2</label>
              <input
                className="so-field__input"
                name="addressName2"
                value={addressForm.addressName2}
                onChange={onFormChange}
              />
            </div>

            {/* Address Name 3 */}
            <div className="so-field">
              <label className="so-field__label">Address Name 3</label>
              <input
                className="so-field__input"
                name="addressName3"
                value={addressForm.addressName3}
                onChange={onFormChange}
              />
            </div>

            {/* GLN */}
            <div className="so-field">
              <label className="so-field__label">GLN</label>
              <input
                className="so-field__input"
                name="gln"
                value={addressForm.gln}
                onChange={onFormChange}
              />
            </div>

            {/* GSTIN No */}
            <div className="so-field">
              <label className="so-field__label">GSTIN No</label>
              <input
                className="so-field__input"
                name="gstin"
                value={addressForm.gstin}
                onChange={onFormChange}
              />
            </div>

            {/* Print Picking Sheet */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
              <span style={{ width: '110px' }}></span>
              <input type="checkbox" id="printPickingSheet" style={{ cursor: 'pointer' }} />
              <label htmlFor="printPickingSheet" style={{ cursor: 'pointer', margin: 0, fontSize: 12 }}>
                Print Picking Sheet
              </label>
            </div>

            {/* Language */}
            <div className="so-field">
              <label className="so-field__label">Language</label>
              <select className="so-field__select">
                <option>English</option>
              </select>
            </div>

            {/* Procure Non-Drop-Ship Items */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
              <span style={{ width: '110px' }}></span>
              <input type="checkbox" id="procureNonDrop" style={{ cursor: 'pointer' }} />
              <label htmlFor="procureNonDrop" style={{ cursor: 'pointer', margin: 0, fontSize: 12 }}>
                Procure Non-Drop-Ship Items
              </label>
            </div>

            {/* Procure Drop-Ship Items */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
              <span style={{ width: '110px' }}></span>
              <input type="checkbox" id="procureDrop" style={{ cursor: 'pointer' }} />
              <label htmlFor="procureDrop" style={{ cursor: 'pointer', margin: 0, fontSize: 12 }}>
                Procure Drop-Ship Items
              </label>
            </div>

            {/* Confirmed */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
              <span style={{ width: '110px' }}></span>
              <input type="checkbox" id="confirmed" style={{ cursor: 'pointer' }} />
              <label htmlFor="confirmed" style={{ cursor: 'pointer', margin: 0, fontSize: 12 }}>
                Confirmed
              </label>
            </div>

            {/* Allow Partial Delivery */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
              <span style={{ width: '110px' }}></span>
              <input type="checkbox" id="allowPartial" style={{ cursor: 'pointer' }} />
              <label htmlFor="allowPartial" style={{ cursor: 'pointer', margin: 0, fontSize: 12 }}>
                Allow Partial Delivery
              </label>
            </div>

            {/* Pick and Pack Remarks */}
            <div className="so-field">
              <label className="so-field__label">Pick & Pack Remarks</label>
              <input className="so-field__input" />
            </div>

            {/* BP Channel Name */}
            <div className="so-field">
              <label className="so-field__label">BP Channel Name</label>
              <input className="so-field__input" />
            </div>

            {/* BP Channel Contact */}
            <div className="so-field">
              <label className="so-field__label">BP Channel Contact</label>
              <select className="so-field__select">
                <option value="">— Select —</option>
              </select>
            </div>
          </div>
        </div>
        <div className="so-modal__footer">
          <button type="button" className="so-btn so-btn--primary" onClick={onSave}>
            OK
          </button>
          <button type="button" className="so-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
