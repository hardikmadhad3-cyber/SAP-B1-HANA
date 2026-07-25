import apiClient from "./client";

export const fetchBillOfMaterialsReport = (criteria) =>
  apiClient.post("/reports/production/bill-of-materials", criteria).then((response) => response.data);
