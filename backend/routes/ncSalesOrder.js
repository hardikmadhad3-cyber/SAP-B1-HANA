const express = require('express');
const ncSalesOrderController = require('../controllers/ncSalesOrderController');

const router = express.Router();

router.get('/reference-data', ncSalesOrderController.getReferenceData);
router.get('/list', ncSalesOrderController.getSalesOrderList);
router.get('/list/filter-options', ncSalesOrderController.getSalesOrderFilterOptions);
router.get('/series', ncSalesOrderController.getDocumentSeries);
router.get('/series/next', ncSalesOrderController.getNextNumber);
router.get('/state-from-address', ncSalesOrderController.getStateFromAddress);
router.get('/items-modal', ncSalesOrderController.getItemsForModal);
router.get('/freight-charges', ncSalesOrderController.getFreightCharges);
router.get('/print-layouts', ncSalesOrderController.getSalesOrderPrintLayouts);
router.post('/print', ncSalesOrderController.printNCSalesOrder);
router.post('/lookup-values', ncSalesOrderController.createLookupValue);
router.get('/customers/search', ncSalesOrderController.getCustomerFilterOptions);
router.get('/customers/:customerCode', ncSalesOrderController.getCustomerDetails);

// Copy From endpoints must stay before /:docEntry.
router.get('/open', ncSalesOrderController.getOpenSalesOrders);
router.get('/open-sales-orders', ncSalesOrderController.getOpenSalesOrders);
router.get('/open-sales-quotations', ncSalesOrderController.getOpenSalesQuotations);
router.get('/open-blanket-agreements', ncSalesOrderController.getOpenBlanketAgreements);
router.get('/quotation/:docEntry/copy', ncSalesOrderController.getSalesQuotationForCopy);
router.get('/blanket/:docEntry/copy', ncSalesOrderController.getBlanketAgreementForCopy);
router.get('/:docEntry/copy', ncSalesOrderController.getSalesOrderForCopy);

router.get('/:docEntry', ncSalesOrderController.getSalesOrder);
router.post('/', ncSalesOrderController.submitSalesOrder);
router.patch('/:docEntry', ncSalesOrderController.updateSalesOrder);

module.exports = router;
