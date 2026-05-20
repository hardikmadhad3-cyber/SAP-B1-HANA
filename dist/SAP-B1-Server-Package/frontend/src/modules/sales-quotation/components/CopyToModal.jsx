import { useState } from 'react';

export default function CopyToModal({ isOpen, onClose, onCopyTo, currentDocument }) {
  const [selectedType, setSelectedType] = useState('delivery');
  const [copyPartial, setCopyPartial] = useState(false);
  const [selectedLines, setSelectedLines] = useState([]);

  const handleCopy = () => {
    if (!currentDocument) return;

    const linesToCopy = copyPartial 
      ? currentDocument.lines.filter((_, i) => selectedLines.includes(i))
      : currentDocument.lines;

    onCopyTo({
      targetType: selectedType,
      header: currentDocument.header,
      lines: linesToCopy,
      baseDocument: {
        baseType: 23, // Sales Quotation
        baseEntry: currentDocument.docEntry,
      }
    });

    onClose();
  };

  const toggleLine = (index) => {
    setSelectedLines(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: 'linear-gradient(to bottom, #f0f0f0, #d0d0d0)', borderBottom: '1px solid #999', padding: '6px 12px' }}>
            <h6 className="modal-title mb-0" style={{ fontSize: 12, fontWeight: 600 }}>Copy To</h6>
            <div className="d-flex gap-1">
              <button type="button" className="btn btn-sm" style={{ padding: '0 8px', fontSize: 14, lineHeight: 1.2, border: '1px solid #999', background: '#f0f0f0' }}>−</button>
              <button type="button" className="btn btn-sm" onClick={onClose} style={{ padding: '0 8px', fontSize: 14, lineHeight: 1.2, border: '1px solid #999', background: '#f0f0f0' }}>✕</button>
            </div>
          </div>
          
          <div className="modal-body" style={{ padding: '12px', backgroundColor: '#fff' }}>
            {/* Document Type Selection */}
            <div className="mb-3">
              <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, display: 'block' }}>Select Target Document</label>
              <div className="d-flex gap-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="targetType"
                    id="targetDelivery"
                    value="delivery"
                    checked={selectedType === 'delivery'}
                    onChange={(e) => setSelectedType(e.target.value)}
                  />
                  <label className="form-check-label" htmlFor="targetDelivery" style={{ fontSize: 11 }}>
                    Delivery
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="targetType"
                    id="targetInvoice"
                    value="ar-invoice"
                    checked={selectedType === 'ar-invoice'}
                    onChange={(e) => setSelectedType(e.target.value)}
                  />
                  <label className="form-check-label" htmlFor="targetInvoice" style={{ fontSize: 11 }}>
                    A/R Invoice
                  </label>
                </div>
              </div>
            </div>

            {/* Partial Copy Option */}
            <div className="mb-3">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="partialCopy"
                  checked={copyPartial}
                  onChange={(e) => setCopyPartial(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="partialCopy" style={{ fontSize: 11 }}>
                  Copy selected lines only
                </label>
              </div>
            </div>

            {/* Line Selection (if partial copy) */}
            {copyPartial && currentDocument?.lines && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #c8d0da' }}>
                <table className="table table-sm mb-0" style={{ fontSize: 11 }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#e8edf2' }}>
                    <tr>
                      <th style={{ width: '40px', padding: '4px 8px' }}>
                        <input
                          type="checkbox"
                          checked={selectedLines.length === currentDocument.lines.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLines(currentDocument.lines.map((_, i) => i));
                            } else {
                              setSelectedLines([]);
                            }
                          }}
                        />
                      </th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', padding: '4px 8px' }}>Item</th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', padding: '4px 8px' }}>Description</th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', padding: '4px 8px', textAlign: 'right' }}>Qty</th>
                      <th style={{ fontSize: 11, fontWeight: 700, color: '#003366', padding: '4px 8px', textAlign: 'right' }}>Open Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDocument.lines.map((line, index) => (
                      <tr key={index}>
                        <td style={{ padding: '3px 8px' }}>
                          <input
                            type="checkbox"
                            checked={selectedLines.includes(index)}
                            onChange={() => toggleLine(index)}
                          />
                        </td>
                        <td style={{ padding: '3px 8px' }}>{line.itemNo}</td>
                        <td style={{ padding: '3px 8px' }}>{line.itemDescription}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right' }}>{line.quantity}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right' }}>{line.openQuantity || line.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Info Message */}
            <div className="alert alert-info mt-3" style={{ fontSize: 11, padding: '8px 12px' }}>
              <strong>Note:</strong> Only open quantities will be copied. Document linking will be maintained.
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '8px 12px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ccc' }}>
            <button 
              type="button" 
              className="btn btn-warning btn-sm px-4" 
              style={{ fontSize: 11 }} 
              onClick={handleCopy}
              disabled={copyPartial && selectedLines.length === 0}
            >
              Create {selectedType === 'delivery' ? 'Delivery' : 'A/R Invoice'}
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
