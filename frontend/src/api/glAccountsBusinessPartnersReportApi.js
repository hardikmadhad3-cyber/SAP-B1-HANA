import apiClient from "./client";

const BASE = "/reports/gl-accounts-business-partners";

export const fetchGLAccountsBusinessPartnersLookups = () =>
  apiClient.get(`${BASE}/lookups`).then((response) => response.data);

export const fetchGLAccountsBusinessPartnersReport = (criteria) =>
  apiClient.post(BASE, criteria).then((response) => response.data);
