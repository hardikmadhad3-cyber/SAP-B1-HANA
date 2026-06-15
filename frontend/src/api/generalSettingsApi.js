import apiClient from './client';

export const fetchAdminGeneralSettingsBootstrap = () =>
  apiClient.get('/admin-panel/general-settings/bootstrap').then((response) => response.data);

export const fetchAdminGeneralSettings = (companyId, userId) =>
  apiClient.get('/admin-panel/general-settings', {
    params: { companyId, userId },
  }).then((response) => response.data);

export const fetchAdminGeneralSettingsOptions = (companyId, userId, date) =>
  apiClient.get('/admin-panel/general-settings/options', {
    params: { companyId, userId, date },
  }).then((response) => response.data);

export const saveAdminGeneralSettings = (companyId, userId, settings) =>
  apiClient.put('/admin-panel/general-settings', {
    companyId,
    userId,
    settings,
  }).then((response) => response.data);
