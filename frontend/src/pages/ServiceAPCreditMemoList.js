import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchServiceAPCreditMemoList,
  fetchServiceAPCreditMemoVendorOptions,
} from '../api/serviceApCreditMemoApi';

function ServiceAPCreditMemoListPage() {
  return (
    <DocumentFindPage
      title="Service A/P Credit Memos"
      backPath="/services/ap-credit-memo"
      partnerLabel="Vendor"
      partnerParamPrefix="vendor"
      resultKey="service_ap_credit_memos"
      emptyLabel="Service A/P credit memos"
      loadingLabel="Loading Service A/P credit memos..."
      fetchDocuments={fetchServiceAPCreditMemoList}
      fetchPartnerOptions={fetchServiceAPCreditMemoVendorOptions}
      editPath="/services/ap-credit-memo"
      editStateKey="serviceApCreditMemoDocEntry"
      codeField="vendor_code"
      nameField="vendor_name"
    />
  );
}

export default ServiceAPCreditMemoListPage;

