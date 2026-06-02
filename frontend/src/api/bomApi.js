import apiClient from "./client";

export const listBOMs  = (query = "", top = 50, skip = 0) =>
  apiClient.get("/bom", { params: { query, top, skip } }).then((r) => r.data);

export const getBOM    = (treeCode) =>
  apiClient.get(`/bom/${encodeURIComponent(treeCode)}`).then((r) => r.data);

export const createBOM = (data) =>
  apiClient.post("/bom", data).then((r) => r.data);

export const updateBOM = (treeCode, data) =>
  apiClient.patch(`/bom/${encodeURIComponent(treeCode)}`, data).then((r) => r.data);

export const deleteBOM = (treeCode) =>
  apiClient.delete(`/bom/${encodeURIComponent(treeCode)}`).then((r) => r.data);

// Lookups
export const fetchBOMItems             = (query = "", top = 5000, skip = 0) =>
  apiClient.get("/bom/lookup/items", { params: { query, top, skip, _: Date.now() } }).then((r) => r.data);

export const fetchBOMList              = (query = "") =>
  apiClient.get("/bom", { params: { query, top: 100 } }).then((r) => r.data);

export const fetchBOMWarehouses        = () =>
  apiClient.get("/bom/lookup/warehouses", { params: { _: Date.now() } }).then((r) => r.data);

export const fetchBOMPriceLists        = () =>
  apiClient.get("/bom/lookup/price-lists", { params: { _: Date.now() } }).then((r) => r.data);

export const fetchBOMDistributionRules = () =>
  apiClient.get("/bom/lookup/distribution-rules", { params: { _: Date.now() } }).then((r) => r.data);

export const fetchBOMProjects          = () =>
  apiClient.get("/bom/lookup/projects", { params: { _: Date.now() } }).then((r) => r.data);

export const fetchBOMGLAccounts        = (query = "") =>
  apiClient.get("/bom/lookup/gl-accounts", { params: { query, _: Date.now() } }).then((r) => r.data);

export const getItemDetails = (itemCode) =>
  apiClient.get(`/bom/lookup/item-details/${encodeURIComponent(itemCode)}`, { params: { _: Date.now() } }).then((r) => r.data);
