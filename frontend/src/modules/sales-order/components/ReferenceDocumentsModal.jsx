import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesOrderReferenceDocumentLookup } from '../../../api/salesOrderApi';
import SapGoldenArrowButton from '../../../components/document/SapGoldenArrowButton';

export const SALES_ORDER_REFERENCE_DOCUMENT_TYPES = [
  { value: '22', label: 'Purchase Order', serviceLayer: 'rot_PurchaseOrder' },
  { value: '17', label: 'Sales Order', serviceLayer: 'rot_SalesOrder' },
  { value: '15', label: 'Delivery', serviceLayer: 'rot_DeliveryNotes' },
  { value: '13', label: 'A/R Invoice', serviceLayer: 'rot_SalesInvoice' },
  { value: '14', label: 'A/R Credit Memo', serviceLayer: 'rot_SalesCreditNote' },
  { value: '23', label: 'Sales Quotation', serviceLayer: 'rot_SalesQuotation' },
  { value: '20', label: 'Goods Receipt PO', serviceLayer: 'rot_PurchaseDeliveryNotes' },
  { value: '18', label: 'A/P Invoice', serviceLayer: 'rot_PurchaseInvoice' },
  { value: '19', label: 'A/P Credit Memo', serviceLayer: 'rot_PurchaseCreditNote' },
  { value: '1470000113', label: 'Purchase Request', serviceLayer: 'rot_PurchaseRequest' },
  { value: '540000006', label: 'Purchase Quotation', serviceLayer: 'rot_PurchaseQuotation' },
];

const EMPTY_ROW = {
  direction: 'to',
  transactionType: '',
  docNumber: '',
  docEntry: '',
  extDocNumber: '',
};

const withBlankRows = (rows = [], minRows = 12, direction = 'to') => {
  const normalized = rows.map((row) => ({
    ...EMPTY_ROW,
    ...row,
    direction: row.direction || direction,
  }));
  while (normalized.length < minRows) {
    normalized.push({ ...EMPTY_ROW, direction });
  }
  return normalized;
};

const compactRows = (rows = []) => rows
  .map((row) => ({
    ...row,
    transactionType: String(row.transactionType || '').trim(),
    docNumber: String(row.docNumber || '').trim(),
    docEntry: String(row.docEntry || '').trim(),
    extDocNumber: String(row.extDocNumber || '').trim(),
  }))
  .filter((row) => row.transactionType || row.docNumber || row.docEntry || row.extDocNumber);

const updateRowsAtVisibleIndex = (rows = [], activeTab = 'to', visibleIndex = -1, updater) => {
  let seen = -1;
  return rows.map((row) => {
    if ((row.direction || 'to') !== activeTab) return row;
    seen += 1;
    return seen === visibleIndex ? updater(row) : row;
  });
};

