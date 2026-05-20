import apiClient from './client';

// ─────────── Reference Data ───────────
const fetchDeliveryReferenceData = (companyId) =>
  apiClient.get('/delivery/reference-data', {
    params: { company_id: companyId },
  });

// ─────────── Customer ───────────
const fetchDeliveryCustomerDetails = (customerCode) =>
  apiClient.get(`/delivery/customers/${encodeURIComponent(customerCode)}`);

const saveDeliverySalesEmployeesSetup = (employees = []) =>
  apiClient.post('/delivery/sales-employees/setup', { employees });

// ─────────── Documents ───────────
const fetchDeliveries = (params = {}) =>
  apiClient.get('/delivery/list', { params });

const fetchDeliveryCustomerOptions = (params = {}) =>
  apiClient.get('/delivery/customers/search', { params });

const fetchDeliveryByDocEntry = (docEntry) =>
  apiClient.get(`/delivery/${encodeURIComponent(docEntry)}`);

// ─────────── Submit / Update ───────────
const submitDelivery = (payload) =>
  apiClient.post('/delivery', payload);

const updateDelivery = (docEntry, payload) =>
  apiClient.patch(`/delivery/${docEntry}`, payload);

// ─────────── Series ───────────
const fetchDocumentSeries = (date = '') =>
  apiClient.get('/delivery/series', {
    params: date ? { date } : {},
  });

const fetchNextNumber = (series) =>
  apiClient.get(`/delivery/series/${series}/next-number`);

// ─────────── GST / Location ───────────
const fetchStateFromWarehouse = (whsCode) =>
  apiClient.get(`/delivery/warehouse-state/${encodeURIComponent(whsCode)}`);

const fetchCompanyState = () =>
  apiClient.get('/delivery/company-state');

// ─────────── Copy From Sales Order ───────────
const fetchOpenSalesOrders = (customerCode = null) =>
  apiClient.get('/delivery/open-sales-orders', {
    params: customerCode ? { customerCode } : {},
  });

const fetchSalesOrderForCopy = (docEntry) =>
  apiClient.get(`/delivery/sales-order/${encodeURIComponent(docEntry)}/copy`);

// ─────────── Copy From Sales Quotation ───────────
const fetchOpenSalesQuotationsForDelivery = () =>
  apiClient.get('/sales-quotation/open');

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
  apiClient.get(`/delivery/delivery/${encodeURIComponent(docEntry)}/copy-to-credit-memo`);

// ─────────── Batch / Item Management ───────────
const fetchBatchesByItem = (itemCode, whsCode) =>
  apiClient.get('/delivery/batches', {
    params: { itemCode, whsCode },
  });

const fetchItemManagementType = (itemCode) =>
  apiClient.get(`/delivery/item-management/${encodeURIComponent(itemCode)}`);

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/delivery/freight-charges', { params: { docEntry } });

const fetchItemsForModal = (whsCode = '') =>
  apiClient.get('/delivery/items-modal', {
    params: whsCode ? { whsCode } : {},
  });

const createDeliveryLookupValue = (field, value, description = '') =>
  apiClient.post('/delivery/lookup-values', { field, value, description });

const fetchUomConversionFactor = (itemCode, uomCode) =>
  apiClient.get('/delivery/uom-conversion', {
    params: { itemCode, uomCode },
  });

// ─────────── Validation ───────────
const validateDeliveryDocument = (payload) =>
  apiClient.post('/delivery/validate', payload);

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
