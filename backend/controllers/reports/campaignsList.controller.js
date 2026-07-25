const campaignsListService = require("../../services/reports/campaignsList.service");

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Could not load Campaigns List report.";

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

const sanitizeDocumentTypes = (documents = {}) => ({
  opportunities: Boolean(documents.opportunities),
  quotations: Boolean(documents.quotations),
  orders: Boolean(documents.orders),
  deliveries: Boolean(documents.deliveries),
  arInvoices: Boolean(documents.arInvoices),
  withoutLinkedDocument: Boolean(documents.withoutLinkedDocument),
});

const sanitizePayload = (payload = {}) => ({
  itemCodeFrom: String(payload.itemCodeFrom || "").trim(),
  itemCodeTo: String(payload.itemCodeTo || "").trim(),
  itemGroup: String(payload.itemGroup || "All").trim() || "All",
  itemPropertyFilter: sanitizePropertyFilter(payload.itemPropertyFilter),
  targetGroupType: payload.targetGroupType === "vendor" ? "vendor" : "customer",
  bpCodeFrom: String(payload.bpCodeFrom || "").trim(),
  bpCodeTo: String(payload.bpCodeTo || "").trim(),
  bpGroup: String(payload.bpGroup || "All").trim() || "All",
  bpPropertyFilter: sanitizePropertyFilter(payload.bpPropertyFilter),
  campaignNoFrom: String(payload.campaignNoFrom || "").trim(),
  campaignNoTo: String(payload.campaignNoTo || "").trim(),
  campaignType: String(payload.campaignType || "All").trim() || "All",
  owner: String(payload.owner || "All").trim() || "All",
  status: String(payload.status || "All").trim() || "All",
  targetGroup: String(payload.targetGroup || "All").trim() || "All",
  responseTypeEnabled: Boolean(payload.responseTypeEnabled),
  responseTypes: Array.isArray(payload.responseTypes)
    ? payload.responseTypes.map((value) => String(value || "").trim()).filter(Boolean)
    : [],
  documentsEnabled: Boolean(payload.documentsEnabled),
  documents: sanitizeDocumentTypes(payload.documents),
  startDateFrom: String(payload.startDateFrom || "").trim(),
  startDateTo: String(payload.startDateTo || "").trim(),
  endDateFrom: String(payload.endDateFrom || "").trim(),
  endDateTo: String(payload.endDateTo || "").trim(),
});

const getLookups = async (_req, res) => {
  try {
    res.json(await campaignsListService.getLookups());
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const postCampaignsListReport = async (req, res) => {
  try {
    const criteria = sanitizePayload(req.body || {});
    res.json(await campaignsListService.getReport(criteria));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  getLookups,
  postCampaignsListReport,
};
