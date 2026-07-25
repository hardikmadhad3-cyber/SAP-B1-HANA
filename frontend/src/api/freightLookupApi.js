import apiClient from './client';

export const fetchFreightDistributionRules = () =>
  apiClient.get('/production-order/lookup/distribution-rules').then((r) => r.data || []);

export const fetchFreightProjects = () =>
  apiClient.get('/production-order/lookup/projects').then((r) => r.data || []);
