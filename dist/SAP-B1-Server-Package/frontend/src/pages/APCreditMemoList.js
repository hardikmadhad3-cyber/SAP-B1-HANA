import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchAPCreditMemos,
  fetchAPCreditMemoVendorOptions,
} from '../api/apCreditMemoApi';

function APCreditMemoListPage() {
  return (
    <DocumentFindPage
      title="A/P Credit Memos"
      backPath="/ap-credit-memo"
      partnerLabel="Vendor"
      partnerParamPrefix="vendor"
      resultKey="apCreditMemos"
      emptyLabel="A/P credit memos"
      loadingLabel="Loading A/P credit memos..."
      fetchDocuments={fetchAPCreditMemos}
      fetchPartnerOptions={fetchAPCreditMemoVendorOptions}
      editPath="/ap-credit-memo"
      editStateKey="APCreditMemoDocEntry"
      codeField="vendor_code"
      nameField="vendor_name"
    />
  );
}

export default APCreditMemoListPage;
