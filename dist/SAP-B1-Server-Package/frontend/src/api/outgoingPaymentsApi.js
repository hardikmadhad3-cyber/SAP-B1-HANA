import apiClient from "./client";

const BASE = "/outgoing-payments";

export const fetchOutgoingPaymentReferenceData = () =>
  apiClient.get(`${BASE}/reference-data`).then((response) => response.data);

export const searchOutgoingPaymentBusinessPartners = (query = "", bpType = "Vendor") =>
  apiClient.get(`${BASE}/business-partners`, { params: { query, bpType } }).then((response) => response.data);

export const searchOutgoingPayments = (query = "") =>
  apiClient.get(`${BASE}/documents`, { params: { query } }).then((response) => response.data);

export const fetchOutgoingPaymentOpenInvoices = (cardCode = "", branch = "") =>
  apiClient.get(`${BASE}/open-invoices`, { params: { cardCode, branch } }).then((response) => response.data);

export const searchOutgoingPaymentControlAccounts = (query = "") =>
  apiClient.get(`${BASE}/control-accounts`, { params: { query } }).then((response) => response.data);

export const searchOutgoingPaymentCashAccounts = (query = "") =>
  apiClient.get(`${BASE}/cash-accounts`, { params: { query } }).then((response) => response.data);

export const submitOutgoingPayment = (payload) =>
  apiClient.post(BASE, payload).then((response) => response.data);
