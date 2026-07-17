import React from 'react';
import InventoryDocumentFindPage from '../components/InventoryDocumentFindPage';
import { searchOutgoingPayments } from '../api/outgoingPaymentsApi';

const columns = [
  { key: 'docNum', label: 'Payment No' },
  { key: 'postingDate', label: 'Posting Date', type: 'date' },
  { key: 'businessPartnerCode', label: 'Vendor Code' },
  { key: 'businessPartnerName', label: 'Vendor Name' },
  { key: 'referenceNumber', label: 'Reference' },
  { key: 'branch', label: 'Branch' },
  { key: 'totalAmount', label: 'Total', align: 'end' },
];

const filterFields = [
  { name: 'docNum', key: 'docNum', label: 'Payment No', placeholder: 'Enter Payment No' },
  { name: 'businessPartnerCode', key: 'businessPartnerCode', label: 'Vendor Code', placeholder: 'Vendor code' },
  { name: 'businessPartnerName', key: 'businessPartnerName', label: 'Vendor Name', placeholder: 'Vendor name' },
  { name: 'postingDateFrom', key: 'postingDate', label: 'Posting Date From', type: 'date', compare: 'from' },
  { name: 'postingDateTo', key: 'postingDate', label: 'Posting Date To', type: 'date', compare: 'to' },
];

const fetchDocuments = async () => {
  const rows = await searchOutgoingPayments('');
  return (rows || []).map((row) => ({
    ...row,
    docEntry: row.docEntry,
    docNum: row.documentNo || row.docNum || '',
  }));
};

export default function OutgoingPaymentsList() {
  return (
    <InventoryDocumentFindPage
      title="Outgoing Payments"
      subtitle="Filter by payment, vendor, and posting date."
      backPath="/outgoing-payments"
      fetchDocuments={fetchDocuments}
      editPath="/outgoing-payments"
      editStateKey="outgoingPaymentDocEntry"
      emptyLabel="outgoing payments"
      loadingLabel="Loading outgoing payments..."
      columns={columns}
      filterFields={filterFields}
      globalSearchPlaceholder="Search by payment no, vendor, reference, branch, or remarks"
      searchFields={['docNum', 'businessPartnerCode', 'businessPartnerName', 'referenceNumber', 'transactionNumber', 'branch', 'journalRemarks']}
    />
  );
}
