import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchSalesQuotationCustomerOptions,
  fetchSalesQuotations,
} from '../api/salesQuotationApi';

function SalesQuotationListPage() {
  return (
    <DocumentFindPage
      title="Sales Quotations"
      backPath="/sales-quotation"
      partnerLabel="Customer"
      partnerParamPrefix="customer"
      resultKey="quotations"
      emptyLabel="sales quotations"
      loadingLabel="Loading sales quotations..."
      fetchDocuments={fetchSalesQuotations}
      fetchPartnerOptions={fetchSalesQuotationCustomerOptions}
      editPath="/sales-quotation"
      editStateKey="salesQuotationDocEntry"
      codeField="customer_code"
      nameField="customer_name"
      includeSellerFilters
    />
  );
}

export default SalesQuotationListPage;
