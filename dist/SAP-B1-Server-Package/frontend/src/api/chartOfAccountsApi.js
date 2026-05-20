import apiClient from "./client";

const BASE = "/chart-of-accounts";

export const createAccount  = (data)              => apiClient.post(`${BASE}/create`, data).then((r) => r.data);
export const getAccount     = (code)              => apiClient.get(`${BASE}/${encodeURIComponent(code)}`).then((r) => r.data);
export const updateAccount  = (code, data)        => apiClient.patch(`${BASE}/${encodeURIComponent(code)}`, data).then((r) => r.data);
export const searchAccounts = (query = "", accountType = "", top = 50, skip = 0) =>
  apiClient.get(`${BASE}/search`, { params: { query, accountType, top, skip } }).then((r) => r.data);

export const fetchParentAccounts = (query = "") => apiClient.get(`${BASE}/lookup/parent-accounts`, { params: { query } }).then((r) => r.data);
export const fetchCoACurrencies  = (query = "") => apiClient.get(`${BASE}/lookup/currencies`,      { params: { query } }).then((r) => r.data);
export const fetchCoATaxCodes    = (query = "") => apiClient.get(`${BASE}/lookup/tax-codes`,       { params: { query } }).then((r) => r.data);
