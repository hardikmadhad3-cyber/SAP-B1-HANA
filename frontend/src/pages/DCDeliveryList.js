import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchDeliveries,
  fetchDeliveryCustomerOptions,
} from '../api/dcDeliveryApi';

function DCDeliveryListPage() {
  return (
    <DocumentFindPage
      title="DC Deliveries"
      backPath="/dc-delivery"
      partnerLabel="Customer"
      partnerParamPrefix="customer"
      resultKey="deliveries"
      emptyLabel="DC deliveries"
      loadingLabel="Loading DC deliveries..."
      fetchDocuments={fetchDeliveries}
      fetchPartnerOptions={fetchDeliveryCustomerOptions}
      editPath="/dc-delivery"
      editStateKey="dcDeliveryDocEntry"
      codeField="customer_code"
      nameField="customer_name"
      includeSellerFilters
    />
  );
}

export default DCDeliveryListPage;
