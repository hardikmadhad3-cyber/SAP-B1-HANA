import React, { useEffect, useMemo, useState } from 'react';

const TITLES = {
  arInvoice: 'Copy From A/R Invoice',
};

const TYPE_LABELS = {
  arInvoice: 'A/R Invoice',
};

const fmtDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN');
  } catch {
    return String(value);
  }
};

export default function CopyFromModal({
  isOpen,
  onClose,
  onCopy,
  documentType = 'arInvoice',
  onFetchDocuments,
  onFetchDocumentDetails,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setSelectedRow(null);
    setSearchTerm('');
    setError('');

    const loadDocuments = async () => {
      setLoading(true);
      try {
        const docs = await onFetchDocuments(documentType);
        setDocuments(Array.isArray(docs) ? docs : []);
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load documents');
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [isOpen, documentType, onFetchDocuments]);

  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return documents;
    const term = searchTerm.toLowerCase();
    return documents.filter((doc) =>
      String(doc.DocNum || '').toLowerCase().includes(term) ||
      String(doc.CardCode || '').toLowerCase().includes(term) ||
      String(doc.CardName || '').toLowerCase().includes(term) ||
      String(doc.Comments || '').toLowerCase().includes(term)
    );
  }, [documents, searchTerm]);

  const handleCopy = async (doc) => {
    const target = doc || (selectedRow !== null ? filteredDocuments[selectedRow] : null);
    if (!target) return;

    try {
      setLoading(true);
      setError('');
      const fullDocument = await onFetchDocumentDetails(documentType, target.DocEntry);
      onCopy(fullDocument, documentType);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to copy document');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalTitle = TITLES[documentType] || 'Copy From Document';
  const documentTypeLabel = TYPE_LABELS[documentType] || 'Document';

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: 'linear-gradient(to bottom, #f0f0f0, #d0d0d0)', borderBottom: '1px solid #999', padding: '6px 12px' }}>
            <h6 className="modal-title mb-0" style={{ fontSize: 12, fontWeight: 600 }}>
              {modalTitle}
            </h6>
            <div className="d-flex gap-1">
              <button type="button" className="btn btn-sm" style={{ padding: '0 8px', fontSize: 14, lineHeight: 1.2, border: '1px solid #999', background: '#f0f0f0' }}>-</button>
              <button type="button" className="btn btn-sm" onClick={onClose} style={{ padding: '0 8px', fontSize: 14, lineHeight: 1.2, border: '1px solid #999', background: '#f0f0f0' }}>x</button>
            </div>
          </div>

          <div className="modal-body" style={{ padding: '12px', backgroundColor: '#fff' }}>
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert" style={{ fontSize: 11, padding: '8px 12px', marginBottom: 12 }}>
                {error}
                <button type="button" className="btn-close" style={{ fontSize: 10 }} onClick={() => setError('')}></button>
              </div>
            )}

            <div className="mb-2">
              <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Document Type</label>
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ fontSize: 11, maxWidth: 250, background: '#f8f9fa' }}
                value={documentTypeLabel}
                readOnly
              />
            </div>

            <div className="mb-2">
              <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Find</label>
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ fontSize: 11, background: '#ffffcc' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by document number, customer code, customer name, or remarks..."
              />
            </div>

            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>Loading documents...</div>
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #c8d0da' }}>
                <table className="table table-sm table-hover mb-0" style={{ fontSize: 11 }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#e8edf2', zIndex: 1 }}>
                    <tr>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '40px', padding: '4px 8px' }}>#</th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '100px', padding: '4px 8px' }}>Doc No.</th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '120px', padding: '4px 8px' }}>Customer Code</th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', padding: '4px 8px' }}>Customer Name</th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', padding: '4px 8px' }}>Remarks</th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '110px', padding: '4px 8px' }}>Date</th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', width: '120px', padding: '4px 8px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center" style={{ padding: '20px', color: '#888' }}>
                          {documents.length === 0 ? `No open ${documentTypeLabel.toLowerCase()}s found` : 'No documents match your search'}
                        </td>
                      </tr>
                    ) : (
                      filteredDocuments.map((doc, index) => (
                        <tr
                          key={doc.DocEntry || index}
                          onClick={() => setSelectedRow(index)}
                          onDoubleClick={() => handleCopy(doc)}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: selectedRow === index ? '#ffffcc' : index % 2 === 0 ? '#fff' : '#fafbfc',
                          }}
                        >
                          <td style={{ padding: '3px 8px' }}>{index + 1}</td>
                          <td style={{ padding: '3px 8px', fontWeight: selectedRow === index ? 600 : 400 }}>{doc.DocNum || ''}</td>
                          <td style={{ padding: '3px 8px' }}>{doc.CardCode || ''}</td>
                          <td style={{ padding: '3px 8px' }}>{doc.CardName || ''}</td>
                          <td style={{ padding: '3px 8px' }}>{doc.Comments || ''}</td>
                          <td style={{ padding: '3px 8px' }}>{fmtDate(doc.DocDate)}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {doc.DocTotal != null ? Number(doc.DocTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ padding: '8px 12px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ccc' }}>
            <button
              type="button"
              className="btn btn-warning btn-sm px-4"
              style={{ fontSize: 11 }}
              onClick={() => handleCopy()}
              disabled={selectedRow === null || loading}
            >
              Copy
            </button>
            <button type="button" className="btn btn-secondary btn-sm px-4" style={{ fontSize: 11 }} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
