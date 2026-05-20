import apiClient from './client';

const fetchPurchaseRequestReferenceData = (companyId) =>
  apiClient.get('/purchase-request/reference-data', {
    params: { company_id: companyId },
  });

const fetchPurchaseRequestVendorDetails = (vendorCode) =>
  apiClient.get(`/purchase-request/vendors/${encodeURIComponent(vendorCode)}`);

const fetchPurchaseRequests = (params = {}) =>
  apiClient.get('/purchase-request/list', { params });

const fetchPurchaseRequestVendorOptions = (params = {}) =>
  apiClient.get('/purchase-request/vendors/search', { params });

const fetchPurchaseRequestByDocEntry = (docEntry) =>
  apiClient.get(`/purchase-request/${encodeURIComponent(docEntry)}`);

const fetchPurchaseRequestDocumentSeries = () =>
  apiClient.get('/purchase-request/series');

const fetchPurchaseRequestNextNumber = (series) =>
  apiClient.get(`/purchase-request/series/${encodeURIComponent(series)}/next-number`);

const fetchPurchaseRequestStateFromAddress = (vendorCode, addressCode) =>
  apiClient.get(
    `/purchase-request/state/${encodeURIComponent(vendorCode)}/${encodeURIComponent(addressCode)}`
  );

const fetchPurchaseRequestStateFromWarehouse = (whsCode) =>
  apiClient.get(`/purchase-request/warehouse-state/${encodeURIComponent(whsCode)}`);

const fetchPurchaseRequestItemsForModal = () =>
  apiClient.get('/purchase-request/items-modal');

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/purchase-request/freight-charges', { params: { docEntry } });

const submitPurchaseRequest = (payload) =>
  apiClient.post('/purchase-request/submit', payload);

const updatePurchaseRequest = (docEntry, payload) =>
  apiClient.patch(`/purchase-request/${encodeURIComponent(docEntry)}`, payload);

export {
  fetchPurchaseRequestReferenceData,
  fetchPurchaseRequestByDocEntry,
  fetchPurchaseRequests,
  fetchPurchaseRequestVendorOptions,
  fetchPurchaseRequestVendorDetails,
  fetchPurchaseRequestDocumentSeries,
  fetchPurchaseRequestNextNumber,
  fetchPurchaseRequestStateFromAddress,
  fetchPurchaseRequestStateFromWarehouse,
  fetchPurchaseRequestItemsForModal,
  fetchFreightCharges,
  submitPurchaseRequest,
  updatePurchaseRequest,
};
