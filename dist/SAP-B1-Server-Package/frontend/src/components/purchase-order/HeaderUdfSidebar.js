import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBP, searchBP } from '../../api/businessPartnerApi';
import BusinessPartnerModal from '../../modules/sales-order/components/BusinessPartnerModal';

const SELLER_CODE_KEY = 'U_Seller_Code';
const SELLER_NAME_KEY = 'U_Seller_Name';
const SELLER_ADDRESS_ID_KEY = 'U_Seller_AddressId';
const SELLER_ADDRESS_KEY = 'U_Seller_Address';
const SELLER_BP_TYPE = 'cSupplier';
const BILL_TO_PARTY_BP_TYPE = 'cCustomer';

const normalizeFieldText = (value) =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const getFieldIdentity = (field) => normalizeFieldText(
  `${String(field?.key || '').replace(/^U_/i, '')} ${field?.label || ''}`
);

const isSellerCodeField = (field) =>
  String(field?.key || '') === SELLER_CODE_KEY ||
  String(field?.label || '').trim().toLowerCase() === 'seller code';

const isToVendorCodeField = (field) => {
  const identity = getFieldIdentity(field);
  const label = normalizeFieldText(field?.label);
  return label === 'tocodevendor' ||
    label === 'tovendorcode' ||
    identity.includes('tocodevendor') ||
    identity.includes('tovendorcode');
};

const isToVendorNameField = (field) => {
  const identity = getFieldIdentity(field);
  const label = normalizeFieldText(field?.label);
  return label === 'toname' ||
    label === 'tovendorname' ||
    identity.includes('toname') ||
    identity.includes('tovendorname');
};

const isToVendorAddressIdField = (field) => {
  const identity = getFieldIdentity(field);
  const label = normalizeFieldText(field?.label);
  return label === 'toaddressid' ||
    label === 'tovendoraddressid' ||
    identity.includes('toaddressid') ||
    identity.includes('tovendoraddressid');
};

const isToVendorAddressField = (field) => {
  if (isToVendorAddressIdField(field)) return false;
  const identity = getFieldIdentity(field);
  const label = normalizeFieldText(field?.label);
  return label === 'toaddress' ||
    label === 'tovendoraddress' ||
    identity.includes('toaddress') ||
    identity.includes('tovendoraddress');
};

const isBillToPartyCodeField = (field) => {
  if (isSellerCodeField(field) || isToVendorCodeField(field)) return false;
  const identity = getFieldIdentity(field);
  const label = normalizeFieldText(field?.label);
  const key = normalizeFieldText(String(field?.key || '').replace(/^U_/i, ''));

  return label === 'billtopartycode' ||
    label === 'billpartycode' ||
    label === 'partycode' ||
    key === 'billtopartycode' ||
    key === 'billpartycode' ||
    key === 'partycode' ||
    identity.includes('billtopartycode') ||
    identity.includes('billpartycode');
};

const isBillToPartyNameField = (field) => {
  const identity = getFieldIdentity(field);
  const label = normalizeFieldText(field?.label);
  const key = normalizeFieldText(String(field?.key || '').replace(/^U_/i, ''));

  return label === 'billtopartyname' ||
    label === 'billpartyname' ||
    label === 'partyname' ||
    key === 'billtopartyname' ||
    key === 'billpartyname' ||
    key === 'partyname' ||
    identity.includes('billtopartyname') ||
    identity.includes('billpartyname');
};

const isBillToPartyAddressIdField = (field) => {
  const identity = getFieldIdentity(field);
  const label = normalizeFieldText(field?.label);
  const key = normalizeFieldText(String(field?.key || '').replace(/^U_/i, ''));

  return label === 'billtopartyaddressid' ||
    label === 'billtoaddressid' ||
    label === 'partyaddressid' ||
    key === 'billtopartyaddressid' ||
    key === 'billtoaddressid' ||
    key === 'partyaddressid' ||
    identity.includes('billtopartyaddressid') ||
    identity.includes('billtoaddressid') ||
    identity.includes('partyaddressid');
};

const isBillToPartyAddressField = (field) => {
  if (isBillToPartyAddressIdField(field)) return false;
  const identity = getFieldIdentity(field);
  const label = normalizeFieldText(field?.label);
  const key = normalizeFieldText(String(field?.key || '').replace(/^U_/i, ''));

  return label === 'billtopartyaddress' ||
    label === 'billtoaddressbillto' ||
    label === 'billpartyaddress' ||
    label === 'partyaddress' ||
    key === 'billtopartyaddress' ||
    key === 'billtoaddressbillto' ||
    key === 'billpartyaddress' ||
    key === 'partyaddress' ||
    identity.includes('billtopartyaddress') ||
    identity.includes('billtoaddressbillto') ||
    identity.includes('billpartyaddress');
};

const isSellerAddressField = (field) =>
  String(field?.key || '') === SELLER_ADDRESS_KEY ||
  normalizeFieldText(field?.label) === 'selleraddress';

const isSellerAddressIdField = (field) =>
  String(field?.key || '') === SELLER_ADDRESS_ID_KEY ||
  normalizeFieldText(field?.label) === 'selleraddressidshipfrom' ||
  normalizeFieldText(field?.label) === 'selleraddressid';

const isSellerContactPersonField = (field) => {
  const normalizedKey = normalizeFieldText(String(field?.key || '').replace(/^U_/, ''));
  const normalizedLabel = normalizeFieldText(field?.label);

  return normalizedLabel === 'sellercontactperson' ||
    normalizedLabel === 'sellerperson' ||
    normalizedKey === 'sellercontactperson' ||
    normalizedKey === 'sellerperson';
};

const isToVendorContactIdField = (field) => {
  if (isSellerContactPersonField(field)) return false;

  const identity = getFieldIdentity(field);
  const label = normalizeFieldText(field?.label);
  const key = normalizeFieldText(String(field?.key || '').replace(/^U_/i, ''));

  return label === 'contactid' ||
    label === 'contactpersonid' ||
    label === 'bpcontactid' ||
    label === 'buyercontactid' ||
    label === 'tocontactid' ||
    label === 'tovendorcontactid' ||
    label === 'vendorcontactid' ||
    label === 'cntctname' ||
    key === 'contactid' ||
    key === 'contactpersonid' ||
    key === 'bpcontactid' ||
    key === 'buyercontactid' ||
    key === 'tocontactid' ||
    key === 'tovendorcontactid' ||
    key === 'vendorcontactid' ||
    key === 'cntctid' ||
    key === 'cntctname' ||
    identity.includes('tocontactid') ||
    identity.includes('tovendorcontactid') ||
    identity.includes('vendorcontactid');
};

