import client from './client';

const API_BASE = '/ar-credit-memo';

// ─── REFERENCE DATA ──────────────────────────────────────────────────────────
export const fetchARCreditMemoReferenceData = (companyId) => {
  return client.get(`${API_BASE}/reference-data?company_id=${companyId}`);
};

export const fetchARCreditMemoCustomerDetails = (customerCode) => {
  return client.get(`${API_BASE}/customers/${customerCode}`);
};

export const fetchARCreditMemoCustomerOptions = (params = {}) => {
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

export const fetchFreightCharges = (docEntry) => {
  return client.get(`${API_BASE}/freight-charges`, { params: { docEntry } });
};

export const fetchItemsForModal = () => {
  return client.get(`${API_BASE}/items-modal`);
};

export const fetchBatchesByItem = (itemCode, whsCode) => {
  return client.get(`${API_BASE}/batches`, {
    params: { itemCode, whsCode }
  });
};

export const fetchUomConversionFactor = (itemCode, uomCode) => {
  return client.get(`${API_BASE}/uom-conversion`, {
    params: { itemCode, uomCode }
  });
};

// ─── CRUD OPERATIONS ─────────────────────────────────────────────────────────
export const fetchARCreditMemoByDocEntry = (docEntry) => {
  return client.get(`${API_BASE}/${docEntry}`);
};

export const submitARCreditMemo = (data) => {
  return client.post(API_BASE, data);
};

export const updateARCreditMemo = (docEntry, data) => {
  return client.patch(`${API_BASE}/${docEntry}`, data);
};

export const fetchARCreditMemoList = (params = {}) => {
  return client.get(`${API_BASE}/list`, { params });
};

// ─── COPY FROM ───────────────────────────────────────────────────────────────
export const fetchOpenDeliveriesForCreditMemo = () =>
  client.get(`${API_BASE}/open-deliveries`);

export const fetchDeliveryForCreditMemoCopy = (docEntry) =>
  client.get(`${API_BASE}/delivery/${encodeURIComponent(docEntry)}/copy`);

export const fetchOpenARInvoicesForCreditMemo = (customerCode = null) =>
  client.get(`${API_BASE}/open-invoices`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchARInvoiceForCreditMemoCopy = (docEntry) =>
  client.get(`${API_BASE}/invoice/${encodeURIComponent(docEntry)}/copy`);

export const fetchOpenSalesOrdersForCreditMemo = () =>
  client.get(`${API_BASE}/open-sales-orders`);

export const fetchSalesOrderForCreditMemoCopy = (docEntry) =>
  client.get(`${API_BASE}/sales-order/${encodeURIComponent(docEntry)}/copy`);

export const fetchOpenReturnsForCreditMemo = (customerCode = null) =>
  client.get(`${API_BASE}/open-returns`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchReturnForCreditMemoCopy = (docEntry) =>
  client.get(`${API_BASE}/return/${encodeURIComponent(docEntry)}/copy`);

export const fetchOpenReturnRequestsForCreditMemo = (customerCode = null) =>
  client.get(`${API_BASE}/open-return-requests`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchReturnRequestForCreditMemoCopy = (docEntry) =>
  client.get(`${API_BASE}/return-request/${encodeURIComponent(docEntry)}/copy`);

export const fetchOpenDownPaymentsForCreditMemo = (customerCode = null) =>
  client.get(`${API_BASE}/open-down-payments`, {
    params: customerCode ? { customerCode } : {},
  });

export const fetchDownPaymentForCreditMemoCopy = (docEntry) =>
  client.get(`${API_BASE}/down-payment/${encodeURIComponent(docEntry)}/copy`);
