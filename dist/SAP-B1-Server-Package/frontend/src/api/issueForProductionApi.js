import apiClient from './client';

export const fetchIssueReferenceData = () =>
  apiClient.get('/issue-for-production/reference-data').then((r) => r.data);

export const fetchProductionOrderForIssue = (docEntry) =>
  apiClient.get(`/issue-for-production/production-order/${encodeURIComponent(docEntry)}`).then((r) => r.data);

export const fetchIssueList = (params = {}) =>
  apiClient.get('/issue-for-production/list', { params }).then((r) => r.data);

export const fetchIssueByDocEntry = (docEntry) =>
  apiClient.get(`/issue-for-production/${encodeURIComponent(docEntry)}`).then((r) => r.data);

export const createIssue = (data) =>
  apiClient.post('/issue-for-production', data).then((r) => r.data);

export const lookupProductionOrders = (query = '') =>
  apiClient.get('/issue-for-production/lookup/production-orders', { params: { query } }).then((r) => r.data);
