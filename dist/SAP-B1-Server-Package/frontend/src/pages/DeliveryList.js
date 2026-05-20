import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchDeliveries,
  fetchDeliveryCustomerOptions,
} from '../api/deliveryApi';

function DeliveryListPage() {
  return (
    <DocumentFindPage
      title="Deliveries"
      backPath="/delivery"
      partnerLabel="Customer"
      partnerParamPrefix="customer"
      resultKey="deliveries"
      emptyLabel="deliveries"
      loadingLabel="Loading deliveries..."
      fetchDocuments={fetchDeliveries}
      fetchPartnerOptions={fetchDeliveryCustomerOptions}
      editPath="/delivery"
      editStateKey="deliveryDocEntry"
      codeField="customer_code"
      nameField="customer_name"
      includeSellerFilters
    />
  );
}

export default DeliveryListPage;
