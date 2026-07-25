import apiClient from "./client";

export const fetchInventoryInWarehouseLookups = () =>
  apiClient.get("/reports/inventory-in-warehouse/lookups").then((response) => response.data);

export const fetchInventoryInWarehouseReport = (criteria) =>
  apiClient.post("/reports/inventory-in-warehouse", criteria).then((response) => response.data);
