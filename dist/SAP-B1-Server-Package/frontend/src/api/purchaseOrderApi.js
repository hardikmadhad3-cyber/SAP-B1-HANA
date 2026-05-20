import apiClient from './client';

const fetchPurchaseOrderReferenceData = (companyId) =>
  apiClient.get('/purchase-order/reference-data', {
    params: { company_id: companyId },
  });

const fetchPurchaseOrderVendorDetails = async (vendorCode) => {
  const res = await apiClient.get(
    `/purchase-order/vendors/${encodeURIComponent(vendorCode)}`
  );

  return res;
};

const fetchPurchaseOrders = (params = {}) =>
  apiClient.get('/purchase-order/list', { params });

const fetchPurchaseOrderVendorOptions = (params = {}) =>
  apiClient.get('/purchase-order/vendors/search', { params });

const fetchPurchaseOrderByDocEntry = (docEntry) =>
  apiClient.get(`/purchase-order/${encodeURIComponent(docEntry)}`);

const submitPurchaseOrder = (payload) =>
  apiClient.post('/purchase-order', payload);

const updatePurchaseOrder = (docEntry, payload) =>
  apiClient.patch(`/purchase-order/${docEntry}`, payload);

const fetchDocumentSeries = () =>
  apiClient.get('/purchase-order/series');

const fetchNextNumber = (series) =>
  apiClient.get(`/purchase-order/series/${series}/next-number`);

const fetchStateFromAddress = (vendorCode, addressCode) =>
  apiClient.get(`/purchase-order/state/${encodeURIComponent(vendorCode)}/${encodeURIComponent(addressCode)}`);

const fetchStateFromWarehouse = (whsCode) =>
  apiClient.get(`/purchase-order/warehouse-state/${encodeURIComponent(whsCode)}`);

const fetchItemsForModal = () =>
  apiClient.get('/purchase-order/items-modal');

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/purchase-order/freight-charges', { params: { docEntry } });

const fetchOpenPurchaseQuotationsForCopy = (vendorCode = null) =>
  apiClient.get('/purchase-order/open-purchase-quotations', {
    params: vendorCode ? { vendorCode } : {},
  });

const fetchPurchaseQuotationForCopy = (docEntry) =>
  apiClient.get(`/purchase-order/quotation/${encodeURIComponent(docEntry)}/copy`);

const fetchOpenPurchaseRequestsForCopy = (vendorCode = null) =>
  apiClient.get('/purchase-order/open-purchase-requests', {
    params: vendorCode ? { vendorCode } : {},
  });

const fetchPurchaseRequestForCopy = (docEntry) =>
  apiClient.get(`/purchase-order/request/${encodeURIComponent(docEntry)}/copy`);

export {
  fetchPurchaseOrderReferenceData,
  fetchPurchaseOrderByDocEntry,
  fetchPurchaseOrders,
  fetchPurchaseOrderVendorOptions,
  fetchPurchaseOrderVendorDetails,
  submitPurchaseOrder,
  updatePurchaseOrder,
  fetchDocumentSeries,
  fetchNextNumber,
  fetchStateFromAddress,
  fetchStateFromWarehouse,
  fetchItemsForModal,
  fetchFreightCharges,
  fetchOpenPurchaseQuotationsForCopy,
  fetchPurchaseQuotationForCopy,
  fetchOpenPurchaseRequestsForCopy,
  fetchPurchaseRequestForCopy,
};
