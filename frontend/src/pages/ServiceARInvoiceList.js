import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchServiceARInvoiceCustomerOptions,
  fetchServiceARInvoiceList,
} from '../api/serviceArInvoiceApi';

function ServiceARInvoiceListPage() {
  return (
    <DocumentFindPage
      title="Service A/R Invoices"
      backPath="/services/ar-invoice"
      partnerLabel="Customer"
      partnerParamPrefix="customer"
      resultKey="service_ar_invoices"
      emptyLabel="service A/R invoices"
      loadingLabel="Loading service A/R invoices..."
      fetchDocuments={fetchServiceARInvoiceList}
      fetchPartnerOptions={fetchServiceARInvoiceCustomerOptions}
      editPath="/services/ar-invoice"
      editStateKey="serviceARInvoiceDocEntry"
      codeField="customer_code"
      nameField="customer_name"
    />
  );
}

export default ServiceARInvoiceListPage;
