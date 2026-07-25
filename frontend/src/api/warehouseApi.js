import apiClient from "./client";

const BASE = "/warehouses";

export const createWarehouse  = (data)              => apiClient.post(`${BASE}/create`, data).then((r) => r.data);
export const getWarehouse     = (whCode)            => apiClient.get(`${BASE}/${encodeURIComponent(whCode)}`).then((r) => r.data);
export const updateWarehouse  = (whCode, data)      => apiClient.patch(`${BASE}/${encodeURIComponent(whCode)}`, data).then((r) => r.data);
export const searchWarehouses = (query = "", top = 50, skip = 0) =>
  apiClient.get(`${BASE}/search`, { params: { query, top, skip } }).then((r) => r.data);

export const fetchWHCountries  = (query = "") => apiClient.get(`${BASE}/lookup/countries`,   { params: { query } }).then((r) => r.data);
export const fetchWHStates     = (country = "") => apiClient.get(`${BASE}/lookup/states`, { params: { country } }).then((r) => r.data);
export const fetchWHLocations  = () => apiClient.get(`${BASE}/lookup/locations`).then((r) => r.data);
export const fetchWHBusinessPlaces = () => apiClient.get(`${BASE}/lookup/business-places`).then((r) => r.data);
export const fetchWHGLAccounts = (query = "") => apiClient.get(`${BASE}/lookup/gl-accounts`, { params: { query } }).then((r) => r.data);
