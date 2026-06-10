import apiClient from "./client";

const BASE = "/journal-entry";

export const addJournalEntry = (payload) =>
  apiClient.post(BASE, payload).then((response) => response.data);
