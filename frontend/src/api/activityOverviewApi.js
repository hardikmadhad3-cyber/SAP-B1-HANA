import apiClient from "./client";

export const fetchActivityOverviewLookups = () =>
  apiClient.get("/reports/activity-overview/lookups").then((response) => response.data);

export const runActivityOverviewReport = (payload) =>
  apiClient.post("/reports/activity-overview", payload).then((response) => response.data);

export const fetchActivityOverviewUsers = (query = "") =>
  apiClient.get("/reports/activity-overview/users", { params: { query } }).then((response) => response.data);

export const fetchActivityOverviewEmployees = (query = "") =>
  apiClient.get("/reports/activity-overview/employees", { params: { query } }).then((response) => response.data);

export const fetchActivityOverviewRecipientLists = (query = "") =>
  apiClient.get("/reports/activity-overview/recipient-lists", { params: { query } }).then((response) => response.data);

export const fetchActivityOverviewUserDefinedFields = (query = "") =>
  apiClient.get("/reports/activity-overview/user-defined-fields", { params: { query } }).then((response) => response.data);

export const fetchActivityByNumber = (activityNo) =>
  apiClient.get(`/reports/activity-overview/activity/${encodeURIComponent(activityNo)}`).then((response) => response.data);
