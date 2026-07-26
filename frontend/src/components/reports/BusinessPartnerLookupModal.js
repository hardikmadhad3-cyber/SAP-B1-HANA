import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchBP } from '../../api/businessPartnerApi';
import useFloatingWindow from './useFloatingWindow';

const TABLE_COLUMNS = [
  { key: 'rowNo', label: '#', className: 'is-index' },
  { key: 'CardName', label: 'BP Name', className: 'is-name' },
  { key: 'CardCode', label: 'BP Code', className: 'is-code' },
  { key: 'Balance', label: 'BP Balance', className: 'is-balance' },
  { key: 'CardTypeLabel', label: 'BP Type', className: 'is-type' },
  { key: 'Active', label: 'Active', className: 'is-flag' },
  { key: 'Inactive', label: 'Inactive', className: 'is-flag' },
  { key: 'BillToBlock', label: 'Bil-to Block', className: 'is-billto' },
  { key: 'BillToBuildingFloorRoom', label: 'Bil-to Building/Floor/Room', className: 'is-address' },
  { key: 'GTSRegistrationNumber', label: 'GTS Registration Number', className: 'is-gst' },
];

const getCardTypeLabel = (value) => {
  if (value === 'C') return 'Customer';
  if (value === 'S') return 'Supplier';
  if (value === 'L') return 'Lead';
  if (value === 'cCustomer') return 'Customer';
  if (value === 'cSupplier') return 'Supplier';
  if (value === 'cLead') return 'Lead';
  return value || 'Customer';
};

const formatAmount = (value) =>
  Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const PAGE_SIZE = 100;

function BusinessPartnerLookupModal({ isOpen, onClose, onSelect, type = 'cCustomer' }) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const windowFrame = useFloatingWindow({ isOpen, defaultTop: 36, bounds: 'parent' });

  const loadRows = async (query = '', pageToLoad = 0) => {
    setLoading(true);
    setError('');
    try {
      const response = await searchBP(query, type, PAGE_SIZE + 1, pageToLoad * PAGE_SIZE);
      const list = Array.isArray(response) ? response : [];
      setHasMore(list.length > PAGE_SIZE);
      setRows(list.slice(0, PAGE_SIZE));
      setPage(pageToLoad);
      setSelectedIndex(0);
    } catch (loadError) {
      setRows([]);
      setHasMore(false);
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
      setRows([]);
      setPage(0);
      setHasMore(false);
      setSelectedIndex(0);
      setError('');
      return;
    }

    loadRows('', 0);
  }, [isOpen, type]);

  const normalizedRows = useMemo(
    () =>
      rows.map((row, index) => ({
        ...row,
        rowNo: index + 1,
        CardTypeLabel: getCardTypeLabel(row.CardType),
      })),
    [rows],
  );

  const selectedRow = normalizedRows[selectedIndex] || null;

  const handleChoose = () => {
    if (!selectedRow) return;
    onSelect(selectedRow);
    onClose();
  };

  const handleSearch = () => {
    loadRows(searchText, 0);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="bp-lookup-modal__backdrop" onClick={onClose}>
      <div
        className="bp-lookup-modal"
        role="dialog"
        aria-modal="true"
        aria-label="List of Business Partners"
        onClick={(event) => event.stopPropagation()}
        {...windowFrame.windowProps}
      >
        <div className="bp-lookup-modal__titlebar" {...windowFrame.titleBarProps}>
          <div className="bp-lookup-modal__title">List of Business Partners</div>
          <div className="bp-lookup-modal__controls">
            <button
              type="button"
              aria-label={windowFrame.isMinimized ? 'Restore' : 'Minimize'}
              onClick={windowFrame.toggleMinimize}
            >
              {windowFrame.isMinimized ? '□' : '-'}
            </button>
            <button type="button" aria-label="Close" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="bp-lookup-modal__accent" />

        {!windowFrame.isMinimized ? (
          <div className="bp-lookup-modal__body">
          <div className="bp-lookup-modal__toolbar">
            <label className="bp-lookup-modal__find-label" htmlFor="bp-lookup-search">Find</label>
            <input
              id="bp-lookup-search"
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button type="button" className="bp-lookup-modal__action-btn" onClick={handleSearch}>
              Text Search
            </button>
          </div>

          <div className="bp-lookup-modal__grid-wrap">
            <table className="bp-lookup-modal__grid">
              <thead>
                <tr>
                  {TABLE_COLUMNS.map((column) => (
                    <th key={column.key} className={column.className}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="bp-lookup-modal__state-cell">
                      Loading customers...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="bp-lookup-modal__state-cell is-error">
                      {error}
                    </td>
                  </tr>
                ) : !normalizedRows.length ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="bp-lookup-modal__state-cell">
                      No business partners found.
                    </td>
                  </tr>
                ) : (
                  normalizedRows.map((row, index) => (
                    <tr
                      key={`${row.CardCode || 'bp'}-${index}`}
                      className={selectedIndex === index ? 'is-selected' : ''}
                      onClick={() => setSelectedIndex(index)}
                      onDoubleClick={() => {
                        onSelect(row);
                        onClose();
                      }}
                    >
                      <td className="is-index">{row.rowNo}</td>
                      <td className="is-name">{row.CardName || ''}</td>
                      <td className="is-code">{row.CardCode || ''}</td>
                      <td className="is-balance">{formatAmount(row.Balance)}</td>
                      <td className="is-type">{row.CardTypeLabel}</td>
                      <td className="is-flag">{row.Active || ''}</td>
                      <td className="is-flag">{row.Inactive || ''}</td>
                      <td className="is-billto">{row.BillToBlock || ''}</td>
                      <td className="is-address">{row.BillToBuildingFloorRoom || ''}</td>
                      <td className="is-gst">{row.GTSRegistrationNumber || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        ) : null}

        {!windowFrame.isMinimized ? (
          <div className="bp-lookup-modal__footer">
          <button type="button" className="bp-lookup-modal__action-btn bp-lookup-modal__action-btn--primary" onClick={handleChoose} disabled={!selectedRow}>
            Choose
          </button>
          <button type="button" className="bp-lookup-modal__action-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="bp-lookup-modal__action-btn"
            onClick={() => navigate('/business-partner')}
          >
            New
          </button>
          <span className="bp-lookup-modal__page-info">
            {rows.length ? `Showing ${page * PAGE_SIZE + 1}-${page * PAGE_SIZE + rows.length}` : ''}
          </span>
          <button
            type="button"
            className="bp-lookup-modal__action-btn"
            onClick={() => loadRows(searchText, page - 1)}
            disabled={loading || page === 0}
          >
            Prev
          </button>
          <button
            type="button"
            className="bp-lookup-modal__action-btn"
            onClick={() => loadRows(searchText, page + 1)}
            disabled={loading || !hasMore}
          >
            Next
          </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default BusinessPartnerLookupModal;
