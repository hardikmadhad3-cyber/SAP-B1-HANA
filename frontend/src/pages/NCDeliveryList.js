import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchDeliveries,
  fetchDeliveryCustomerOptions,
} from '../api/ncDeliveryApi';

function NCDeliveryListPage() {
  return (
    <DocumentFindPage
      title="NC Deliveries"
      backPath="/nc-delivery"
      partnerLabel="Customer"
      partnerParamPrefix="customer"
      resultKey="deliveries"
      emptyLabel="NC deliveries"
      loadingLabel="Loading NC deliveries..."
      fetchDocuments={fetchDeliveries}
      fetchPartnerOptions={fetchDeliveryCustomerOptions}
      editPath="/nc-delivery"
      editStateKey="ncDeliveryDocEntry"
      codeField="customer_code"
      nameField="customer_name"
      includeSellerFilters
    />
  );
}

export default NCDeliveryListPage;
