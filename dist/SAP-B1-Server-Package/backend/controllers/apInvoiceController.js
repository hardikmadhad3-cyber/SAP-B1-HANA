const apInvoiceService = require('../services/apInvoiceService');

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
    res.json(await apInvoiceService.getReferenceData(req.query.company_id));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load A/P Invoice reference data.'));
  }
};

const getVendorDetails = async (req, res) => {
  try {
    res.json(await apInvoiceService.getVendorDetails(req.params.vendorCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor details.'));
  }
};

const getVendorFilterOptions = async (req, res) => {
  try {
    res.json(await apInvoiceService.getVendorFilterOptions({
      query: req.query.query,
      vendorCode: req.query.vendorCode,
      vendorName: req.query.vendorName,
      top: parseTopParam(req.query.top),
      display: req.query.display,
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor filter options.'));
  }
};

const getAPInvoices = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? false
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    res.json(await apInvoiceService.getAPInvoiceList({
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
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load A/P Invoices.'));
  }
};

const getAPInvoiceByDocEntry = async (req, res) => {
  try {
    res.json(await apInvoiceService.getAPInvoice(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load A/P Invoice details.'));
  }
};

const submitAPInvoice = async (req, res) => {
  try {
    res.json(await apInvoiceService.submitAPInvoice(req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ...getErrorPayload(error, 'Failed to submit A/P Invoice.'),
      validation: error.validation || null,
    });
  }
};

const updateAPInvoice = async (req, res) => {
  try {
    res.json(await apInvoiceService.updateAPInvoice(req.params.docEntry, req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ...getErrorPayload(error, 'Failed to update A/P Invoice.'),
      validation: error.validation || null,
    });
  }
};

const getDocumentSeries = async (_req, res) => {
  try {
    res.json(await apInvoiceService.getDocumentSeries());
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    res.json(await apInvoiceService.getNextNumber(req.params.series));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get next number.'));
  }
};

const getStateFromWarehouse = async (req, res) => {
  try {
    res.json(await apInvoiceService.getStateFromWarehouse(req.params.whsCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from warehouse.'));
  }
};

const getOpenGRPO = async (req, res) => {
  try {
    res.json(await apInvoiceService.getOpenGRPO(req.query.vendorCode || req.query.vendor || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open GRPOs.'));
  }
};

const getGRPOForCopy = async (req, res) => {
  try {
    res.json(await apInvoiceService.getGRPOForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load GRPO.'));
  }
};

const getItemsForModal = async (req, res) => {
  try {
    res.json(await apInvoiceService.getItemsForModal());
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load items.'));
  }
};

const getFreightCharges = async (req, res) => {
  try {
    res.json(await apInvoiceService.getFreightCharges(req.query.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load freight charges.'));
  }
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getVendorFilterOptions,
  getAPInvoices,
  getAPInvoiceByDocEntry,
  submitAPInvoice,
  updateAPInvoice,
  getDocumentSeries,
  getNextNumber,
  getStateFromWarehouse,
  getOpenGRPO,
  getGRPOForCopy,
  getItemsForModal,
  getFreightCharges,
};
