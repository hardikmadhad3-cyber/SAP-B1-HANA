import apiClient from './client';

// Reference Data
export const fetchAPInvoiceReferenceData = (companyId) =>
  apiClient.get('/ap-invoice/reference-data', {
    params: { company_id: companyId }
  });

// Vendor
export const fetchAPInvoiceVendorDetails = (cardCode) =>
  apiClient.get(`/ap-invoice/vendors/${cardCode}`);

export const fetchAPInvoiceVendorOptions = (params = {}) =>
  apiClient.get('/ap-invoice/vendors/search', { params });

// Submit
export const submitAPInvoice = (payload) =>
  apiClient.post('/ap-invoice', payload);

export const updateAPInvoice = (docEntry, payload) =>
  apiClient.patch(`/ap-invoice/${docEntry}`, payload);

export const fetchAPInvoiceByDocEntry = (docEntry) =>
  apiClient.get(`/ap-invoice/${docEntry}`);

// Series
export const fetchAPInvoiceSeries = () =>
  apiClient.get('/ap-invoice/series');

export const fetchNextNumber = (series) =>
  apiClient.get(`/ap-invoice/series/${series}/next-number`);

export const fetchStateFromWarehouse = (whsCode) =>
  apiClient.get(`/ap-invoice/warehouse-state/${encodeURIComponent(whsCode)}`);

// Copy From GRPO
export const fetchOpenGRPO = (vendor) =>
  apiClient.get('/ap-invoice/open-grpo', {
    params: vendor ? { vendorCode: vendor } : {}
  });

export const fetchGRPOForCopy = (docEntry) =>
  apiClient.get(`/ap-invoice/grpo/${docEntry}`);

export const fetchAPInvoices = (params = {}) =>
  apiClient.get('/ap-invoice/list', { params });

export const fetchItemsForModal = () =>
  apiClient.get('/ap-invoice/items-modal');

export const fetchFreightCharges = (docEntry) =>
  apiClient.get('/ap-invoice/freight-charges', { params: { docEntry } });
