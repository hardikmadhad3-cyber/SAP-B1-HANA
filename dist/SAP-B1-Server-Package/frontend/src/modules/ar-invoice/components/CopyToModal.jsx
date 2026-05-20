import React, { useState } from 'react';

export default function CopyToModal({ isOpen, onClose, onCopyTo, currentDocEntry }) {
  const [selectedType, setSelectedType] = useState('');
  const [error, setError] = useState('');

  const handleSelect = (type) => {
    setSelectedType(type);
    setError('');
  };

  const handleCopyTo = () => {
    if (!selectedType) {
      setError('Please select a target document type');
      return;
    }

    if (!currentDocEntry) {
      setError('AR Invoice must be saved before copying to another document');
      return;
    }

    onCopyTo(selectedType);
    onClose();
  };

  const handleClose = () => {
    setSelectedType('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '90%' }}>
        <div className="modal-header">
          <h5 className="modal-title">Copy To</h5>
          <button type="button" className="btn-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {!currentDocEntry && (
            <div className="alert alert-warning" role="alert">
              Please save the AR Invoice document first before copying to another document.
            </div>
          )}

          <p style={{ marginBottom: 16, color: '#555' }}>Select target document type:</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              type="button"
              className={`btn ${selectedType === 'arCreditMemo' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => handleSelect('arCreditMemo')}
              disabled={!currentDocEntry}
              style={{ padding: '12px 20px', textAlign: 'left' }}
            >
              <strong>A/R Credit Memo</strong>
              <div style={{ fontSize: 12, color: selectedType === 'arCreditMemo' ? '#fff' : '#666', marginTop: 4 }}>
                Create credit memo from this invoice
              </div>
            </button>

            <button
              type="button"
              className={`btn ${selectedType === 'return' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => handleSelect('return')}
              disabled={!currentDocEntry}
              style={{ padding: '12px 20px', textAlign: 'left' }}
            >
              <strong>Return Request</strong>
              <div style={{ fontSize: 12, color: selectedType === 'return' ? '#fff' : '#666', marginTop: 4 }}>
                Create return request from this invoice
              </div>
            </button>
          </div>

          {selectedType && (
            <div className="alert alert-info mt-3" style={{ fontSize: 13 }}>
              <strong>Note:</strong> This will create a new {selectedType === 'arCreditMemo' ? 'A/R Credit Memo' : 'Return Request'} document 
              with data from the current invoice. The new document will be linked to this invoice as a base document.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleCopyTo}
            disabled={!selectedType || !currentDocEntry}
          >
            Copy To {selectedType === 'arCreditMemo' ? 'Credit Memo' : selectedType === 'return' ? 'Return Request' : 'Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
