import apiClient from './client';

export const fetchAnalyticsQueries = (filters = {}) =>
  apiClient.get('/analytics/queries', { params: filters }).then((response) => response.data.items || []);

export const fetchAnalyticsQuery = (queryId) =>
  apiClient.get(`/analytics/queries/${queryId}`).then((response) => response.data);

export const createAnalyticsQuery = (payload) =>
  apiClient.post('/analytics/queries', payload).then((response) => response.data);

export const updateAnalyticsQuery = (queryId, payload) =>
  apiClient.put(`/analytics/queries/${queryId}`, payload).then((response) => response.data);

export const deleteAnalyticsQuery = (queryId) =>
  apiClient.delete(`/analytics/queries/${queryId}`).then((response) => response.data);

export const publishAnalyticsQuery = (queryId) =>
  apiClient.post(`/analytics/queries/${queryId}/publish`).then((response) => response.data);

export const unpublishAnalyticsQuery = (queryId) =>
  apiClient.post(`/analytics/queries/${queryId}/unpublish`).then((response) => response.data);

export const previewAnalyticsQuery = (payload) =>
  apiClient.post('/analytics/queries/preview', payload).then((response) => response.data);

export const runAnalyticsQuery = (queryId, payload, { signal } = {}) =>
  apiClient.post(`/analytics/queries/${queryId}/run`, payload, { signal }).then((response) => response.data);

export const fetchAnalyticsQueryExecutions = (queryId, params = {}) =>
  apiClient.get(`/analytics/queries/${queryId}/executions`, { params }).then((response) => response.data.items || []);
