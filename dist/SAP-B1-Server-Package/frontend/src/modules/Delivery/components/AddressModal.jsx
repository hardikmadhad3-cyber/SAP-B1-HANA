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
    <div className="del-modal-overlay" onClick={onClose}>
      <div className="del-modal" onClick={e => e.stopPropagation()}>
        <div className="del-modal__header">
          Address Component
          <button type="button" className="del-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="del-modal__body">
          <div className="del-field-grid">
            {/* Street / PO Box */}
            <div className="del-field">
              <label className="del-field__label">Street / PO Box *</label>
              <input
                className="del-field__input"
                name="streetPoBox"
                value={addressForm.streetPoBox}
                onChange={onFormChange}
              />
            </div>

            {/* Street No. */}
            <div className="del-field">
              <label className="del-field__label">Street No.</label>
              <input
                className="del-field__input"
                name="streetNo"
                value={addressForm.streetNo}
                onChange={onFormChange}
              />
            </div>

            {/* Building/Floor/Room */}
            <div className="del-field">
              <label className="del-field__label">Building/Floor/Room</label>
              <input
                className="del-field__input"
                name="buildingFloorRoom"
                value={addressForm.buildingFloorRoom}
                onChange={onFormChange}
              />
            </div>

            {/* Block */}
            <div className="del-field">
              <label className="del-field__label">Block</label>
              <input
                className="del-field__input"
                name="block"
                value={addressForm.block}
                onChange={onFormChange}
              />
            </div>

            {/* City */}
            <div className="del-field">
              <label className="del-field__label">City</label>
              <input
                className="del-field__input"
                name="city"
                value={addressForm.city}
                onChange={onFormChange}
              />
            </div>

            {/* Zip Code */}
            <div className="del-field">
              <label className="del-field__label">Zip Code</label>
              <input
                className="del-field__input"
                name="zipCode"
                value={addressForm.zipCode}
                onChange={onFormChange}
              />
            </div>

            {/* County */}
            <div className="del-field">
              <label className="del-field__label">County</label>
              <input
                className="del-field__input"
                name="county"
                value={addressForm.county}
                onChange={onFormChange}
              />
            </div>

            {/* State */}
            <div className="del-field">
              <label className="del-field__label">State</label>
              <select
                className="del-field__select"
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
            <div className="del-field">
              <label className="del-field__label">Country/Region</label>
              <input
                className="del-field__input"
                name="countryRegion"
                value={addressForm.countryRegion}
                onChange={onFormChange}
              />
            </div>

            {/* Address Name 2 */}
            <div className="del-field">
              <label className="del-field__label">Address Name 2</label>
              <input
                className="del-field__input"
                name="addressName2"
                value={addressForm.addressName2}
                onChange={onFormChange}
              />
            </div>

            {/* Address Name 3 */}
            <div className="del-field">
              <label className="del-field__label">Address Name 3</label>
              <input
                className="del-field__input"
                name="addressName3"
                value={addressForm.addressName3}
                onChange={onFormChange}
              />
            </div>

            {/* GLN */}
            <div className="del-field">
              <label className="del-field__label">GLN</label>
              <input
                className="del-field__input"
                name="gln"
                value={addressForm.gln}
                onChange={onFormChange}
              />
            </div>

            {/* GSTIN No */}
            <div className="del-field">
              <label className="del-field__label">GSTIN No</label>
              <input
                className="del-field__input"
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
            <div className="del-field">
              <label className="del-field__label">Language</label>
              <select className="del-field__select">
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
            <div className="del-field">
              <label className="del-field__label">Pick & Pack Remarks</label>
              <input className="del-field__input" />
            </div>

            {/* BP Channel Name */}
            <div className="del-field">
              <label className="del-field__label">BP Channel Name</label>
              <input className="del-field__input" />
            </div>

            {/* BP Channel Contact */}
            <div className="del-field">
              <label className="del-field__label">BP Channel Contact</label>
              <select className="del-field__select">
                <option value="">— Select —</option>
              </select>
            </div>
          </div>
        </div>
        <div className="del-modal__footer">
          <button type="button" className="del-btn del-btn--primary" onClick={onSave}>
            OK
          </button>
          <button type="button" className="del-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
