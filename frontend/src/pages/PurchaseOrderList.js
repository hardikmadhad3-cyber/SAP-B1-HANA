import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchPurchaseOrderVendorOptions,
  fetchPurchaseOrders,
} from '../api/purchaseOrderApi';

function PurchaseOrderListPage() {
  return (
    <DocumentFindPage
      title="Purchase Orders"
      backPath="/purchase-order"
      partnerLabel="Vendor"
      partnerParamPrefix="vendor"
      resultKey="orders"
      emptyLabel="purchase orders"
      loadingLabel="Loading purchase orders..."
      fetchDocuments={fetchPurchaseOrders}
      fetchPartnerOptions={fetchPurchaseOrderVendorOptions}
      editPath="/purchase-order"
      editStateKey="purchaseOrderDocEntry"
      codeField="vendor_code"
      nameField="vendor_name"
    />
  );
}

export default PurchaseOrderListPage;
