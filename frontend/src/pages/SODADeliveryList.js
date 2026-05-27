import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchDeliveries,
  fetchDeliveryCustomerOptions,
} from '../api/sodaDeliveryApi';

function SODADeliveryListPage() {
  return (
    <DocumentFindPage
      title="SODA Deliveries"
      backPath="/soda-delivery"
      partnerLabel="Customer"
      partnerParamPrefix="customer"
      resultKey="deliveries"
      emptyLabel="SODA deliveries"
      loadingLabel="Loading SODA deliveries..."
      fetchDocuments={fetchDeliveries}
      fetchPartnerOptions={fetchDeliveryCustomerOptions}
      editPath="/soda-delivery"
      editStateKey="sodaDeliveryDocEntry"
      codeField="customer_code"
      nameField="customer_name"
      includeSellerFilters
    />
  );
}

export default SODADeliveryListPage;
