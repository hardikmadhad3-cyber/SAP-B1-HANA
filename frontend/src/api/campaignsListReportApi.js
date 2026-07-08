import apiClient from "./client";

export const fetchCampaignsListLookups = () =>
  apiClient.get("/reports/campaigns-list/lookups").then((response) => response.data);

export const fetchCampaignsListReport = (criteria) =>
  apiClient.post("/reports/campaigns-list", criteria).then((response) => response.data);
