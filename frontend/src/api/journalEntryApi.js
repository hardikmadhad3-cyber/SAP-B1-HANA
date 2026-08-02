import apiClient from "./client";

const BASE = "/journal-entry";

export const addJournalEntry = (payload) =>
  apiClient.post(BASE, payload).then((response) => response.data);

export const previewJournalEntryDocument = (payload) =>
  apiClient.post(`${BASE}/preview`, payload).then((response) => response.data);

export const fetchJournalEntryByTransId = (transId) =>
  apiClient.get(`${BASE}/${encodeURIComponent(transId)}`).then((response) => response.data);

export const fetchJournalEntryReferenceData = (postingDate = "") =>
  apiClient.get(`${BASE}/reference-data`, { params: { postingDate } }).then((response) => response.data);

export const fetchJournalRemarkTemplates = (query = "") =>
  apiClient.get(`${BASE}/remark-templates`, { params: { query } }).then((response) => response.data);
