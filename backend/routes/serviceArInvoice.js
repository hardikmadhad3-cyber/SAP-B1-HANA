const express = require('express');
const controller = require('../controllers/serviceArInvoiceController');

const router = express.Router();

router.get('/reference-data', controller.getReferenceData);
router.get('/list', controller.getServiceARInvoiceList);
router.get('/series', controller.getDocumentSeries);
router.get('/series/next', controller.getNextNumber);
router.get('/customers/search', controller.getCustomerFilterOptions);
router.get('/customers/:customerCode', controller.getCustomerDetails);

router.get('/open-sales-quotations', controller.getOpenServiceSalesQuotations);
router.get('/open-sales-orders', controller.getOpenServiceSalesOrders);
router.get('/open-deliveries', controller.getOpenServiceDeliveries);
router.get('/quotation/:docEntry/copy', controller.getServiceSalesQuotationForCopy);
router.get('/sales-order/:docEntry/copy', controller.getServiceSalesOrderForCopy);
router.get('/delivery/:docEntry/copy', controller.getServiceDeliveryForCopy);

router.get('/:docEntry', controller.getServiceARInvoice);
router.post('/', controller.submitServiceARInvoice);
router.patch('/:docEntry', controller.updateServiceARInvoice);

module.exports = router;
