import apiClient from './client';

export const fetchAnalyticsDashboards = (filters = {}) =>
  apiClient.get('/analytics/dashboards', { params: filters }).then((response) => response.data.items || []);

export const fetchAnalyticsDashboard = (dashboardId) =>
  apiClient.get(`/analytics/dashboards/${dashboardId}`).then((response) => response.data);

export const createAnalyticsDashboard = (payload) =>
  apiClient.post('/analytics/dashboards', payload).then((response) => response.data);

export const updateAnalyticsDashboard = (dashboardId, payload) =>
  apiClient.put(`/analytics/dashboards/${dashboardId}`, payload).then((response) => response.data);

export const deleteAnalyticsDashboard = (dashboardId) =>
  apiClient.delete(`/analytics/dashboards/${dashboardId}`).then((response) => response.data);

export const publishAnalyticsDashboard = (dashboardId) =>
  apiClient.post(`/analytics/dashboards/${dashboardId}/publish`).then((response) => response.data);

export const unpublishAnalyticsDashboard = (dashboardId) =>
  apiClient.post(`/analytics/dashboards/${dashboardId}/unpublish`).then((response) => response.data);

export const addAnalyticsDashboardWidget = (dashboardId, payload) =>
  apiClient.post(`/analytics/dashboards/${dashboardId}/widgets`, payload).then((response) => response.data);

export const updateAnalyticsDashboardWidget = (dashboardId, widgetId, payload) =>
  apiClient.put(`/analytics/dashboards/${dashboardId}/widgets/${widgetId}`, payload).then((response) => response.data);

export const removeAnalyticsDashboardWidget = (dashboardId, widgetId) =>
  apiClient.delete(`/analytics/dashboards/${dashboardId}/widgets/${widgetId}`).then((response) => response.data);

export const fetchAnalyticsRoles = () =>
  apiClient.get('/analytics/roles').then((response) => response.data.items || []);

export const fetchAnalyticsDashboardView = (dashboardCode, { signal } = {}) =>
  apiClient.get(`/analytics/dashboard-view/${encodeURIComponent(dashboardCode)}`, { signal }).then((response) => response.data);

export const runAnalyticsDashboardWidget = (dashboardCode, widgetId, payload = {}, { signal } = {}) =>
  apiClient.post(`/analytics/dashboard-view/${encodeURIComponent(dashboardCode)}/widgets/${widgetId}/run`, payload, { signal })
    .then((response) => response.data);
