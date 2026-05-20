import apiClient from './client';

const fetchSalesOrderReferenceData = (companyId) =>
  apiClient.get('/sales-order/reference-data', {
    params: { company_id: companyId },
  });

const fetchSalesOrderCustomerDetails = async (customerCode) => {
  const res = await apiClient.get(
    `/sales-order/customers/${encodeURIComponent(customerCode)}`
  );

  return res;
};

const fetchSalesOrderCustomerOptions = (params = {}) =>
  apiClient.get('/sales-order/customers/search', { params });

const fetchSalesOrders = (params = {}) =>
  apiClient.get('/sales-order/list', { params });

const fetchSalesOrderFilterOptions = (params = {}) =>
  apiClient.get('/sales-order/list/filter-options', { params });

const fetchSalesOrderByDocEntry = (docEntry) =>
  apiClient.get(`/sales-order/${encodeURIComponent(docEntry)}`);

const submitSalesOrder = (payload) => {
 
  return apiClient.post('/sales-order', payload);

};

const updateSalesOrder = (docEntry, payload) => {
  console.log("update Sales Order: ", payload);

  return apiClient.patch(
    `/sales-order/${encodeURIComponent(docEntry)}`,
    payload
  );
};
const fetchDocumentSeries = (date = '') =>
  apiClient.get('/sales-order/series', {
    params: date ? { date } : {},
  });

const fetchNextNumber = (series) =>
  apiClient.get(`/sales-order/series/next?series=${series}`);

const fetchStateFromAddress = (cardCode, addressCode) =>
  apiClient.get(`/sales-order/state-from-address?cardCode=${encodeURIComponent(cardCode)}&addressCode=${encodeURIComponent(addressCode)}`);

const fetchItemsForModal = () =>
  apiClient.get('/sales-order/items-modal');

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/sales-order/freight-charges', { params: { docEntry } });

const fetchSalesOrderPrintLayouts = () =>
  apiClient.get('/sales-order/print-layouts');

const createSalesOrderLookupValue = (field, value, description = '') =>
  apiClient.post('/sales-order/lookup-values', { field, value, description });

// ── Copy From: reuse existing sales-quotation and blanket-agreement endpoints ──
const fetchOpenSalesQuotations = () =>
  apiClient.get('/sales-quotation/open');

const fetchOpenBlanketAgreements = () =>
  apiClient.get('/blanket-agreements/open');

const fetchSalesQuotationForCopy = (docEntry) =>
  apiClient.get(`/sales-quotation/${encodeURIComponent(docEntry)}/copy`);

const fetchBlanketAgreementForCopy = (docEntry) =>
  apiClient.get(`/blanket-agreements/${encodeURIComponent(docEntry)}/copy`);

// ── Open Sales Orders (for Copy From in Sales Order page) ──
const fetchOpenSalesOrdersForCopy = () =>
  apiClient.get('/sales-order/open');

const fetchSalesOrderForCopy = (docEntry) =>
  apiClient.get(`/sales-order/${encodeURIComponent(docEntry)}/copy`);

const printSalesOrder = ({ docEntry, schema, docCode }) =>
  apiClient.post('/print-sales-order', {
    docEntry,
    schema,
    docCode,
  });

export {
  fetchSalesOrderReferenceData,
  fetchSalesOrderCustomerDetails,
  fetchSalesOrderCustomerOptions,
  fetchSalesOrders,
  fetchSalesOrderFilterOptions,
  fetchSalesOrderByDocEntry,
  submitSalesOrder,
  updateSalesOrder,
  fetchDocumentSeries,
  fetchNextNumber,
  fetchStateFromAddress,
  fetchItemsForModal,
  fetchFreightCharges,
  fetchSalesOrderPrintLayouts,
  createSalesOrderLookupValue,
  fetchOpenSalesQuotations,
  fetchOpenBlanketAgreements,
  fetchSalesQuotationForCopy,
  fetchBlanketAgreementForCopy,
  fetchOpenSalesOrdersForCopy,
  fetchSalesOrderForCopy,
  printSalesOrder,
};
