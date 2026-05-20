import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBP, searchBP } from '../../api/businessPartnerApi';
import BusinessPartnerModal from '../../modules/sales-order/components/BusinessPartnerModal';

const SELLER_CODE_KEY = 'U_Seller_Code';
const SELLER_NAME_KEY = 'U_Seller_Name';
const SELLER_ADDRESS_ID_KEY = 'U_Seller_AddressId';
const SELLER_ADDRESS_KEY = 'U_Seller_Address';

const normalizeFieldText = (value) =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const isSellerCodeField = (field) =>
  String(field?.key || '') === SELLER_CODE_KEY ||
  String(field?.label || '').trim().toLowerCase() === 'seller code';

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
      <div className="d-flex align-items-center gap-1">
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          {input}
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onLookup}
          disabled={disabled}
          title="List of Business Partners"
          aria-label="List of Business Partners"
          style={{
            height: 31,
            minWidth: 28,
            padding: '0 6px',
            border: '1px solid #a0aab4',
            background: 'linear-gradient(180deg,#fff8c9 0%,#f4d45d 100%)',
            color: '#6b5200',
            fontSize: 11,
            lineHeight: 1,
          }}
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

function SellerAddressModal({
  isOpen,
  onClose,
  addresses = [],
  onSelect,
  loading = false,
  error = '',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  const filteredAddresses = useMemo(() => {
    const usableAddresses = addresses.filter((address) => getAddressId(address));
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
            Seller Address in Sales Order
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
                      No seller addresses found
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
}) {
  const [sellerLookupOpen, setSellerLookupOpen] = useState(false);
  const [sellerPartners, setSellerPartners] = useState([]);
  const [sellerLookupLoading, setSellerLookupLoading] = useState(false);
  const [sellerAddressLookupOpen, setSellerAddressLookupOpen] = useState(false);
  const [sellerAddresses, setSellerAddresses] = useState([]);
  const [sellerAddressLoading, setSellerAddressLoading] = useState(false);
  const [sellerAddressError, setSellerAddressError] = useState('');

  if (!isOpen || !Array.isArray(fields) || fields.length === 0) {
    return null;
  }

  const containerClass = orientation === 'horizontal'
    ? 'po-udf-sidebar-horizontal'
    : 'col-xl-3 col-lg-4 align-self-start';

  const rootClassName = [containerClass, className].filter(Boolean).join(' ');
  const showClose = typeof onClose === 'function';
  const orderedFields = sortHeaderUdfFields(fields);
  const sellerContactPersonField = orderedFields.find(isSellerContactPersonField);

  const openSellerLookup = async () => {
    setSellerLookupOpen(true);
    setSellerLookupLoading(true);

    try {
      const rows = await searchBP('', '', 5000, 0);
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

  const applySellerAddress = (seller) => {
    const selectedAddress = selectSellerAddress(seller?.BPAddresses, seller);
    onFieldChange(SELLER_ADDRESS_ID_KEY, getAddressId(selectedAddress));
    onFieldChange(SELLER_ADDRESS_KEY, formatSellerAddress(selectedAddress));
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
    onFieldChange(SELLER_ADDRESS_ID_KEY, getAddressId(address));
    onFieldChange(SELLER_ADDRESS_KEY, formatSellerAddress(address));
  };

  const handleSellerSelect = async (bp) => {
    onFieldChange(SELLER_CODE_KEY, bp.CardCode || '');
    onFieldChange(SELLER_NAME_KEY, bp.CardName || '');
    onFieldChange(SELLER_ADDRESS_ID_KEY, '');
    onFieldChange(SELLER_ADDRESS_KEY, '');
    if (sellerContactPersonField?.key) {
      onFieldChange(sellerContactPersonField.key, '');
    }

    const cardCode = String(bp.CardCode || '').trim();
    if (!cardCode) return;

    try {
      const seller = await getBP(cardCode);
      applySellerAddress(seller || bp);
      if (sellerContactPersonField?.key) {
        onFieldChange(sellerContactPersonField.key, selectSellerContactPerson(seller || bp));
      }
    } catch (error) {
      console.error('Failed to load seller address details:', error);
      applySellerAddress(bp);
      if (sellerContactPersonField?.key) {
        onFieldChange(sellerContactPersonField.key, selectSellerContactPerson(bp));
      }
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
              const fieldLookup = isSellerCodeField(field)
                ? openSellerLookup
                : isSellerAddressIdField(field)
                  ? openSellerAddressLookup
                  : undefined;

              return (
                <div
                  key={field.key}
                  className={`mb-3 po-udf-sidebar-field po-udf-sidebar-field--${field.type || 'text'}`}
                >
                  <label className="form-label mb-1">
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  {renderField(
                    field,
                    values[field.key],
                    fieldDisabled,
                    (nextValue) => onFieldChange(field.key, nextValue),
                    fieldLookup
                  )}
                </div>
              );
            })}
            {sellerLookupLoading ? (
              <small className="text-muted">Loading business partners...</small>
            ) : null}
          </div>
        </div>
      </div>
      <BusinessPartnerModal
        isOpen={sellerLookupOpen}
        onClose={() => setSellerLookupOpen(false)}
        onSelect={handleSellerSelect}
        businessPartners={sellerPartners}
      />
      <SellerAddressModal
        isOpen={sellerAddressLookupOpen}
        onClose={() => setSellerAddressLookupOpen(false)}
        addresses={sellerAddresses}
        onSelect={handleSellerAddressSelect}
        loading={sellerAddressLoading}
        error={sellerAddressError}
      />
    </>
  );
}

export default HeaderUdfSidebar;
