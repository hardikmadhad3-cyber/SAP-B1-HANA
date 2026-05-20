import apiClient from './client';

export const fetchGoodsIssueMetadata = () => apiClient.get('/goods-issue/metadata');
export const fetchGoodsIssueItems = () => apiClient.get('/goods-issue/items');
export const fetchGoodsIssueWarehouses = () => apiClient.get('/goods-issue/warehouses');
export const fetchGoodsIssueSeries = () => apiClient.get('/goods-issue/series');
export const fetchGoodsIssueBatchesByItem = (itemCode, whsCode) =>
  apiClient.get('/goods-issue/batches', {
    params: { itemCode, whsCode },
  });
export const fetchGoodsIssueList = () => apiClient.get('/goods-issue/list');
export const fetchGoodsIssueByDocEntry = (docEntry) =>
  apiClient.get(`/goods-issue/${encodeURIComponent(docEntry)}`);
export const submitGoodsIssue = (payload) => apiClient.post('/goods-issue', payload);
export const updateGoodsIssue = (docEntry, payload) =>
  apiClient.patch(`/goods-issue/${encodeURIComponent(docEntry)}`, payload);
