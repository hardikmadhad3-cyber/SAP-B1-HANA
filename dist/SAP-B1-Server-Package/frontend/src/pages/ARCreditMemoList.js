import React from 'react';
import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchARCreditMemoCustomerOptions,
  fetchARCreditMemoList,
} from '../api/arCreditMemoApi';

function ARCreditMemoListPage() {
  return (
    <DocumentFindPage
      title="AR Credit Memos"
      backPath="/ar-credit-memo"
      partnerLabel="Customer"
      partnerParamPrefix="customer"
      resultKey="ar_credit_memos"
      emptyLabel="AR credit memos"
      loadingLabel="Loading AR credit memos..."
      fetchDocuments={fetchARCreditMemoList}
      fetchPartnerOptions={fetchARCreditMemoCustomerOptions}
      editPath="/ar-credit-memo"
      editStateKey="arCreditMemoDocEntry"
      codeField="customer_code"
      nameField="customer_name"
      includeSellerFilters
    />
  );
}

export default ARCreditMemoListPage;
