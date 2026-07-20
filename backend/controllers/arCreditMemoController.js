const arCreditMemoService = require('../services/arCreditMemoService');

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
    const data = await arCreditMemoService.getReferenceData(req.query.company_id);
    console.log('[ARCreditMemoController] /reference-data response keys:', Object.keys(data));
    res.json(data);
  } catch (error) {
    console.error('[ARCreditMemoController] /reference-data failed:', error);
    res.status(500).json(getErrorPayload(error, 'Failed to load AR credit memo reference data.'));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    const data = await arCreditMemoService.getCustomerDetails(req.params.customerCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer details.'));
  }
};

const getCustomerFilterOptions = async (req, res) => {
  try {
    const data = await arCreditMemoService.getCustomerFilterOptions({
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

const getARCreditMemoList = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? false
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    const data = await arCreditMemoService.getARCreditMemoList({
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
    res.status(500).json(getErrorPayload(error, 'Failed to load AR credit memos.'));
  }
};

const getOpenARCreditMemoDocuments = async (req, res) => {
  try {
    const data = await arCreditMemoService.getOpenARCreditMemoDocuments();
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open AR credit memos.'));
  }
};

const getARCreditMemo = async (req, res) => {
  try {
    const data = await arCreditMemoService.getARCreditMemo(req.params.docEntry);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(getErrorPayload(error, 'Failed to load AR credit memo details.'));
  }
};

const submitARCreditMemo = async (req, res) => {
  try {
    console.log('🔍 [ARCreditMemoController] submitARCreditMemo called');
    console.log('🔍 [ARCreditMemoController] Request body:', JSON.stringify(req.body, null, 2));
    const result = await arCreditMemoService.submitARCreditMemo(req.body);
    console.log('✅ [ARCreditMemoController] submitARCreditMemo success:', result);
    res.json(result);
  } catch (error) {
    console.error('❌ [ARCreditMemoController] submitARCreditMemo failed:', error);
    console.error('❌ [ARCreditMemoController] Error stack:', error.stack);
    res.status(500).json(getErrorPayload(error, 'Failed to submit AR credit memo.'));
  }
};

const updateARCreditMemo = async (req, res) => {
  try {
    const result = await arCreditMemoService.updateARCreditMemo(req.params.docEntry, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to update AR credit memo.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await arCreditMemoService.getDocumentSeries(
      req.query.date,
      req.query.transactionType || '',
      req.query.branch || req.query.branchId || '',
    );
    console.log('[ARCreditMemoController] /series payload:', data);
    res.json(data);
  } catch (error) {
    console.error('[ARCreditMemoController] /series failed:', error);
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    const data = await arCreditMemoService.getNextNumber(req.query.series);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get next number.'));
  }
};

const getStateFromAddress = async (req, res) => {
  try {
    const { cardCode, addressCode } = req.query;
    const data = await arCreditMemoService.getStateFromAddress(cardCode, addressCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from address.'));
  }
};

const getWarehouseState = async (req, res) => {
  try {
    const { whsCode } = req.params;
    const data = await arCreditMemoService.getWarehouseState(whsCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get warehouse state.'));
  }
};

const getFreightCharges = async (req, res) => {
  try {
    const { docEntry } = req.query;
    const data = await arCreditMemoService.getFreightCharges(docEntry);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load freight charges.'));
  }
};

const getItemsForModal = async (req, res) => {
  try {
    const data = await arCreditMemoService.getItemsForModal();
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load items for modal.'));
  }
};

const getBatchesByItem = async (req, res) => {
  try {
    const { itemCode, whsCode } = req.query;
    const data = await arCreditMemoService.getBatchesByItem(itemCode, whsCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load batches.'));
  }
};

const getUomConversionFactor = async (req, res) => {
  try {
    const { itemCode, uomCode } = req.query;
    const data = await arCreditMemoService.getUomConversionFactor(itemCode, uomCode);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get UoM conversion factor.'));
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getARCreditMemoList,
  getOpenARCreditMemoDocuments,
  getARCreditMemo,
  submitARCreditMemo,
  updateARCreditMemo,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getWarehouseState,
  getFreightCharges,
  getItemsForModal,
  getBatchesByItem,
  getUomConversionFactor,
  // getOpenDeliveries:       async (req, res) => { try { res.json(await arCreditMemoService.getOpenDeliveries()); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  // getDeliveryForCopy:      async (req, res) => { try { res.json(await arCreditMemoService.getDeliveryForCopy(req.params.docEntry)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  getOpenARInvoices:       async (req, res) => { try { const { customerCode } = req.query; res.json(await arCreditMemoService.getOpenARInvoices(customerCode)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  getARInvoiceForCopy:     async (req, res) => { try { res.json(await arCreditMemoService.getARInvoiceForCopy(req.params.docEntry)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  getARCreditMemoForCopy:  async (req, res) => { try { res.json(await arCreditMemoService.getARCreditMemoForCopy(req.params.docEntry)); } catch(e) { res.status(e.status || 500).json(getErrorPayload(e, 'Failed.')); } },
  // getOpenSalesOrders:      async (req, res) => { try { res.json(await arCreditMemoService.getOpenSalesOrders()); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  // getSalesOrderForCopy:    async (req, res) => { try { res.json(await arCreditMemoService.getSalesOrderForCopy(req.params.docEntry)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  // getOpenReturns:          async (req, res) => { try { const { customerCode } = req.query; res.json(await arCreditMemoService.getOpenReturns(customerCode)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  // getReturnForCopy:        async (req, res) => { try { res.json(await arCreditMemoService.getReturnForCopy(req.params.docEntry)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  // getOpenReturnRequests:   async (req, res) => { try { const { customerCode } = req.query; res.json(await arCreditMemoService.getOpenReturnRequests(customerCode)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  // getReturnRequestForCopy: async (req, res) => { try { res.json(await arCreditMemoService.getReturnRequestForCopy(req.params.docEntry)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  // getOpenDownPayments:     async (req, res) => { try { const { customerCode } = req.query; res.json(await arCreditMemoService.getOpenDownPayments(customerCode)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
  // getDownPaymentForCopy:   async (req, res) => { try { res.json(await arCreditMemoService.getDownPaymentForCopy(req.params.docEntry)); } catch(e) { res.status(500).json(getErrorPayload(e, 'Failed.')); } },
};
