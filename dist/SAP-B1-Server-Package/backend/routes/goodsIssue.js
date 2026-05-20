const express = require('express');
const goodsIssueController = require('../controllers/goodsIssueController');

const router = express.Router();

router.get('/metadata', goodsIssueController.getMetadata);
router.get('/items', goodsIssueController.getItems);
router.get('/batches', goodsIssueController.getBatchesByItem);
router.get('/warehouses', goodsIssueController.getWarehouses);
router.get('/series', goodsIssueController.getSeries);
router.get('/list', goodsIssueController.getGoodsIssues);
router.get('/:docEntry', goodsIssueController.getGoodsIssue);
router.post('/', goodsIssueController.createGoodsIssue);
router.patch('/:docEntry', goodsIssueController.updateGoodsIssue);

module.exports = router;
