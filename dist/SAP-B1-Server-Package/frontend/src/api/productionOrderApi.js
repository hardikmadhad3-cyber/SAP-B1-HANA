import apiClient from './client';

export const fetchProductionOrderReferenceData = () =>
  apiClient.get('/production-order/reference-data').then((r) => r.data);

export const fetchProductionOrders = (params = {}) =>
  apiClient.get('/production-order/list', { params }).then((r) => r.data);

export const fetchProductionOrderByDocEntry = (docEntry) =>
  apiClient.get(`/production-order/${encodeURIComponent(docEntry)}`).then((r) => r.data);

export const createProductionOrder = (data) =>
  apiClient.post('/production-order', data).then((r) => r.data);

export const updateProductionOrder = (docEntry, data) =>
  apiClient.patch(`/production-order/${encodeURIComponent(docEntry)}`, data).then((r) => r.data);

export const releaseProductionOrder = (docEntry) =>
  apiClient.post(`/production-order/${encodeURIComponent(docEntry)}/release`).then((r) => r.data);

export const closeProductionOrder = (docEntry) =>
  apiClient.post(`/production-order/${encodeURIComponent(docEntry)}/close`).then((r) => r.data);

export const explodeBOM = (itemCode, qty = 1) =>
  apiClient.get(`/production-order/bom-explode/${encodeURIComponent(itemCode)}`, { params: { qty } }).then((r) => r.data);

// Lookups
export const fetchProdOrderItems = (query = '') =>
  apiClient.get('/production-order/lookup/items', { params: { query } }).then((r) => r.data);

export const fetchProdOrderComponentItems = (query = '') =>
  apiClient.get('/production-order/lookup/component-items', { params: { query } }).then((r) => r.data);

export const fetchProdOrderResources = (query = '') =>
  apiClient.get('/production-order/lookup/resources', { params: { query } }).then((r) => r.data);

export const fetchProdOrderRouteStages = (query = '') =>
  apiClient.get('/production-order/lookup/route-stages', { params: { query } }).then((r) => r.data);

export const fetchProdOrderWarehouses = () =>
  apiClient.get('/production-order/lookup/warehouses').then((r) => r.data);

export const fetchProdOrderDistributionRules = () =>
  apiClient.get('/production-order/lookup/distribution-rules').then((r) => r.data);

export const fetchProdOrderProjects = () =>
  apiClient.get('/production-order/lookup/projects').then((r) => r.data);

export const fetchProdOrderBranches = () =>
  apiClient.get('/production-order/lookup/branches').then((r) => r.data);

export const fetchProdOrderCustomers = (query = '') =>
  apiClient.get('/production-order/lookup/customers', { params: { query } }).then((r) => r.data);
