import client from './client';

const API_BASE = '/services/ar-invoice';

export const fetchServiceARInvoiceReferenceData = (companyId) =>
  client.get(`${API_BASE}/reference-data`, { params: companyId ? { company_id: companyId } : {} });

export const fetchServiceARInvoiceCustomerDetails = (customerCode) =>
  client.get(`${API_BASE}/customers/${encodeURIComponent(customerCode)}`);

export const fetchServiceARInvoiceCustomerOptions = (params = {}) =>
  client.get(`${API_BASE}/customers/search`, { params });

export const fetchServiceARInvoiceSeries = (date = '', transactionType = '') =>
  client.get(`${API_BASE}/series`, {
    params: {
      ...(date ? { date } : {}),
      ...(transactionType ? { transactionType } : {}),
    },
  });

export const fetchServiceARInvoiceNextNumber = (series) =>
  client.get(`${API_BASE}/series/next`, { params: { series } });

export const fetchServiceARInvoiceList = (params = {}) =>
  client.get(`${API_BASE}/list`, { params });

export const fetchServiceARInvoiceByDocEntry = (docEntry) =>
  client.get(`${API_BASE}/${encodeURIComponent(docEntry)}`);

export const submitServiceARInvoice = (data) =>
  client.post(API_BASE, data);

export const updateServiceARInvoice = (docEntry, data) =>
  client.patch(`${API_BASE}/${encodeURIComponent(docEntry)}`, data);

export const generateServiceARInvoiceJournalEntry = ({ docEntry, payload, persist = false }) =>
  client.post('/journal-entry/generate-from-ar-invoice', {
    ...(docEntry ? { docEntry } : {}),
    ...(payload ? { payload } : {}),
    persist,
  });

export const fetchOpenServiceSalesQuotationsForARInvoice = (customerCode = null) =>
  client.get(`${API_BASE}/open-sales-quotations`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchOpenServiceSalesOrdersForARInvoice = (customerCode = null) =>
  client.get(`${API_BASE}/open-sales-orders`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchOpenServiceDeliveriesForARInvoice = (customerCode = null) =>
  client.get(`${API_BASE}/open-deliveries`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchServiceSalesQuotationForARInvoiceCopy = (docEntry) =>
  client.get(`${API_BASE}/quotation/${encodeURIComponent(docEntry)}/copy`);

export const fetchServiceSalesOrderForARInvoiceCopy = (docEntry) =>
  client.get(`${API_BASE}/sales-order/${encodeURIComponent(docEntry)}/copy`);

export const fetchServiceDeliveryForARInvoiceCopy = (docEntry) =>
  client.get(`${API_BASE}/delivery/${encodeURIComponent(docEntry)}/copy`);
