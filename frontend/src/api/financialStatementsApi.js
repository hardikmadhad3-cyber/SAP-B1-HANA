import apiClient from "./client";

export const fetchFinancialStatementLookups = () =>
  apiClient.get("/reports/financial-statements/lookups")
    .then((response) => response.data)
    .catch((error) => {
      if (error?.response?.status !== 404) throw error;
      return apiClient.get("/financial-statements/lookups").then((response) => response.data);
    });

export const fetchFinancialStatement = (reportKey, criteria) =>
  apiClient
    .post(`/reports/financial-statements/${reportKey}`, criteria)
    .then((response) => response.data)
    .catch((error) => {
      if (error?.response?.status !== 404) throw error;
      return apiClient.post(`/financial-statements/${reportKey}`, criteria).then((response) => response.data);
    });
