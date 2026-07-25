const deliveryService = require('../services/ncDeliveryService');

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
    const data = await deliveryService.getReferenceData(req.query.company_id);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Delivery reference data.'));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    const data = await deliveryService.getCustomerDetails(req.params.customerCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer details.'));
  }
};

const saveSalesEmployeesSetup = async (req, res) => {
  try {
    const data = await deliveryService.saveSalesEmployeesSetup(req.body?.employees || []);
    res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    res.status(statusCode).json(getErrorPayload(error, 'Failed to save sales employees setup.'));
  }
};

const getCustomerFilterOptions = async (req, res) => {
  try {
    const data = await deliveryService.getCustomerFilterOptions({
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

const getDeliveries = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? false
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    const data = await deliveryService.getDeliveryList({
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
    res.status(500).json(getErrorPayload(error, 'Failed to load Deliveries.'));
  }
};

const getDeliveryByDocEntry = async (req, res) => {
  try {
    const data = await deliveryService.getDelivery(req.params.docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Delivery details.'));
  }
};

const submitDelivery = async (req, res) => {
  try {
    const result = await deliveryService.submitDelivery(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to submit Delivery.'));
  }
};

const updateDelivery = async (req, res) => {
  try {
    const result = await deliveryService.updateDelivery(req.params.docEntry, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to update Delivery.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await deliveryService.getDocumentSeries(req.query.date);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    const data = await deliveryService.getNextNumber(req.params.series);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get next number.'));
  }
};

const getStateFromWarehouse = async (req, res) => {
  try {
    const { whsCode } = req.params;
    const data = await deliveryService.getStateFromWarehouse(whsCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from warehouse.'));
  }
};

const getOpenSalesOrders = async (req, res) => {
  try {
    const { customerCode } = req.query;
    const data = await deliveryService.getOpenSalesOrders(customerCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open sales orders.'));
  }
};

const getSalesOrderForCopy = async (req, res) => {
  try {
    const data = await deliveryService.getSalesOrderForCopy(req.params.docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load sales order.'));
  }
};

const getDeliveryForCopyToCreditMemo = async (req, res) => {
  try {
    const data = await deliveryService.getDeliveryForCopyToCreditMemo(req.params.docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load delivery for copy.'));
  }
};

const getBatchesByItem = async (req, res) => {
  try {
    const { itemCode, whsCode } = req.query;
    const data = await deliveryService.getBatchesByItem(itemCode, whsCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load batches.'));
  }
};

const getFreightCharges = async (req, res) => {
  try {
    const { docEntry } = req.query;
    const data = await deliveryService.getFreightCharges(docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load freight charges.'));
  }
};

const getItemsForModal = async (req, res) => {
  try {
    const data = await deliveryService.getItemsForModal(req.query.whsCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load items.'));
  }
};

const getUomConversionFactor = async (req, res) => {
  try {
    const { itemCode, uomCode } = req.query;
    const data = await deliveryService.getUomConversionFactor(itemCode, uomCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get UoM conversion factor.'));
  }
};

const createLookupValue = async (req, res) => {
  try {
    const result = await deliveryService.createLookupValue(req.body || {});
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to create lookup value.'));
  }
};

// ─── Validation Controller ───────────────────────────────────────────────────────

const validateDelivery = async (req, res) => {
  try {
    const validationResult = await deliveryService.validateDeliveryDocument(req.body);
    
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationResult.errors
      });
    }
    
    res.json({
      success: true,
      message: 'Document validation passed',
      errors: []
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation failed due to server error',
      errors: ['Internal server error during validation']
    });
  }
};

module.exports = {
  getReferenceData,
  getDeliveries,
  getDeliveryByDocEntry,
  getCustomerDetails,
  saveSalesEmployeesSetup,
  getCustomerFilterOptions,
  submitDelivery,
  updateDelivery,
  getDocumentSeries,
  getNextNumber,
  getStateFromWarehouse,
  getOpenSalesOrders,
  getSalesOrderForCopy,
  getDeliveryForCopyToCreditMemo,
  getBatchesByItem,
  getFreightCharges,
  validateDelivery,
  getItemsForModal,
  getUomConversionFactor,
  createLookupValue
};
