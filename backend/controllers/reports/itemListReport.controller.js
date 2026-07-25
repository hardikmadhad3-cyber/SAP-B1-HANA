const itemListReportService = require("../../services/reports/itemListReport.service");

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Invalid item list selection criteria";

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

const sanitizeExpandedCriteria = (criteriaRows = []) => {
  if (!Array.isArray(criteriaRows)) return [];

  return criteriaRows.slice(0, 5).map((row) => ({
    field: String(row?.field || "").trim(),
    from: String(row?.from || "").trim(),
    to: String(row?.to || "").trim(),
  }));
};

const sanitizeItemListPayload = (payload = {}) => ({
  itemFrom: String(payload.itemFrom || "").trim(),
  itemTo: String(payload.itemTo || "").trim(),
  groupCode: String(payload.groupCode || "*").trim() || "*",
  hideNoStock: payload.hideNoStock !== false,
  expandedSelection: payload.expandedSelection !== false,
  propertyFilter: sanitizePropertyFilter(payload.propertyFilter),
  expandedCriteria: sanitizeExpandedCriteria(payload.expandedCriteria),
});

const postItemListReport = async (req, res) => {
  try {
    const criteria = sanitizeItemListPayload(req.body || {});
    const result = await itemListReportService.getItemListReport(criteria);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  postItemListReport,
};
