import apiClient from "./client";

export const fetchInventoryPostingList = (criteria) =>
  apiClient.post("/reports/inventory-posting-list", criteria).then((response) => response.data);