const sortHeaderUdfFields = (fields = []) => {
  const sellerAddressIndex = fields.findIndex(isSellerAddressField);
  const sellerContactIndex = fields.findIndex(isSellerContactPersonField);

  if (sellerAddressIndex < 0 || sellerContactIndex < 0 || sellerContactIndex === sellerAddressIndex + 1) {
    return fields;
  }

  const nextFields = [...fields];
  const [sellerContactField] = nextFields.splice(sellerContactIndex, 1);
  const nextSellerAddressIndex = nextFields.findIndex(isSellerAddressField);

  nextFields.splice(nextSellerAddressIndex + 1, 0, sellerContactField);
  return nextFields;
};

const normalizeBPCardType = (cardType) => {
  if (cardType === 'cCustomer') return 'C';
  if (cardType === 'cSupplier') return 'S';
  if (cardType === 'cLead') return 'L';
  return cardType || '';
};

const getAddressId = (address) =>
  address?.AddressName || address?.Address || address?.AddressID || address?.AddressId || '';

const isShipToAddress = (address) => {
  const type = String(address?.AddressType || address?.AddrType || address?.AdresType || '').toUpperCase();
  return type.includes('SHIP') || type === 'S';
};

const isBillToAddress = (address) => {
  const type = String(address?.AddressType || address?.AddrType || address?.AdresType || '').toUpperCase();
  return type.includes('BILL') || type === 'B';
};

const hasAddressType = (address) =>
  String(address?.AddressType || address?.AddrType || address?.AdresType || '').trim() !== '';

const filterBillToAddresses = (addresses = []) => {
  const usableAddresses = (Array.isArray(addresses) ? addresses : [])
    .filter((address) => getAddressId(address));
  const billToAddresses = usableAddresses.filter(isBillToAddress);

  if (billToAddresses.length) return billToAddresses;
  return usableAddresses.some(hasAddressType) ? [] : usableAddresses;
};

const selectSellerAddress = (addresses = [], seller = {}) => {
  const usableAddresses = (Array.isArray(addresses) ? addresses : [])
    .filter((address) => getAddressId(address));

  if (!usableAddresses.length) return null;

  const defaultShipTo = String(seller.ShipToDefault || seller.ShipToDef || seller.ShipTo || '').trim();
  if (defaultShipTo) {
    const match = usableAddresses.find((address) => String(getAddressId(address)).trim() === defaultShipTo);
    if (match) return match;
  }

  return usableAddresses.find(isShipToAddress)
    || usableAddresses.find(isBillToAddress)
    || usableAddresses[0];
};

const selectBillToPartyAddress = (addresses = [], party = {}) => {
  const usableAddresses = filterBillToAddresses(addresses);

  if (!usableAddresses.length) return null;

  const defaultBillTo = String(
    party.BilltoDefault ||
    party.BillToDef ||
    party.BillToDefault ||
    party.PayToDefault ||
    party.PayToDef ||
    party.PayTo ||
    ''
  ).trim();
  if (defaultBillTo) {
    const match = usableAddresses.find((address) => String(getAddressId(address)).trim() === defaultBillTo);
    if (match) return match;
  }

  return usableAddresses.find(isBillToAddress)
    || usableAddresses[0];
};

const formatSellerAddress = (address) => {
  if (!address) return '';

  return [
    [address.Street, address.StreetNo],
    [address.Block, address.Building, address.BuildingFloorRoom, address.Address2, address.AddressName2, address.Address3, address.AddressName3],
    [address.City, address.County, address.State, address.ZipCode],
    [address.Country],
  ]
    .map((parts) => parts.filter((part) => String(part || '').trim()).join(', '))
    .filter(Boolean)
    .join('\n');
};

const formatAddressRowText = (address) =>
  formatSellerAddress(address).replace(/\s*\n\s*/g, ' ').trim();

const getAddressTypeText = (address) => {
  const rawType = String(address?.AddressType || address?.AddrType || address?.AdresType || '').trim().toUpperCase();
  if (rawType.includes('BILL') || rawType === 'B' || rawType === 'BO_BILLTO') return 'Bill To';
  if (rawType.includes('SHIP') || rawType === 'S' || rawType === 'BO_SHIPTO') return 'Ship To';
  return '';
};

const getAddressLineKey = (address, fallbackIndex = 0) =>
  String(address?.LineNum ?? address?.RowNum ?? address?.AddressID ?? address?.AddressId ?? fallbackIndex);

const getAddressOptionKey = (address, fallbackIndex = 0) => [
  getAddressId(address),
  getAddressTypeText(address),
  getAddressLineKey(address, fallbackIndex),
  formatAddressRowText(address),
].map((part) => String(part || '').trim().toLowerCase()).join('::');

const getAddressDedupeKey = (address) => [
  getAddressId(address),
  getAddressTypeText(address),
  formatAddressRowText(address),
].map((part) => String(part || '').trim().toLowerCase()).join('::');

