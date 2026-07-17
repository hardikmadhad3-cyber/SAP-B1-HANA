import React, { useCallback } from 'react';
import { fetchHSNCodes, fetchSACCodes } from '../../api/hsnCodeApi';
import SapLookupModal from './SapLookupModal';

export default function HSNCodeModal({ isOpen, onClose, onSelect, mode = 'hsn' }) {
  const isSacMode = mode === 'sac';
  const fetchCodes = useCallback(async (query) => {
    const response = isSacMode ? await fetchSACCodes(query) : await fetchHSNCodes(query);
    return response.data || [];
  }, [isSacMode]);
  const handleSelect = (hsn) => {
    onSelect(hsn);
    onClose();
  };

  return (
    <SapLookupModal
      open={isOpen}
      title={isSacMode ? 'List of India SAC Codes' : 'List of India Chapter ID'}
      columns={[
        { key: 'rowNumber', label: '#', width: 44, render: (_row, index) => index + 1 },
        { key: 'code', label: isSacMode ? 'Service Code' : 'Chapter', width: 120, render: (row) => row.code || row.serviceCode || '' },
        { key: 'heading', label: isSacMode ? 'Service Name' : 'Heading', width: 140, render: (row) => isSacMode ? (row.serviceName || row.description || '') : (row.heading || '') },
        { key: 'subHeading', label: isSacMode ? '' : 'Subheading', width: 120, render: (row) => isSacMode ? '' : (row.subHeading || '') },
        { key: 'description', label: 'Description' },
      ]}
      fetchOptions={fetchCodes}
      searchPlaceholder={isSacMode ? 'Search by service code or description' : 'Search by Chapter, Heading, Subheading, or Description'}
      emptyMessage={isSacMode ? 'No SAC codes found' : 'No HSN codes found'}
      onClose={onClose}
      onSelect={handleSelect}
      width="min(860px, calc(100vw - 40px))"
    />
  );
}
