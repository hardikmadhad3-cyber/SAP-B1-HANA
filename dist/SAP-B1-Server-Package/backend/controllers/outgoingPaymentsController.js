const outgoingPaymentsService = require("../services/outgoingPaymentsService");

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
  createOutgoingPayment: handle(
    (req) => outgoingPaymentsService.createOutgoingPayment(req.body || {}),
    "Failed to create outgoing payment.",
  ),
  getReferenceData: handle(
    () => outgoingPaymentsService.getReferenceData(),
    "Failed to load outgoing payment reference data.",
  ),
  searchBusinessPartners: handle(
    (req) => outgoingPaymentsService.searchBusinessPartners(req.query.query || "", req.query.bpType || "Vendor"),
    "Failed to search business partners.",
  ),
  lookupControlAccounts: handle(
    (req) => outgoingPaymentsService.lookupControlAccounts(req.query.query || ""),
    "Failed to search control accounts.",
  ),
  lookupCashAccounts: handle(
    (req) => outgoingPaymentsService.lookupCashAccounts(req.query.query || ""),
    "Failed to search cash accounts.",
  ),
  searchOutgoingPayments: handle(
    (req) => outgoingPaymentsService.searchOutgoingPayments(req.query.query || ""),
    "Failed to search outgoing payments.",
  ),
  getOpenInvoices: handle(
    (req) => outgoingPaymentsService.getOpenInvoices(req.query.cardCode || "", req.query.branch || ""),
    "Failed to load open invoices.",
  ),
};
