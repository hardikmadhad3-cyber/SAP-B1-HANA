const express = require('express');
const sodaSalesOrderController = require('../controllers/sodaSalesOrderController');

const router = express.Router();

router.get('/reference-data', sodaSalesOrderController.getReferenceData);
router.get('/list', sodaSalesOrderController.getSalesOrderList);
router.get('/list/filter-options', sodaSalesOrderController.getSalesOrderFilterOptions);
router.get('/series', sodaSalesOrderController.getDocumentSeries);
router.get('/series/next', sodaSalesOrderController.getNextNumber);
router.get('/state-from-address', sodaSalesOrderController.getStateFromAddress);
router.get('/items-modal', sodaSalesOrderController.getItemsForModal);
router.get('/freight-charges', sodaSalesOrderController.getFreightCharges);
router.get('/print-layouts', sodaSalesOrderController.getSalesOrderPrintLayouts);
router.post('/print', sodaSalesOrderController.printSODASalesOrder);
router.post('/lookup-values', sodaSalesOrderController.createLookupValue);
router.get('/customers/search', sodaSalesOrderController.getCustomerFilterOptions);
router.get('/customers/:customerCode', sodaSalesOrderController.getCustomerDetails);

// Copy From endpoints must stay before /:docEntry.
router.get('/open', sodaSalesOrderController.getOpenSalesOrders);
router.get('/open-sales-orders', sodaSalesOrderController.getOpenSalesOrders);
router.get('/open-sales-quotations', sodaSalesOrderController.getOpenSalesQuotations);
router.get('/open-blanket-agreements', sodaSalesOrderController.getOpenBlanketAgreements);
router.get('/quotation/:docEntry/copy', sodaSalesOrderController.getSalesQuotationForCopy);
router.get('/blanket/:docEntry/copy', sodaSalesOrderController.getBlanketAgreementForCopy);
router.get('/:docEntry/copy', sodaSalesOrderController.getSalesOrderForCopy);

router.get('/:docEntry', sodaSalesOrderController.getSalesOrder);
router.post('/', sodaSalesOrderController.submitSalesOrder);
router.patch('/:docEntry', sodaSalesOrderController.updateSalesOrder);

module.exports = router;
