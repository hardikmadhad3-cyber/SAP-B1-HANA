import apiClient from "./client";

export const fetchItemListReport = (criteria) =>
  apiClient.post("/reports/item-list", criteria).then((response) => response.data);
