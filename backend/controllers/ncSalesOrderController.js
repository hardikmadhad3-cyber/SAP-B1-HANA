const salesOrderService = require('../services/ncSalesOrderService');
const documentPrintLayoutService = require('../services/documentPrintLayoutService');

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
    const data = await salesOrderService.getReferenceData(req.auth?.companyId);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load NC sales order reference data.'));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    const data = await salesOrderService.getCustomerDetails(req.params.customerCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer details.'));
  }
};

const getCustomerFilterOptions = async (req, res) => {
  try {
    const data = await salesOrderService.getCustomerFilterOptions({
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

const getSalesOrderList = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? true
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    const data = await salesOrderService.getSalesOrderList({
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
    res.status(500).json(getErrorPayload(error, 'Failed to load NC sales orders.'));
  }
};

const getSalesOrderFilterOptions = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? true
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const data = await salesOrderService.getSalesOrderFilterOptions({
      field: req.query.field,
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
      top: parseTopParam(req.query.top),
    });
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load NC sales order filter options.'));
  }
};

const getSalesOrder = async (req, res) => {
  try {
    const data = await salesOrderService.getSalesOrder(req.params.docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load NC sales order details.'));
  }
};

const submitSalesOrder = async (req, res) => {
  try {
    const result = await salesOrderService.submitSalesOrder(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to submit NC sales order.'));
  }
};

const updateSalesOrder = async (req, res) => {
  try {
    const result = await salesOrderService.updateSalesOrder(req.params.docEntry, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to update NC sales order.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await salesOrderService.getDocumentSeries(req.query.date);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    const data = await salesOrderService.getNextNumber(req.query.series);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get next number.'));
  }
};

const getStateFromAddress = async (req, res) => {
  try {
    const { cardCode, addressCode } = req.query;
    const data = await salesOrderService.getStateFromAddress(cardCode, addressCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from address.'));
  }
};

const getItemsForModal = async (req, res) => {
  try {
    const data = await salesOrderService.getItemsForModal(req.query.whsCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load items.'));
  }
};

const getFreightCharges = async (req, res) => {
  try {
    const { docEntry } = req.query;
    const data = await salesOrderService.getFreightCharges(docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load freight charges.'));
  }
};

const getSalesOrderPrintLayouts = async (_req, res) => {
  try {
    const data = await salesOrderService.getSalesOrderPrintLayouts();
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load NC sales order print layouts.'));
  }
};

const createLookupValue = async (req, res) => {
  try {
    const result = await salesOrderService.createLookupValue(req.body || {});
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to create lookup value.'));
  }
};

const printNCSalesOrder = async (req, res) => {
  try {
    const { docEntry, docNum, series, schema, docCode, cardCode } = req.body || {};
    const data = await documentPrintLayoutService.printDocument({
      documentType: 'salesOrder',
      docEntry,
      docNum,
      series,
      schema,
      docCode,
      cardCode,
      auth: req.auth,
    });

    res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    res.status(statusCode).json(getErrorPayload(error, 'Failed to generate NC sales order PDF.'));
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getSalesOrderList,
  getSalesOrderFilterOptions,
  getSalesOrder,
  submitSalesOrder,
  updateSalesOrder,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getItemsForModal,
  getFreightCharges,
  getSalesOrderPrintLayouts,
  createLookupValue,
  printNCSalesOrder,
  getOpenSalesOrders:          async (req, res) => { try { res.json(await salesOrderService.getOpenSalesOrders(req.query.customerCode)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  getSalesOrderForCopy:        async (req, res) => { try { res.json(await salesOrderService.getSalesOrderForCopy(req.params.docEntry)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  getOpenSalesQuotations:      async (req, res) => { try { res.json(await salesOrderService.getOpenSalesQuotations(req.query.customerCode)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  getSalesQuotationForCopy:    async (req, res) => { try { res.json(await salesOrderService.getSalesQuotationForCopy(req.params.docEntry)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  getOpenBlanketAgreements:    async (req, res) => { try { res.json({ documents: [] }); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  getBlanketAgreementForCopy:  async (req, res) => { res.status(404).json({ detail: 'Blanket agreements not yet implemented.' }); },
};
