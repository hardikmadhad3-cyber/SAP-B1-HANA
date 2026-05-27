import apiClient from './client';

// ─────────── Reference Data ───────────
const fetchDeliveryReferenceData = (companyId) =>
  apiClient.get('/soda-delivery/reference-data', {
    params: { company_id: companyId },
  });

// ─────────── Customer ───────────
const fetchDeliveryCustomerDetails = (customerCode) =>
  apiClient.get(`/soda-delivery/customers/${encodeURIComponent(customerCode)}`);

const saveDeliverySalesEmployeesSetup = (employees = []) =>
  apiClient.post('/soda-delivery/sales-employees/setup', { employees });

// ─────────── Documents ───────────
const fetchDeliveries = (params = {}) =>
  apiClient.get('/soda-delivery/list', { params });

const fetchDeliveryCustomerOptions = (params = {}) =>
  apiClient.get('/soda-delivery/customers/search', { params });

const fetchDeliveryByDocEntry = (docEntry) =>
  apiClient.get(`/soda-delivery/${encodeURIComponent(docEntry)}`);

// ─────────── Submit / Update ───────────
const submitDelivery = (payload) =>
  apiClient.post('/soda-delivery', payload);

const updateDelivery = (docEntry, payload) =>
  apiClient.patch(`/soda-delivery/${docEntry}`, payload);

// ─────────── Series ───────────
const fetchDocumentSeries = (date = '') =>
  apiClient.get('/soda-delivery/series', {
    params: date ? { date } : {},
  });

const fetchNextNumber = (series) =>
  apiClient.get(`/soda-delivery/series/${series}/next-number`);

// ─────────── GST / Location ───────────
const fetchStateFromWarehouse = (whsCode) =>
  apiClient.get(`/soda-delivery/warehouse-state/${encodeURIComponent(whsCode)}`);

const fetchCompanyState = () =>
  apiClient.get('/soda-delivery/company-state');

// ─────────── Copy From Sales Order ───────────
const fetchOpenSalesOrders = (customerCode = null) =>
  apiClient.get('/soda-delivery/open-sales-orders', {
    params: customerCode ? { customerCode } : {},
  });

const fetchSalesOrderForCopy = (docEntry) =>
  apiClient.get(`/soda-delivery/sales-order/${encodeURIComponent(docEntry)}/copy`);

// ─────────── Copy From Sales Quotation ───────────
const fetchOpenSalesQuotationsForDelivery = (customerCode = null) =>
  apiClient.get('/sales-quotation/open', {
    params: customerCode ? { customerCode } : {},
  });

const fetchSalesQuotationForDeliveryCopy = (docEntry) =>
  apiClient.get(`/sales-quotation/${encodeURIComponent(docEntry)}/copy`);

// ─────────── Copy From Returns (AR Credit Memo) ───────────
const fetchOpenReturnsForDelivery = () =>
  apiClient.get('/ar-credit-memo/open');

const fetchReturnForDeliveryCopy = (docEntry) =>
  apiClient.get(`/ar-credit-memo/${encodeURIComponent(docEntry)}/copy`);

// ─────────── Copy From Blanket Agreement ───────────
const fetchOpenBlanketAgreementsForDelivery = () =>
  apiClient.get('/blanket-agreements/open');

const fetchBlanketAgreementForDeliveryCopy = (docEntry) =>
  apiClient.get(`/blanket-agreements/${encodeURIComponent(docEntry)}/copy`);

// ─────────── Copy To Credit Memo ───────────
const fetchDeliveryForCopyToCreditMemo = (docEntry) =>
  apiClient.get(`/soda-delivery/delivery/${encodeURIComponent(docEntry)}/copy-to-credit-memo`);

// ─────────── Batch / Item Management ───────────
const fetchBatchesByItem = (itemCode, whsCode) =>
  apiClient.get('/soda-delivery/batches', {
    params: { itemCode, whsCode },
  });

const fetchItemManagementType = (itemCode) =>
  apiClient.get(`/soda-delivery/item-management/${encodeURIComponent(itemCode)}`);

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/soda-delivery/freight-charges', { params: { docEntry } });

const fetchItemsForModal = (whsCode = '') =>
  apiClient.get('/soda-delivery/items-modal', {
    params: whsCode ? { whsCode } : {},
  });

const createDeliveryLookupValue = (field, value, description = '') =>
  apiClient.post('/soda-delivery/lookup-values', { field, value, description });

const fetchUomConversionFactor = (itemCode, uomCode) =>
  apiClient.get('/soda-delivery/uom-conversion', {
    params: { itemCode, uomCode },
  });

// ─────────── Validation ───────────
const validateDeliveryDocument = (payload) =>
  apiClient.post('/soda-delivery/validate', payload);

// ─────────── EXPORTS ───────────
export {
  fetchDeliveryReferenceData,
  fetchDeliveryByDocEntry,
  fetchDeliveries,
  fetchDeliveryCustomerOptions,
  fetchDeliveryCustomerDetails,
  saveDeliverySalesEmployeesSetup,
  submitDelivery,
  updateDelivery,
  fetchDocumentSeries,
  fetchItemsForModal,
  fetchUomConversionFactor,
  fetchNextNumber,
  fetchStateFromWarehouse,
  fetchCompanyState,
  fetchOpenSalesOrders,
  fetchSalesOrderForCopy,
  fetchOpenSalesQuotationsForDelivery,
  fetchSalesQuotationForDeliveryCopy,
  fetchOpenReturnsForDelivery,
  fetchReturnForDeliveryCopy,
  fetchOpenBlanketAgreementsForDelivery,
  fetchBlanketAgreementForDeliveryCopy,
  fetchDeliveryForCopyToCreditMemo,
  fetchBatchesByItem,
  fetchItemManagementType,
  fetchFreightCharges,
  validateDeliveryDocument,
  createDeliveryLookupValue,
};
