import apiClient from './client';

export const fetchInventoryTransferMetadata = () => apiClient.get('/inventory-transfer/metadata');
export const fetchInventoryTransferItems = () => apiClient.get('/inventory-transfer/items');
export const fetchInventoryTransferWarehouses = () =>
  apiClient.get('/inventory-transfer/warehouses');
export const fetchInventoryTransferSeries = () => apiClient.get('/inventory-transfer/series');
export const fetchInventoryTransferBusinessPartnerDetails = (cardCode) =>
  apiClient.get(`/inventory-transfer/business-partners/${encodeURIComponent(cardCode)}`);
export const fetchInventoryTransferList = () => apiClient.get('/inventory-transfer/list');
export const fetchInventoryTransferByDocEntry = (docEntry) =>
  apiClient.get(`/inventory-transfer/${encodeURIComponent(docEntry)}`);
export const submitInventoryTransfer = (payload) => apiClient.post('/inventory-transfer', payload);
export const updateInventoryTransfer = (docEntry, payload) =>
  apiClient.patch(`/inventory-transfer/${encodeURIComponent(docEntry)}`, payload);
