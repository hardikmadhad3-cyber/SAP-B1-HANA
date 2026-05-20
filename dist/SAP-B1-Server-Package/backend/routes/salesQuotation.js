const express = require('express');
const salesQuotationController = require('../controllers/salesQuotationController');

const router = express.Router();

router.get('/reference-data', salesQuotationController.getReferenceData);
router.get('/list', salesQuotationController.getSalesQuotationList);
router.get('/customers/search', salesQuotationController.getCustomerFilterOptions);
router.get('/open', salesQuotationController.getOpenSalesQuotations);
router.get('/series', salesQuotationController.getDocumentSeries);
router.get('/series/next', salesQuotationController.getNextNumber);
router.get('/state-from-address', salesQuotationController.getStateFromAddress);
router.get('/items-modal', salesQuotationController.getItemsForModal);
router.get('/freight-charges', salesQuotationController.getFreightCharges);
router.get('/customers/:customerCode', salesQuotationController.getCustomerDetails);
router.get('/:docEntry/copy', salesQuotationController.getSalesQuotationForCopy);
router.get('/:docEntry', salesQuotationController.getSalesQuotation);
router.post('/', salesQuotationController.submitSalesQuotation);
router.patch('/:docEntry', salesQuotationController.updateSalesQuotation);

module.exports = router;
