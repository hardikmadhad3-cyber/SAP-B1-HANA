import apiClient from './client';

const fetchSalesOrderReferenceData = (companyId) =>
  apiClient.get('/soda-sales-order/reference-data', {
    params: { company_id: companyId },
  });

const fetchSalesOrderCustomerDetails = async (customerCode) => {
  const res = await apiClient.get(
    `/soda-sales-order/customers/${encodeURIComponent(customerCode)}`
  );

  return res;
};

const fetchSalesOrderVendorDetails = async (vendorCode) => {
  const res = await apiClient.get(
    `/purchase-order/vendors/${encodeURIComponent(vendorCode)}`
  );

  return res;
};

const fetchSalesOrderCustomerOptions = (params = {}) =>
  apiClient.get('/soda-sales-order/customers/search', { params });

const fetchSalesOrders = (params = {}) =>
  apiClient.get('/soda-sales-order/list', { params });

const fetchSalesOrderFilterOptions = (params = {}) =>
  apiClient.get('/soda-sales-order/list/filter-options', { params });

const fetchSalesOrderByDocEntry = (docEntry) =>
  apiClient.get(`/soda-sales-order/${encodeURIComponent(docEntry)}`);

const submitSalesOrder = (payload) => {
 
  return apiClient.post('/soda-sales-order', payload);

};

const updateSalesOrder = (docEntry, payload) => {
  console.log("update SODA Sales Order: ", payload);

  return apiClient.patch(
    `/soda-sales-order/${encodeURIComponent(docEntry)}`,
    payload
  );
};
const fetchDocumentSeries = (date = '') =>
  apiClient.get('/soda-sales-order/series', {
    params: date ? { date } : {},
  });

const fetchNextNumber = (series) =>
  apiClient.get(`/soda-sales-order/series/next?series=${series}`);

const fetchStateFromAddress = (cardCode, addressCode) =>
  apiClient.get(`/soda-sales-order/state-from-address?cardCode=${encodeURIComponent(cardCode)}&addressCode=${encodeURIComponent(addressCode)}`);

const fetchItemsForModal = (whsCode = '') =>
  apiClient.get('/soda-sales-order/items-modal', {
    params: whsCode ? { whsCode } : {},
  });

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/soda-sales-order/freight-charges', { params: { docEntry } });

const fetchSalesOrderPrintLayouts = () =>
  apiClient.get('/soda-sales-order/print-layouts');

const createSalesOrderLookupValue = (field, value, description = '') =>
  apiClient.post('/soda-sales-order/lookup-values', { field, value, description });

// ── Copy From: reuse existing sales-quotation and blanket-agreement endpoints ──
const fetchOpenSalesQuotations = (customerCode = null) =>
  apiClient.get('/sales-quotation/open', {
    params: customerCode ? { customerCode } : {},
  });

const fetchOpenBlanketAgreements = () =>
  apiClient.get('/blanket-agreements/open');

const fetchSalesQuotationForCopy = (docEntry) =>
  apiClient.get(`/sales-quotation/${encodeURIComponent(docEntry)}/copy`);

const fetchBlanketAgreementForCopy = (docEntry) =>
  apiClient.get(`/blanket-agreements/${encodeURIComponent(docEntry)}/copy`);

// ── Open SODA Sales Orders (for Copy From in SODA Sales Order page) ──
const fetchOpenSalesOrdersForCopy = (customerCode = null) =>
  apiClient.get('/soda-sales-order/open', {
    params: customerCode ? { customerCode } : {},
  });

const fetchSalesOrderForCopy = (docEntry) =>
  apiClient.get(`/soda-sales-order/${encodeURIComponent(docEntry)}/copy`);

const printSalesOrder = ({ docEntry, docNum, series, schema, docCode, cardCode }) =>
  apiClient.post('/soda-sales-order/print', {
    docEntry,
    docNum,
    series,
    schema,
    docCode,
    cardCode,
  });

export {
  fetchSalesOrderReferenceData,
  fetchSalesOrderCustomerDetails,
  fetchSalesOrderVendorDetails,
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
