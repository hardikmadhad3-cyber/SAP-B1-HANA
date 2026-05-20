import apiClient from "./client";

const BASE = "/branches";

export const createBranch  = (data)            => apiClient.post(`${BASE}/create`, data).then((r) => r.data);
export const getBranch     = (bplid)           => apiClient.get(`${BASE}/${encodeURIComponent(bplid)}`).then((r) => r.data);
export const updateBranch  = (bplid, data)     => apiClient.patch(`${BASE}/${encodeURIComponent(bplid)}`, data).then((r) => r.data);
export const searchBranches = (query = "", top = 50, skip = 0) =>
  apiClient.get(`${BASE}/search`, { params: { query, top, skip } }).then((r) => r.data);

export const fetchBranchWarehouses = (query = "", branchId = "") =>
  apiClient.get(`${BASE}/lookup/warehouses`, { params: { query, branchId } }).then((r) => r.data);
