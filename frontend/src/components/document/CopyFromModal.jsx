import { useEffect, useMemo, useState } from 'react';
import { matchesSapSearchText } from '../../utils/sapSearch';

const TITLES = {
  quotation: 'List of Sales Quotations',
  salesQuotation: 'List of Sales Quotations',
  salesOrder: 'List of Sales Orders',
  delivery: 'List of Deliveries',
  invoice: 'List of A/R Invoices',
  arInvoice: 'List of A/R Invoices',
  purchaseQuotation: 'List of Purchase Quotations',
  purchaseRequest: 'List of Purchase Requests',
  purchaseOrder: 'List of Purchase Orders',
  grpo: 'List of Goods Receipt POs',
  apInvoice: 'List of A/P Invoices',
  goodsIssue: 'List of Goods Issues',
  blanket: 'List of Blanket Agreements',
};

const BUSINESS_LABELS = {
  purchaseQuotation: 'Vendor',
  purchaseRequest: 'Vendor',
  purchaseOrder: 'Vendor',
  grpo: 'Vendor',
  apInvoice: 'Vendor',
};

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail?.error?.message?.value) return detail.error.message.value;
  if (detail?.error?.message) return detail.error.message;
  if (detail?.message) return detail.message;
  if (error?.response?.data?.message) return error.response.data.message;
  return error?.message || fallback;
};

const getDocValue = (document, keys) => {
  for (const key of keys) {
    const value = document?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return '';
};

const getDocEntry = (document) => getDocValue(document, ['DocEntry', 'docEntry', 'doc_entry']);

const fmtDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export default function CopyFromModal({
  isOpen,
  onClose,
  onCopy,
  documentType = 'quotation',
  title,
  onFetchDocuments,
  onFetchDocumentDetails,
  searchPlaceholder,
  columns,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setSelectedEntry('');
    setSearchTerm('');
    setError('');
    setLoading(true);

    Promise.resolve(onFetchDocuments?.(documentType))
      .then((docs) => {
        if (active) setDocuments(Array.isArray(docs) ? docs : []);
      })
      .catch((err) => {
        console.error('Error loading copy-from documents:', err);
        if (active) {
          setDocuments([]);
          setError(getErrorMessage(err, 'Failed to load documents.'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [documentType, isOpen, onFetchDocuments]);

  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return documents;

    return documents.filter((doc) => (
      [
        getDocValue(doc, ['DocNum', 'docNum', 'doc_num']),
        getDocValue(doc, ['CardCode', 'cardCode', 'customerCode', 'vendor_code']),
        getDocValue(doc, ['CardName', 'cardName', 'customerName', 'vendor_name']),
        getDocValue(doc, ['Comments', 'comments', 'Remarks', 'remarks', 'details']),
      ].some((value) => matchesSapSearchText(value, searchTerm))
    ));
  }, [documents, searchTerm]);

  const selectedDocument = filteredDocuments.find((doc) => String(getDocEntry(doc)) === String(selectedEntry));
  const businessLabel = BUSINESS_LABELS[documentType] || 'Customer';
  const modalTitle = title || TITLES[documentType] || 'List of Documents';
  const tableColumns = Array.isArray(columns) && columns.length
    ? columns
    : [
        { key: 'rowNumber', label: '#', width: 44, render: (_doc, index) => index + 1 },
        { key: 'docNum', label: 'No.', width: 96, render: (doc) => getDocValue(doc, ['DocNum', 'docNum', 'doc_num']) },
        { key: 'docDate', label: 'Date', width: 96, render: (doc) => fmtDate(getDocValue(doc, ['DocDate', 'docDate', 'posting_date'])) },
        { key: 'businessPartner', label: businessLabel, render: (doc) => getDocValue(doc, ['CardName', 'cardName', 'customerName', 'vendor_name']) },
        { key: 'remarks', label: 'Remarks', render: (doc) => getDocValue(doc, ['Comments', 'comments', 'Remarks', 'remarks', 'details']) },
        { key: 'dueDate', label: 'Due Date', width: 96, render: (doc) => fmtDate(getDocValue(doc, ['DocDueDate', 'docDueDate', 'delivery_date'])) },
      ];

  const handleChoose = async (document = selectedDocument) => {
    if (!document) return;

    const docEntry = getDocEntry(document);
    try {
      setLoading(true);
      setError('');
      const payload = onFetchDocumentDetails
        ? await onFetchDocumentDetails(documentType, docEntry, document)
        : document;
      await Promise.resolve(onCopy(payload, documentType, document));
      onClose();
    } catch (err) {
      console.error('Error copying document:', err);
      setError(getErrorMessage(err, 'Failed to copy document. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sap-copy-from-overlay" role="presentation" onMouseDown={onClose}>
      <div className="sap-copy-from-window" role="dialog" aria-modal="true" aria-label={modalTitle} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sap-copy-from-titlebar">
          <span>{modalTitle}</span>
          <div className="sap-copy-from-titlebar__actions">
            <button type="button" aria-label="Close" onClick={onClose} />
          </div>
        </div>

        <div className="sap-copy-from-filter">
          <label htmlFor="sap-copy-from-search">Find</label>
          <input
            id="sap-copy-from-search"
            type="text"
            autoFocus
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder || `Search by number, ${businessLabel.toLowerCase()}, or remarks...`}
          />
        </div>

        {error && <div className="sap-copy-from-error">{error}</div>}

        <div className="sap-copy-from-grid-wrap">
          {loading ? (
            <div className="sap-copy-from-empty">Loading documents...</div>
          ) : (
            <table className="sap-copy-from-grid">
              <thead>
                <tr>
                  {tableColumns.map((column) => (
                    <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length} className="sap-copy-from-empty">
                      No open documents found
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc, index) => {
                    const entry = getDocEntry(doc) || index;
                    const selected = String(selectedEntry) === String(entry);
                    return (
                      <tr
                        key={entry}
                        className={selected ? 'is-selected' : undefined}
                        onClick={() => setSelectedEntry(entry)}
                        onDoubleClick={() => handleChoose(doc)}
                      >
                        {tableColumns.map((column) => (
                          <td key={column.key}>
                            {typeof column.render === 'function' ? column.render(doc, index) : ''}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="sap-copy-from-footer">
          <button type="button" className="sap-copy-from-btn sap-copy-from-btn--primary" onClick={() => handleChoose()} disabled={!selectedDocument || loading}>
            Choose
          </button>
          <button type="button" className="sap-copy-from-btn" onClick={onClose}>
            Cancel
          </button>
          <span>{filteredDocuments.length} of {documents.length} documents</span>
        </div>
      </div>
    </div>
  );
}
