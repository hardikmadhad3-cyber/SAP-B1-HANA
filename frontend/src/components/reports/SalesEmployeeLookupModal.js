import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesPersons } from '../../api/businessPartnerApi';
import useFloatingWindow from './useFloatingWindow';

const TABLE_COLUMNS = [
  { key: 'rowNo', label: '#', className: 'is-index' },
  { key: 'name', label: 'Sales Employee Name', className: 'is-name' },
  { key: 'remarks', label: 'Remarks', className: 'is-remarks' },
];

function SalesEmployeeLookupModal({ isOpen, onClose, onSelect }) {
  const [searchText, setSearchText] = useState('');
  const [rows, setRows] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const windowFrame = useFloatingWindow({ isOpen, defaultTop: 48 });

  const loadRows = async (query = '') => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchSalesPersons(query);
      setRows(Array.isArray(response) ? response : []);
      setSelectedIndex(0);
    } catch (loadError) {
      setRows([]);
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load sales employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
      setRows([]);
      setSelectedIndex(0);
      setError('');
      return;
    }

    loadRows('');
  }, [isOpen]);

  const normalizedRows = useMemo(
    () =>
      rows.map((row, index) => ({
        ...row,
        rowNo: index + 1,
        code: String(row.code || '').trim(),
        name: String(row.name || '').trim(),
        remarks: String(row.remarks || '').trim(),
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
    loadRows(searchText);
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
    <div className="sales-employee-lookup-modal__backdrop" onClick={onClose}>
      <div
        className="sales-employee-lookup-modal"
        role="dialog"
        aria-modal="true"
        aria-label="List of Sales Employee"
        onClick={(event) => event.stopPropagation()}
        {...windowFrame.windowProps}
      >
        <div className="sales-employee-lookup-modal__titlebar" {...windowFrame.titleBarProps}>
          <div className="sales-employee-lookup-modal__title">List of Sales Employee</div>
          <div className="sales-employee-lookup-modal__controls">
            <button
              type="button"
              aria-label={windowFrame.isMinimized ? 'Restore' : 'Minimize'}
              onClick={windowFrame.toggleMinimize}
            >
              {windowFrame.isMinimized ? '□' : '-'}
            </button>
            <button type="button" aria-label="Restore" onClick={windowFrame.restoreWindow}>□</button>
            <button type="button" aria-label="Close" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="sales-employee-lookup-modal__accent" />

        {!windowFrame.isMinimized ? (
          <>
            <div className="sales-employee-lookup-modal__body">
              <div className="sales-employee-lookup-modal__toolbar">
                <label className="sales-employee-lookup-modal__find-label" htmlFor="sales-employee-lookup-search">
                  Find
                </label>
                <input
                  id="sales-employee-lookup-search"
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <button type="button" className="sales-employee-lookup-modal__action-btn" onClick={handleSearch}>
                  Text Search
                </button>
              </div>

              <div className="sales-employee-lookup-modal__grid-wrap">
                <table className="sales-employee-lookup-modal__grid">
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
                        <td colSpan={TABLE_COLUMNS.length} className="sales-employee-lookup-modal__state-cell">
                          Loading sales employees...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={TABLE_COLUMNS.length} className="sales-employee-lookup-modal__state-cell is-error">
                          {error}
                        </td>
                      </tr>
                    ) : !normalizedRows.length ? (
                      <tr>
                        <td colSpan={TABLE_COLUMNS.length} className="sales-employee-lookup-modal__state-cell">
                          No sales employees found.
                        </td>
                      </tr>
                    ) : (
                      normalizedRows.map((row, index) => (
                        <tr
                          key={`${row.code || 'sales-employee'}-${index}`}
                          className={selectedIndex === index ? 'is-selected' : ''}
                          onClick={() => setSelectedIndex(index)}
                          onDoubleClick={() => {
                            onSelect(row);
                            onClose();
                          }}
                        >
                          <td className="is-index">{row.rowNo}</td>
                          <td className="is-name">{row.name}</td>
                          <td className="is-remarks">{row.remarks}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sales-employee-lookup-modal__footer">
              <button
                type="button"
                className="sales-employee-lookup-modal__action-btn"
                onClick={handleChoose}
                disabled={!selectedRow}
              >
                Choose
              </button>
              <button type="button" className="sales-employee-lookup-modal__action-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="sales-employee-lookup-modal__action-btn" disabled>
                New
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default SalesEmployeeLookupModal;
