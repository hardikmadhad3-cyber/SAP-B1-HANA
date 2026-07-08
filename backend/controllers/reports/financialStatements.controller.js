const financialStatementsService = require("../../services/reports/financialStatements.service");

const ALLOWED_REPORTS = new Set([
  "balance-sheet",
  "trial-balance",
  "profit-and-loss-statement",
  "cash-flow",
  "cash-flow-reference-report",
  "statement-of-cash-flows",
  "business-assessment-report",
]);

const sanitizeCriteria = (payload = {}) => ({
  dateFrom: String(payload.dateFrom || "").trim(),
  dateTo: String(payload.dateTo || "").trim(),
  fiscalYearFrom: String(payload.fiscalYearFrom || payload.dateFrom || "").trim(),
  displayCurrency: ["local", "system", "foreign", "localAndSystem"].includes(payload.displayCurrency)
    ? payload.displayCurrency
    : "local",
  includeZeroBalance: Boolean(payload.includeZeroBalance),
  hideZeroBalance: payload.hideZeroBalance !== false,
  hideNoPostings: payload.hideNoPostings !== false,
  includeBusinessPartners: payload.includeBusinessPartners !== false,
  includeGlAccounts: payload.includeGlAccounts !== false,
  bpFrom: String(payload.bpFrom || "").trim(),
  bpTo: String(payload.bpTo || "").trim(),
  customerGroup: String(payload.customerGroup || "All").trim(),
  vendorGroup: String(payload.vendorGroup || "All").trim(),
  selectedAccountGroups: Array.isArray(payload.selectedAccountGroups)
    ? payload.selectedAccountGroups.map(Number).filter((value) => value >= 1 && value <= 5)
    : [1, 2, 3, 4, 5],
  propertyFilter: payload.propertyFilter && typeof payload.propertyFilter === "object"
    ? payload.propertyFilter
    : {},
  expanded: payload.expanded !== false,
  dateType: ["postingDate", "dueDate", "documentDate"].includes(payload.dateType)
    ? payload.dateType
    : "postingDate",
  actualDateType: ["postingDate", "dueDate", "documentDate"].includes(payload.actualDateType)
    ? payload.actualDateType
    : "postingDate",
  previousDateType: ["postingDate", "dueDate", "documentDate"].includes(payload.previousDateType)
    ? payload.previousDateType
    : "postingDate",
  includePreviousPeriod: Boolean(payload.includePreviousPeriod),
  previousDateFrom: String(payload.previousDateFrom || "").trim(),
  previousDateTo: String(payload.previousDateTo || "").trim(),
  templateCode: String(payload.templateCode || "").trim(),
  periodCode: String(payload.periodCode || "").trim(),
  hideGlAccounts: Boolean(payload.hideGlAccounts),
  periodType: ["annual", "quarterly", "monthly"].includes(payload.periodType)
    ? payload.periodType
    : "annual",
  reportMode: ["budgetComparison", "monthlyComparison", "yearlyComparison"].includes(payload.reportMode)
    ? payload.reportMode
    : "budgetComparison",
  printMode: ["monthly", "medium", "yearEnd"].includes(payload.printMode)
    ? payload.printMode
    : "monthly",
  displaySubtotals: payload.displaySubtotals !== false,
  hideTitles: Boolean(payload.hideTitles),
  displayLevel: Number.isFinite(Number(payload.displayLevel))
    ? Math.min(10, Math.max(1, Number(payload.displayLevel)))
    : 10,
  timeInterval: ["daily", "weekly", "monthly", "quarterly", "semiAnnual", "annual"].includes(payload.timeInterval)
    ? payload.timeInterval
    : "weekly",
  addRecurringPostings: payload.addRecurringPostings !== false,
  addJournalVouchers: payload.addJournalVouchers !== false,
  considerDelaysInPayments: Boolean(payload.considerDelaysInPayments),
  displayFullyReconciledPostings: Boolean(payload.displayFullyReconciledPostings),
  addBlanketAgreements: Boolean(payload.addBlanketAgreements),
  addMarketingDocuments: payload.addMarketingDocuments !== false,
  addDocumentDrafts: Boolean(payload.addDocumentDrafts),
  addRecurringTransactions: Boolean(payload.addRecurringTransactions),
  openingBalanceMode: payload.openingBalanceMode === "calculate" ? "calculate" : "opening",
  cashFlowChecks: payload.cashFlowChecks && typeof payload.cashFlowChecks === "object"
    ? payload.cashFlowChecks
    : {},
  cashFlowDocumentTypes: payload.cashFlowDocumentTypes && typeof payload.cashFlowDocumentTypes === "object"
    ? payload.cashFlowDocumentTypes
    : {},
  cashFlowReferenceMode: ["unassigned", "all"].includes(payload.cashFlowReferenceMode)
    ? payload.cashFlowReferenceMode
    : "unassigned",
  selectedCashAccounts: Array.isArray(payload.selectedCashAccounts)
    ? payload.selectedCashAccounts.map((value) => String(value || "").trim()).filter(Boolean)
    : [],
  projectFrom: String(payload.projectFrom || "").trim(),
  projectTo: String(payload.projectTo || "").trim(),
  blanketAgreementFrom: String(payload.blanketAgreementFrom || "").trim(),
  blanketAgreementTo: String(payload.blanketAgreementTo || "").trim(),
  projectedPostings: Array.isArray(payload.projectedPostings) ? payload.projectedPostings : [],
  revaluationEnabled: Boolean(payload.revaluationEnabled),
  revaluation: payload.revaluation && typeof payload.revaluation === "object"
    ? payload.revaluation
    : {},
  foreignName: Boolean(payload.foreignName),
  externalCode: Boolean(payload.externalCode),
  referenceFilters: Array.isArray(payload.referenceFilters) ? payload.referenceFilters : [],
  udfFilters: Array.isArray(payload.udfFilters) ? payload.udfFilters : [],
});

const getLookups = async (_req, res) => {
  try {
    res.json(await financialStatementsService.getLookups());
  } catch (error) {
    res.status(error.status || 500).json({
      message: error?.message || "Could not load financial statement lookups.",
    });
  }
};

const postReport = async (req, res) => {
  try {
    const reportKey = String(req.params.reportKey || "").trim();
    if (!ALLOWED_REPORTS.has(reportKey)) {
      res.status(404).json({ message: "This financial statement is not configured." });
      return;
    }

    const criteria = sanitizeCriteria(req.body || {});
    if (!criteria.dateFrom || !criteria.dateTo) {
      res.status(400).json({ message: "Select the report date range." });
      return;
    }

    res.json(await financialStatementsService.getReport(reportKey, criteria));
  } catch (error) {
    res.status(error.status || 500).json({
      message: error?.message || "Could not load financial statement.",
    });
  }
};

module.exports = { getLookups, postReport };
