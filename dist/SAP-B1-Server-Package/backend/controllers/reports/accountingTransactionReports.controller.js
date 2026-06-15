const service = require("../../services/reports/accountingTransactionReports.service");

const cleanText = (value) => String(value || "").trim();
const sanitizeCriteria = (payload = {}) => ({
  postingDateFrom: cleanText(payload.postingDateFrom),
  postingDateTo: cleanText(payload.postingDateTo),
  dueDateFrom: cleanText(payload.dueDateFrom),
  dueDateTo: cleanText(payload.dueDateTo),
  documentDateFrom: cleanText(payload.documentDateFrom),
  documentDateTo: cleanText(payload.documentDateTo),
  transactionFrom: cleanText(payload.transactionFrom),
  transactionTo: cleanText(payload.transactionTo),
  projectFrom: cleanText(payload.projectFrom),
  projectTo: cleanText(payload.projectTo),
  accountFrom: cleanText(payload.accountFrom),
  accountTo: cleanText(payload.accountTo),
  originalJournal: cleanText(payload.originalJournal || "all"),
  voucherNumber: Number(payload.voucherNumber || 0),
  displayCurrency: ["local", "system", "foreign"].includes(payload.displayCurrency)
    ? payload.displayCurrency
    : "local",
  seriesCodes: (Array.isArray(payload.seriesCodes) ? payload.seriesCodes : [])
    .map(Number)
    .filter(Number.isInteger),
});

const messageOf = (error) => error?.message || "Could not load accounting report.";

const getLookups = async (_req, res) => {
  try {
    res.json(await service.getLookups());
  } catch (error) {
    res.status(error.status || 500).json({ message: messageOf(error) });
  }
};

const postReport = async (req, res) => {
  try {
    res.json(await service.getReport(cleanText(req.params.reportKey), sanitizeCriteria(req.body)));
  } catch (error) {
    res.status(error.status || 500).json({ message: messageOf(error) });
  }
};

module.exports = { getLookups, postReport };
