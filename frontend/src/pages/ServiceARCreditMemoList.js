import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchServiceARCreditMemoList,
  fetchServiceARCreditMemoCustomerOptions,
} from '../api/serviceArCreditMemoApi';

function ServiceARCreditMemoListPage() {
  return (
    <DocumentFindPage
      title="Service A/R Credit Memos"
      backPath="/services/ar-credit-memo"
      partnerLabel="Customer"
      partnerParamPrefix="customer"
      resultKey="service_ar_credit_memos"
      emptyLabel="Service A/R credit memos"
      loadingLabel="Loading Service A/R credit memos..."
      fetchDocuments={fetchServiceARCreditMemoList}
      fetchPartnerOptions={fetchServiceARCreditMemoCustomerOptions}
      editPath="/services/ar-credit-memo"
      editStateKey="serviceArCreditMemoDocEntry"
      codeField="customer_code"
      nameField="customer_name"
    />
  );
}

export default ServiceARCreditMemoListPage;

