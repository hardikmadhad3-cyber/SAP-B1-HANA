const express = require('express');
const arCreditMemoController = require('../controllers/arCreditMemoController');

const router = express.Router();

router.get('/reference-data', arCreditMemoController.getReferenceData);
router.get('/list', arCreditMemoController.getARCreditMemoList);
router.get('/series', arCreditMemoController.getDocumentSeries);
router.get('/series/next', arCreditMemoController.getNextNumber);
router.get('/state-from-address', arCreditMemoController.getStateFromAddress);
router.get('/warehouse-state/:whsCode', arCreditMemoController.getWarehouseState);
router.get('/freight-charges', arCreditMemoController.getFreightCharges);
router.get('/items-modal', arCreditMemoController.getItemsForModal);
router.get('/batches', arCreditMemoController.getBatchesByItem);
router.get('/uom-conversion', arCreditMemoController.getUomConversionFactor);
router.get('/customers/search', arCreditMemoController.getCustomerFilterOptions);
router.get('/customers/:customerCode', arCreditMemoController.getCustomerDetails);

// ── Copy From endpoints (must be before /:docEntry) ──
router.get('/open',                            arCreditMemoController.getOpenARCreditMemoDocuments);
// router.get('/open-deliveries',                 arCreditMemoController.getOpenDeliveries);
router.get('/open-invoices',                   arCreditMemoController.getOpenARInvoices);
// router.get('/open-sales-orders',               arCreditMemoController.getOpenSalesOrders);
// router.get('/open-returns',                    arCreditMemoController.getOpenReturns);
// router.get('/open-return-requests',            arCreditMemoController.getOpenReturnRequests);
// router.get('/open-down-payments',              arCreditMemoController.getOpenDownPayments);
// router.get('/delivery/:docEntry/copy',         arCreditMemoController.getDeliveryForCopy);
router.get('/invoice/:docEntry/copy',          arCreditMemoController.getARInvoiceForCopy);
// router.get('/sales-order/:docEntry/copy',      arCreditMemoController.getSalesOrderForCopy);
// router.get('/return/:docEntry/copy',           arCreditMemoController.getReturnForCopy);
// router.get('/return-request/:docEntry/copy',   arCreditMemoController.getReturnRequestForCopy);
// router.get('/down-payment/:docEntry/copy',     arCreditMemoController.getDownPaymentForCopy);
router.get('/:docEntry/copy', arCreditMemoController.getARCreditMemoForCopy);

router.get('/:docEntry', arCreditMemoController.getARCreditMemo);
router.post('/', arCreditMemoController.submitARCreditMemo);
router.patch('/:docEntry', arCreditMemoController.updateARCreditMemo);

module.exports = router;
