import apiClient from './client';

export const fetchCustomerSalesAnalysisReport = (criteria) =>
  apiClient.post('/reports/sales-analysis/customers', criteria).then((response) => response.data);

export const fetchItemSalesAnalysisReport = (criteria) =>
  apiClient.post('/reports/sales-analysis/items', criteria).then((response) => response.data);

export const fetchSalesEmployeeSalesAnalysisReport = (criteria) =>
  apiClient.post('/reports/sales-analysis/sales-employees', criteria).then((response) => response.data);

export const fetchCustomerSalesAnalysisDetailReport = (criteria, customerCode) =>
  apiClient
    .post(`/reports/sales-analysis/customers/${encodeURIComponent(customerCode)}/detail`, criteria)
    .then((response) => response.data);
