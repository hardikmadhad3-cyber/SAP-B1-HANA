const glAccountsBusinessPartnersService = require("../../services/reports/glAccountsBusinessPartners.service");

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Invalid G/L Accounts and Business Partners selection criteria";

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

const sanitizeAccountGroupMasks = (values = []) => {
  const normalized = Array.isArray(values)
    ? values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5)
    : [];

  return [...new Set(normalized)].sort((left, right) => left - right);
};

const sanitizeReportPayload = (payload = {}) => ({
  includeBusinessPartners: payload.includeBusinessPartners !== false,
  displayLeads: Boolean(payload.displayLeads),
  includeGlAccounts: payload.includeGlAccounts !== false,
  bpCodeFrom: String(payload.bpCodeFrom || "").trim(),
  bpCodeTo: String(payload.bpCodeTo || "").trim(),
  customerGroup: String(payload.customerGroup || "All").trim() || "All",
  vendorGroup: String(payload.vendorGroup || "All").trim() || "All",
  propertyFilter: sanitizePropertyFilter(payload.propertyFilter),
  selectedAccountGroupMasks: sanitizeAccountGroupMasks(payload.selectedAccountGroupMasks),
});

const getLookups = async (_req, res) => {
  try {
    const data = await glAccountsBusinessPartnersService.getLookups();
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const postReport = async (req, res) => {
  try {
    const criteria = sanitizeReportPayload(req.body || {});
    if (!criteria.includeBusinessPartners && !criteria.includeGlAccounts) {
      res.status(400).json({ message: "Select BP or G/L Accounts to run the report." });
      return;
    }

    const result = await glAccountsBusinessPartnersService.getReport(criteria);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const lookupBusinessPartners = async (req, res) => {
  try {
    const data = await glAccountsBusinessPartnersService.lookupBusinessPartners(req.query.query || "");
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  getLookups,
  postReport,
  lookupBusinessPartners,
};
