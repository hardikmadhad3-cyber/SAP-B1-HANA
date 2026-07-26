import React, { useEffect, useMemo, useState } from 'react';
import { searchItems } from '../../api/itemApi';
import useFloatingWindow from './useFloatingWindow';

const TABLE_COLUMNS = [
  { key: 'rowNo', label: '#', className: 'is-index' },
  { key: 'ItemCode', label: 'Item No.', className: 'is-code' },
  { key: 'ItemName', label: 'Item Description', className: 'is-name' },
  { key: 'InStock', label: 'In Stock', className: 'is-stock' },
  { key: 'WTaxLiable', label: 'WTax Liable', className: 'is-flag' },
];

const PAGE_SIZE = 100;

function ItemLookupModal({ isOpen, onClose, onSelect }) {
  const [searchText, setSearchText] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const windowFrame = useFloatingWindow({ isOpen, defaultTop: 42, bounds: 'parent' });

  const loadRows = async (query = '', pageToLoad = 0) => {
    setLoading(true);
    setError('');
    try {
      const response = await searchItems(query, PAGE_SIZE + 1, pageToLoad * PAGE_SIZE);
      const list = Array.isArray(response) ? response : [];
      setHasMore(list.length > PAGE_SIZE);
      setRows(list.slice(0, PAGE_SIZE));
      setPage(pageToLoad);
      setSelectedIndex(0);
    } catch (loadError) {
      setRows([]);
      setHasMore(false);
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load items.');
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
  }, [isOpen]);

  const normalizedRows = useMemo(
    () =>
      rows.map((row, index) => ({
        ...row,
        rowNo: index + 1,
        InStock: Number(row.InStock || row.OnHand || 0),
        WTaxLiable: row.WTaxLiable || row.WTLiable || 'Yes',
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
    <div className="item-lookup-modal__backdrop" onClick={onClose}>
      <div
        className="item-lookup-modal"
        role="dialog"
        aria-modal="true"
        aria-label="List of Items"
        onClick={(event) => event.stopPropagation()}
        {...windowFrame.windowProps}
      >
        <div className="item-lookup-modal__titlebar" {...windowFrame.titleBarProps}>
          <div className="item-lookup-modal__title">List of Items</div>
          <div className="item-lookup-modal__controls">
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

        <div className="item-lookup-modal__accent" />

        {!windowFrame.isMinimized ? (
          <div className="item-lookup-modal__body">
          <div className="item-lookup-modal__toolbar">
            <label className="item-lookup-modal__find-label" htmlFor="item-lookup-search">Find</label>
            <input
              id="item-lookup-search"
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button type="button" className="item-lookup-modal__action-btn" onClick={handleSearch}>
              Text Search
            </button>
          </div>

          <div className="item-lookup-modal__grid-wrap">
            <table className="item-lookup-modal__grid">
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
                    <td colSpan={TABLE_COLUMNS.length} className="item-lookup-modal__state-cell">
                      Loading items...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="item-lookup-modal__state-cell is-error">
                      {error}
                    </td>
                  </tr>
                ) : !normalizedRows.length ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="item-lookup-modal__state-cell">
                      No items found.
                    </td>
                  </tr>
                ) : (
                  normalizedRows.map((row, index) => (
                    <tr
                      key={`${row.ItemCode || 'item'}-${index}`}
                      className={selectedIndex === index ? 'is-selected' : ''}
                      onClick={() => setSelectedIndex(index)}
                      onDoubleClick={() => {
                        onSelect(row);
                        onClose();
                      }}
                    >
                      <td className="is-index">{row.rowNo}</td>
                      <td className="is-code">{row.ItemCode || ''}</td>
                      <td className="is-name">{row.ItemName || ''}</td>
                      <td className="is-stock">{Number(row.InStock || 0).toFixed(3)}</td>
                      <td className="is-flag">{row.WTaxLiable || 'Yes'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        ) : null}

        {!windowFrame.isMinimized ? (
          <div className="item-lookup-modal__footer">
          <button type="button" className="item-lookup-modal__action-btn item-lookup-modal__action-btn--primary" onClick={handleChoose} disabled={!selectedRow}>
            Choose
          </button>
          <button type="button" className="item-lookup-modal__action-btn" onClick={onClose}>
            Cancel
          </button>
          <span className="item-lookup-modal__page-info">
            {rows.length ? `Showing ${page * PAGE_SIZE + 1}-${page * PAGE_SIZE + rows.length}` : ''}
          </span>
          <button
            type="button"
            className="item-lookup-modal__action-btn"
            onClick={() => loadRows(searchText, page - 1)}
            disabled={loading || page === 0}
          >
            Prev
          </button>
          <button
            type="button"
            className="item-lookup-modal__action-btn"
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

export default ItemLookupModal;
