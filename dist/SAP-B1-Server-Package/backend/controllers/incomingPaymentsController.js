const incomingPaymentsService = require("../services/incomingPaymentsService");

const getErrorPayload = (error, fallbackMessage) => ({
  detail: error.response?.data || error.message || fallbackMessage,
});

const handle = (fn, fallbackMessage) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, fallbackMessage));
  }
};

module.exports = {
  createIncomingPayment: handle(
    (req) => incomingPaymentsService.createIncomingPayment(req.body || {}),
    "Failed to create incoming payment.",
  ),
  getReferenceData: handle(
    () => incomingPaymentsService.getReferenceData(),
    "Failed to load incoming payment reference data.",
  ),
  searchBusinessPartners: handle(
    (req) => incomingPaymentsService.searchBusinessPartners(req.query.query || "", req.query.bpType || "Customer"),
    "Failed to search business partners.",
  ),
  lookupControlAccounts: handle(
    (req) => incomingPaymentsService.lookupControlAccounts(req.query.query || ""),
    "Failed to search control accounts.",
  ),
  lookupCashAccounts: handle(
    (req) => incomingPaymentsService.lookupCashAccounts(req.query.query || ""),
    "Failed to search cash accounts.",
  ),
  searchIncomingPayments: handle(
    (req) => incomingPaymentsService.searchIncomingPayments(req.query.query || ""),
    "Failed to search incoming payments.",
  ),
  getOpenInvoices: handle(
    (req) => incomingPaymentsService.getOpenInvoices(req.query.cardCode || "", req.query.branch || ""),
    "Failed to load open invoices.",
  ),
};
