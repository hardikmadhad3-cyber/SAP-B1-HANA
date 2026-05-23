const express = require('express');
const dcSalesOrderController = require('../controllers/dcSalesOrderController');

const router = express.Router();

router.get('/reference-data', dcSalesOrderController.getReferenceData);
router.get('/list', dcSalesOrderController.getSalesOrderList);
router.get('/list/filter-options', dcSalesOrderController.getSalesOrderFilterOptions);
router.get('/series', dcSalesOrderController.getDocumentSeries);
router.get('/series/next', dcSalesOrderController.getNextNumber);
router.get('/state-from-address', dcSalesOrderController.getStateFromAddress);
router.get('/items-modal', dcSalesOrderController.getItemsForModal);
router.get('/freight-charges', dcSalesOrderController.getFreightCharges);
router.get('/print-layouts', dcSalesOrderController.getSalesOrderPrintLayouts);
router.post('/print', dcSalesOrderController.printDCSalesOrder);
router.post('/lookup-values', dcSalesOrderController.createLookupValue);
router.get('/customers/search', dcSalesOrderController.getCustomerFilterOptions);
router.get('/customers/:customerCode', dcSalesOrderController.getCustomerDetails);

// Copy From endpoints must stay before /:docEntry.
router.get('/open', dcSalesOrderController.getOpenSalesOrders);
router.get('/open-sales-orders', dcSalesOrderController.getOpenSalesOrders);
router.get('/open-sales-quotations', dcSalesOrderController.getOpenSalesQuotations);
router.get('/open-blanket-agreements', dcSalesOrderController.getOpenBlanketAgreements);
router.get('/quotation/:docEntry/copy', dcSalesOrderController.getSalesQuotationForCopy);
router.get('/blanket/:docEntry/copy', dcSalesOrderController.getBlanketAgreementForCopy);
router.get('/:docEntry/copy', dcSalesOrderController.getSalesOrderForCopy);

router.get('/:docEntry', dcSalesOrderController.getSalesOrder);
router.post('/', dcSalesOrderController.submitSalesOrder);
router.patch('/:docEntry', dcSalesOrderController.updateSalesOrder);

module.exports = router;
