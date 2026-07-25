import apiClient from "./client";

const BASE = "/tax-codes";

export const createTaxCode  = (data)              => apiClient.post(`${BASE}/create`, data).then((r) => r.data);
export const getTaxCode     = (code)              => apiClient.get(`${BASE}/${encodeURIComponent(code)}`).then((r) => r.data);
export const updateTaxCode  = (code, data)        => apiClient.patch(`${BASE}/${encodeURIComponent(code)}`, data).then((r) => r.data);
export const searchTaxCodes = (query = "", category = "", top = 50, skip = 0) =>
  apiClient.get(`${BASE}/search`, { params: { query, category, top, skip } }).then((r) => r.data);

export const fetchTaxGLAccounts = (query = "") =>
  apiClient.get(`${BASE}/lookup/gl-accounts`, { params: { query } }).then((r) => r.data);
