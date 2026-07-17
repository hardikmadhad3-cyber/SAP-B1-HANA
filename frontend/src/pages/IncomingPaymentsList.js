import React from 'react';
import InventoryDocumentFindPage from '../components/InventoryDocumentFindPage';
import { searchIncomingPayments } from '../api/incomingPaymentsApi';

const columns = [
  { key: 'docNum', label: 'Payment No' },
  { key: 'postingDate', label: 'Posting Date', type: 'date' },
  { key: 'businessPartnerCode', label: 'Customer Code' },
  { key: 'businessPartnerName', label: 'Customer Name' },
  { key: 'referenceNumber', label: 'Reference' },
  { key: 'branch', label: 'Branch' },
  { key: 'totalAmount', label: 'Total', align: 'end' },
];

const filterFields = [
  { name: 'docNum', key: 'docNum', label: 'Payment No', placeholder: 'Enter Payment No' },
  { name: 'businessPartnerCode', key: 'businessPartnerCode', label: 'Customer Code', placeholder: 'Customer code' },
  { name: 'businessPartnerName', key: 'businessPartnerName', label: 'Customer Name', placeholder: 'Customer name' },
  { name: 'postingDateFrom', key: 'postingDate', label: 'Posting Date From', type: 'date', compare: 'from' },
  { name: 'postingDateTo', key: 'postingDate', label: 'Posting Date To', type: 'date', compare: 'to' },
];

const fetchDocuments = async () => {
  const rows = await searchIncomingPayments('');
  return (rows || []).map((row) => ({
    ...row,
    docEntry: row.docEntry,
    docNum: row.documentNo || row.docNum || '',
  }));
};

export default function IncomingPaymentsList() {
  return (
    <InventoryDocumentFindPage
      title="Incoming Payments"
      subtitle="Filter by payment, customer, and posting date."
      backPath="/incoming-payments"
      fetchDocuments={fetchDocuments}
      editPath="/incoming-payments"
      editStateKey="incomingPaymentDocEntry"
      emptyLabel="incoming payments"
      loadingLabel="Loading incoming payments..."
      columns={columns}
      filterFields={filterFields}
      globalSearchPlaceholder="Search by payment no, customer, reference, branch, or remarks"
      searchFields={['docNum', 'businessPartnerCode', 'businessPartnerName', 'referenceNumber', 'transactionNumber', 'branch', 'journalRemarks']}
    />
  );
}
