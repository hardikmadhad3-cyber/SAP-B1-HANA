import apiClient from "./client";

const BASE = "/incoming-payments";

export const fetchIncomingPaymentReferenceData = () =>
  apiClient.get(`${BASE}/reference-data`).then((response) => response.data);

export const searchIncomingPaymentBusinessPartners = (query = "", bpType = "Customer", page = 1, pageSize = 100) =>
  apiClient.get(`${BASE}/business-partners`, { params: { query, bpType, page, pageSize } }).then((response) => response.data);

export const searchIncomingPayments = (query = "") =>
  apiClient.get(`${BASE}/documents`, { params: { query } }).then((response) => response.data);

export const fetchIncomingPaymentByDocEntry = (docEntry) =>
  apiClient.get(`${BASE}/documents/${encodeURIComponent(docEntry)}`).then((response) => response.data);

export const fetchIncomingPaymentOpenInvoices = (cardCode = "", branch = "") =>
  apiClient.get(`${BASE}/open-invoices`, { params: { cardCode, branch } }).then((response) => response.data);

export const searchIncomingPaymentControlAccounts = (query = "") =>
  apiClient.get(`${BASE}/control-accounts`, { params: { query } }).then((response) => response.data);

export const searchIncomingPaymentCashAccounts = (query = "") =>
  apiClient.get(`${BASE}/cash-accounts`, { params: { query } }).then((response) => response.data);

export const submitIncomingPayment = (payload) =>
  apiClient.post(BASE, payload).then((response) => response.data);
