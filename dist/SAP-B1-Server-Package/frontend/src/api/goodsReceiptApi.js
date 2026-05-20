import apiClient from './client';

export const fetchGoodsReceiptMetadata = () => apiClient.get('/goods-receipt/metadata');
export const fetchGoodsReceiptItems = () => apiClient.get('/goods-receipt/items');
export const fetchGoodsReceiptWarehouses = () => apiClient.get('/goods-receipt/warehouses');
export const fetchGoodsReceiptSeries = () => apiClient.get('/goods-receipt/series');
export const fetchGoodsReceiptGoodsIssues = () => apiClient.get('/goods-receipt/goods-issues');
export const fetchGoodsReceiptBatchesByItem = (itemCode, whsCode) =>
  apiClient.get('/goods-receipt/batches', {
    params: { itemCode, whsCode },
  });
export const fetchGoodsReceipts = () => apiClient.get('/goods-receipt/list');
export const fetchGoodsReceiptByDocEntry = (docEntry) =>
  apiClient.get(`/goods-receipt/${encodeURIComponent(docEntry)}`);
export const fetchGoodsReceiptCopySource = (sourceType, docEntry) =>
  apiClient.get(`/goods-receipt/copy-from/${encodeURIComponent(sourceType)}/${encodeURIComponent(docEntry)}`);
export const submitGoodsReceipt = (payload) => apiClient.post('/goods-receipt', payload);
export const updateGoodsReceipt = (docEntry, payload) =>
  apiClient.patch(`/goods-receipt/${encodeURIComponent(docEntry)}`, payload);
