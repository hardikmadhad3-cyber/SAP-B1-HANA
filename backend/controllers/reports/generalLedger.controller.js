const generalLedgerService = require("../../services/reports/generalLedger.service");

const sanitizeCodes = (values = []) => [...new Set(
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean),
)];

const sanitizePropertyFilter = (value = {}) => ({
  ignoreProperties: value.ignoreProperties !== false,
  linkMode: value.linkMode === "or" ? "or" : "and",
  exactlyMatch: Boolean(value.exactlyMatch),
  selectedPropertyNumbers: (Array.isArray(value.selectedPropertyNumbers) ? value.selectedPropertyNumbers : [])
    .map(Number)
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= 64),
});

const sanitizeDateRange = (range = {}) => ({
  enabled: Boolean(range.enabled),
  from: String(range.from || "").trim(),
  to: String(range.to || "").trim(),
});

const sanitizeCriteria = (payload = {}) => ({
  includeBusinessPartners: payload.includeBusinessPartners !== false,
  includeAccounts: payload.includeAccounts !== false,
  bpCodeFrom: String(payload.bpCodeFrom || "").trim(),
  bpCodeTo: String(payload.bpCodeTo || "").trim(),
  customerGroup: String(payload.customerGroup || "All").trim() || "All",
  vendorGroup: String(payload.vendorGroup || "All").trim() || "All",
  propertyFilter: sanitizePropertyFilter(payload.propertyFilter),
  selectedAccountGroupMasks: (Array.isArray(payload.selectedAccountGroupMasks) ? payload.selectedAccountGroupMasks : [])
    .map(Number)
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= 5),
  controlAccountsOnly: Boolean(payload.controlAccountsOnly),
  selectedControlAccountCodes: sanitizeCodes(payload.selectedControlAccountCodes),
  openingBalanceForPeriod: payload.openingBalanceForPeriod !== false,
  hideZeroBalancedAccounts: Boolean(payload.hideZeroBalancedAccounts),
  displayCurrency: ["local", "system", "foreign"].includes(payload.displayCurrency) ? payload.displayCurrency : "local",
  dateRanges: {
    postingDate: sanitizeDateRange(payload.dateRanges?.postingDate),
    dueDate: sanitizeDateRange(payload.dateRanges?.dueDate),
    documentDate: sanitizeDateRange(payload.dateRanges?.documentDate),
  },
});

const getErrorMessage = (error) =>
  error?.response?.data?.error?.message?.value
  || error?.response?.data?.error?.message
  || error?.message
  || "Could not load General Ledger report.";

const getLookups = async (_req, res) => {
  try {
    res.json(await generalLedgerService.getLookups());
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const postReport = async (req, res) => {
  try {
    const criteria = sanitizeCriteria(req.body || {});
    if (!criteria.includeBusinessPartners && !criteria.includeAccounts) {
      res.status(400).json({ message: "Select Business Partner or Accounts to run the report." });
      return;
    }
    res.json(await generalLedgerService.getReport(criteria));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  getLookups,
  postReport,
};
