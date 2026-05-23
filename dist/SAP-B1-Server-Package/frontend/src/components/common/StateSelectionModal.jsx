import { useMemo, useState } from 'react';

export default function StateSelectionModal({ isOpen, onClose, onSelect, states = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const safeStates = Array.isArray(states) ? states : [];

  const filteredStates = useMemo(() => {
    if (!searchTerm.trim()) return safeStates;

    const term = searchTerm.toLowerCase();
    return safeStates.filter((state) =>
      String(state.Code || '').toLowerCase().includes(term) ||
      String(state.Name || '').toLowerCase().includes(term) ||
      String(state.Country || '').toLowerCase().includes(term),
    );
  }, [safeStates, searchTerm]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setSelectedRow(null);
  };

  const handleChoose = () => {
    if (selectedRow !== null && filteredStates[selectedRow]) {
      onSelect(filteredStates[selectedRow]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block sap-state-lookup" onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(event) => event.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header sap-state-lookup__header">
            <h6 className="modal-title mb-0">List of States</h6>
            <button
              type="button"
              className="btn btn-sm sap-state-lookup__close"
              aria-label="Close"
              title="Close"
              onClick={onClose}
            >
              x
            </button>
          </div>

          <div className="modal-body sap-state-lookup__body">
            <div className="sap-state-lookup__filter">
              <label htmlFor="state-lookup-search">Find</label>
              <input
                id="state-lookup-search"
                type="text"
                className="form-control form-control-sm"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search by code, name, or country..."
                autoFocus
              />
            </div>

            <div className="sap-state-lookup__table-wrap">
              <table className="table table-sm table-hover mb-0 sap-state-lookup__table">
                <thead>
                  <tr>
                    <th className="sap-state-lookup__col-index">#</th>
                    <th className="sap-state-lookup__col-code">Code</th>
                    <th className="sap-state-lookup__col-country">Country/Region</th>
                    <th>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStates.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center sap-state-lookup__empty">
                        No states found
                      </td>
                    </tr>
                  ) : (
                    filteredStates.map((state, index) => (
                      <tr
                        key={`${state.Code || 'state'}-${index}`}
                        onClick={() => setSelectedRow(index)}
                        onDoubleClick={() => {
                          onSelect(state);
                          onClose();
                        }}
                        className={selectedRow === index ? 'is-selected' : ''}
                      >
                        <td>{index + 1}</td>
                        <td>{state.Code || ''}</td>
                        <td>{state.Country || 'India'}</td>
                        <td>{state.Name || ''}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="sap-state-lookup__count">
              Showing {filteredStates.length} of {safeStates.length} states
            </div>
          </div>

          <div className="modal-footer sap-state-lookup__footer">
            <button
              type="button"
              className="btn btn-warning btn-sm px-4"
              onClick={handleChoose}
              disabled={selectedRow === null}
            >
              Choose
            </button>
            <button type="button" className="btn btn-secondary btn-sm px-4" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-warning btn-sm px-4">
              New
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
