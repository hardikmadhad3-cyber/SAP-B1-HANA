import apiClient from './client';

export const fetchAdminEntities = () =>
  apiClient.get('/admin-panel/entities').then((response) => response.data);

export const fetchAdminEntityBootstrap = (entityKey) =>
  apiClient.get(`/admin-panel/${encodeURIComponent(entityKey)}/bootstrap`).then((response) => response.data);

export const createAdminRecord = (entityKey, payload) =>
  apiClient.post(`/admin-panel/${encodeURIComponent(entityKey)}`, payload).then((response) => response.data);

export const updateAdminRecord = (entityKey, recordId, payload) =>
  apiClient.put(`/admin-panel/${encodeURIComponent(entityKey)}/${encodeURIComponent(recordId)}`, payload).then((response) => response.data);

export const deleteAdminRecord = (entityKey, recordId) =>
  apiClient.delete(`/admin-panel/${encodeURIComponent(entityKey)}/${encodeURIComponent(recordId)}`).then((response) => response.data);
