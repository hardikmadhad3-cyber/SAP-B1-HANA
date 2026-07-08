const productionOpenItemsService = require("../../services/reports/productionOpenItems.service");

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Could not load production open items";

const sanitizePayload = (payload = {}) => ({
  status: String(payload.status || "open").trim(),
  query: String(payload.query || "").trim(),
});

const postProductionOpenItemsReport = async (req, res) => {
  try {
    const criteria = sanitizePayload(req.body || {});
    const result = await productionOpenItemsService.getProductionOpenItemsReport(criteria);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  postProductionOpenItemsReport,
};
