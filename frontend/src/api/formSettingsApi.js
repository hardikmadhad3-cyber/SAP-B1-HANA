import apiClient from './client';

const buildFormSettingsUrl = (formKey) =>
  `/form-settings/${encodeURIComponent(String(formKey || '').trim())}`;

export const fetchFormSettings = (formKey) =>
  apiClient.get(buildFormSettingsUrl(formKey)).then((response) => response.data);

export const saveFormSettings = (formKey, settings) =>
  apiClient.put(buildFormSettingsUrl(formKey), { settings }).then((response) => response.data);
