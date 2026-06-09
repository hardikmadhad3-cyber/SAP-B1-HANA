const inventoryPostingListService = require("../../services/reports/inventoryPostingList.service");

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Invalid inventory posting list selection criteria";

const sanitizePropertyFilter = (propertyFilter = {}) => ({
  ignoreProperties: propertyFilter.ignoreProperties !== false,
  linkMode: propertyFilter.linkMode === "or" ? "or" : "and",
  exactlyMatch: Boolean(propertyFilter.exactlyMatch),
  selectedPropertyNumbers: Array.isArray(propertyFilter.selectedPropertyNumbers)
    ? propertyFilter.selectedPropertyNumbers
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64)
    : [],
});

const sanitizeText = (value) => String(value || "").trim();

const sanitizeCodeArray = (values = []) => (
  Array.isArray(values)
    ? [...new Set(values.map(sanitizeText).filter(Boolean))].slice(0, 250)
    : []
);

const sanitizeGeneralParameterRow = (row = {}) => ({
  enabled: Boolean(row.enabled),
  from: sanitizeText(row.from),
  to: sanitizeText(row.to),
});

const sanitizeExpandedPayload = (expanded = {}) => {
  const documentTypes = {};
  Object.keys(inventoryPostingListService.DOCUMENT_TYPES).forEach((key) => {
    documentTypes[key] = Boolean(expanded?.documentTypes?.[key]);
  });

  const generalParameters = {};
  [
    "reference",
    "reference2",
    "quantityReceived",
    "quantityReleased",
    "price",
    "dueDate",
    "salesEmployee",
    "detailsContained",
    "project",
    "blockNo",
    "importLog",
    "batch",
    "batchAttribute1",
    "batchAttribute2",
    "serialNumber",
    "mfrSerialNo",
    "lotNumber",
    "itemCode",
    "bpCode",
    "routeStage",
    "routeSequence",
  ].forEach((key) => {
    generalParameters[key] = sanitizeGeneralParameterRow(expanded?.generalParameters?.[key]);
  });

  return {
    documentTypes,
    generalParameters,
  };
};

const sanitizeInventoryPostingPayload = (payload = {}) => ({
  itemFrom: sanitizeText(payload.itemFrom),
  itemTo: sanitizeText(payload.itemTo),
  groupCode: sanitizeText(payload.groupCode || "*") || "*",
  hideNoStock: Boolean(payload.hideNoStock),
  dateEnabled: payload.dateEnabled !== false,
  dateFrom: sanitizeText(payload.dateFrom),
  dateTo: sanitizeText(payload.dateTo),
  hideTransWithoutQtyChange: Boolean(payload.hideTransWithoutQtyChange),
  sort: Boolean(payload.sort),
  splitByBatchSerial: Boolean(payload.splitByBatchSerial),
  printSeparatePage: Boolean(payload.printSeparatePage),
  printDirectly: Boolean(payload.printDirectly),
  propertyFilter: sanitizePropertyFilter(payload.propertyFilter),
  locationSelection: {
    mode: payload.locationSelection?.mode === "warehouse" ? "warehouse" : "location",
    locationCodes: sanitizeCodeArray(payload.locationSelection?.locationCodes),
    warehouseCodes: sanitizeCodeArray(payload.locationSelection?.warehouseCodes),
  },
  warehouseSelection: {
    mode: payload.warehouseSelection?.mode === "warehouse" ? "warehouse" : "location",
    includeEnabled: Boolean(payload.warehouseSelection?.includeEnabled),
    includeFrom: sanitizeText(payload.warehouseSelection?.includeFrom),
    includeTo: sanitizeText(payload.warehouseSelection?.includeTo),
    excludeEnabled: Boolean(payload.warehouseSelection?.excludeEnabled),
    excludeFrom: sanitizeText(payload.warehouseSelection?.excludeFrom),
    excludeTo: sanitizeText(payload.warehouseSelection?.excludeTo),
  },
  expanded: sanitizeExpandedPayload(payload.expanded),
});

const postInventoryPostingList = async (req, res) => {
  try {
    const criteria = sanitizeInventoryPostingPayload(req.body || {});
    const result = await inventoryPostingListService.getInventoryPostingList(criteria);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  postInventoryPostingList,
};
