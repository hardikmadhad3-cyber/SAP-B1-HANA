import apiClient from "./client";

const BASE = "/business-partners";

export const createBP  = (data)           => apiClient.post(`${BASE}/create`, data).then((r) => r.data);
export const getBP     = (cardCode)       => apiClient.get(`${BASE}/${encodeURIComponent(cardCode)}`).then((r) => r.data);
export const updateBP  = (cardCode, data) => apiClient.patch(`${BASE}/${encodeURIComponent(cardCode)}`, data).then((r) => r.data);
export const searchBP  = (query = "", type = "", top = 50, skip = 0) =>
  apiClient.get(`${BASE}/search`, { params: { query, type, top, skip } }).then((r) => r.data);

export const fetchBPGroups      = (query = "") => apiClient.get(`${BASE}/lookup/groups`,        { params: { query } }).then((r) => r.data);
export const fetchPaymentTerms  = (query = "") => apiClient.get(`${BASE}/lookup/payment-terms`, { params: { query } }).then((r) => r.data);
export const fetchSalesPersons  = (query = "") => apiClient.get(`${BASE}/lookup/sales-persons`, { params: { query } }).then((r) => r.data);
export const fetchBPPriceLists  = (query = "") => apiClient.get(`${BASE}/lookup/price-lists`,   { params: { query } }).then((r) => r.data);
export const fetchCurrencies    = (query = "") => apiClient.get(`${BASE}/lookup/currencies`,    { params: { query } }).then((r) => r.data);
export const fetchBPCountries   = (query = "") => apiClient.get(`${BASE}/lookup/countries`,     { params: { query } }).then((r) => r.data);
export const fetchBPCompanyTypes = () => apiClient.get(`${BASE}/lookup/company-types`).then((r) => r.data);
export const fetchBPCreditCards = (query = "") => apiClient.get(`${BASE}/lookup/credit-cards`, { params: { query } }).then((r) => r.data);
export const createBPCreditCard = (data) => apiClient.post(`${BASE}/lookup/credit-cards`, data).then((r) => r.data);
export const fetchBPBanks       = (query = "", country = "") =>
  apiClient.get(`${BASE}/lookup/banks`, { params: { query, country } }).then((r) => r.data);
export const fetchBPHouseBankAccounts = (bankCode = "", country = "") =>
  apiClient.get(`${BASE}/lookup/house-bank-accounts`, { params: { bankCode, country } }).then((r) => r.data);
export const fetchBPWithholdingTaxCodes = (query = "") =>
  apiClient.get(`${BASE}/lookup/withholding-tax-codes`, { params: { query } }).then((r) => r.data);
export const fetchNumberingSeries = (bpType = "") => apiClient.get(`${BASE}/lookup/series`, { params: { bpType } }).then((r) => r.data);
export const getNextSeriesNumber = (series, bpType = "") =>
  apiClient.get(`${BASE}/lookup/series/${series}/next`, { params: { bpType } }).then((r) => r.data);
