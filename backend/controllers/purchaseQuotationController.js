const purchaseQuotationService = require('../services/purchaseQuotationService');

const getErrorPayload = (error, fallbackMessage) => ({
  detail:
    error.response?.data?.error?.message?.value ||
    error.response?.data?.error?.message ||
    error.response?.data ||
    error.message ||
    fallbackMessage,
});

const parseTopParam = (value) => {
  if (value == null || value === '') return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;

  return Math.floor(parsed);
};

const getReferenceData = async (req, res) => {
  try {
    const data = await purchaseQuotationService.getReferenceData(req.query.company_id);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load purchase quotation reference data.'));
  }
};

const getVendorDetails = async (req, res) => {
  try {
    const data = await purchaseQuotationService.getVendorDetails(req.params.vendorCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor details.'));
  }
};

const getVendorFilterOptions = async (req, res) => {
  try {
    const data = await purchaseQuotationService.getVendorFilterOptions({
      query: req.query.query,
      vendorCode: req.query.vendorCode,
      vendorName: req.query.vendorName,
      top: parseTopParam(req.query.top),
      display: req.query.display,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor filter options.'));
  }
};

const getPurchaseQuotations = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? false
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    const data = await purchaseQuotationService.getPurchaseQuotationList({
      query: req.query.query,
      openOnly,
      docNum: req.query.docNum,
      vendorCode: req.query.vendorCode,
      vendorName: req.query.vendorName,
      status: req.query.status,
      postingDateFrom: req.query.postingDateFrom,
      postingDateTo: req.query.postingDateTo,
      page,
      pageSize,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load purchase quotations.'));
  }
};

const getPurchaseQuotationByDocEntry = async (req, res) => {
  try {
    const data = await purchaseQuotationService.getPurchaseQuotation(req.params.docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load purchase quotation details.'));
  }
};

const submitPurchaseQuotation = async (req, res) => {
  try {
    const result = await purchaseQuotationService.submitPurchaseQuotation(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to submit purchase quotation.'));
  }
};

const updatePurchaseQuotation = async (req, res) => {
  try {
    const result = await purchaseQuotationService.updatePurchaseQuotation(req.params.docEntry, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to update purchase quotation.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await purchaseQuotationService.getDocumentSeries({
      branch: req.query.branch,
      targetDate: req.query.targetDate,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    const data = await purchaseQuotationService.getNextNumber(req.params.series);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get next number.'));
  }
};

const getStateFromAddress = async (req, res) => {
  try {
    const { vendorCode, addressCode } = req.params;
    const data = await purchaseQuotationService.getStateFromAddress(vendorCode, addressCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from address.'));
  }
};

const getStateFromWarehouse = async (req, res) => {
  try {
    const { whsCode } = req.params;
    const data = await purchaseQuotationService.getStateFromWarehouse(whsCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from warehouse.'));
  }
};

const getFreightCharges = async (req, res) => {
  try {
    res.json(await purchaseQuotationService.getFreightCharges(req.query.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load freight charges.'));
  }
};

module.exports = {
  getReferenceData,
  getPurchaseQuotations,
  getPurchaseQuotationByDocEntry,
  getVendorFilterOptions,
  getVendorDetails,
  submitPurchaseQuotation,
  updatePurchaseQuotation,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getStateFromWarehouse,
  getFreightCharges,
};
