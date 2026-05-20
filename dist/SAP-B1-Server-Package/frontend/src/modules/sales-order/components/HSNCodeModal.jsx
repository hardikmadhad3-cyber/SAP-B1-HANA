import React, { useState, useEffect } from 'react';
import { fetchHSNCodes } from '../../../api/hsnCodeApi';

export default function HSNCodeModal({ isOpen, onClose, onSelect }) {
  const [hsnCodes, setHsnCodes] = useState([]);
  const [filteredCodes, setFilteredCodes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHSNCodes();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = hsnCodes.filter(
        hsn =>
          (hsn.code || '').toLowerCase().includes(query) ||
          (hsn.heading || '').toLowerCase().includes(query) ||
          (hsn.subHeading || '').toLowerCase().includes(query) ||
          (hsn.description || '').toLowerCase().includes(query)
      );
      setFilteredCodes(filtered);
    } else {
      setFilteredCodes(hsnCodes);
    }
    setSelectedIndex(-1);
  }, [searchQuery, hsnCodes]);

  const loadHSNCodes = async () => {
    setLoading(true);
    try {
      const response = await fetchHSNCodes('');
      setHsnCodes(response.data || []);
      setFilteredCodes(response.data || []);
    } catch (error) {
      console.error('Error loading HSN codes:', error);
      setHsnCodes([]);
      setFilteredCodes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (index) => {
    setSelectedIndex(index);
  };

  const handleRowDoubleClick = (hsn) => {
    onSelect(hsn);
    handleClose();
  };

  const handleChoose = () => {
    if (selectedIndex >= 0 && filteredCodes[selectedIndex]) {
      onSelect(filteredCodes[selectedIndex]);
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
            List of India Chapter ID
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
              placeholder="Search by Chapter, Heading, Subheading, or Description"
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
            <div style={{ padding: 20, textAlign: 'center', color: '#57606a' }}>Loading...</div>
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
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 120 }}>
                    Chapter
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 80 }}>
                    Heading
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 100 }}>
                    Subheading
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 20, textAlign: 'center', color: '#57606a' }}>
                      No HSN codes found
                    </td>
                  </tr>
                ) : (
                  filteredCodes.map((hsn, index) => (
                    <tr
                      key={index}
                      onClick={() => handleRowClick(index)}
                      onDoubleClick={() => handleRowDoubleClick(hsn)}
                      style={{
                        backgroundColor: selectedIndex === index ? '#fff8c5' : index % 2 === 0 ? '#fff' : '#f6f8fa',
                        cursor: 'pointer',
                        borderBottom: '1px solid #d0d7de',
                      }}
                    >
                      <td style={{ padding: '6px 8px', color: '#57606a' }}>{index + 1}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 500 }}>{hsn.code || ''}</td>
                      <td style={{ padding: '6px 8px' }}>{hsn.heading || ''}</td>
                      <td style={{ padding: '6px 8px' }}>{hsn.subHeading || ''}</td>
                      <td style={{ padding: '6px 8px' }}>{hsn.description || ''}</td>
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
