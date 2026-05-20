export const getWarehouseBranchId = (warehouse = {}) =>
  warehouse.BranchID ??
  warehouse.BPLId ??
  warehouse.BPLID ??
  warehouse.Branch ??
  warehouse.branchId ??
  "";

export const filterWarehousesByBranch = (warehouses = [], branchId = "") => {
  const normalizedBranchId = String(branchId || "").trim();
  if (!normalizedBranchId) return warehouses;

  return warehouses.filter((warehouse) => {
    const warehouseBranchId = String(getWarehouseBranchId(warehouse) || "").trim();
    return !warehouseBranchId || warehouseBranchId === normalizedBranchId;
  });
};
