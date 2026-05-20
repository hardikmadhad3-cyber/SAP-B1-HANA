import apiClient from './client';

export const fetchInventoryTransferRequestMetadata = () =>
  apiClient.get('/inventory-transfer-request/metadata');
export const fetchInventoryTransferRequestItems = () =>
  apiClient.get('/inventory-transfer-request/items');
export const fetchInventoryTransferRequestWarehouses = () =>
  apiClient.get('/inventory-transfer-request/warehouses');
export const fetchInventoryTransferRequestSeries = () =>
  apiClient.get('/inventory-transfer-request/series');
export const fetchInventoryTransferRequestBusinessPartnerDetails = (cardCode) =>
  apiClient.get(
    `/inventory-transfer-request/business-partners/${encodeURIComponent(cardCode)}`
  );
export const fetchInventoryTransferRequestList = () =>
  apiClient.get('/inventory-transfer-request/list');
export const fetchInventoryTransferRequestByDocEntry = (docEntry) =>
  apiClient.get(`/inventory-transfer-request/${encodeURIComponent(docEntry)}`);
export const submitInventoryTransferRequest = (payload) =>
  apiClient.post('/inventory-transfer-request', payload);
export const updateInventoryTransferRequest = (docEntry, payload) =>
  apiClient.patch(
    `/inventory-transfer-request/${encodeURIComponent(docEntry)}`,
    payload
  );
