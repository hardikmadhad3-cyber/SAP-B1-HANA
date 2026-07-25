import apiClient from "./client";

export const fetchInventoryAuditLookups = () =>
  apiClient.get("/reports/inventory-audit/lookups").then((response) => response.data);

export const fetchInventoryAuditReport = (criteria) =>
  apiClient.post("/reports/inventory-audit", criteria).then((response) => response.data);
