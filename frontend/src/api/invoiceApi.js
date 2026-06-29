import apiClient from './client';

export const fetchGLAccounts = (query = '') =>
  apiClient.get('/items/lookup/gl-accounts', { params: { query } }).then((r) => r.data);

export const fetchTaxCodes = (query = '', category = '', top = 50, skip = 0) =>
  apiClient.get('/tax-codes/search', { params: { query, category, top, skip } }).then((r) => r.data);

export const fetchPaymentTerms = (query = '', top = 50, skip = 0) =>
  apiClient.get('/payment-terms/search', { params: { query, top, skip } }).then((r) => r.data);

export const fetchBusinessPartners = (query = '', type = '', top = 50, skip = 0) =>
  apiClient.get('/business-partners/search', { params: { query, type, top, skip } }).then((r) => r.data);

export const fetchItems = (query = '', top = 50, skip = 0) =>
  apiClient.get('/items/search', { params: { query, top, skip } }).then((r) => r.data);

export const fetchBlanketAgreements = () =>
  apiClient.get('/blanket-agreements/open').then((r) => r.data);
