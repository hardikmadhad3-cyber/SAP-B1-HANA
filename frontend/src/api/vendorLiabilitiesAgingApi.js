import apiClient from "./client";

export const fetchVendorLiabilitiesAgingLookups = () =>
  apiClient.get("/reports/vendor-liabilities-aging/lookups").then((response) => response.data);

export const fetchVendorLiabilitiesAgingReport = (criteria) =>
  apiClient.post("/reports/vendor-liabilities-aging", criteria).then((response) => response.data);
