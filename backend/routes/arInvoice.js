const express = require('express');
const arInvoiceController = require('../controllers/arInvoiceController');

const router = express.Router();

router.get('/reference-data', arInvoiceController.getReferenceData);
router.get('/list', arInvoiceController.getARInvoiceList);
router.get('/series', arInvoiceController.getDocumentSeries);
router.get('/series/next', arInvoiceController.getNextNumber);
router.get('/state-from-address', arInvoiceController.getStateFromAddress);
router.get('/warehouse-state/:whsCode', arInvoiceController.getWarehouseState);
router.get('/batches', arInvoiceController.getBatchesByItem);
router.get('/freight-charges', arInvoiceController.getFreightCharges);
router.get('/items-modal', arInvoiceController.getItemsForModal);
router.get('/customers/search', arInvoiceController.getCustomerFilterOptions);
router.get('/customers/:customerCode', arInvoiceController.getCustomerDetails);

// ── Copy From endpoints (must be before /:docEntry) ──
router.get('/open-sales-orders',          arInvoiceController.getOpenSalesOrders);
router.get('/open-deliveries',            arInvoiceController.getOpenDeliveries);
router.get('/open-sales-quotations',      arInvoiceController.getOpenSalesQuotations);
router.get('/sales-order/:docEntry/copy', arInvoiceController.getSalesOrderForCopy);
router.get('/delivery/:docEntry/copy',    arInvoiceController.getDeliveryForCopy);
router.get('/quotation/:docEntry/copy',   arInvoiceController.getSalesQuotationForCopy);

router.get('/:docEntry', arInvoiceController.getARInvoice);
router.post('/', arInvoiceController.submitARInvoice);
router.patch('/:docEntry', arInvoiceController.updateARInvoice);

module.exports = router;
