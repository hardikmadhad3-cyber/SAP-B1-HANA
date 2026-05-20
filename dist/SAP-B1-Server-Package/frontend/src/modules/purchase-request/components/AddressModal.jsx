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
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: '#6c757d', color: 'white', padding: '8px 16px' }}>
            <h6 className="modal-title mb-0">Address Component</h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ padding: '16px' }}>
            <div className="row g-3">
              <div className="col-md-6">
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    Street / PO Box <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    className="form-control form-control-sm"
                    style={{ background: '#ffffcc' }}
                    name="streetNo"
                    value={addressForm.streetNo}
                    onChange={onFormChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    Street No.
                  </label>
                  <input className="form-control form-control-sm" />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    Building/Floor/Room
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="buildingFloorRoom"
                    value={addressForm.buildingFloorRoom}
                    onChange={onFormChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    Block
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="block"
                    value={addressForm.block}
                    onChange={onFormChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    City
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="city"
                    value={addressForm.city}
                    onChange={onFormChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    Zip Code
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="zipCode"
                    value={addressForm.zipCode}
                    onChange={onFormChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    County
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="county"
                    value={addressForm.county}
                    onChange={onFormChange}
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    State
                  </label>
                  <select
                    className="form-control form-control-sm"
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
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    Country/Region
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="countryRegion"
                    value={addressForm.countryRegion}
                    onChange={onFormChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    Address Name 2
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="addressName2"
                    value={addressForm.addressName2}
                    onChange={onFormChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    Address Name 3
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="addressName3"
                    value={addressForm.addressName3}
                    onChange={onFormChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    GLN
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="gln"
                    value={addressForm.gln}
                    onChange={onFormChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                    GSTIN No
                  </label>
                  <input
                    className="form-control form-control-sm"
                    name="gstin"
                    value={addressForm.gstin}
                    onChange={onFormChange}
                  />
                </div>
              </div>
            </div>
            <div className="row mt-3">
              <div className="col-md-6">
                <div className="form-check">
                  <input type="checkbox" className="form-check-input" id="printPickingSheet" />
                  <label className="form-check-label" htmlFor="printPickingSheet">
                    Print Picking Sheet
                  </label>
                </div>
                <div className="mb-2 mt-2">
                  <label className="form-label" style={{ fontSize: 11 }}>
                    Language
                  </label>
                  <select className="form-control form-control-sm">
                    <option>English</option>
                  </select>
                </div>
                <div className="form-check">
                  <input type="checkbox" className="form-check-input" id="procureNonDrop" />
                  <label className="form-check-label" htmlFor="procureNonDrop">
                    Procure Non-Drop-Ship Items
                  </label>
                </div>
                <div className="form-check">
                  <input type="checkbox" className="form-check-input" id="procureDrop" />
                  <label className="form-check-label" htmlFor="procureDrop">
                    Procure Drop-Ship Items
                  </label>
                </div>
                <div className="form-check">
                  <input type="checkbox" className="form-check-input" id="confirmed" />
                  <label className="form-check-label" htmlFor="confirmed">
                    Confirmed
                  </label>
                </div>
                <div className="form-check">
                  <input type="checkbox" className="form-check-input" id="allowPartial" />
                  <label className="form-check-label" htmlFor="allowPartial">
                    Allow Partial Delivery
                  </label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11 }}>
                    Pick and Pack Remarks
                  </label>
                  <input className="form-control form-control-sm" />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11 }}>
                    BP Channel Name
                  </label>
                  <input className="form-control form-control-sm" />
                </div>
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 11 }}>
                    BP Channel Contact
                  </label>
                  <select className="form-control form-control-sm">
                    <option value="">— Select —</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ padding: '8px 16px' }}>
            <button type="button" className="btn btn-warning btn-sm px-4" onClick={onSave}>
              OK
            </button>
            <button type="button" className="btn btn-secondary btn-sm px-4" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
