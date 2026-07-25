import apiClient from "./client";

export const fetchProductionOpenItemsReport = (criteria = {}) =>
  apiClient.post("/reports/production/open-items-list", criteria).then((response) => response.data);
