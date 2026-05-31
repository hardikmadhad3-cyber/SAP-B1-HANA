const serviceArInvoiceService = require('../services/serviceArInvoiceService');

const getErrorPayload = (error, fallbackMessage) => ({
  message: error.message || fallbackMessage,
  detail: error.response?.data || null,
});

const getReferenceData = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getReferenceData(req.query.company_id));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/R Invoice reference data.'));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getCustomerDetails(req.params.customerCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer details.'));
  }
};

const getCustomerFilterOptions = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getCustomerFilterOptions({
      query: req.query.query || '',
      customerCode: req.query.customerCode || '',
      customerName: req.query.customerName || '',
      top: req.query.top,
      display: req.query.display || 'code',
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer options.'));
  }
};

const getServiceARInvoiceList = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceARInvoiceList(req.query));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/R Invoices.'));
  }
};

const getServiceARInvoice = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceARInvoice(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/R Invoice.'));
  }
};

const submitServiceARInvoice = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.submitServiceARInvoice(req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to submit Service A/R Invoice.'));
  }
};

const updateServiceARInvoice = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.updateServiceARInvoice(req.params.docEntry, req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to update Service A/R Invoice.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const result = await serviceArInvoiceService.getDocumentSeries(req.query.date || null, req.query.transactionType || '');
    res.json({ series: Array.isArray(result) ? result : (result?.series || []) });
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getNextNumber(req.query.series));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load next number.'));
  }
};

const getOpenServiceSalesQuotations = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getOpenServiceSalesQuotations(req.query.customerCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service sales quotations.'));
  }
};

const getOpenServiceSalesOrders = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getOpenServiceSalesOrders(req.query.customerCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service sales orders.'));
  }
};

const getOpenServiceDeliveries = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getOpenServiceDeliveries(req.query.customerCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service deliveries.'));
  }
};

const getServiceSalesQuotationForCopy = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceSalesQuotationForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service sales quotation.'));
  }
};

const getServiceSalesOrderForCopy = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceSalesOrderForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service sales order.'));
  }
};

const getServiceDeliveryForCopy = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceDeliveryForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service delivery.'));
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getServiceARInvoiceList,
  getServiceARInvoice,
  submitServiceARInvoice,
  updateServiceARInvoice,
  getDocumentSeries,
  getNextNumber,
  getOpenServiceSalesQuotations,
  getOpenServiceSalesOrders,
  getOpenServiceDeliveries,
  getServiceSalesQuotationForCopy,
  getServiceSalesOrderForCopy,
  getServiceDeliveryForCopy,
};
