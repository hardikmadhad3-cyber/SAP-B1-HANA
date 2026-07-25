import apiClient from "./client";

const BASE = "/payment-terms";

export const createPaymentTerms  = (data)                  => apiClient.post(`${BASE}/create`, data).then((r) => r.data);
export const getPaymentTerms     = (groupNumber)           => apiClient.get(`${BASE}/${encodeURIComponent(groupNumber)}`).then((r) => r.data);
export const updatePaymentTerms  = (groupNumber, data)     => apiClient.patch(`${BASE}/${encodeURIComponent(groupNumber)}`, data).then((r) => r.data);
export const searchPaymentTerms  = (query = "", top = 50, skip = 0) =>
  apiClient.get(`${BASE}/search`, { params: { query, top, skip } }).then((r) => r.data);

export const fetchCashDiscounts  = (query = "") => apiClient.get(`${BASE}/lookup/cash-discounts`,  { params: { query } }).then((r) => r.data);
export const fetchPaymentMethods = (query = "") => apiClient.get(`${BASE}/lookup/payment-methods`, { params: { query } }).then((r) => r.data);
