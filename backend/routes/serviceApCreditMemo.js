const express = require('express');
const controller = require('../controllers/serviceApCreditMemoController');

const router = express.Router();

router.get('/reference-data', controller.getReferenceData);
router.get('/list', controller.getServiceAPCreditMemoList);
router.get('/series', controller.getDocumentSeries);
router.get('/series/next', controller.getNextNumber);
router.get('/vendors/search', controller.getVendorFilterOptions);
router.get('/vendors/:vendorCode', controller.getVendorDetails);

router.get('/open-ap-invoices', controller.getOpenServiceAPInvoices);
router.get('/ap-invoice/:docEntry/copy', controller.getServiceAPInvoiceForCopy);

router.get('/:docEntry', controller.getServiceAPCreditMemo);
router.post('/', controller.submitServiceAPCreditMemo);
router.patch('/:docEntry', controller.updateServiceAPCreditMemo);

module.exports = router;

