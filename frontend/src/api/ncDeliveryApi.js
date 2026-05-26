import apiClient from './client';

// ─────────── Reference Data ───────────
const fetchDeliveryReferenceData = (companyId) =>
  apiClient.get('/nc-delivery/reference-data', {
    params: { company_id: companyId },
  });

// ─────────── Customer ───────────
const fetchDeliveryCustomerDetails = (customerCode) =>
  apiClient.get(`/nc-delivery/customers/${encodeURIComponent(customerCode)}`);

const saveDeliverySalesEmployeesSetup = (employees = []) =>
  apiClient.post('/nc-delivery/sales-employees/setup', { employees });

// ─────────── Documents ───────────
const fetchDeliveries = (params = {}) =>
  apiClient.get('/nc-delivery/list', { params });

const fetchDeliveryCustomerOptions = (params = {}) =>
  apiClient.get('/nc-delivery/customers/search', { params });

const fetchDeliveryByDocEntry = (docEntry) =>
  apiClient.get(`/nc-delivery/${encodeURIComponent(docEntry)}`);

// ─────────── Submit / Update ───────────
const submitDelivery = (payload) =>
  apiClient.post('/nc-delivery', payload);

const updateDelivery = (docEntry, payload) =>
  apiClient.patch(`/nc-delivery/${docEntry}`, payload);

// ─────────── Series ───────────
const fetchDocumentSeries = (date = '') =>
  apiClient.get('/nc-delivery/series', {
    params: date ? { date } : {},
  });

const fetchNextNumber = (series) =>
  apiClient.get(`/nc-delivery/series/${series}/next-number`);

// ─────────── GST / Location ───────────
const fetchStateFromWarehouse = (whsCode) =>
  apiClient.get(`/nc-delivery/warehouse-state/${encodeURIComponent(whsCode)}`);

const fetchCompanyState = () =>
  apiClient.get('/nc-delivery/company-state');

// ─────────── Copy From Sales Order ───────────
const fetchOpenSalesOrders = (customerCode = null) =>
  apiClient.get('/nc-delivery/open-sales-orders', {
    params: customerCode ? { customerCode } : {},
  });

const fetchSalesOrderForCopy = (docEntry) =>
  apiClient.get(`/nc-delivery/sales-order/${encodeURIComponent(docEntry)}/copy`);

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
  apiClient.get(`/nc-delivery/delivery/${encodeURIComponent(docEntry)}/copy-to-credit-memo`);

// ─────────── Batch / Item Management ───────────
const fetchBatchesByItem = (itemCode, whsCode) =>
  apiClient.get('/nc-delivery/batches', {
    params: { itemCode, whsCode },
  });

const fetchItemManagementType = (itemCode) =>
  apiClient.get(`/nc-delivery/item-management/${encodeURIComponent(itemCode)}`);

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/nc-delivery/freight-charges', { params: { docEntry } });

const fetchItemsForModal = (whsCode = '') =>
  apiClient.get('/nc-delivery/items-modal', {
    params: whsCode ? { whsCode } : {},
  });

const createDeliveryLookupValue = (field, value, description = '') =>
  apiClient.post('/nc-delivery/lookup-values', { field, value, description });

const fetchUomConversionFactor = (itemCode, uomCode) =>
  apiClient.get('/nc-delivery/uom-conversion', {
    params: { itemCode, uomCode },
  });

// ─────────── Validation ───────────
const validateDeliveryDocument = (payload) =>
  apiClient.post('/nc-delivery/validate', payload);

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
