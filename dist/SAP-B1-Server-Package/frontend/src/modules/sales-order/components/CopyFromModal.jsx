import { useState, useMemo, useEffect } from 'react';

const TITLES = {
  quotation:      'List of Sales Quotations',
  salesQuotation: 'List of Sales Quotations',
  salesOrder:     'List of Sales Orders',
  returns:        'List of Returns',
  blanket:        'List of Blanket Agreements',
};

const fmtDate = (val) => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d)) return String(val);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return String(val); }
};

export default function CopyFromModal({
  isOpen,
  onClose,
  onCopy,
  documentType = 'quotation',
  onFetchDocuments,
  onFetchDocumentDetails
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedRow(null);
      setSearchTerm('');
      setError('');
      loadDocuments();
    }
  }, [isOpen, documentType]);

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const docs = await onFetchDocuments(documentType);
      setDocuments(docs || []);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Failed to load documents.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return documents;
    const term = searchTerm.toLowerCase();
    return documents.filter(doc =>
      String(doc.DocNum || '').toLowerCase().includes(term) ||
      String(doc.CardCode || '').toLowerCase().includes(term) ||
      String(doc.CardName || '').toLowerCase().includes(term) ||
      String(doc.Comments || '').toLowerCase().includes(term)
    );
  }, [documents, searchTerm]);

  const handleRowClick = (index) => setSelectedRow(index);

  const handleChoose = async (doc) => {
    const target = doc || (selectedRow !== null ? filteredDocuments[selectedRow] : null);
    if (!target) return;
    try {
      setLoading(true);
      const fullDocument = await onFetchDocumentDetails(documentType, target.DocEntry);
      onCopy(fullDocument, documentType);
      onClose();
    } catch (err) {
      console.error('Error copying document:', err);
      setError('Failed to copy document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalTitle = TITLES[documentType] || 'List of Documents';
  const col2Label = documentType === 'blanket' ? 'Agreement No.' : '#';

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#fff', border: '1px solid #999', borderRadius: 2, width: 900, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(to bottom, #e8e8e8, #c8c8c8)', borderBottom: '2px solid #e8a000', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#000' }}>{modalTitle}</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {['−', '□', '✕'].map((ch, i) => (
              <button key={i} type="button" onClick={ch === '✕' ? onClose : undefined}
                style={{ width: 18, height: 18, fontSize: 11, border: '1px solid #999', background: '#e0e0e0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Find */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, minWidth: 30 }}>Find</label>
          <input
            type="text"
            autoFocus
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, maxWidth: 320, padding: '3px 6px', fontSize: 11, border: '1px solid #ccc', background: '#ffffcc' }}
            placeholder="Search by number, customer, or remarks..."
          />
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {error && <div style={{ padding: '6px 10px', color: '#c00', fontSize: 11, background: '#fff0f0' }}>{error}</div>}
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: 11 }}>Loading documents...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#e8edf2', borderBottom: '1px solid #c8d0da' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#003366', width: 40, borderRight: '1px solid #d0d7de' }}>#</th>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#003366', width: 90, borderRight: '1px solid #d0d7de' }}>
                    {col2Label} <span>▲</span>
                  </th>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#003366', width: 90, borderRight: '1px solid #d0d7de' }}>Date</th>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#003366', borderRight: '1px solid #d0d7de' }}>Customer</th>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#003366', borderRight: '1px solid #d0d7de' }}>Remarks</th>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#003366', width: 90 }}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: 20, textAlign: 'center', color: '#888' }}>No open documents found</td></tr>
                ) : (
                  filteredDocuments.map((doc, idx) => (
                    <tr
                      key={doc.DocEntry || idx}
                      onClick={() => handleRowClick(idx)}
                      onDoubleClick={() => handleChoose(doc)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedRow === idx ? '#fff8c5' : idx % 2 === 0 ? '#fff' : '#f5f5f5',
                        borderBottom: '1px solid #e0e0e0'
                      }}
                    >
                      <td style={{ padding: '4px 8px', color: '#57606a' }}>{idx + 1}</td>
                      <td style={{ padding: '4px 8px', fontWeight: selectedRow === idx ? 600 : 400 }}>{doc.DocNum || ''}</td>
                      <td style={{ padding: '4px 8px', color: '#57606a' }}>{fmtDate(doc.DocDate)}</td>
                      <td style={{ padding: '4px 8px' }}>{doc.CardName || ''}</td>
                      <td style={{ padding: '4px 8px', color: '#57606a' }}>{doc.Comments || ''}</td>
                      <td style={{ padding: '4px 8px', color: '#57606a' }}>{fmtDate(doc.DocDueDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 10px', borderTop: '1px solid #ccc', background: '#f0f0f0', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => handleChoose()}
            disabled={selectedRow === null || loading}
            style={{
              padding: '4px 20px', fontSize: 11, fontWeight: 600,
              border: '1px solid #999', borderRadius: 2,
              background: selectedRow !== null && !loading ? 'linear-gradient(to bottom, #ffe066, #e8a000)' : '#e0e0e0',
              color: selectedRow !== null ? '#000' : '#888',
              cursor: selectedRow !== null && !loading ? 'pointer' : 'not-allowed'
            }}
          >
            Choose
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '4px 20px', fontSize: 11, fontWeight: 600, border: '1px solid #999', borderRadius: 2, background: 'linear-gradient(to bottom, #ffe066, #e8a000)', color: '#000', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#666' }}>
            {filteredDocuments.length} of {documents.length} documents
          </span>
        </div>
      </div>
    </div>
  );
}
