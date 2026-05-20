import React, { useState, useEffect } from 'react';

export default function FreightSelectionModal({ isOpen, onClose, onSelect, freightCharges, loading }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCharges, setFilteredCharges] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = freightCharges.filter(
        charge =>
          (charge.ExpnsName || '').toLowerCase().includes(query) ||
          (charge.ExpnsCode || '').toLowerCase().includes(query) ||
          (charge.Comments || '').toLowerCase().includes(query)
      );
      setFilteredCharges(filtered);
    } else {
      setFilteredCharges(freightCharges);
    }
    setSelectedIndex(-1);
  }, [searchQuery, freightCharges]);

  const handleRowClick = (index) => {
    setSelectedIndex(index);
  };

  const handleRowDoubleClick = (charge) => {
    onSelect(charge);
    handleClose();
  };

  const handleChoose = () => {
    if (selectedIndex >= 0 && filteredCharges[selectedIndex]) {
      onSelect(filteredCharges[selectedIndex]);
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedIndex(-1);
    onClose();
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 4,
          width: '800px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #d0d7de',
            background: 'linear-gradient(180deg, #f6f8fa 0%, #e9ecef 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#24292f' }}>
            Freight Charges
          </h3>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#57606a',
              padding: 0,
              width: 24,
              height: 24,
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #d0d7de' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, minWidth: 40 }}>Find</label>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by Name, Code, or Remarks"
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 12,
                border: '1px solid #d0d7de',
                borderRadius: 3,
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#57606a' }}>Loading freight charges...</div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 11,
                marginTop: 8,
              }}
            >
              <thead>
                <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #d0d7de' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 40 }}>
                    #
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 100 }}>
                    Code
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>
                    Name
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 120 }}>
                    Distrib. Method
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, width: 100 }}>
                    Amount
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 80 }}>
                    Tax Code
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCharges.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: 20, textAlign: 'center', color: '#57606a' }}>
                      {loading ? 'Loading...' : 'No freight charges found'}
                    </td>
                  </tr>
                ) : (
                  filteredCharges.map((charge, index) => (
                    <tr
                      key={index}
                      onClick={() => handleRowClick(index)}
                      onDoubleClick={() => handleRowDoubleClick(charge)}
                      style={{
                        backgroundColor: selectedIndex === index ? '#fff8c5' : index % 2 === 0 ? '#fff' : '#f6f8fa',
                        cursor: 'pointer',
                        borderBottom: '1px solid #d0d7de',
                      }}
                    >
                      <td style={{ padding: '6px 8px', color: '#57606a' }}>{index + 1}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 500 }}>{charge.ExpnsCode || ''}</td>
                      <td style={{ padding: '6px 8px' }}>{charge.ExpnsName || ''}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {charge.DistributionMethod === 'N' ? 'None' :
                         charge.DistributionMethod === 'E' ? 'Equally' :
                         charge.DistributionMethod === 'Q' ? 'Quantity' :
                         charge.DistributionMethod === 'V' ? 'Volume' :
                         charge.DistributionMethod === 'W' ? 'Weight' :
                         charge.DistributionMethod || ''}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {charge.LineTotal ? Number(charge.LineTotal).toFixed(2) : ''}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{charge.TaxCode || ''}</td>
                      <td style={{ padding: '6px 8px' }}>{charge.Comments || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #d0d7de',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            background: '#f6f8fa',
          }}
        >
          <button
            onClick={handleChoose}
            disabled={selectedIndex < 0}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid #1f883d',
              borderRadius: 3,
              background: selectedIndex >= 0 ? 'linear-gradient(180deg, #2da44e 0%, #1f883d 100%)' : '#94d3a2',
              color: '#fff',
              cursor: selectedIndex >= 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Choose
          </button>
          <button
            onClick={handleClose}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid #d0d7de',
              borderRadius: 3,
              background: 'linear-gradient(180deg, #f6f8fa 0%, #e9ecef 100%)',
              color: '#24292f',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
