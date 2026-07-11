import React from 'react';

const FIELDS = [
  ['Street / PO Box', 'streetPoBox'],
  ['Street No.', 'streetNo'],
  ['Building/Floor/Room', 'buildingFloorRoom'],
  ['Block', 'block'],
  ['City', 'city'],
  ['Zip Code', 'zipCode'],
  ['County', 'county'],
  ['State', 'state', 'state'],
  ['Country/Region', 'countryRegion'],
  ['Address Name 2', 'addressName2'],
  ['Address Name 3', 'addressName3'],
  ['GLN', 'gln'],
  ['ERP Address', 'erpAddress'],
  ['CONTACT-PERSON', 'contactPerson'],
  ['MOBILE', 'mobile'],
  ['Date of Registration', 'dateOfRegistration'],
  ['Date Detl of Reg', 'dateDetailsOfRegistration'],
  ['Status', 'addressStatus'],
  ['GSTIN No', 'gstin'],
];

export default function AddressComponentModal({
  isOpen,
  onClose,
  onSave,
  addressForm = {},
  onFormChange,
  states = [],
}) {
  if (!isOpen) return null;

  return (
    <div className="sap-address-modal__backdrop" onMouseDown={onClose} role="presentation">
      <section
        className="sap-address-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Address Component"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sap-address-modal__header">
          <span>Address Component</span>
          <button type="button" onClick={onClose} aria-label="Close address component">x</button>
        </header>

        <div className="sap-address-modal__body">
          {FIELDS.map(([label, name, type]) => (
            <label className="sap-address-modal__field" key={name}>
              <span>{label}</span>
              {type === 'state' ? (
                <select name={name} value={addressForm[name] || ''} onChange={onFormChange}>
                  <option value="">Select</option>
                  {states.map((state) => {
                    const value = state.Code || state.code || state.Name || state.name || '';
                    const text = state.Name || state.name || state.Code || state.code || '';
                    return <option key={`${value}-${text}`} value={value}>{text}</option>;
                  })}
                  {addressForm[name] && !states.some((state) =>
                    String(state.Code || state.code || state.Name || state.name || '') === String(addressForm[name])) && (
                    <option value={addressForm[name]}>{addressForm[name]}</option>
                  )}
                </select>
              ) : (
                <input name={name} value={addressForm[name] || ''} onChange={onFormChange} />
              )}
            </label>
          ))}
        </div>

        <footer className="sap-address-modal__footer">
          <button type="button" className="sap-address-modal__primary" onClick={onSave}>OK</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </footer>
      </section>
    </div>
  );
}
