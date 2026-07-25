import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchARInvoiceCustomerOptions,
  fetchARInvoiceList,
} from '../api/arInvoiceApi';

function ARInvoiceListPage() {
  return (
    <DocumentFindPage
      title="AR Invoices"
      backPath="/ar-invoice"
      partnerLabel="Customer"
      partnerParamPrefix="customer"
      resultKey="ar_invoices"
      emptyLabel="AR invoices"
      loadingLabel="Loading AR invoices..."
      fetchDocuments={fetchARInvoiceList}
      fetchPartnerOptions={fetchARInvoiceCustomerOptions}
      editPath="/ar-invoice"
      editStateKey="arInvoiceDocEntry"
      codeField="customer_code"
      nameField="customer_name"
      includeSellerFilters
    />
  );
}

export default ARInvoiceListPage;
