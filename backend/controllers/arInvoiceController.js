const arInvoiceService = require('../services/arInvoiceService');

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

const handle = (fn, msg) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (e) { res.status(500).json(getErrorPayload(e, msg)); }
};

const getReferenceData = async (req, res) => {
  try {
    const data = await arInvoiceService.getReferenceData(req.query.company_id);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load AR invoice reference data.'));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    res.json(await arInvoiceService.getCustomerDetails(req.params.customerCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer details.'));
  }
};

const getCustomerFilterOptions = async (req, res) => {
  try {
    res.json(await arInvoiceService.getCustomerFilterOptions({
      query: req.query.query,
      customerCode: req.query.customerCode,
      customerName: req.query.customerName,
      top: parseTopParam(req.query.top),
      display: req.query.display,
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer filter options.'));
  }
};

const getARInvoiceList = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? false
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    res.json(await arInvoiceService.getARInvoiceList({
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
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load AR invoices.'));
  }
};

const getARInvoice = async (req, res) => {
  try {
    res.json(await arInvoiceService.getARInvoice(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load AR invoice details.'));
  }
};

const submitARInvoice = async (req, res) => {
  try {
    res.json(await arInvoiceService.submitARInvoice(req.body));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to submit AR invoice.'));
  }
};

const updateARInvoice = async (req, res) => {
  try {
    res.json(await arInvoiceService.updateARInvoice(req.params.docEntry, req.body));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to update AR invoice.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    res.json(await arInvoiceService.getDocumentSeries(req.query.date));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    res.json(await arInvoiceService.getNextNumber(req.query.series));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get next number.'));
  }
};

const getStateFromAddress = async (req, res) => {
  try {
    res.json(await arInvoiceService.getStateFromAddress(req.query.cardCode, req.query.addressCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from address.'));
  }
};

const getWarehouseState = async (req, res) => {
  try {
    res.json(await arInvoiceService.getWarehouseState(req.params.whsCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get warehouse state.'));
  }
};

const getBatchesByItem = async (req, res) => {
  try {
    res.json(await arInvoiceService.getBatchesByItem(req.query.itemCode, req.query.whsCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get batches.'));
  }
};

const getFreightCharges = async (req, res) => {
  try {
    res.json(await arInvoiceService.getFreightCharges(req.query.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load freight charges.'));
  }
};

const getItemsForModal = async (req, res) => {
  try {
    res.json(await arInvoiceService.getItemsForModal());
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load items.'));
  }
};

// ── Copy From endpoints ───────────────────────────────────────────────────────

const getOpenSalesOrders = async (req, res) => {
  try {
    const { customerCode } = req.query;
    res.json(await arInvoiceService.getOpenSalesOrders(customerCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open sales orders.'));
  }
};

const getSalesOrderForCopy = async (req, res) => {
  try {
    res.json(await arInvoiceService.getSalesOrderForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load sales order for copy.'));
  }
};

const getOpenDeliveries = async (req, res) => {
  try {
    const { customerCode } = req.query;
    res.json(await arInvoiceService.getOpenDeliveries(customerCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open deliveries.'));
  }
};

const getDeliveryForCopy = async (req, res) => {
  try {
    res.json(await arInvoiceService.getDeliveryForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load delivery for copy.'));
  }
};

const getOpenSalesQuotations = async (req, res) => {
  try {
    res.json(await arInvoiceService.getOpenSalesQuotations(req.query.customerCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open sales quotations.'));
  }
};

const getSalesQuotationForCopy = async (req, res) => {
  try {
    res.json(await arInvoiceService.getSalesQuotationForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load sales quotation for copy.'));
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getARInvoiceList,
  getARInvoice,
  submitARInvoice,
  updateARInvoice,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getWarehouseState,
  getBatchesByItem,
  getFreightCharges,
  getItemsForModal,
  getOpenSalesOrders,
  getSalesOrderForCopy,
  getOpenDeliveries,
  getDeliveryForCopy,
  getOpenSalesQuotations,
  getSalesQuotationForCopy,
};
