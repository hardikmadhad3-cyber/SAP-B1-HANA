const express = require('express');
const controller = require('../controllers/serviceApInvoiceController');

const router = express.Router();

router.get('/reference-data', controller.getReferenceData);
router.get('/list', controller.getServiceAPInvoiceList);
router.get('/series', controller.getDocumentSeries);
router.get('/series/next', controller.getNextNumber);
router.get('/vendors/search', controller.getVendorFilterOptions);
router.get('/vendors/:vendorCode', controller.getVendorDetails);

router.get('/open-purchase-quotations', controller.getOpenServicePurchaseQuotations);
router.get('/open-purchase-orders', controller.getOpenServicePurchaseOrders);
router.get('/open-grpo', controller.getOpenServiceGRPO);
router.get('/purchase-quotation/:docEntry/copy', controller.getServicePurchaseQuotationForCopy);
router.get('/purchase-order/:docEntry/copy', controller.getServicePurchaseOrderForCopy);
router.get('/grpo/:docEntry/copy', controller.getServiceGRPOForCopy);

router.get('/:docEntry', controller.getServiceAPInvoice);
router.post('/', controller.submitServiceAPInvoice);
router.patch('/:docEntry', controller.updateServiceAPInvoice);

module.exports = router;
