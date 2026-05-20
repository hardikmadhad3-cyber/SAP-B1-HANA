import apiClient from './client';

const fetchGRPOReferenceData = (companyId) =>
  apiClient.get('/grpo/reference-data', {
    params: { company_id: companyId },
  });

const fetchGRPOVendorDetails = async (vendorCode) => {
  const res = await apiClient.get(
    `/grpo/vendors/${encodeURIComponent(vendorCode)}`
  );
  return res;
};

const fetchGRPOs = (params = {}) =>
  apiClient.get('/grpo/list', { params });

const fetchGRPOVendorOptions = (params = {}) =>
  apiClient.get('/grpo/vendors/search', { params });

const fetchGRPOByDocEntry = (docEntry) =>
  apiClient.get(`/grpo/${encodeURIComponent(docEntry)}`);

const submitGRPO = (payload) =>
  apiClient.post('/grpo', payload);

const updateGRPO = (docEntry, payload) =>
  apiClient.patch(`/grpo/${docEntry}`, payload);

const fetchDocumentSeries = () =>
  apiClient.get('/grpo/series');

const fetchNextNumber = (series) =>
  apiClient.get(`/grpo/series/${series}/next-number`);

const fetchStateFromWarehouse = (whsCode) =>
  apiClient.get(`/grpo/warehouse-state/${encodeURIComponent(whsCode)}`);

const fetchOpenPurchaseOrders = (vendorCode = null) =>
  apiClient.get('/grpo/open-purchase-orders', {
    params: vendorCode ? { vendorCode } : {},
  });

const fetchPurchaseOrderForCopy = (docEntry) =>
  apiClient.get(`/grpo/purchase-order/${encodeURIComponent(docEntry)}/copy`);

const fetchBatchesByItem = (itemCode, whsCode) =>
  apiClient.get('/grpo/batches', {
    params: { itemCode, whsCode },
  });

const fetchItemsForModal = () =>
  apiClient.get('/grpo/items-modal');

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/grpo/freight-charges', { params: { docEntry } });

export {
  fetchGRPOReferenceData,
  fetchGRPOByDocEntry,
  fetchGRPOs,
  fetchGRPOVendorOptions,
  fetchGRPOVendorDetails,
  submitGRPO,
  updateGRPO,
  fetchDocumentSeries,
  fetchNextNumber,
  fetchStateFromWarehouse,
  fetchOpenPurchaseOrders,
  fetchPurchaseOrderForCopy,
  fetchBatchesByItem,
  fetchItemsForModal,
  fetchFreightCharges,
};
