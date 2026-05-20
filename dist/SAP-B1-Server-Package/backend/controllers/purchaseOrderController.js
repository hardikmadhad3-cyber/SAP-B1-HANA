const purchaseOrderService = require('../services/purchaseOrderService');

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
    const data = await purchaseOrderService.getReferenceData(req.query.company_id);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load purchase order reference data.'));
  }
};

const getVendorDetails = async (req, res) => {
  try {
    const data = await purchaseOrderService.getVendorDetails(req.params.vendorCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor details.'));
  }
};

const getVendorFilterOptions = async (req, res) => {
  try {
    const data = await purchaseOrderService.getVendorFilterOptions({
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

const getPurchaseOrders = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? false
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    const data = await purchaseOrderService.getPurchaseOrderList({
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
    res.status(500).json(getErrorPayload(error, 'Failed to load purchase orders.'));
  }
};

const getPurchaseOrderByDocEntry = async (req, res) => {
  try {
    const data = await purchaseOrderService.getPurchaseOrder(req.params.docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load purchase order details.'));
  }
};

const submitPurchaseOrder = async (req, res) => {
  try {
    const result = await purchaseOrderService.submitPurchaseOrder(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to submit purchase order.'));
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const result = await purchaseOrderService.updatePurchaseOrder(req.params.docEntry, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to update purchase order.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await purchaseOrderService.getDocumentSeries();
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    const data = await purchaseOrderService.getNextNumber(req.params.series);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get next number.'));
  }
};

const getStateFromAddress = async (req, res) => {
  try {
    const { vendorCode, addressCode } = req.params;
    const data = await purchaseOrderService.getStateFromAddress(vendorCode, addressCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from address.'));
  }
};

const getStateFromWarehouse = async (req, res) => {
  try {
    const { whsCode } = req.params;
    const data = await purchaseOrderService.getStateFromWarehouse(whsCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from warehouse.'));
  }
};

const getOpenPurchaseQuotations = async (req, res) => {
  try {
    res.json(await purchaseOrderService.getOpenPurchaseQuotations(req.query.vendorCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open purchase quotations.'));
  }
};

const getOpenPurchaseRequests = async (req, res) => {
  try {
    res.json(await purchaseOrderService.getOpenPurchaseRequests(req.query.vendorCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open purchase requests.'));
  }
};

const getPurchaseQuotationForCopy = async (req, res) => {
  try {
    res.json(await purchaseOrderService.getPurchaseQuotationForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load purchase quotation for copy.'));
  }
};

const getPurchaseRequestForCopy = async (req, res) => {
  try {
    res.json(await purchaseOrderService.getPurchaseRequestForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load purchase request for copy.'));
  }
};

const getItemsForModal = async (req, res) => {
  try {
    res.json(await purchaseOrderService.getItemsForModal());
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load items.'));
  }
};

const getFreightCharges = async (req, res) => {
  try {
    res.json(await purchaseOrderService.getFreightCharges(req.query.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load freight charges.'));
  }
};

module.exports = {
  getReferenceData,
  getPurchaseOrders,
  getPurchaseOrderByDocEntry,
  getVendorFilterOptions,
  getVendorDetails,
  submitPurchaseOrder,
  updatePurchaseOrder,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getStateFromWarehouse,
  getOpenPurchaseQuotations,
  getOpenPurchaseRequests,
  getPurchaseQuotationForCopy,
  getPurchaseRequestForCopy,
  getItemsForModal,
  getFreightCharges,
};
