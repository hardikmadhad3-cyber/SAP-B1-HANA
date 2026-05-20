const express = require('express');
const goodsReceiptController = require('../controllers/goodsReceiptController');

const router = express.Router();

router.get('/metadata', goodsReceiptController.getMetadata);
router.get('/items', goodsReceiptController.getItems);
router.get('/batches', goodsReceiptController.getBatchesByItem);
router.get('/warehouses', goodsReceiptController.getWarehouses);
router.get('/series', goodsReceiptController.getSeries);
router.get('/purchase-orders', goodsReceiptController.getPurchaseOrders);
router.get('/purchase-invoices', goodsReceiptController.getPurchaseInvoices);
router.get('/goods-issues', goodsReceiptController.getGoodsIssues);
router.get('/list', goodsReceiptController.getGoodsReceipts);
router.get('/copy-from/:sourceType/:docEntry', goodsReceiptController.getCopyFromDocument);
router.get('/:docEntry', goodsReceiptController.getGoodsReceipt);
router.post('/', goodsReceiptController.createGoodsReceipt);
router.patch('/:docEntry', goodsReceiptController.updateGoodsReceipt);

module.exports = router;
