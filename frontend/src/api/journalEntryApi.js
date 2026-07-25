import apiClient from "./client";

const BASE = "/journal-entry";

export const addJournalEntry = (payload) =>
  apiClient.post(BASE, payload).then((response) => response.data);

export const fetchJournalEntryByTransId = (transId) =>
  apiClient.get(`${BASE}/${encodeURIComponent(transId)}`).then((response) => response.data);
