const goodsIssueService = require('../services/goodsIssueService');

const errorPayload = (error, fallbackMessage) => ({
  success: false,
  message: error.message || fallbackMessage,
});

const getMetadata = async (_req, res) => {
  try {
    res.json(await goodsIssueService.getMetadata());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load Goods Issue metadata.'));
  }
};

const getItems = async (_req, res) => {
  try {
    res.json(await goodsIssueService.getItems());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load items.'));
  }
};

const getBatchesByItem = async (req, res) => {
  try {
    res.json(
      await goodsIssueService.getBatchesByItem(req.query.itemCode, req.query.whsCode)
    );
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load batches.'));
  }
};

const getWarehouses = async (_req, res) => {
  try {
    res.json(await goodsIssueService.getWarehouses());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load warehouses.'));
  }
};

const getSeries = async (_req, res) => {
  try {
    res.json(await goodsIssueService.getSeries());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load series.'));
  }
};

const getGoodsIssues = async (_req, res) => {
  try {
    res.json(await goodsIssueService.getGoodsIssues());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load goods issues.'));
  }
};

const getGoodsIssue = async (req, res) => {
  try {
    res.json(await goodsIssueService.getGoodsIssue(req.params.docEntry));
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load goods issue.'));
  }
};

const createGoodsIssue = async (req, res) => {
  try {
    res.json(await goodsIssueService.createGoodsIssue(req.body));
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to create Goods Issue.'));
  }
};

const updateGoodsIssue = async (req, res) => {
  try {
    res.json(await goodsIssueService.updateGoodsIssue(req.params.docEntry, req.body));
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to update Goods Issue.'));
  }
};

module.exports = {
  getMetadata,
  getItems,
  getBatchesByItem,
  getWarehouses,
  getSeries,
  getGoodsIssues,
  getGoodsIssue,
  createGoodsIssue,
  updateGoodsIssue,
};
