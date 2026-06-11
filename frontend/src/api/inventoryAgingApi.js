import apiClient from "./client";

export const fetchInventoryAgingLookups = () =>
  apiClient.get("/reports/inventory-aging/lookups").then((response) => response.data);

export const fetchInventoryAgingReport = (criteria) =>
  apiClient.post("/reports/inventory-aging", criteria).then((response) => response.data);
