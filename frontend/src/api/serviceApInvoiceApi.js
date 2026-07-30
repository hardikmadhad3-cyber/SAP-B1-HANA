import client from './client';

const API_BASE = '/services/ap-invoice';

export const fetchServiceAPInvoiceReferenceData = (companyId) =>
  client.get(`${API_BASE}/reference-data`, { params: companyId ? { company_id: companyId } : {} });

export const fetchServiceAPInvoiceVendorDetails = (vendorCode) =>
  client.get(`${API_BASE}/vendors/${encodeURIComponent(vendorCode)}`);

export const fetchServiceAPInvoiceVendorOptions = (params = {}) =>
  client.get(`${API_BASE}/vendors/search`, { params });

export const fetchServiceAPInvoiceSeries = (date = '', branch = '') =>
  client.get(`${API_BASE}/series`, {
    params: {
      ...(date ? { date } : {}),
      ...(branch ? { branch } : {}),
    },
  });

export const fetchServiceAPInvoiceNextNumber = (series) =>
  client.get(`${API_BASE}/series/next`, { params: { series } });

export const fetchServiceAPInvoiceList = (params = {}) =>
  client.get(`${API_BASE}/list`, { params });

export const fetchServiceAPInvoiceByDocEntry = (docEntry) =>
  client.get(`${API_BASE}/${encodeURIComponent(docEntry)}`);

export const submitServiceAPInvoice = (data) =>
  client.post(API_BASE, data);

export const updateServiceAPInvoice = (docEntry, data) =>
  client.patch(`${API_BASE}/${encodeURIComponent(docEntry)}`, data);

export const generateServiceAPInvoiceJournalEntry = ({ docEntry, payload, persist = false }) =>
  client.post('/journal-entry/preview', {
    documentType: 'serviceApInvoice',
    docEntry,
    payload,
    persist,
  });

export const fetchOpenServicePurchaseQuotationsForAPInvoice = (vendorCode = null) =>
  client.get(`${API_BASE}/open-purchase-quotations`, {
    params: vendorCode ? { vendorCode } : {},
  });

export const fetchOpenServicePurchaseOrdersForAPInvoice = (vendorCode = null) =>
  client.get(`${API_BASE}/open-purchase-orders`, {
    params: vendorCode ? { vendorCode } : {},
  });

export const fetchOpenServiceGRPOForAPInvoice = (vendorCode = null) =>
  client.get(`${API_BASE}/open-grpo`, {
    params: vendorCode ? { vendorCode } : {},
  });

export const fetchServicePurchaseQuotationForAPInvoiceCopy = (docEntry) =>
  client.get(`${API_BASE}/purchase-quotation/${encodeURIComponent(docEntry)}/copy`);

export const fetchServicePurchaseOrderForAPInvoiceCopy = (docEntry) =>
  client.get(`${API_BASE}/purchase-order/${encodeURIComponent(docEntry)}/copy`);

export const fetchServiceGRPOForAPInvoiceCopy = (docEntry) =>
  client.get(`${API_BASE}/grpo/${encodeURIComponent(docEntry)}/copy`);
