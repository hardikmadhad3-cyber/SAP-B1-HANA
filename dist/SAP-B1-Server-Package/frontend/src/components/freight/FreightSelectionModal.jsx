import React, { useEffect, useState } from 'react';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(16, 32, 48, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 16,
};

const dialogStyle = {
  backgroundColor: 'var(--sap-surface)',
  border: '1px solid var(--sap-border-strong)',
  borderRadius: 'var(--sap-radius-md)',
  width: 820,
  maxWidth: '92vw',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--sap-shadow-modal)',
  color: 'var(--sap-text)',
  fontFamily: 'var(--sap-font-family)',
  overflow: 'hidden',
};

const headerStyle = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--sap-border)',
  background: 'var(--sap-toolbar-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const inputStyle = {
  flex: 1,
  height: 'var(--sap-control-height)',
  padding: '0 8px',
  fontSize: 'var(--sap-control-font-size)',
  border: '1px solid var(--sap-border-strong)',
  borderRadius: 'var(--sap-radius-xs)',
};

const thStyle = {
  padding: '6px 8px',
  textAlign: 'left',
  fontWeight: 700,
  color: 'var(--sap-heading)',
  background: 'var(--sap-toolbar-bg)',
  borderBottom: '1px solid var(--sap-border)',
};

const buttonStyle = {
  padding: '6px 16px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 'var(--sap-radius-xs)',
  cursor: 'pointer',
};

const primaryButtonStyle = {
  ...buttonStyle,
  border: '1px solid var(--sap-primary-dark)',
  background: 'linear-gradient(180deg, var(--sap-primary) 0%, var(--sap-primary-dark) 100%)',
  color: '#fff',
};

const secondaryButtonStyle = {
  ...buttonStyle,
  border: '1px solid var(--sap-border-strong)',
  background: 'linear-gradient(180deg, #ffffff 0%, #e8edf2 100%)',
  color: 'var(--sap-text)',
};

const getDistributionMethodLabel = (value) => {
  const labels = {
    N: 'None',
    E: 'Equally',
    Q: 'Quantity',
    V: 'Volume',
    W: 'Weight',
  };
  return labels[value] || value || '';
};

export default function FreightSelectionModal({ isOpen, onClose, onSelect, freightCharges = [], loading }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCharges, setFilteredCharges] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    const nextRows = query
      ? freightCharges.filter((charge) => (
        String(charge.ExpnsName || '').toLowerCase().includes(query) ||
        String(charge.ExpnsCode || '').toLowerCase().includes(query) ||
        String(charge.Comments || '').toLowerCase().includes(query)
      ))
      : freightCharges;

    setFilteredCharges(nextRows);
    setSelectedIndex(-1);
  }, [searchQuery, freightCharges]);

  const handleClose = () => {
    setSearchQuery('');
    setSelectedIndex(-1);
    onClose();
  };

  const chooseCharge = (charge) => {
    onSelect(charge);
    handleClose();
  };

  const handleChoose = () => {
    if (selectedIndex >= 0 && filteredCharges[selectedIndex]) {
      chooseCharge(filteredCharges[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={handleClose}>
      <div style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--sap-heading)' }}>Freight Charges</h3>
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--sap-text-muted)', padding: 0, width: 24, height: 24 }}>x</button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sap-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, minWidth: 40 }}>Find</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, code, or remarks"
              style={inputStyle}
              autoFocus
            />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--sap-text-muted)' }}>Loading freight charges...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 40 }}>#</th>
                  <th style={{ ...thStyle, width: 100 }}>Code</th>
                  <th style={thStyle}>Name</th>
                  <th style={{ ...thStyle, width: 120 }}>Distrib. Method</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 100 }}>Amount</th>
                  <th style={{ ...thStyle, width: 90 }}>Tax Code</th>
                  <th style={thStyle}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredCharges.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: 20, textAlign: 'center', color: 'var(--sap-text-muted)' }}>No freight charges found</td>
                  </tr>
                ) : (
                  filteredCharges.map((charge, index) => (
                    <tr
                      key={`${charge.ExpnsCode || 'freight'}-${index}`}
                      onClick={() => setSelectedIndex(index)}
                      onDoubleClick={() => chooseCharge(charge)}
                      style={{
                        backgroundColor: selectedIndex === index ? 'var(--sap-primary-soft)' : index % 2 === 0 ? 'var(--sap-surface)' : 'var(--sap-row-even)',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--sap-border-soft)',
                      }}
                    >
                      <td style={{ padding: '6px 8px', color: 'var(--sap-text-muted)' }}>{index + 1}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{charge.ExpnsCode || ''}</td>
                      <td style={{ padding: '6px 8px' }}>{charge.ExpnsName || ''}</td>
                      <td style={{ padding: '6px 8px' }}>{getDistributionMethodLabel(charge.DistrbMthd)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{charge.LineTotal ? Number(charge.LineTotal).toFixed(2) : ''}</td>
                      <td style={{ padding: '6px 8px' }}>{charge.TaxCode || ''}</td>
                      <td style={{ padding: '6px 8px' }}>{charge.Comments || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--sap-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--sap-toolbar-bg)' }}>
          <button type="button" onClick={handleChoose} disabled={selectedIndex < 0} style={{ ...primaryButtonStyle, opacity: selectedIndex >= 0 ? 1 : 0.65, cursor: selectedIndex >= 0 ? 'pointer' : 'not-allowed' }}>Choose</button>
          <button type="button" onClick={handleClose} style={secondaryButtonStyle}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
