const service = require("../../services/reports/inventoryAudit.service");

const sanitizeText = (value) => String(value || "").trim();

const sanitizeCodeArray = (values = []) => (
  Array.isArray(values)
    ? [...new Set(values.map(sanitizeText).filter(Boolean))].slice(0, 500)
    : []
);

const sanitizePropertyFilter = (value = {}) => ({
  ignoreProperties: value.ignoreProperties !== false,
  linkMode: value.linkMode === "or" ? "or" : "and",
  exactlyMatch: Boolean(value.exactlyMatch),
  selectedPropertyNumbers: Array.isArray(value.selectedPropertyNumbers)
    ? value.selectedPropertyNumbers
      .map(Number)
      .filter((number) => Number.isInteger(number) && number >= 1 && number <= 64)
    : [],
});

const sanitizeCriteria = (body = {}) => {
  const displayMode = body.displayMode === "byAccount" ? "byAccount" : "byItems";

  return {
    dateType: body.dateType === "posting" ? "posting" : "system",
    dateFrom: sanitizeText(body.dateFrom),
    dateTo: sanitizeText(body.dateTo),
    itemFrom: sanitizeText(body.itemFrom),
    itemTo: sanitizeText(body.itemTo),
    groupCode: sanitizeText(body.groupCode || "*") || "*",
    propertyFilter: sanitizePropertyFilter(body.propertyFilter),
    glAccountsEnabled: Boolean(body.glAccountsEnabled),
    selectedAccountCodes: sanitizeCodeArray(body.selectedAccountCodes),
    selectedWarehouseCodes: sanitizeCodeArray(body.selectedWarehouseCodes),
    displayMode,
    groupByWarehouses: displayMode === "byItems" && Boolean(body.groupByWarehouses),
    displayOpeningBalances: Boolean(body.displayOpeningBalances),
    hideItemsWithCumulativeQuantityZero: displayMode === "byItems" && Boolean(body.hideItemsWithCumulativeQuantityZero),
    hideSerialBatchForNonSerialBatch: Boolean(body.hideSerialBatchForNonSerialBatch),
  };
};

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Could not load Inventory Audit report.";

const getLookups = async (_req, res) => {
  try {
    res.json(await service.getLookups());
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const postReport = async (req, res) => {
  try {
    res.json(await service.getReport(sanitizeCriteria(req.body || {})));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  getLookups,
  postReport,
};
