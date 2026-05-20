import apiClient from './client';

const fetchSalesQuotationReferenceData = (companyId) =>
  apiClient.get('/sales-quotation/reference-data', {
    params: { company_id: companyId },
  });

const fetchSalesQuotationCustomerDetails = (customerCode) =>
  apiClient.get(`/sales-quotation/customers/${encodeURIComponent(customerCode)}`);

const fetchSalesQuotations = (params = {}) =>
  apiClient.get('/sales-quotation/list', { params });

const fetchSalesQuotationCustomerOptions = (params = {}) =>
  apiClient.get('/sales-quotation/customers/search', { params });

const fetchSalesQuotationByDocEntry = (docEntry) =>
  apiClient.get(`/sales-quotation/${encodeURIComponent(docEntry)}`);

const submitSalesQuotation = (payload) =>
  apiClient.post('/sales-quotation', payload);

const updateSalesQuotation = (docEntry, payload) =>
  apiClient.patch(`/sales-quotation/${encodeURIComponent(docEntry)}`, payload);

const fetchDocumentSeries = (date = '') =>
  apiClient.get('/sales-quotation/series', {
    params: date ? { date } : {},
  });

const fetchNextNumber = (series) =>
  apiClient.get(`/sales-quotation/series/next?series=${series}`);

const fetchStateFromAddress = (cardCode, addressCode) =>
  apiClient.get(`/sales-quotation/state-from-address?cardCode=${encodeURIComponent(cardCode)}&addressCode=${encodeURIComponent(addressCode)}`);

const fetchItemsForModal = () =>
  apiClient.get('/sales-quotation/items-modal');

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/sales-quotation/freight-charges', { params: { docEntry } });

const fetchOpenSalesQuotations = () =>
  apiClient.get('/sales-quotation/open');

const fetchSalesQuotationForCopy = (docEntry) =>
  apiClient.get(`/sales-quotation/${encodeURIComponent(docEntry)}/copy`);

export {
  fetchSalesQuotationReferenceData,
  fetchSalesQuotationCustomerDetails,
  fetchSalesQuotations,
  fetchSalesQuotationCustomerOptions,
  fetchSalesQuotationByDocEntry,
  submitSalesQuotation,
  updateSalesQuotation,
  fetchDocumentSeries,
  fetchNextNumber,
  fetchStateFromAddress,
  fetchItemsForModal,
  fetchFreightCharges,
  fetchOpenSalesQuotations,
  fetchSalesQuotationForCopy,
};
