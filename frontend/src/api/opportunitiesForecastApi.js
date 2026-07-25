import apiClient from './client';

export const fetchOpportunitiesForecastReport = (criteria) =>
  apiClient.post('/reports/opportunities-forecast/report', criteria).then((response) => response.data);

export const fetchOpportunitiesForecastOverTimeReport = (criteria) =>
  apiClient.post('/reports/opportunities-forecast/over-time/report', criteria).then((response) => response.data);

export const fetchInformationSourceDistributionOverTimeReport = (criteria) =>
  apiClient.post('/reports/information-source-distribution-over-time/report', criteria).then((response) => response.data);

export const fetchOpportunitiesStatisticsReport = (criteria) =>
  apiClient.post('/reports/opportunities-statistics/report', criteria).then((response) => response.data);

export const fetchOpportunitiesReport = (criteria) =>
  apiClient.post('/reports/opportunities/report', criteria).then((response) => response.data);

export const fetchOpportunitiesPipelineReport = (criteria) =>
  apiClient.post('/reports/opportunities-pipeline/report', criteria).then((response) => response.data);

export const fetchOpportunitiesStageAnalysisReport = (criteria) =>
  apiClient.post('/reports/opportunities-stage-analysis/report', criteria).then((response) => response.data);

export const fetchWonOpportunitiesReport = (criteria) =>
  apiClient.post('/reports/opportunities-won/report', criteria).then((response) => response.data);

export const fetchLostOpportunitiesReport = (criteria) =>
  apiClient.post('/reports/opportunities-lost/report', criteria).then((response) => response.data);

export const fetchCrmStages = () =>
  apiClient.get('/reports/opportunities-forecast/stages').then((response) => response.data);

export const fetchTerritories = () =>
  apiClient.get('/reports/opportunities-forecast/territories').then((response) => response.data);

export const fetchIndustries = () =>
  apiClient.get('/reports/opportunities-forecast/industries').then((response) => response.data);

export const fetchInterestLevels = () =>
  apiClient.get('/reports/opportunities-forecast/interest-levels').then((response) => response.data);

export const fetchOpportunityForecastLookups = () =>
  apiClient.get('/reports/opportunities-forecast/lookups').then((response) => response.data);
