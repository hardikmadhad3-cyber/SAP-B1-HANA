import apiClient from "../api/client";

export const runPurchaseAnalysis = (payload) =>
  apiClient.post("/reports/purchase-analysis", payload).then((response) => response.data);

export const fetchPurchaseAnalysisVendors = (query = "") =>
  apiClient.get("/lookups/purchase-vendors", { params: { query } }).then((response) => response.data);

export const fetchPurchaseAnalysisItems = (query = "") =>
  apiClient.get("/lookups/purchase-items", { params: { query } }).then((response) => response.data);

export const fetchPurchaseAnalysisPurchasingEmployees = (query = "", includeInactive = false) =>
  apiClient.get("/lookups/purchasing-employees", { params: { query, includeInactive } }).then((response) => response.data);

export const fetchPurchaseAnalysisVendorGroups = () =>
  apiClient.get("/lookups/purchase-vendor-groups").then((response) => response.data);

export const fetchPurchaseAnalysisItemGroups = () =>
  apiClient.get("/lookups/purchase-item-groups").then((response) => response.data);

export const fetchPurchaseAnalysisVendorProperties = () =>
  apiClient.get("/lookups/purchase-vendor-properties").then((response) => response.data);

export const fetchPurchaseAnalysisItemProperties = () =>
  apiClient.get("/lookups/purchase-item-properties").then((response) => response.data);
