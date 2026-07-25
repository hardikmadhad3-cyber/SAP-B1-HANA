const { sanitizePurchaseAnalysisPayload } = require("../../validators/reports/purchaseAnalysis.validator");
const purchaseAnalysisService = require("../../services/reports/purchaseAnalysis.service");

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Invalid selection criteria";

const runLookup = (lookupFn, optionMapper = (row) => row) => async (req, res) => {
  try {
    const rows = await lookupFn(req.query.query || "", req.query.includeInactive === "true");
    res.json((rows || []).map(optionMapper));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const postPurchaseAnalysis = async (req, res) => {
  try {
    const criteria = sanitizePurchaseAnalysisPayload(req.body || {});
    const result = await purchaseAnalysisService.getPurchaseAnalysis(criteria);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  postPurchaseAnalysis,
  lookupVendors: runLookup(purchaseAnalysisService.lookupVendors),
  lookupItems: runLookup(purchaseAnalysisService.lookupItems),
  lookupPurchasingEmployees: runLookup(purchaseAnalysisService.lookupPurchasingEmployees),
  lookupVendorGroups: runLookup(purchaseAnalysisService.lookupVendorGroups),
  lookupItemGroups: runLookup(purchaseAnalysisService.lookupItemGroups),
  lookupVendorProperties: runLookup(purchaseAnalysisService.lookupVendorProperties),
  lookupItemProperties: runLookup(purchaseAnalysisService.lookupItemProperties),
};
