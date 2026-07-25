import apiClient from "./client";

export const fetchInactiveCustomersLookups = () =>
  apiClient.get("/reports/inactive-customers/lookups").then((response) => response.data);

export const fetchInactiveCustomersReport = (criteria) =>
  apiClient.post("/reports/inactive-customers", criteria).then((response) => response.data);
