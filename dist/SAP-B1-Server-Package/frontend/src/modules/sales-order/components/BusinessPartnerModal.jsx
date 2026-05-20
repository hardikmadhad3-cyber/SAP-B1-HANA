import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export default function BusinessPartnerModal({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
  businessPartners = [],
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedRow(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const filteredPartners = useMemo(() => {
    if (!searchTerm.trim()) return businessPartners;

    const term = searchTerm.toLowerCase();
    return businessPartners.filter((bp) =>
      String(bp.CardCode || '').toLowerCase().includes(term) ||
      String(bp.CardName || '').toLowerCase().includes(term) ||
      String(bp.CardType || '').toLowerCase().includes(term)
    );
  }, [businessPartners, searchTerm]);

  const handleChoose = () => {
    if (selectedRow === null || !filteredPartners[selectedRow]) return;
    onSelect(filteredPartners[selectedRow]);
    onClose();
  };

  const handleRowDoubleClick = (bp) => {
    onSelect(bp);
    onClose();
  };

  const formatCurrency = (value) => {
    const normalizedValue =
      value ??
      0;

    return Number(normalizedValue).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getBalanceValue = (bp) =>
    bp?.CurrentAccountBalance ??
    bp?.currentAccountBalance ??
    bp?.Balance ??
    bp?.balance ??
    0;

  if (!isOpen) return null;

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="List of Business Partners"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(1420px, calc(100vw - 48px))',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          border: '1px solid #999',
          borderRadius: 4,
          boxShadow: '0 20px 48px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            background: 'linear-gradient(to bottom, #f0f0f0, #d0d0d0)',
            borderBottom: '1px solid #999',
          }}
        >
          <h6 className="modal-title mb-0" style={{ fontSize: 12, fontWeight: 600 }}>
            List of Business Partners
          </h6>
          <div className="d-flex gap-1">
            <button
              type="button"
              className="btn btn-sm"
              style={{
                padding: '0 8px',
                fontSize: 14,
                lineHeight: 1.2,
                border: '1px solid #999',
                background: '#f0f0f0',
              }}
              aria-hidden="true"
              tabIndex={-1}
            >
              -
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onClose}
              style={{
                padding: '0 8px',
                fontSize: 14,
                lineHeight: 1.2,
                border: '1px solid #999',
                background: '#f0f0f0',
              }}
              aria-label="Close"
            >
              x
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '12px',
            backgroundColor: '#fff',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            gap: '8px',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
              Find
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              style={{ fontSize: 11, background: '#ffffcc' }}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by code, name, or type..."
              autoFocus
            />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #c8d0da' }}>
            <table className="table table-sm table-hover mb-0" style={{ fontSize: 11 }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#e8edf2', zIndex: 1 }}>
                <tr>
                  <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '40px', padding: '4px 8px' }}>#</th>
                  <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '200px', padding: '4px 8px' }}>
                    BP name
                    <span style={{ marginLeft: 4 }}>^</span>
                  </th>
                  <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '120px', padding: '4px 8px' }}>BP Code</th>
                  <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '120px', padding: '4px 8px', textAlign: 'right' }}>
                    Account Balance
                  </th>
                  <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '100px', padding: '4px 8px' }}>BP Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center" style={{ padding: '20px', color: '#888' }}>
                      No business partners found
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((bp, index) => (
                    <tr
                      key={`${bp.CardCode || 'bp'}-${index}`}
                      onClick={() => setSelectedRow(index)}
                      onDoubleClick={() => handleRowDoubleClick(bp)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedRow === index ? '#ffffcc' : index % 2 === 0 ? '#fff' : '#fafbfc',
                      }}
                    >
                      <td style={{ padding: '3px 8px' }}>{index + 1}</td>
                      <td style={{ padding: '3px 8px', fontWeight: selectedRow === index ? 600 : 400 }}>
                        {bp.CardName || ''}
                      </td>
                      <td style={{ padding: '3px 8px' }}>{bp.CardCode || ''}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(getBalanceValue(bp))}
                      </td>
                      <td style={{ padding: '3px 8px' }}>
                        {bp.CardType === 'C'
                          ? 'Customer'
                          : bp.CardType === 'S'
                            ? 'Supplier'
                            : bp.CardType === 'L'
                              ? 'Lead'
                              : bp.CardType || 'Customer'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center" style={{ fontSize: 11, color: '#666' }}>
            <div>
              <button
                className="btn btn-sm"
                type="button"
                style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #ccc' }}
              >
                {'<'}
              </button>
              <span style={{ margin: '0 8px' }}>...</span>
              <button
                className="btn btn-sm"
                type="button"
                style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #ccc' }}
              >
                {'>'}
              </button>
            </div>
            <div>
              Showing {filteredPartners.length} of {businessPartners.length} business partners
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
          <button
            type="button"
            className="btn btn-secondary btn-sm px-4"
            style={{ fontSize: 11 }}
            onClick={onClose}
          >
            Cancel
          </button>
          {onCreateNew ? (
            <button
              type="button"
              className="btn btn-warning btn-sm px-4"
              style={{ fontSize: 11 }}
              onClick={onCreateNew}
            >
              New
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
