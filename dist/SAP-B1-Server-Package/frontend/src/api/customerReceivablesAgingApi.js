import apiClient from "./client";

export const fetchCustomerReceivablesAgingLookups = () =>
  apiClient.get("/reports/customer-receivables-aging/lookups").then((response) => response.data);

export const fetchCustomerReceivablesAgingReport = (criteria) =>
  apiClient.post("/reports/customer-receivables-aging", criteria).then((response) => response.data);
