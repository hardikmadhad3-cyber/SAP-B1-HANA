import React from 'react';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB');
};

function CopyFromModal({
  isOpen,
  goodsIssues,
  selectedDocEntry,
  onSelectDocEntry,
  onClose,
  onCopy,
  loading,
}) {
  if (!isOpen) return null;

  const documents = goodsIssues;

  return (
    <div className="po-modal-overlay">
      <div className="po-modal" style={{ width: 860 }}>
        <div className="po-modal__header">
          <span>Copy From</span>
          <button type="button" className="po-modal__close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="po-modal__body">
          <div className="po-section-title" style={{ marginBottom: 12 }}>
            List of Goods Issue
          </div>

          <div className="po-grid-wrap" style={{ maxHeight: 360 }}>
            <table className="po-grid">
              <thead>
                <tr>
                  <th>Doc No</th>
                  <th>Date</th>
                  <th>Details</th>
                  <th className="po-grid__cell--num">Total</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="po-grid__cell--muted" style={{ textAlign: 'center', padding: 20 }}>
                      {loading ? 'Loading documents...' : 'No open documents found.'}
                    </td>
                  </tr>
                ) : (
                  documents.map((document) => (
                    <tr
                      key={`${document.sourceType}-${document.docEntry}`}
                      className={
                        selectedDocEntry === document.docEntry
                          ? 'gr-goods-receipt__row--active'
                          : ''
                      }
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectDocEntry(document.docEntry)}
                    >
                      <td>{document.docNum}</td>
                      <td>{formatDate(document.docDate)}</td>
                      <td>{document.details}</td>
                      <td className="po-grid__cell--num">
                        {Number(document.docTotal || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="po-modal__footer">
          <button type="button" className="po-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="po-btn po-btn--primary"
            disabled={!selectedDocEntry || loading}
            onClick={onCopy}
          >
            {loading ? 'Loading...' : 'Copy Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CopyFromModal;
