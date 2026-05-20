import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchPurchaseRequestVendorOptions,
  fetchPurchaseRequests,
} from '../api/purchaseRequestApi';

function PurchaseRequestListPage() {
  return (
    <DocumentFindPage
      title="Purchase Requests"
      backPath="/purchase-request"
      partnerLabel="Vendor"
      partnerParamPrefix="vendor"
      resultKey="requests"
      emptyLabel="purchase requests"
      loadingLabel="Loading purchase requests..."
      fetchDocuments={fetchPurchaseRequests}
      fetchPartnerOptions={fetchPurchaseRequestVendorOptions}
      editPath="/purchase-request"
      editStateKey="purchaseRequestDocEntry"
      codeField="vendor_code"
      nameField="vendor_name"
    />
  );
}

export default PurchaseRequestListPage;
