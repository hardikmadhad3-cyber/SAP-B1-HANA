import apiClient from './client';

export const fetchGoodsIssueMetadata = () =>
  apiClient.get('/goods-issue/metadata', { params: { _: Date.now() } });
export const fetchGoodsIssueItems = () =>
  apiClient.get('/goods-issue/items', { params: { _: Date.now() } });
export const fetchGoodsIssueWarehouses = () => apiClient.get('/goods-issue/warehouses');
export const fetchGoodsIssueDistributionRules = () =>
  apiClient.get('/goods-issue/distribution-rules');
export const fetchGoodsIssueSeries = () =>
  apiClient.get('/goods-issue/series', { params: { _: Date.now() } });
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
