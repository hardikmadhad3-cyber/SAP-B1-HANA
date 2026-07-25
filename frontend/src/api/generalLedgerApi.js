import apiClient from "./client";

const BASE = "/reports/general-ledger";

export const fetchGeneralLedgerLookups = () =>
  apiClient.get(`${BASE}/lookups`).then((response) => response.data);

export const fetchGeneralLedgerReport = (criteria) =>
  apiClient.post(BASE, criteria).then((response) => response.data);
