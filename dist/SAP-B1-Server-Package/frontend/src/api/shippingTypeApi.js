import apiClient from "./client";

const BASE = "/shipping-types";

export const createShippingType  = (data)            => apiClient.post(`${BASE}/create`, data).then((r) => r.data);
export const getShippingType     = (code)            => apiClient.get(`${BASE}/${encodeURIComponent(code)}`).then((r) => r.data);
export const updateShippingType  = (code, data)      => apiClient.patch(`${BASE}/${encodeURIComponent(code)}`, data).then((r) => r.data);
export const deleteShippingType  = (code)            => apiClient.delete(`${BASE}/${encodeURIComponent(code)}`).then((r) => r.data);
export const searchShippingTypes = (query = "", top = 50, skip = 0) =>
  apiClient.get(`${BASE}/search`, { params: { query, top, skip } }).then((r) => r.data);