export default function ReferenceDocumentsModal({
  isOpen,
  referenceDocuments = [],
  onClose,
  onSave,
  isEditable = true,
  cardCode = '',
  onOpenDocument,
}) {
  const [activeTab, setActiveTab] = useState('to');
  const [rows, setRows] = useState([]);
  const [onlyBusinessPartner, setOnlyBusinessPartner] = useState(false);
  const [typeDropdownRow, setTypeDropdownRow] = useState(null);
  const [lookup, setLookup] = useState({
    open: false,
    rowIndex: -1,
    transactionType: '',
    title: 'List of Documents',
    query: '',
    loading: false,
    options: [],
    error: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    const toRows = referenceDocuments.filter((row) => (row.direction || 'to') !== 'by');
    const byRows = referenceDocuments.filter((row) => (row.direction || 'to') === 'by');
    setRows([
      ...withBlankRows(toRows, 12, 'to'),
      ...withBlankRows(byRows, 12, 'by'),
    ]);
    setActiveTab('to');
    setTypeDropdownRow(null);
    setLookup((prev) => ({ ...prev, open: false, rowIndex: -1, query: '', options: [], error: '' }));
  }, [isOpen, referenceDocuments]);

  useEffect(() => {
    if (!lookup.open || !lookup.transactionType) return;
    let ignore = false;

    const load = async () => {
      setLookup((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await fetchSalesOrderReferenceDocumentLookup({
          transactionType: lookup.transactionType,
          query: lookup.query,
          cardCode: onlyBusinessPartner ? cardCode : '',
          top: 80,
        });
        if (ignore) return;
        setLookup((prev) => ({
          ...prev,
          loading: false,
          title: response.data?.label ? `List of ${response.data.label}` : 'List of Documents',
          options: response.data?.options || [],
        }));
      } catch (error) {
        if (ignore) return;
        setLookup((prev) => ({
          ...prev,
          loading: false,
          options: [],
          error: error?.response?.data?.detail || error?.message || 'Failed to load documents.',
        }));
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [lookup.open, lookup.transactionType, lookup.query, onlyBusinessPartner, cardCode]);

  const visibleRows = useMemo(
    () => rows.filter((row) => (row.direction || 'to') === activeTab),
    [rows, activeTab],
  );

  if (!isOpen) return null;

  const updateRow = (visibleIndex, field, value) => {
    if (!isEditable) return;
    setRows((prev) => updateRowsAtVisibleIndex(prev, activeTab, visibleIndex, (row) => ({
      ...row,
      [field]: value,
    })));
  };

  const updateVisibleRow = (visibleIndex, updater) => {
    if (!isEditable) return;
    setRows((prev) => updateRowsAtVisibleIndex(prev, activeTab, visibleIndex, updater));
  };

  const handleTransactionTypeChange = (visibleIndex, value) => {
    setTypeDropdownRow(null);
    updateVisibleRow(visibleIndex, (row) => ({
      ...row,
      transactionType: value,
      docNumber: '',
      docEntry: '',
      extDocNumber: '',
    }));
  };

  const getTransactionTypeLabel = (value) => (
    SALES_ORDER_REFERENCE_DOCUMENT_TYPES.find((type) => String(type.value) === String(value))?.label || ''
  );

  const openDocLookup = (visibleIndex) => {
    const row = visibleRows[visibleIndex] || {};
    if (!row.transactionType) {
      setLookup({
        open: true,
        rowIndex: visibleIndex,
        transactionType: '',
        title: 'List of Documents',
        query: '',
        loading: false,
        options: [],
        error: 'Select Transact. Type first.',
      });
      return;
    }

    setLookup({
      open: true,
      rowIndex: visibleIndex,
      transactionType: row.transactionType,
      title: 'List of Documents',
      query: '',
      loading: true,
      options: [],
      error: '',
    });
  };

  const selectLookupDocument = (documentRow) => {
    updateVisibleRow(lookup.rowIndex, (row) => ({
      ...row,
      docEntry: documentRow.docEntry || '',
      docNumber: documentRow.docNumber || '',
      extDocNumber: documentRow.extDocNumber || row.extDocNumber || '',
    }));
    setLookup((prev) => ({ ...prev, open: false, rowIndex: -1 }));
  };

  const getRowsWithLookupDocument = (documentRow) => updateRowsAtVisibleIndex(
    rows,
    activeTab,
    lookup.rowIndex,
    (row) => ({
      ...row,
      transactionType: lookup.transactionType || row.transactionType,
      docEntry: documentRow.docEntry || '',
      docNumber: documentRow.docNumber || '',
      extDocNumber: documentRow.extDocNumber || row.extDocNumber || '',
    }),
  );

  const openDocumentFromRows = (row, nextRows = rows) => {
    onOpenDocument?.(row, {
      referenceDocuments: compactRows(nextRows),
      referenceDocumentsChanged: true,
      referenceDocumentsModalOpen: true,
    });
  };

  const openLookupDocument = (documentRow) => {
    const nextRows = getRowsWithLookupDocument(documentRow);
    const nextRow = nextRows.filter((row) => (row.direction || 'to') === activeTab)[lookup.rowIndex] || {};
    setRows(nextRows);
    setLookup((prev) => ({ ...prev, open: false, rowIndex: -1 }));
    openDocumentFromRows(nextRow, nextRows);
  };

  const handleDocNumberChange = (visibleIndex, value) => {
    updateVisibleRow(visibleIndex, (row) => ({
      ...row,
      docNumber: value,
      docEntry: '',
    }));
  };

  const handleSave = () => {
    onSave(compactRows(rows));
  };

  return (
    <div className="so-reference-modal-overlay" data-document-dirty-ignore="true">
      <div className="so-reference-modal">
        <div className="so-reference-modal__titlebar">
          <span>Reference Information</span>
          <button type="button" className="so-reference-modal__window-btn">—</button>
          <button type="button" className="so-reference-modal__window-btn">□</button>
          <button type="button" className="so-reference-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="so-reference-modal__body">
          <div className="so-reference-modal__tabs">
            <button
              type="button"
              className={`so-reference-modal__tab ${activeTab === 'to' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('to');
                setTypeDropdownRow(null);
              }}
            >
              Document Referenced To
            </button>
            <button
              type="button"
              className={`so-reference-modal__tab ${activeTab === 'by' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('by');
                setTypeDropdownRow(null);
              }}
            >
              Document Referenced By
            </button>
          </div>

          <div className="so-reference-modal__grid-wrap">
            <table className="so-reference-modal__grid">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th>Transact. Type</th>
                  <th>Doc. Number</th>
                  <th>Ext. Doc. Number</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={`${activeTab}-${index}`}>
                    <td className="so-reference-modal__rowno">{index + 1}</td>
                    <td className="so-reference-modal__type-cell">
                      <button
                        type="button"
                        className="so-reference-modal__type-combo"
                        onClick={() => isEditable && setTypeDropdownRow((prev) => (prev === index ? null : index))}
                        disabled={!isEditable}
                      >
                        <span>{getTransactionTypeLabel(row.transactionType)}</span>
                        <span className="so-reference-modal__type-arrow">⌄</span>
                      </button>
                      {typeDropdownRow === index && (
                        <div className="so-reference-modal__type-menu">
                          <button
                            type="button"
                            className="so-reference-modal__type-option"
                            onClick={() => handleTransactionTypeChange(index, '')}
                          >
                            &nbsp;
                          </button>
                          {SALES_ORDER_REFERENCE_DOCUMENT_TYPES.map((type) => (
                            <button
                              type="button"
                              key={type.value}
                              className="so-reference-modal__type-option"
                              onClick={() => handleTransactionTypeChange(index, type.value)}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="so-reference-modal__lookup-cell">
                        <input
                          value={row.docNumber || ''}
                          onChange={(event) => handleDocNumberChange(index, event.target.value)}
                          disabled={!isEditable}
                        />
                        <button
                          type="button"
                          className="so-reference-modal__lookup-btn"
                          onClick={() => openDocLookup(index)}
                          disabled={!isEditable}
                          title="Choose document"
                        >
                          ...
                        </button>
                        {row.transactionType && (row.docEntry || row.docNumber) ? (
                          <SapGoldenArrowButton
                            onClick={() => openDocumentFromRows(row)}
                            title="Open referenced document"
                            className="so-reference-modal__open-btn"
                          />
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <input
                        value={row.extDocNumber || ''}
                        onChange={(event) => updateRow(index, 'extDocNumber', event.target.value)}
                        disabled={!isEditable}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="so-reference-modal__checkbox">
            <input
              type="checkbox"
              checked={onlyBusinessPartner}
              onChange={(event) => setOnlyBusinessPartner(event.target.checked)}
              disabled={!isEditable}
            />
            <span>Only Reference Business Partner on Main Document</span>
          </label>
        </div>

        <div className="so-reference-modal__footer">
          {isEditable ? (
            <>
              <button type="button" className="so-btn so-btn--primary" onClick={handleSave}>OK</button>
              <button type="button" className="so-btn so-btn--secondary" onClick={onClose}>Cancel</button>
            </>
          ) : (
            <button type="button" className="so-btn so-btn--primary" onClick={onClose}>Close</button>
          )}
        </div>

        {lookup.open && (
          <div className="so-reference-lookup">
            <div className="so-reference-lookup__titlebar">
              <span>{lookup.title}</span>
              <button
                type="button"
                className="so-reference-modal__close"
                onClick={() => setLookup((prev) => ({ ...prev, open: false }))}
              >
                ×
              </button>
            </div>
            <div className="so-reference-lookup__body">
              <div className="so-reference-lookup__search">
                <label>Find</label>
                <input
                  value={lookup.query}
                  onChange={(event) => setLookup((prev) => ({ ...prev, query: event.target.value }))}
                  autoFocus
                />
              </div>
              {lookup.error ? (
                <div className="so-reference-lookup__message">{lookup.error}</div>
              ) : (
                <div className="so-reference-lookup__table-wrap">
                  <table className="so-reference-lookup__table">
                    <thead>
                      <tr>
                        <th>Doc. Number</th>
                        <th>Customer/Vendor Code</th>
                        <th>Name</th>
                        <th>Posting Date</th>
                        <th>Ext. Doc. Number</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lookup.loading ? (
                        <tr><td colSpan={6}>Loading...</td></tr>
                      ) : lookup.options.length ? (
                        lookup.options.map((option) => (
                          <tr
                            key={`${option.docEntry}-${option.docNumber}`}
                            onDoubleClick={() => selectLookupDocument(option)}
                          >
                            <td>
                              <span className="so-reference-lookup__doc-link">
                                {option.docEntry ? (
                                  <SapGoldenArrowButton
                                    onClick={() => openLookupDocument(option)}
                                    title="Open document"
                                  />
                                ) : null}
                                <button
                                  type="button"
                                  className="so-reference-lookup__link"
                                  onClick={() => selectLookupDocument(option)}
                                >
                                  {option.docNumber}
                                </button>
                              </span>
                            </td>
                            <td>{option.cardCode}</td>
                            <td>{option.cardName}</td>
                            <td>{option.docDate}</td>
                            <td>{option.extDocNumber}</td>
                            <td>{option.status}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={6}>No documents found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="so-reference-lookup__footer">
                <button
                  type="button"
                  className="so-btn so-btn--secondary"
                  onClick={() => setLookup((prev) => ({ ...prev, open: false }))}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
