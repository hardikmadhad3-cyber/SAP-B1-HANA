import React from 'react';
import SapLookupModal from '../../../components/common/SapLookupModal';
import { fetchAnalyticsQueries } from '../../../api/analyticsQueryApi';

const COLUMNS = [
  { key: 'queryName', label: 'Name' },
  { key: 'queryCode', label: 'Code' },
  { key: 'category', label: 'Category' },
];

const QueryPickerModal = ({ open, onClose, onSelect, footerNote }) => (
  <SapLookupModal
    open={open}
    title="Select a Published Query"
    columns={COLUMNS}
    fetchOptions={async () => fetchAnalyticsQueries({ status: 'Published' })}
    onClose={onClose}
    onSelect={onSelect}
    getRowKey={(row) => row.queryId}
    emptyMessage="No Published queries available. Publish a query in Query Manager first."
    footerNote={footerNote}
  />
);

export default QueryPickerModal;
