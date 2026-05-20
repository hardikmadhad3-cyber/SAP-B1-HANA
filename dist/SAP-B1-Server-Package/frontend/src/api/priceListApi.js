import apiClient from "./client";

const BASE = "/price-lists";

export const createPriceList  = (data)                => apiClient.post(`${BASE}/create`, data).then((r) => r.data);
export const getPriceList     = (priceListNo)         => apiClient.get(`${BASE}/${encodeURIComponent(priceListNo)}`).then((r) => r.data);
export const updatePriceList  = (priceListNo, data)   => apiClient.patch(`${BASE}/${encodeURIComponent(priceListNo)}`, data).then((r) => r.data);
export const searchPriceLists = (query = "", top = 50, skip = 0) =>
  apiClient.get(`${BASE}/search`, { params: { query, top, skip } }).then((r) => r.data);

export const fetchBasePriceLists = (query = "") => apiClient.get(`${BASE}/lookup/price-lists`, { params: { query } }).then((r) => r.data);
export const fetchPLCurrencies   = (query = "") => apiClient.get(`${BASE}/lookup/currencies`,  { params: { query } }).then((r) => r.data);
