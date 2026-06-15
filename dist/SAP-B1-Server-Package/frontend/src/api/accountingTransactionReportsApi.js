import apiClient from "./client";

const BASE = "/reports/accounting-transactions";

export const fetchAccountingTransactionLookups = () =>
  apiClient.get(`${BASE}/lookups`).then((response) => response.data);

export const fetchAccountingTransactionReport = (reportKey, criteria) =>
  apiClient.post(`${BASE}/${reportKey}`, criteria).then((response) => response.data);
