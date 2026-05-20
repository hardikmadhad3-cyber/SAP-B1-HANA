import { useState, useMemo } from 'react';

export default function StateSelectionModal({ isOpen, onClose, onSelect, states }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  const filteredStates = useMemo(() => {
    if (!searchTerm.trim()) return states;
    const term = searchTerm.toLowerCase();
    return states.filter(state => 
      String(state.Code || '').toLowerCase().includes(term) ||
      String(state.Name || '').toLowerCase().includes(term) ||
      String(state.Country || '').toLowerCase().includes(term)
    );
  }, [states, searchTerm]);

  const handleRowClick = (state, index) => {
    setSelectedRow(index);
  };

  const handleRowDoubleClick = (state) => {
    onSelect(state);
    onClose();
  };

  const handleChoose = () => {
    if (selectedRow !== null && filteredStates[selectedRow]) {
      onSelect(filteredStates[selectedRow]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: 'linear-gradient(to bottom, #f0f0f0, #d0d0d0)', borderBottom: '1px solid #999', padding: '6px 12px' }}>
            <h6 className="modal-title mb-0" style={{ fontSize: 12, fontWeight: 600 }}>List of States</h6>
            <div className="d-flex gap-1">
              <button type="button" className="btn btn-sm" style={{ padding: '0 8px', fontSize: 14, lineHeight: 1.2, border: '1px solid #999', background: '#f0f0f0' }}>−</button>
              <button type="button" className="btn btn-sm" onClick={onClose} style={{ padding: '0 8px', fontSize: 14, lineHeight: 1.2, border: '1px solid #999', background: '#f0f0f0' }}>✕</button>
            </div>
          </div>
          
          <div className="modal-body" style={{ padding: '12px', backgroundColor: '#fff' }}>
            {/* Search Box */}
            <div className="mb-2">
              <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Find</label>
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ fontSize: 11, background: '#ffffcc' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by code, name, or country..."
                autoFocus
              />
            </div>

            {/* States Table */}
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #c8d0da' }}>
              <table className="table table-sm table-hover mb-0" style={{ fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#e8edf2', zIndex: 1 }}>
                  <tr>
                    <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '50px', padding: '4px 8px' }}>#</th>
                    <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '100px', padding: '4px 8px' }}>
                      Code
                      <span style={{ marginLeft: 4 }}>▲</span>
                    </th>
                    <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '150px', padding: '4px 8px' }}>Country/Region</th>
                    <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', padding: '4px 8px' }}>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStates.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center" style={{ padding: '20px', color: '#888' }}>
                        No states found
                      </td>
                    </tr>
                  ) : (
                    filteredStates.map((state, index) => (
                      <tr
                        key={index}
                        onClick={() => handleRowClick(state, index)}
                        onDoubleClick={() => handleRowDoubleClick(state)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedRow === index ? '#ffffcc' : index % 2 === 0 ? '#fff' : '#fafbfc'
                        }}
                      >
                        <td style={{ padding: '3px 8px' }}>{index + 1}</td>
                        <td style={{ padding: '3px 8px', fontWeight: selectedRow === index ? 600 : 400 }}>
                          {state.Code || ''}
                        </td>
                        <td style={{ padding: '3px 8px' }}>{state.Country || 'India'}</td>
                        <td style={{ padding: '3px 8px' }}>{state.Name || ''}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination placeholder */}
            <div className="d-flex justify-content-between align-items-center mt-2" style={{ fontSize: 11, color: '#666' }}>
              <div>
                <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #ccc' }}>◄</button>
                <span style={{ margin: '0 8px' }}>...</span>
                <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #ccc' }}>►</button>
              </div>
              <div>
                Showing {filteredStates.length} of {states.length} states
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '8px 12px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ccc' }}>
            <button 
              type="button" 
              className="btn btn-warning btn-sm px-4" 
              style={{ fontSize: 11 }} 
              onClick={handleChoose}
              disabled={selectedRow === null}
            >
              Choose
            </button>
            <button type="button" className="btn btn-secondary btn-sm px-4" style={{ fontSize: 11 }} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-warning btn-sm px-4" style={{ fontSize: 11 }}>
              New
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
