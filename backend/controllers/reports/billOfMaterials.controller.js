const billOfMaterialsService = require("../../services/reports/billOfMaterials.service");

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Invalid Bill of Materials report selection criteria";

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

const sanitizePayload = (payload = {}) => ({
  itemFrom: String(payload.itemFrom || "").trim(),
  itemTo: String(payload.itemTo || "").trim(),
  groupCode: String(payload.groupCode || "All").trim() || "All",
  bomType: String(payload.bomType || "All").trim() || "All",
  propertyFilter: sanitizePropertyFilter(payload.propertyFilter),
});

const postBillOfMaterialsReport = async (req, res) => {
  try {
    const criteria = sanitizePayload(req.body || {});
    const result = await billOfMaterialsService.getBillOfMaterialsReport(criteria);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  postBillOfMaterialsReport,
};
