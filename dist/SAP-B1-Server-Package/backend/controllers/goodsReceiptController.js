const goodsReceiptService = require('../services/goodsReceiptService');

const errorPayload = (error, fallbackMessage) => ({
  success: false,
  message: error.message || fallbackMessage,
});

const getMetadata = async (_req, res) => {
  try {
    res.json(await goodsReceiptService.getMetadata());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load Goods Receipt metadata.'));
  }
};

const getItems = async (_req, res) => {
  try {
    res.json(await goodsReceiptService.getItems());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load items.'));
  }
};

const getBatchesByItem = async (req, res) => {
  try {
    res.json(
      await goodsReceiptService.getBatchesByItem(req.query.itemCode, req.query.whsCode)
    );
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load batches.'));
  }
};

const getWarehouses = async (_req, res) => {
  try {
    res.json(await goodsReceiptService.getWarehouses());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load warehouses.'));
  }
};

const getSeries = async (_req, res) => {
  try {
    res.json(await goodsReceiptService.getSeries());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load series.'));
  }
};

const getPurchaseOrders = async (_req, res) => {
  try {
    res.json(await goodsReceiptService.getPurchaseOrders());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load purchase orders.'));
  }
};

const getPurchaseInvoices = async (_req, res) => {
  try {
    res.json(await goodsReceiptService.getPurchaseInvoices());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load purchase invoices.'));
  }
};

const getGoodsIssues = async (_req, res) => {
  try {
    res.json(await goodsReceiptService.getGoodsIssues());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load goods issues.'));
  }
};

const getGoodsReceipts = async (_req, res) => {
  try {
    res.json(await goodsReceiptService.getGoodsReceipts());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load goods receipts.'));
  }
};

const getGoodsReceipt = async (req, res) => {
  try {
    res.json(await goodsReceiptService.getGoodsReceipt(req.params.docEntry));
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load goods receipt.'));
  }
};

const getCopyFromDocument = async (req, res) => {
  try {
    res.json(
      await goodsReceiptService.getCopyFromDocument(
        req.params.sourceType,
        req.params.docEntry
      )
    );
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load source document.'));
  }
};

const createGoodsReceipt = async (req, res) => {
  try {
    res.json(await goodsReceiptService.createGoodsReceipt(req.body));
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to create Goods Receipt.'));
  }
};

const updateGoodsReceipt = async (req, res) => {
  try {
    res.json(await goodsReceiptService.updateGoodsReceipt(req.params.docEntry, req.body));
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to update Goods Receipt.'));
  }
};

module.exports = {
  getMetadata,
  getItems,
  getBatchesByItem,
  getWarehouses,
  getSeries,
  getPurchaseOrders,
  getPurchaseInvoices,
  getGoodsIssues,
  getGoodsReceipts,
  getGoodsReceipt,
  getCopyFromDocument,
  createGoodsReceipt,
  updateGoodsReceipt,
};
