import client from './client';

const API_BASE = '/services/ap-credit-memo';

export const fetchServiceAPCreditMemoReferenceData = (companyId) =>
  client.get(`${API_BASE}/reference-data`, { params: companyId ? { company_id: companyId } : {} });

export const fetchServiceAPCreditMemoVendorDetails = (vendorCode) =>
  client.get(`${API_BASE}/vendors/${encodeURIComponent(vendorCode)}`);

export const fetchServiceAPCreditMemoVendorOptions = (params = {}) =>
  client.get(`${API_BASE}/vendors/search`, { params });

export const fetchServiceAPCreditMemoSeries = (date = '', branch = '') =>
  client.get(`${API_BASE}/series`, {
    params: {
      ...(date ? { date } : {}),
      ...(branch ? { branch } : {}),
    },
  });

export const fetchServiceAPCreditMemoNextNumber = (series) =>
  client.get(`${API_BASE}/series/next`, { params: { series } });

export const fetchServiceAPCreditMemoList = (params = {}) =>
  client.get(`${API_BASE}/list`, { params });

export const fetchServiceAPCreditMemoByDocEntry = (docEntry) =>
  client.get(`${API_BASE}/${encodeURIComponent(docEntry)}`);

export const submitServiceAPCreditMemo = (data) =>
  client.post(API_BASE, data);

export const updateServiceAPCreditMemo = (docEntry, data) =>
  client.patch(`${API_BASE}/${encodeURIComponent(docEntry)}`, data);

export const generateServiceAPCreditMemoJournalEntry = ({ docEntry, payload, persist = false }) =>
  client.post('/journal-entry/generate-from-ap-credit-memo', {
    docEntry,
    payload,
    persist,
  });

export const fetchOpenServiceAPInvoicesForAPCreditMemo = (vendorCode = null) =>
  client.get(`${API_BASE}/open-ap-invoices`, {
    params: vendorCode ? { vendorCode } : {},
  });

export const fetchServiceAPInvoiceForAPCreditMemoCopy = (docEntry) =>
  client.get(`${API_BASE}/ap-invoice/${encodeURIComponent(docEntry)}/copy`);

