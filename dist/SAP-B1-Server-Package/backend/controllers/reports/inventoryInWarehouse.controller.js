const service = require("../../services/reports/inventoryInWarehouse.service");

const text = (value) => String(value || "").trim();

const sanitizePropertyFilter = (value = {}) => ({
  ignoreProperties: value.ignoreProperties !== false,
  linkMode: value.linkMode === "or" ? "or" : "and",
  exactlyMatch: Boolean(value.exactlyMatch),
  selectedPropertyNumbers: Array.isArray(value.selectedPropertyNumbers)
    ? value.selectedPropertyNumbers.map(Number).filter((number) => Number.isInteger(number) && number >= 1 && number <= 64)
    : [],
});

const sanitize = (body = {}) => ({
  itemFrom: text(body.itemFrom),
  itemTo: text(body.itemTo),
  vendorFrom: text(body.vendorFrom),
  vendorTo: text(body.vendorTo),
  groupCode: text(body.groupCode) || "*",
  hideNoStock: Boolean(body.hideNoStock),
  selectionMode: body.selectionMode === "location" ? "location" : "warehouse",
  selectedLocationCodes: Array.isArray(body.selectedLocationCodes) ? body.selectedLocationCodes.map(text).filter(Boolean) : [],
  includeWarehouses: body.includeWarehouses !== false,
  includeWarehouseFrom: text(body.includeWarehouseFrom),
  includeWarehouseTo: text(body.includeWarehouseTo),
  excludeWarehouses: Boolean(body.excludeWarehouses),
  excludeWarehouseFrom: text(body.excludeWarehouseFrom),
  excludeWarehouseTo: text(body.excludeWarehouseTo),
  displayMode: body.displayMode === "detailed" ? "detailed" : "normal",
  priceSource: text(body.priceSource) || "lastPurchase",
  propertyFilter: sanitizePropertyFilter(body.propertyFilter),
});

const getLookups = async (_req, res) => {
  try {
    res.json(await service.getLookups());
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || "Could not load report lookups." });
  }
};

const postReport = async (req, res) => {
  try {
    res.json(await service.getReport(sanitize(req.body)));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || "Could not load Inventory in Warehouse report." });
  }
};

module.exports = { getLookups, postReport };
