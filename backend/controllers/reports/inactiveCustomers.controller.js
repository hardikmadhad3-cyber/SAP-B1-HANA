const service = require("../../services/reports/inactiveCustomers.service");

const text = (value) => String(value || "").trim();

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

const sanitizeDocumentTypes = (value = {}) => ({
  salesQuotations: value.salesQuotations !== false,
  orders: value.orders !== false,
  deliveryNotes: value.deliveryNotes !== false,
  arInvoices: value.arInvoices !== false,
});

const sanitizeCriteria = (body = {}) => ({
  codeFrom: text(body.codeFrom),
  codeTo: text(body.codeTo),
  dateFrom: text(body.dateFrom),
  customerGroup: text(body.customerGroup || "All") || "All",
  propertyFilter: sanitizePropertyFilter(body.propertyFilter),
  documentTypes: sanitizeDocumentTypes(body.documentTypes),
});

const getLookups = async (_req, res) => {
  try {
    res.json(await service.getLookups());
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Could not load Inactive Customers lookups.",
    });
  }
};

const postReport = async (req, res) => {
  try {
    res.json(await service.getReport(sanitizeCriteria(req.body || {})));
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Could not load Inactive Customers report.",
    });
  }
};

module.exports = { getLookups, postReport };