const dedupeAddresses = (addresses = []) => {
  const seen = new Set();

  return (Array.isArray(addresses) ? addresses : []).filter((address) => {
    if (!getAddressId(address)) return false;

    const key = getAddressDedupeKey(address);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

const getAddressListSignature = (addresses = []) =>
  (Array.isArray(addresses) ? addresses : [])
    .map((address, index) => getAddressOptionKey(address, index))
    .join('|');

const areAddressListsEqual = (left = [], right = []) =>
  getAddressListSignature(left) === getAddressListSignature(right);

const getContactName = (contact) =>
  String(
    contact?.Name ||
    contact?.ContactPerson ||
    [contact?.FirstName, contact?.MiddleName, contact?.LastName].filter(Boolean).join(' ') ||
    ''
  ).trim();

const isActiveContact = (contact) => {
  const active = String(contact?.Active || contact?.active || '').trim().toUpperCase();
  return !active || active === 'Y' || active === 'YES' || active === 'TYES' || active === '1';
};

const selectSellerContactPerson = (seller = {}) => {
  const directContact = String(
    seller.ContactPerson ||
    seller.ContactPersonName ||
    seller.DefaultContactPerson ||
    ''
  ).trim();

  if (directContact) return directContact;

  const contacts = Array.isArray(seller.ContactEmployees) ? seller.ContactEmployees : [];
  const activeContact = contacts.find((contact) => getContactName(contact) && isActiveContact(contact));
  return getContactName(activeContact || contacts.find(getContactName));
};

const getContactCode = (contact) =>
  String(
    contact?.CntctCode ??
    contact?.InternalCode ??
    contact?.ContactCode ??
    contact?.ContactID ??
    contact?.ContactId ??
    contact?.ContactPersonCode ??
    contact?.Code ??
    contact?.id ??
    ''
  ).trim();

const getContactDisplayValue = (contact) =>
  getContactName(contact) || getContactCode(contact);

const selectBusinessPartnerContactId = (bp = {}) => {
  const contacts = [
    ...(Array.isArray(bp?.contacts) ? bp.contacts : []),
    ...(Array.isArray(bp?.ContactEmployees) ? bp.ContactEmployees : []),
  ];
  const directContactCode = String(
    bp.ContactPersonCode ??
    bp.ContactPersonID ??
    bp.DefaultContactPersonCode ??
    bp.CntctCode ??
    ''
  ).trim();

  if (directContactCode) {
    const matchingContact = contacts.find((contact) => getContactCode(contact) === directContactCode);
    return getContactDisplayValue(matchingContact) || directContactCode;
  }

  const directContactName = String(
    bp.ContactPerson ||
    bp.ContactPersonName ||
    bp.DefaultContactPerson ||
    ''
  ).trim();

  if (directContactName) {
    const normalizedDirectName = normalizeFieldText(directContactName);
    const matchingContact = contacts.find((contact) =>
      normalizeFieldText(getContactName(contact)) === normalizedDirectName ||
      String(getContactCode(contact)) === directContactName
    );
    const matchingContactValue = getContactDisplayValue(matchingContact);
    if (matchingContactValue) return matchingContactValue;
    return directContactName;
  }

  const activeContact = contacts.find((contact) => getContactDisplayValue(contact) && isActiveContact(contact));
  const fallbackContact = activeContact || contacts.find((contact) => getContactDisplayValue(contact));
  return getContactDisplayValue(fallbackContact) || '';
};

function renderField(field, value, disabled, onChange, onLookup) {
  if (field.type === 'checkbox') {
    const checked = ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase());
    return (
      <input
        type="checkbox"
        className="form-check-input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked ? 'Y' : 'N')}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className="form-control form-control-sm"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {(field.options || []).map((option) => {
          const normalizedOption = typeof option === 'object'
            ? option
            : { value: option, label: option };

          return (
            <option key={normalizedOption.value} value={normalizedOption.value}>
              {normalizedOption.label}
            </option>
          );
        })}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        rows={3}
        className="form-control form-control-sm"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  const input = (
    <input
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      className="form-control form-control-sm"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );

  if (typeof onLookup === 'function') {
    return (
      <div className="po-udf-lookup-control">
        <div className="po-udf-lookup-control__field">
          {input}
        </div>
        <button
          type="button"
          className="btn btn-sm po-udf-lookup-control__button"
          onClick={onLookup}
          disabled={disabled}
          title="List of Business Partners"
          aria-label="List of Business Partners"
        >
          ...
        </button>
      </div>
    );
  }

  return (
    input
  );
}

function renderLookupControl(control, onLookup, disabled, title = 'Lookup') {
  return (
    <div className="po-udf-lookup-control">
      <div className="po-udf-lookup-control__field">
        {control}
      </div>
      <button
        type="button"
        className="btn btn-sm po-udf-lookup-control__button"
        onClick={onLookup}
        disabled={disabled}
        title={title}
        aria-label={title}
      >
        ...
      </button>
    </div>
  );
}

function renderLookupInputControl(value, onChange, onLookup, disabled, title = 'Lookup', showLookup = true) {
  const input = (
    <input
      type="text"
      className="form-control form-control-sm"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );

  return showLookup ? renderLookupControl(input, onLookup, disabled, title) : input;
}

function SellerAddressModal({
  isOpen,
  onClose,
  addresses = [],
  onSelect,
  loading = false,
  error = '',
  title = 'Seller Address in Sales Order',
  emptyMessage = 'No seller addresses found',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  const filteredAddresses = useMemo(() => {
    const usableAddresses = dedupeAddresses(addresses);
    if (!searchTerm.trim()) return usableAddresses;

    const term = searchTerm.toLowerCase();
    return usableAddresses.filter((address) =>
      getAddressId(address).toLowerCase().includes(term) ||
      formatAddressRowText(address).toLowerCase().includes(term)
    );
  }, [addresses, searchTerm]);

  if (!isOpen) return null;

  const chooseAddress = (address) => {
    if (!address) return;
    onSelect(address);
    onClose();
  };

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 21000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Seller Address"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(760px, calc(100vw - 48px))',
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          border: '1px solid #999',
          borderRadius: 3,
          boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            background: 'linear-gradient(to bottom, #f0f0f0, #d0d0d0)',
            borderBottom: '2px solid #e8a000',
          }}
        >
          <h6 className="mb-0" style={{ fontSize: 12, fontWeight: 700 }}>
            {title}
          </h6>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-sm"
            style={{ padding: '0 8px', fontSize: 13, border: '1px solid #999', background: '#f0f0f0' }}
          >
            x
          </button>
        </div>

        <div style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, margin: 0 }}>Find</label>
          <input
            type="text"
            className="form-control form-control-sm"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setSelectedRow(null);
            }}
            style={{ maxWidth: 340, fontSize: 11, background: '#ffffcc' }}
            autoFocus
          />
        </div>

        {error ? (
          <div style={{ color: '#b00020', background: '#fff3f3', padding: '6px 10px', fontSize: 11 }}>
            {error}
          </div>
        ) : null}

        <div style={{ flex: 1, minHeight: 220, overflow: 'auto', padding: '0 10px 10px' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: '#666' }}>
              Loading addresses...
            </div>
          ) : (
            <table className="table table-sm mb-0" style={{ fontSize: 11 }}>
              <tbody>
                {filteredAddresses.length === 0 ? (
                  <tr>
                    <td style={{ padding: 18, textAlign: 'center', color: '#777' }}>
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  filteredAddresses.map((address, index) => {
                    const addressId = getAddressId(address);
                    const rowText = formatAddressRowText(address);
                    const selected = selectedRow === index;

                    return (
                      <tr
                        key={`${addressId}-${index}`}
                        onClick={() => setSelectedRow(index)}
                        onDoubleClick={() => chooseAddress(address)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selected ? '#fff8c5' : index % 2 === 0 ? '#fff' : '#f3f3f3',
                        }}
                      >
                        <td style={{ width: 48, padding: '5px 8px', color: '#666' }}>{index + 1}</td>
                        <td style={{ padding: '5px 8px', fontWeight: selected ? 700 : 500 }}>
                          {addressId}
                          {rowText ? <span style={{ fontWeight: 400 }}> / {rowText}</span> : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #ccc', background: '#f0f0f0' }}>
          <button
            type="button"
            className="btn btn-sm"
            disabled={selectedRow === null || loading || !filteredAddresses[selectedRow]}
            onClick={() => chooseAddress(filteredAddresses[selectedRow])}
            style={{
              minWidth: 82,
              fontSize: 11,
              border: '1px solid #999',
              background: selectedRow !== null ? 'linear-gradient(to bottom, #ffe066, #e8a000)' : '#e0e0e0',
            }}
          >
            Choose
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            style={{ minWidth: 82, fontSize: 11, border: '1px solid #999', background: 'linear-gradient(to bottom, #ffe066, #e8a000)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function HeaderUdfSidebar({
  isOpen,
  fields,
  formSettings,
  values,
  onFieldChange,
  onClose,
  disabled = false,
  orientation = 'vertical',
  className = '',
  style,
  billToPartyAddressOptions = [],
  billToPartyName = '',
  loadBillToPartyDetails,
  loadToVendorDetails,
}) {
  const [sellerLookupOpen, setSellerLookupOpen] = useState(false);
  const [sellerPartners, setSellerPartners] = useState([]);
  const [sellerLookupLoading, setSellerLookupLoading] = useState(false);
  const [sellerAddressLookupOpen, setSellerAddressLookupOpen] = useState(false);
  const [sellerAddresses, setSellerAddresses] = useState([]);
  const [sellerAddressLoading, setSellerAddressLoading] = useState(false);
  const [sellerAddressError, setSellerAddressError] = useState('');
  const [toVendorLookupOpen, setToVendorLookupOpen] = useState(false);
  const [toVendorPartners, setToVendorPartners] = useState([]);
  const [toVendorLookupLoading, setToVendorLookupLoading] = useState(false);
  const [toVendorAddressLookupOpen, setToVendorAddressLookupOpen] = useState(false);
  const [toVendorAddresses, setToVendorAddresses] = useState([]);
  const [toVendorAddressLoading, setToVendorAddressLoading] = useState(false);
  const [toVendorAddressError, setToVendorAddressError] = useState('');
  const lastLoadedToVendorCodeRef = useRef('');
  const [billToPartyLookupOpen, setBillToPartyLookupOpen] = useState(false);
  const [billToPartyPartners, setBillToPartyPartners] = useState([]);
  const [billToPartyLookupLoading, setBillToPartyLookupLoading] = useState(false);
  const [billToPartyAddresses, setBillToPartyAddresses] = useState([]);
  const [billToPartyAddressLookupOpen, setBillToPartyAddressLookupOpen] = useState(false);
  const [billToPartyAddressLoading, setBillToPartyAddressLoading] = useState(false);
  const [billToPartyAddressError, setBillToPartyAddressError] = useState('');
  const lastLoadedBillToPartyCodeRef = useRef('');
  const valuesRef = useRef(values || {});
  const onFieldChangeRef = useRef(onFieldChange);
  const loadBillToPartyDetailsRef = useRef(loadBillToPartyDetails);
  const loadToVendorDetailsRef = useRef(loadToVendorDetails);
  const billToPartyAddressOptionsSignature = getAddressListSignature(billToPartyAddressOptions);
  const externalBillToPartyAddresses = useMemo(
    () => filterBillToAddresses(dedupeAddresses(billToPartyAddressOptions)),
    [billToPartyAddressOptionsSignature],
  );

  useEffect(() => {
    valuesRef.current = values || {};
  }, [values]);

  useEffect(() => {
    onFieldChangeRef.current = onFieldChange;
  }, [onFieldChange]);

  useEffect(() => {
    loadBillToPartyDetailsRef.current = loadBillToPartyDetails;
  }, [loadBillToPartyDetails]);

  useEffect(() => {
    loadToVendorDetailsRef.current = loadToVendorDetails;
  }, [loadToVendorDetails]);

  const changeField = useCallback((key, nextValue) => {
    if (!key || typeof onFieldChangeRef.current !== 'function') return;

    const currentValue = valuesRef.current?.[key];
    if (String(currentValue ?? '') === String(nextValue ?? '')) {
      return;
    }

    onFieldChangeRef.current(key, nextValue);
  }, []);

  const setToVendorAddressList = useCallback((addresses = []) => {
    const nextAddresses = filterBillToAddresses(dedupeAddresses(addresses));
    setToVendorAddresses((current) =>
      areAddressListsEqual(current, nextAddresses) ? current : nextAddresses
    );
  }, []);

  const setBillToPartyAddressList = useCallback((addresses = []) => {
    const nextAddresses = filterBillToAddresses(dedupeAddresses(addresses));
    setBillToPartyAddresses((current) =>
      areAddressListsEqual(current, nextAddresses) ? current : nextAddresses
    );
  }, []);

  const safeFields = Array.isArray(fields) ? fields : [];
  const containerClass = orientation === 'horizontal'
    ? 'po-udf-sidebar-horizontal'
    : 'col-xl-3 col-lg-4 align-self-start';

  const rootClassName = [containerClass, className].filter(Boolean).join(' ');
  const showClose = typeof onClose === 'function';
  const orderedFields = sortHeaderUdfFields(safeFields);
  const sellerContactPersonField = orderedFields.find(isSellerContactPersonField);
  const toVendorCodeField = orderedFields.find(isToVendorCodeField);
  const toVendorNameField = orderedFields.find(isToVendorNameField);
  const toVendorAddressIdField = orderedFields.find(isToVendorAddressIdField);
  const toVendorAddressField = orderedFields.find(isToVendorAddressField);
  const toVendorContactIdField = orderedFields.find(isToVendorContactIdField);
  const toVendorCode = String(toVendorCodeField?.key ? values?.[toVendorCodeField.key] : '').trim();
  const toVendorNameValue = String(toVendorNameField?.key ? values?.[toVendorNameField.key] : '').trim();
  const toVendorAddressIdValue = String(toVendorAddressIdField?.key ? values?.[toVendorAddressIdField.key] : '').trim();
  const toVendorAddressTextValue = String(toVendorAddressField?.key ? values?.[toVendorAddressField.key] : '').trim();
  const billToPartyCodeField = orderedFields.find(isBillToPartyCodeField);
  const billToPartyCode = String(billToPartyCodeField?.key ? values?.[billToPartyCodeField.key] : '').trim();
  const billToPartyNameField = orderedFields.find(isBillToPartyNameField);
  const billToPartyAddressIdField = orderedFields.find(isBillToPartyAddressIdField);
  const billToPartyAddressField = orderedFields.find(isBillToPartyAddressField);
  const billToPartyNameValue = String(billToPartyNameField?.key ? values?.[billToPartyNameField.key] : '').trim();
  const billToPartyAddressIdValue = String(billToPartyAddressIdField?.key ? values?.[billToPartyAddressIdField.key] : '').trim();

  const loadToVendorByCode = useCallback(async (cardCode) => {
    const normalizedCode = String(cardCode || '').trim();
    if (!normalizedCode) return { vendor: null, addresses: [] };

    let vendor = null;
    let addresses = [];
    let contacts = [];

    if (typeof loadToVendorDetailsRef.current === 'function') {
      const details = await loadToVendorDetailsRef.current(normalizedCode);
      vendor = details?.businessPartner || details?.vendor || details?.bp || null;
      contacts = [
        ...(Array.isArray(details?.contacts) ? details.contacts : []),
        ...(Array.isArray(details?.ContactEmployees) ? details.ContactEmployees : []),
      ];
      addresses = [
        ...(Array.isArray(details?.addresses) ? details.addresses : []),
        ...(Array.isArray(details?.BPAddresses) ? details.BPAddresses : []),
        ...(Array.isArray(details?.bill_to_addresses) ? details.bill_to_addresses : []),
        ...(Array.isArray(details?.pay_to_addresses) ? details.pay_to_addresses : []),
      ];
    }

    if (!addresses.length || !vendor?.CardName) {
      try {
        const bp = await getBP(normalizedCode);
        vendor = vendor || bp;
        addresses = addresses.length ? addresses : (Array.isArray(bp?.BPAddresses) ? bp.BPAddresses : []);
        contacts = contacts.length ? contacts : (Array.isArray(bp?.ContactEmployees) ? bp.ContactEmployees : []);
      } catch (error) {
        if (!addresses.length && !contacts.length && !vendor) throw error;
      }
    }

    const usableAddresses = filterBillToAddresses(dedupeAddresses(addresses));
    const contactEmployees = contacts.length
      ? contacts
      : (Array.isArray(vendor?.ContactEmployees) ? vendor.ContactEmployees : []);

    if (contactEmployees.length) {
      vendor = { ...(vendor || {}), ContactEmployees: contactEmployees, contacts: contactEmployees };
    }

    return { vendor, addresses: usableAddresses };
  }, []);

  useEffect(() => {
    if (!isOpen || !toVendorCodeField?.key || !toVendorCode) {
      if (isOpen && toVendorCodeField?.key && !toVendorCode && toVendorContactIdField?.key) {
        changeField(toVendorContactIdField.key, '');
      }
      setToVendorAddressList([]);
      lastLoadedToVendorCodeRef.current = '';
      return undefined;
    }

    if (lastLoadedToVendorCodeRef.current === toVendorCode) {
      return undefined;
    }

    let cancelled = false;

    const hydrateToVendor = async () => {
      try {
        const { vendor, addresses } = await loadToVendorByCode(toVendorCode);
        if (cancelled) return;

        const selectedAddress = addresses.find(
          (address) => String(getAddressId(address)) === toVendorAddressIdValue
        ) || selectBillToPartyAddress(addresses, vendor || {});

        setToVendorAddressList(addresses);
        lastLoadedToVendorCodeRef.current = toVendorCode;

        if (toVendorNameField?.key && vendor?.CardName && !toVendorNameValue) {
          changeField(toVendorNameField.key, vendor.CardName);
        }

        if (toVendorContactIdField?.key) {
          changeField(toVendorContactIdField.key, selectBusinessPartnerContactId(vendor || {}));
        }

        if (selectedAddress && toVendorAddressIdField?.key && !toVendorAddressIdValue) {
          changeField(toVendorAddressIdField.key, getAddressId(selectedAddress));
        }

        if (selectedAddress && toVendorAddressField?.key && !toVendorAddressTextValue) {
          changeField(toVendorAddressField.key, formatSellerAddress(selectedAddress));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load To Vendor addresses:', error);
          setToVendorAddressList([]);
          lastLoadedToVendorCodeRef.current = '';
        }
      }
    };

    hydrateToVendor();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    toVendorCode,
    toVendorCodeField?.key,
    toVendorNameField?.key,
    toVendorAddressIdField?.key,
    toVendorAddressField?.key,
    toVendorContactIdField?.key,
    toVendorNameValue,
    toVendorAddressIdValue,
    toVendorAddressTextValue,
    setToVendorAddressList,
    loadToVendorByCode,
    changeField,
  ]);

  useEffect(() => {
    if (!isOpen || !billToPartyCodeField?.key || !billToPartyCode) {
      setBillToPartyAddressList([]);
      lastLoadedBillToPartyCodeRef.current = '';
      return undefined;
    }

    const canUseExternalAddresses = externalBillToPartyAddresses.length &&
      (!billToPartyCode || !billToPartyName || billToPartyNameValue === billToPartyName);

    if (canUseExternalAddresses) {
      const selectedAddress = selectBillToPartyAddress(externalBillToPartyAddresses, {
        BillToDef: billToPartyAddressIdValue,
      });
      setBillToPartyAddressList(externalBillToPartyAddresses);
      lastLoadedBillToPartyCodeRef.current = billToPartyCode;

      if (billToPartyNameField?.key && billToPartyName && !billToPartyNameValue) {
        changeField(billToPartyNameField.key, billToPartyName);
      }

      if (
        selectedAddress &&
        billToPartyAddressIdField?.key &&
        !externalBillToPartyAddresses.some((address) => String(getAddressId(address)) === billToPartyAddressIdValue)
      ) {
        changeField(billToPartyAddressIdField.key, getAddressId(selectedAddress));
        if (billToPartyAddressField?.key) {
          changeField(billToPartyAddressField.key, formatSellerAddress(selectedAddress));
        }
      }

      return undefined;
    }

    if (lastLoadedBillToPartyCodeRef.current === billToPartyCode) {
      return undefined;
    }

    let cancelled = false;
    lastLoadedBillToPartyCodeRef.current = billToPartyCode;

    const loadBillToPartyAddresses = async () => {
      try {
        let party = null;
        let addresses = [];

        if (typeof loadBillToPartyDetailsRef.current === 'function') {
          const details = await loadBillToPartyDetailsRef.current(billToPartyCode);
          addresses = [
            ...(Array.isArray(details?.addresses) ? details.addresses : []),
            ...(Array.isArray(details?.BPAddresses) ? details.BPAddresses : []),
            ...(Array.isArray(details?.bill_to_addresses) ? details.bill_to_addresses : []),
          ];
          party = details?.businessPartner || details?.customer || null;
        }

        if (!addresses.length) {
          party = await getBP(billToPartyCode);
          addresses = Array.isArray(party?.BPAddresses) ? party.BPAddresses : [];
        }

        if (cancelled) return;

        const usableAddresses = filterBillToAddresses(dedupeAddresses(addresses));
        const selectedAddress = selectBillToPartyAddress(usableAddresses, party || {});
        setBillToPartyAddressList(usableAddresses);

        if (billToPartyNameField?.key && party?.CardName && !billToPartyNameValue) {
          changeField(billToPartyNameField.key, party.CardName);
        }

        if (
          selectedAddress &&
          billToPartyAddressIdField?.key &&
          !usableAddresses.some((address) => String(getAddressId(address)) === billToPartyAddressIdValue)
        ) {
          changeField(billToPartyAddressIdField.key, getAddressId(selectedAddress));
          if (billToPartyAddressField?.key) {
            changeField(billToPartyAddressField.key, formatSellerAddress(selectedAddress));
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load Bill To Party addresses:', error);
          setBillToPartyAddressList([]);
          lastLoadedBillToPartyCodeRef.current = '';
        }
      }
    };

    loadBillToPartyAddresses();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    billToPartyCode,
    billToPartyCodeField?.key,
    billToPartyNameField?.key,
    billToPartyAddressIdField?.key,
    billToPartyAddressField?.key,
    externalBillToPartyAddresses,
    billToPartyName,
    billToPartyNameValue,
    billToPartyAddressIdValue,
    setBillToPartyAddressList,
    changeField,
  ]);

  if (!isOpen || safeFields.length === 0) {
    return null;
  }

  const openSellerLookup = async () => {
    setSellerLookupOpen(true);
    setSellerLookupLoading(true);

    try {
      const rows = await searchBP('', SELLER_BP_TYPE, 5000, 0);
      setSellerPartners((Array.isArray(rows) ? rows : []).map((bp) => ({
        ...bp,
        CardType: normalizeBPCardType(bp.CardType),
      })));
    } catch (error) {
      console.error('Failed to load business partners for seller lookup:', error);
      setSellerPartners([]);
    } finally {
      setSellerLookupLoading(false);
    }
  };

  const openToVendorLookup = async () => {
    setToVendorLookupOpen(true);
    setToVendorLookupLoading(true);

    try {
      const rows = await searchBP('', SELLER_BP_TYPE, 5000, 0);
      setToVendorPartners((Array.isArray(rows) ? rows : []).map((bp) => ({
        ...bp,
        CardType: normalizeBPCardType(bp.CardType),
      })));
    } catch (error) {
      console.error('Failed to load business partners for To Vendor lookup:', error);
      setToVendorPartners([]);
    } finally {
      setToVendorLookupLoading(false);
    }
  };

  const openBillToPartyLookup = async () => {
    setBillToPartyLookupOpen(true);
    setBillToPartyLookupLoading(true);

    try {
      const rows = await searchBP('', BILL_TO_PARTY_BP_TYPE, 5000, 0);
      setBillToPartyPartners((Array.isArray(rows) ? rows : []).map((bp) => ({
        ...bp,
        CardType: normalizeBPCardType(bp.CardType),
      })));
    } catch (error) {
      console.error('Failed to load business partners for Bill To Party lookup:', error);
      setBillToPartyPartners([]);
    } finally {
      setBillToPartyLookupLoading(false);
    }
  };

  const applySellerAddress = (seller) => {
    const selectedAddress = selectSellerAddress(seller?.BPAddresses, seller);
    changeField(SELLER_ADDRESS_ID_KEY, getAddressId(selectedAddress));
    changeField(SELLER_ADDRESS_KEY, formatSellerAddress(selectedAddress));
  };

  const applyToVendorAddress = (address) => {
    if (toVendorAddressIdField?.key) {
      changeField(toVendorAddressIdField.key, getAddressId(address));
    }
    if (toVendorAddressField?.key) {
      changeField(toVendorAddressField.key, formatSellerAddress(address));
    }
  };

  const applyBillToPartyAddress = (address) => {
    if (billToPartyAddressIdField?.key) {
      changeField(billToPartyAddressIdField.key, getAddressId(address));
    }
    if (billToPartyAddressField?.key) {
      changeField(billToPartyAddressField.key, formatSellerAddress(address));
    }
  };

  const handleBillToPartyAddressIdChange = (addressOptionKey) => {
    const selectedAddress = billToPartyAddresses.find(
      (address, index) => getAddressOptionKey(address, index) === addressOptionKey
    ) || billToPartyAddresses.find(
      (address) => String(getAddressId(address)) === String(addressOptionKey)
    ) || null;
    applyBillToPartyAddress(selectedAddress || { Address: addressOptionKey });
  };

  const openBillToPartyAddressLookup = async () => {
    setBillToPartyAddressLookupOpen(true);
    setBillToPartyAddressLoading(true);
    setBillToPartyAddressError('');

    if (!billToPartyCode) {
      setBillToPartyAddressList([]);
      setBillToPartyAddressLoading(false);
      setBillToPartyAddressError('Select Bill to Party Code first.');
      return;
    }

    try {
      let party = null;
      let addresses = [];

      if (typeof loadBillToPartyDetailsRef.current === 'function') {
        const details = await loadBillToPartyDetailsRef.current(billToPartyCode);
        party = details?.businessPartner || details?.customer || details?.bp || null;
        addresses = [
          ...(Array.isArray(details?.addresses) ? details.addresses : []),
          ...(Array.isArray(details?.BPAddresses) ? details.BPAddresses : []),
          ...(Array.isArray(details?.bill_to_addresses) ? details.bill_to_addresses : []),
        ];
      }

      if (!addresses.length) {
        party = party || await getBP(billToPartyCode);
        addresses = Array.isArray(party?.BPAddresses) ? party.BPAddresses : [];
      }

      const usableAddresses = filterBillToAddresses(dedupeAddresses(addresses));
      setBillToPartyAddressList(usableAddresses);
      lastLoadedBillToPartyCodeRef.current = billToPartyCode;

      if (!usableAddresses.length) {
        setBillToPartyAddressError('No bill-to address is available for this party.');
      }
    } catch (error) {
      console.error('Failed to load Bill To Party addresses:', error);
      setBillToPartyAddressList([]);
      setBillToPartyAddressError('Failed to load bill-to addresses.');
    } finally {
      setBillToPartyAddressLoading(false);
    }
  };

  const openSellerAddressLookup = async () => {
    const sellerCode = String(values?.[SELLER_CODE_KEY] || '').trim();
    setSellerAddressLookupOpen(true);
    setSellerAddressLoading(true);
    setSellerAddressError('');
    setSellerAddresses([]);

    if (!sellerCode) {
      setSellerAddressLoading(false);
      setSellerAddressError('Select Seller Code first.');
      return;
    }

    try {
      const seller = await getBP(sellerCode);
      const addresses = Array.isArray(seller?.BPAddresses) ? seller.BPAddresses : [];
      const usableAddresses = addresses.filter((address) => getAddressId(address));
      setSellerAddresses(usableAddresses);
      if (!usableAddresses.length) {
        setSellerAddressError('No address is available for this seller.');
      }
    } catch (error) {
      console.error('Failed to load seller addresses:', error);
      setSellerAddresses([]);
      setSellerAddressError('Failed to load seller addresses.');
    } finally {
      setSellerAddressLoading(false);
    }
  };

  const handleSellerAddressSelect = (address) => {
    changeField(SELLER_ADDRESS_ID_KEY, getAddressId(address));
    changeField(SELLER_ADDRESS_KEY, formatSellerAddress(address));
  };

  const handleToVendorAddressIdChange = (addressOptionKey) => {
    const addressOptions = dedupeAddresses(toVendorAddresses);
    const selectedAddress = addressOptions.find(
      (address, index) => getAddressOptionKey(address, index) === addressOptionKey
    ) || addressOptions.find(
      (address) => String(getAddressId(address)) === String(addressOptionKey)
    ) || null;
    applyToVendorAddress(selectedAddress || { Address: addressOptionKey });
  };

  const openToVendorAddressLookup = async () => {
    setToVendorAddressLookupOpen(true);
    setToVendorAddressLoading(true);
    setToVendorAddressError('');

    if (!toVendorCode) {
      setToVendorAddressList([]);
      setToVendorAddressLoading(false);
      setToVendorAddressError('Select To Code Vendor first.');
      return;
    }

    try {
      const { addresses } = await loadToVendorByCode(toVendorCode);
      setToVendorAddressList(addresses);
      lastLoadedToVendorCodeRef.current = toVendorCode;
      if (!addresses.length) {
        setToVendorAddressError('No address is available for this vendor.');
      }
    } catch (error) {
      console.error('Failed to load To Vendor addresses:', error);
      setToVendorAddressList([]);
      setToVendorAddressError('Failed to load vendor addresses.');
    } finally {
      setToVendorAddressLoading(false);
    }
  };

  const handleToVendorAddressSelect = (address) => {
    applyToVendorAddress(address);
  };

  const handleBillToPartyAddressSelect = (address) => {
    applyBillToPartyAddress(address);
  };

  const handleSellerSelect = async (bp) => {
    changeField(SELLER_CODE_KEY, bp.CardCode || '');
    changeField(SELLER_NAME_KEY, bp.CardName || '');
    changeField(SELLER_ADDRESS_ID_KEY, '');
    changeField(SELLER_ADDRESS_KEY, '');
    if (sellerContactPersonField?.key) {
      changeField(sellerContactPersonField.key, '');
    }

    const cardCode = String(bp.CardCode || '').trim();
    if (!cardCode) return;

    try {
      const seller = await getBP(cardCode);
      applySellerAddress(seller || bp);
      if (sellerContactPersonField?.key) {
        changeField(sellerContactPersonField.key, selectSellerContactPerson(seller || bp));
      }
    } catch (error) {
      console.error('Failed to load seller address details:', error);
      applySellerAddress(bp);
      if (sellerContactPersonField?.key) {
        changeField(sellerContactPersonField.key, selectSellerContactPerson(bp));
      }
    }
  };

  const handleToVendorSelect = async (bp) => {
    if (toVendorCodeField?.key) {
      changeField(toVendorCodeField.key, bp.CardCode || '');
    }
    if (toVendorNameField?.key) {
      changeField(toVendorNameField.key, bp.CardName || '');
    }
    if (toVendorAddressIdField?.key) {
      changeField(toVendorAddressIdField.key, '');
    }
    if (toVendorAddressField?.key) {
      changeField(toVendorAddressField.key, '');
    }
    if (toVendorContactIdField?.key) {
      changeField(toVendorContactIdField.key, '');
    }
    setToVendorAddressList([]);
    lastLoadedToVendorCodeRef.current = '';

    const cardCode = String(bp.CardCode || '').trim();
    if (!cardCode) return;

    try {
      const { vendor, addresses } = await loadToVendorByCode(cardCode);
      const selectedAddress = selectBillToPartyAddress(addresses, vendor || bp);
      setToVendorAddressList(addresses);
      lastLoadedToVendorCodeRef.current = cardCode;
      applyToVendorAddress(selectedAddress);
      if (toVendorNameField?.key && vendor?.CardName) {
        changeField(toVendorNameField.key, vendor.CardName);
      }
      if (toVendorContactIdField?.key) {
        changeField(toVendorContactIdField.key, selectBusinessPartnerContactId(vendor || bp));
      }
    } catch (error) {
      console.error('Failed to load To Vendor details:', error);
      const addresses = Array.isArray(bp?.BPAddresses) ? bp.BPAddresses : [];
      const usableAddresses = filterBillToAddresses(addresses);
      setToVendorAddressList(usableAddresses);
      lastLoadedToVendorCodeRef.current = cardCode;
      applyToVendorAddress(selectBillToPartyAddress(usableAddresses, bp));
      if (toVendorContactIdField?.key) {
        changeField(toVendorContactIdField.key, selectBusinessPartnerContactId(bp));
      }
    }
  };

  const handleBillToPartySelect = async (bp) => {
    if (billToPartyCodeField?.key) {
      changeField(billToPartyCodeField.key, bp.CardCode || '');
    }
    if (billToPartyNameField?.key) {
      changeField(billToPartyNameField.key, bp.CardName || '');
    }
    if (billToPartyAddressIdField?.key) {
      changeField(billToPartyAddressIdField.key, '');
    }
    if (billToPartyAddressField?.key) {
      changeField(billToPartyAddressField.key, '');
    }

    const cardCode = String(bp.CardCode || '').trim();
    if (!cardCode) {
      lastLoadedBillToPartyCodeRef.current = '';
      return;
    }

    try {
      const party = await getBP(cardCode);
      const addresses = Array.isArray(party?.BPAddresses) ? party.BPAddresses : [];
      const usableAddresses = filterBillToAddresses(dedupeAddresses(addresses));
      const selectedAddress = selectBillToPartyAddress(usableAddresses, party || bp);
      setBillToPartyAddressList(usableAddresses);
      lastLoadedBillToPartyCodeRef.current = cardCode;
      applyBillToPartyAddress(selectedAddress);
      if (billToPartyNameField?.key && party?.CardName) {
        changeField(billToPartyNameField.key, party.CardName);
      }
    } catch (error) {
      console.error('Failed to load Bill To Party details:', error);
      const addresses = Array.isArray(bp?.BPAddresses) ? bp.BPAddresses : [];
      const usableAddresses = filterBillToAddresses(dedupeAddresses(addresses));
      setBillToPartyAddressList(usableAddresses);
      lastLoadedBillToPartyCodeRef.current = cardCode;
      applyBillToPartyAddress(selectBillToPartyAddress(usableAddresses, bp));
    }
  };

  return (
    <>
      <div className={rootClassName} style={style}>
        <div
          className={`card p-3 po-udf-sidebar-card ${orientation === 'horizontal' ? 'po-udf-sidebar-card-horizontal' : ''}`}
        >
          <div className="po-udf-sidebar-header">
            <div>
              <h6 className="mb-1">Header UDFs</h6>
              <small className="text-muted">
                Marketing document header user-defined fields
              </small>
            </div>
            {showClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Header UDFs"
                title="Close"
                className="po-udf-sidebar-close"
              />
            ) : null}
          </div>

          <div className="po-udf-sidebar-body">
            {orderedFields.map((field) => {
              const fieldDisabled = disabled || field.readOnly || formSettings.headerUdfs?.[field.key]?.active === false;
              const currentToVendorAddressId = String(values[field.key] || '');
              const currentBillToPartyAddressId = String(values[field.key] || '');
              const fieldLookup = isSellerCodeField(field)
                ? openSellerLookup
                : isToVendorCodeField(field)
                  ? openToVendorLookup
                  : isBillToPartyCodeField(field)
                    ? openBillToPartyLookup
                    : isSellerAddressIdField(field)
                      ? openSellerAddressLookup
                      : isToVendorAddressIdField(field)
                        ? openToVendorAddressLookup
                        : isBillToPartyAddressIdField(field)
                          ? openBillToPartyAddressLookup
                          : undefined;
              const fieldControl = isToVendorAddressIdField(field)
                ? renderLookupInputControl(
                  currentToVendorAddressId,
                  handleToVendorAddressIdChange,
                  openToVendorAddressLookup,
                  fieldDisabled,
                  'List of To Vendor Addresses'
                )
                : isBillToPartyAddressIdField(field)
                  ? renderLookupInputControl(
                    currentBillToPartyAddressId,
                    handleBillToPartyAddressIdChange,
                    openBillToPartyAddressLookup,
                    fieldDisabled,
                    'List of Bill To Party Addresses'
                  )
                : renderField(
                  field,
                  values[field.key],
                  fieldDisabled,
                  (nextValue) => {
                    if (isToVendorAddressIdField(field)) {
                      handleToVendorAddressIdChange(nextValue);
                      return;
                    }
                    if (isBillToPartyAddressIdField(field)) {
                      handleBillToPartyAddressIdChange(nextValue);
                      return;
                    }
                    changeField(field.key, nextValue);
                  },
                  fieldLookup
                );

              return (
                <div
                  key={field.key}
                  className={`mb-3 po-udf-sidebar-field po-udf-sidebar-field--${field.type || 'text'}`}
                >
                  <label className="form-label mb-1">
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  {fieldControl}
                </div>
              );
            })}
            {sellerLookupLoading ? (
              <small className="text-muted">Loading business partners...</small>
            ) : null}
            {toVendorLookupLoading ? (
              <small className="text-muted">Loading vendors...</small>
            ) : null}
            {billToPartyLookupLoading ? (
              <small className="text-muted">Loading bill-to parties...</small>
            ) : null}
          </div>
        </div>
      </div>
      <BusinessPartnerModal
        isOpen={sellerLookupOpen}
        onClose={() => setSellerLookupOpen(false)}
        onSelect={handleSellerSelect}
        businessPartners={sellerPartners}
        title="Ven(Code)FMS"
        variant="seller"
      />
      <BusinessPartnerModal
        isOpen={toVendorLookupOpen}
        onClose={() => setToVendorLookupOpen(false)}
        onSelect={handleToVendorSelect}
        businessPartners={toVendorPartners}
        title="Vendor Code"
        variant="seller"
      />
      <BusinessPartnerModal
        isOpen={billToPartyLookupOpen}
        onClose={() => setBillToPartyLookupOpen(false)}
        onSelect={handleBillToPartySelect}
        businessPartners={billToPartyPartners}
        title="Bill To Party Code"
      />
      <SellerAddressModal
        isOpen={sellerAddressLookupOpen}
        onClose={() => setSellerAddressLookupOpen(false)}
        addresses={sellerAddresses}
        onSelect={handleSellerAddressSelect}
        loading={sellerAddressLoading}
        error={sellerAddressError}
      />
      <SellerAddressModal
        isOpen={toVendorAddressLookupOpen}
        onClose={() => setToVendorAddressLookupOpen(false)}
        addresses={toVendorAddresses}
        onSelect={handleToVendorAddressSelect}
        loading={toVendorAddressLoading}
        error={toVendorAddressError}
        title="To Vendor Address"
        emptyMessage="No vendor addresses found"
      />
      <SellerAddressModal
        isOpen={billToPartyAddressLookupOpen}
        onClose={() => setBillToPartyAddressLookupOpen(false)}
        addresses={billToPartyAddresses}
        onSelect={handleBillToPartyAddressSelect}
        loading={billToPartyAddressLoading}
        error={billToPartyAddressError}
        title="Bill To Party Address"
        emptyMessage="No bill-to addresses found"
      />
    </>
  );
}

export default HeaderUdfSidebar;
