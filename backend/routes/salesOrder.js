const express = require('express');
const salesOrderController = require('../controllers/salesOrderController');

const router = express.Router();

const requireNumericDocEntry = (req, res, next) => {
  if (/^\d+$/.test(String(req.params.docEntry || '').trim())) {
    return next();
  }
  return res.status(404).json({ detail: 'Sales order document was not found.' });
};

router.get('/reference-data', salesOrderController.getReferenceData);
router.get('/list', salesOrderController.getSalesOrderList);
router.get('/list/filter-options', salesOrderController.getSalesOrderFilterOptions);
router.get('/series', salesOrderController.getDocumentSeries);
router.get('/series/next', salesOrderController.getNextNumber);
router.get('/state-from-address', salesOrderController.getStateFromAddress);
router.get('/items-modal', salesOrderController.getItemsForModal);
router.get('/freight-charges', salesOrderController.getFreightCharges);
router.get('/print-layouts', salesOrderController.getSalesOrderPrintLayouts);
router.get('/reference-documents', salesOrderController.getReferenceDocumentLookup);
router.get('/lookups/:source', salesOrderController.getLookupOptions);
router.post('/lookup-values', salesOrderController.createLookupValue);
router.get('/customers/search', salesOrderController.getCustomerFilterOptions);
router.get('/customers/:customerCode', salesOrderController.getCustomerDetails);

// ── Copy From endpoints (must be before /:docEntry) ──
router.get('/open', salesOrderController.getOpenSalesOrders);
router.get('/open-sales-orders', salesOrderController.getOpenSalesOrders);
router.get('/open-sales-quotations', salesOrderController.getOpenSalesQuotations);
router.get('/open-blanket-agreements', salesOrderController.getOpenBlanketAgreements);
router.get('/quotation/:docEntry/copy', salesOrderController.getSalesQuotationForCopy);
router.get('/blanket/:docEntry/copy', salesOrderController.getBlanketAgreementForCopy);
router.get('/:docEntry/copy', requireNumericDocEntry, salesOrderController.getSalesOrderForCopy);

router.get('/:docEntry', requireNumericDocEntry, salesOrderController.getSalesOrder);
router.post('/', salesOrderController.submitSalesOrder);
router.patch('/:docEntry', requireNumericDocEntry, salesOrderController.updateSalesOrder);

module.exports = router;
