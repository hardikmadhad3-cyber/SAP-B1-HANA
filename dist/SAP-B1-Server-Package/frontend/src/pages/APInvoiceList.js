import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchAPInvoices,
  fetchAPInvoiceVendorOptions,
} from '../api/apInvoiceApi';

function APInvoiceListPage() {
  return (
    <DocumentFindPage
      title="A/P Invoices"
      backPath="/ap-invoice"
      partnerLabel="Vendor"
      partnerParamPrefix="vendor"
      resultKey="apInvoices"
      emptyLabel="A/P invoices"
      loadingLabel="Loading A/P invoices..."
      fetchDocuments={fetchAPInvoices}
      fetchPartnerOptions={fetchAPInvoiceVendorOptions}
      editPath="/ap-invoice"
      editStateKey="APInvoiceDocEntry"
      codeField="vendor_code"
      nameField="vendor_name"
    />
  );
}

export default APInvoiceListPage;
