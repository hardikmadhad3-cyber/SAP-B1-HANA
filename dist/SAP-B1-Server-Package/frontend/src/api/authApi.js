import apiClient from './client';

export const loginUser = (credentials) =>
  apiClient.post('/login', credentials).then((response) => response.data);

export const fetchPublicCompanies = () =>
  apiClient.get('/companies-public').then((response) => response.data);

export const fetchUserCompanies = (userId) =>
  apiClient.get(`/companies/${encodeURIComponent(userId)}`).then((response) => response.data);

export const selectCompany = (payload) =>
  apiClient.post('/select-company', payload).then((response) => response.data);

export const fetchMenu = () =>
  apiClient.get('/menu').then((response) => response.data);
