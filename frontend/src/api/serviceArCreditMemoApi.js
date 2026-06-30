import client from './client';

const API_BASE = '/services/ar-credit-memo';

export const fetchServiceARCreditMemoReferenceData = (companyId) =>
  client.get(`${API_BASE}/reference-data`, { params: companyId ? { company_id: companyId } : {} });

export const fetchServiceARCreditMemoCustomerDetails = (customerCode) =>
  client.get(`${API_BASE}/customers/${encodeURIComponent(customerCode)}`);

export const fetchServiceARCreditMemoCustomerOptions = (params = {}) =>
  client.get(`${API_BASE}/customers/search`, { params });

export const fetchServiceARCreditMemoSeries = (date = '', branch = '') =>
  client.get(`${API_BASE}/series`, {
    params: {
      ...(date ? { date } : {}),
      ...(branch ? { branch } : {}),
    },
  });

export const fetchServiceARCreditMemoNextNumber = (series) =>
  client.get(`${API_BASE}/series/next`, { params: { series } });

export const fetchServiceARCreditMemoList = (params = {}) =>
  client.get(`${API_BASE}/list`, { params });

export const fetchServiceARCreditMemoByDocEntry = (docEntry) =>
  client.get(`${API_BASE}/${encodeURIComponent(docEntry)}`);

export const submitServiceARCreditMemo = (data) =>
  client.post(API_BASE, data);

export const updateServiceARCreditMemo = (docEntry, data) =>
  client.patch(`${API_BASE}/${encodeURIComponent(docEntry)}`, data);

export const generateServiceARCreditMemoJournalEntry = ({ docEntry, payload, persist = false }) =>
  client.post('/journal-entry/generate-from-ar-credit-memo', {
    docEntry,
    payload,
    persist,
  });

export const fetchOpenServiceARInvoicesForARCreditMemo = (customerCode = null) =>
  client.get(`${API_BASE}/open-ar-invoices`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchServiceARInvoiceForARCreditMemoCopy = (docEntry) =>
  client.get(`${API_BASE}/ar-invoice/${encodeURIComponent(docEntry)}/copy`);

