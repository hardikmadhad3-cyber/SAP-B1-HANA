import client from './client';

const API_BASE = '/ar-invoice';

// ─── REFERENCE DATA ──────────────────────────────────────────────────────────
export const fetchARInvoiceReferenceData = (companyId) => {
  return client.get(`${API_BASE}/reference-data?company_id=${companyId}`);
};

export const fetchARInvoiceCustomerDetails = (customerCode) => {
  return client.get(`${API_BASE}/customers/${customerCode}`);
};

export const fetchARInvoiceCustomerOptions = (params = {}) => {
  return client.get(`${API_BASE}/customers/search`, { params });
};

export const fetchDocumentSeries = (date = '') => {
  return client.get(`${API_BASE}/series`, {
    params: date ? { date } : {},
  });
};

export const fetchNextNumber = (series) => {
  return client.get(`${API_BASE}/series/next?series=${series}`);
};

export const fetchStateFromAddress = (address) => {
  return client.get(`${API_BASE}/state-from-address?address=${encodeURIComponent(address)}`);
};

export const fetchStateFromWarehouse = (whsCode) => {
  return client.get(`${API_BASE}/warehouse-state/${encodeURIComponent(whsCode)}`);
};

export const fetchBatchesByItem = (itemCode, whsCode) => {
  return client.get(`${API_BASE}/batches`, {
    params: { itemCode, whsCode },
  });
};

export const fetchFreightCharges = (docEntry) => {
  return client.get(`${API_BASE}/freight-charges`, { params: { docEntry } });
};

export const fetchItemsForModal = () => {
  return client.get(`${API_BASE}/items-modal`);
};

// ─── CRUD OPERATIONS ─────────────────────────────────────────────────────────
export const fetchARInvoiceByDocEntry = (docEntry) => {
  return client.get(`${API_BASE}/${docEntry}`);
};

export const submitARInvoice = (data) => {
  return client.post(API_BASE, data);
};

export const updateARInvoice = (docEntry, data) => {
  return client.patch(`${API_BASE}/${docEntry}`, data);
};

export const fetchARInvoiceList = (params = {}) => {
  return client.get(`${API_BASE}/list`, { params });
};

// ─── COPY FROM ───────────────────────────────────────────────────────────────
export const fetchOpenSalesOrdersForARInvoice = (customerCode = null) =>
  client.get(`${API_BASE}/open-sales-orders`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchSalesOrderForARInvoiceCopy = (docEntry) =>
  client.get(`${API_BASE}/sales-order/${encodeURIComponent(docEntry)}/copy`);

export const fetchOpenDeliveriesForARInvoice = (customerCode = null) =>
  client.get(`${API_BASE}/open-deliveries`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchDeliveryForARInvoiceCopy = (docEntry) =>
  client.get(`${API_BASE}/delivery/${encodeURIComponent(docEntry)}/copy`);

export const fetchOpenSalesQuotationsForARInvoice = () =>
   client.get('/sales-quotation/open');

export const fetchSalesQuotationForARInvoiceCopy = (docEntry) =>
  client.get(`/sales-quotation/${encodeURIComponent(docEntry)}/copy`);

export const fetchOpenBlanketAgreementsForARInvoice = () =>
  client.get('/blanket-agreements/open');

export const fetchBlanketAgreementForARInvoiceCopy = (docEntry) =>
  client.get(`/blanket-agreements/${encodeURIComponent(docEntry)}/copy`);
