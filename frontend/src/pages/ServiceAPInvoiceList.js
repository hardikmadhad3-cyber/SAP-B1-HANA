import DocumentFindPage from '../components/DocumentFindPage';
import {
  fetchServiceAPInvoiceList,
  fetchServiceAPInvoiceVendorOptions,
} from '../api/serviceApInvoiceApi';

function ServiceAPInvoiceListPage() {
  return (
    <DocumentFindPage
      title="Service A/P Invoices"
      backPath="/services/ap-invoice"
      partnerLabel="Vendor"
      partnerParamPrefix="vendor"
      resultKey="service_ap_invoices"
      emptyLabel="Service A/P invoices"
      loadingLabel="Loading Service A/P invoices..."
      fetchDocuments={fetchServiceAPInvoiceList}
      fetchPartnerOptions={fetchServiceAPInvoiceVendorOptions}
      editPath="/services/ap-invoice"
      editStateKey="serviceApInvoiceDocEntry"
      codeField="vendor_code"
      nameField="vendor_name"
    />
  );
}

export default ServiceAPInvoiceListPage;
