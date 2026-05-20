const salesQuotationService = require('../services/salesQuotationService');

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
    const data = await salesQuotationService.getReferenceData(req.query.company_id);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load sales quotation reference data.'));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    const data = await salesQuotationService.getCustomerDetails(req.params.customerCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer details.'));
  }
};

const getCustomerFilterOptions = async (req, res) => {
  try {
    const data = await salesQuotationService.getCustomerFilterOptions({
      query: req.query.query,
      customerCode: req.query.customerCode,
      customerName: req.query.customerName,
      top: parseTopParam(req.query.top),
      display: req.query.display,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer filter options.'));
  }
};

const getSalesQuotationList = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? false
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    const data = await salesQuotationService.getSalesQuotationList({
      query: req.query.query,
      openOnly,
      docNum: req.query.docNum,
      customerCode: req.query.customerCode,
      customerName: req.query.customerName,
      sellerCode: req.query.sellerCode,
      sellerName: req.query.sellerName,
      status: req.query.status,
      postingDateFrom: req.query.postingDateFrom,
      postingDateTo: req.query.postingDateTo,
      page,
      pageSize,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load sales quotations.'));
  }
};

const getSalesQuotation = async (req, res) => {
  try {
    const data = await salesQuotationService.getSalesQuotation(req.params.docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load sales quotation details.'));
  }
};

const submitSalesQuotation = async (req, res) => {
  try {
    const result = await salesQuotationService.submitSalesQuotation(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to submit sales quotation.'));
  }
};

const updateSalesQuotation = async (req, res) => {
  try {
    const result = await salesQuotationService.updateSalesQuotation(req.params.docEntry, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to update sales quotation.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await salesQuotationService.getDocumentSeries(req.query.date);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    const data = await salesQuotationService.getNextNumber(req.query.series);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get next number.'));
  }
};

const getStateFromAddress = async (req, res) => {
  try {
    const { cardCode, addressCode } = req.query;
    const data = await salesQuotationService.getStateFromAddress(cardCode, addressCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from address.'));
  }
};

const getItemsForModal = async (req, res) => {
  try {
    const data = await salesQuotationService.getItemsForModal();
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load items.'));
  }
};

const getFreightCharges = async (req, res) => {
  try {
    const { docEntry } = req.query;
    const data = await salesQuotationService.getFreightCharges(docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load freight charges.'));
  }
};

const getOpenSalesQuotations = async (req, res) => {
  try {
    const data = await salesQuotationService.getOpenSalesQuotations();
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open sales quotations.'));
  }
};

const getSalesQuotationForCopy = async (req, res) => {
  try {
    const data = await salesQuotationService.getSalesQuotationForCopy(req.params.docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load sales quotation for copy.'));
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getSalesQuotationList,
  getSalesQuotation,
  submitSalesQuotation,
  updateSalesQuotation,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getItemsForModal,
  getFreightCharges,
  getOpenSalesQuotations,
  getSalesQuotationForCopy,
};
