const service = require("../../services/reports/inventoryAging.service");

const sanitizeText = (value) => String(value || "").trim();

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

const sanitizeIntervals = (values = []) => (
  Array.isArray(values)
    ? values.slice(0, 12).map((row) => ({
      days: sanitizeText(row?.days),
      from: sanitizeText(row?.from),
      to: sanitizeText(row?.to),
    }))
    : []
);

const sanitizeCriteria = (body = {}) => ({
  reportDate: sanitizeText(body.reportDate),
  issueStrategy: body.issueStrategy === "fifo" ? "fifo" : "lifo",
  valuation: body.valuation === "current" ? "current" : "document",
  itemFrom: sanitizeText(body.itemFrom),
  itemTo: sanitizeText(body.itemTo),
  groupCode: sanitizeText(body.groupCode || "*") || "*",
  propertyFilter: sanitizePropertyFilter(body.propertyFilter),
  includeWarehouses: Boolean(body.includeWarehouses),
  includeWarehouseFrom: sanitizeText(body.includeWarehouseFrom),
  includeWarehouseTo: sanitizeText(body.includeWarehouseTo),
  excludeWarehouses: Boolean(body.excludeWarehouses),
  excludeWarehouseFrom: sanitizeText(body.excludeWarehouseFrom),
  excludeWarehouseTo: sanitizeText(body.excludeWarehouseTo),
  intervals: sanitizeIntervals(body.intervals),
});

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Could not load Inventory Aging report.";

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
