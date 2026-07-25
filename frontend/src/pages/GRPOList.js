import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchGRPOs,
  fetchGRPOVendorOptions,
} from '../api/grpoApi';

function GRPOListPage() {
  return (
    <DocumentFindPage
      title="Goods Receipt POs"
      backPath="/grpo"
      partnerLabel="Vendor"
      partnerParamPrefix="vendor"
      resultKey="grpos"
      emptyLabel="goods receipt POs"
      loadingLabel="Loading goods receipt POs..."
      fetchDocuments={fetchGRPOs}
      fetchPartnerOptions={fetchGRPOVendorOptions}
      editPath="/grpo"
      editStateKey="grpoDocEntry"
      codeField="vendor_code"
      nameField="vendor_name"
    />
  );
}

export default GRPOListPage;
