import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchPurchaseQuotationVendorOptions,
  fetchPurchaseQuotations,
} from '../api/purchaseQuotationApi';

function PurchaseQuotationListPage() {
  return (
    <DocumentFindPage
      title="Purchase Quotations"
      backPath="/purchase-quotation"
      partnerLabel="Vendor"
      partnerParamPrefix="vendor"
      resultKey="quotations"
      emptyLabel="purchase quotations"
      loadingLabel="Loading purchase quotations..."
      fetchDocuments={fetchPurchaseQuotations}
      fetchPartnerOptions={fetchPurchaseQuotationVendorOptions}
      editPath="/purchase-quotation"
      editStateKey="purchaseQuotationDocEntry"
      codeField="vendor_code"
      nameField="vendor_name"
    />
  );
}

export default PurchaseQuotationListPage;
