const service = require("../../services/reports/vendorLiabilitiesAging.service");

const text = (value) => String(value || "").trim();
const sanitizePropertyFilter = (value = {}) => ({
  ignoreProperties: value.ignoreProperties !== false,
  linkMode: value.linkMode === "or" ? "or" : "and",
  exactlyMatch: Boolean(value.exactlyMatch),
  selectedPropertyNumbers: Array.isArray(value.selectedPropertyNumbers)
    ? value.selectedPropertyNumbers.map(Number).filter((number) => Number.isInteger(number) && number >= 1 && number <= 64)
    : [],
});

const sanitizeCriteria = (body = {}) => ({
  groupBy: body.groupBy === "buyer" ? "buyer" : "vendor",
  codeFrom: text(body.codeFrom),
  codeTo: text(body.codeTo),
  vendorGroup: text(body.vendorGroup || "All") || "All",
  propertyFilter: sanitizePropertyFilter(body.propertyFilter),
  controlAccountsEnabled: Boolean(body.controlAccountsEnabled),
  selectedAccountCodes: Array.isArray(body.selectedAccountCodes) ? body.selectedAccountCodes.map(text).filter(Boolean) : [],
  agingDate: text(body.agingDate),
  ageBy: ["posting", "document"].includes(body.ageBy) ? body.ageBy : "due",
  intervals: Array.isArray(body.intervals) ? body.intervals.slice(0, 4).map(Number) : [30, 60, 90, 120],
  postingDateFrom: text(body.postingDateFrom),
  postingDateTo: text(body.postingDateTo),
  dueDateFrom: text(body.dueDateFrom),
  dueDateTo: text(body.dueDateTo),
  documentDateFrom: text(body.documentDateFrom),
  documentDateTo: text(body.documentDateTo),
  displayCurrency: ["system", "foreign", "businessPartner"].includes(body.displayCurrency) ? body.displayCurrency : "local",
  displayZeroBalance: Boolean(body.displayZeroBalance),
  displayReconciled: Boolean(body.displayReconciled),
  ignoreFutureRemit: body.ignoreFutureRemit !== false,
  considerConnectedCustomers: Boolean(body.considerConnectedCustomers),
});

const errorMessage = (error) => error?.message || "Could not load Vendor Liabilities Aging report.";

const getLookups = async (_req, res) => {
  try {
    res.json(await service.getLookups());
  } catch (error) {
    res.status(error.status || 500).json({ message: errorMessage(error) });
  }
};

const postReport = async (req, res) => {
  try {
    res.json(await service.getReport(sanitizeCriteria(req.body || {})));
  } catch (error) {
    res.status(error.status || 500).json({ message: errorMessage(error) });
  }
};

module.exports = { getLookups, postReport };
