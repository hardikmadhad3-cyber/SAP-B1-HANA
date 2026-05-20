const express = require('express');
const apInvoiceController = require('../controllers/apInvoiceController');

const router = express.Router();

router.get('/reference-data', apInvoiceController.getReferenceData);
router.get('/items-modal', apInvoiceController.getItemsForModal);
router.get('/list', apInvoiceController.getAPInvoices);
router.get('/vendors/search', apInvoiceController.getVendorFilterOptions);
router.get('/series', apInvoiceController.getDocumentSeries);
router.get('/series/:series/next-number', apInvoiceController.getNextNumber);
router.get('/vendors/:vendorCode', apInvoiceController.getVendorDetails);
router.get('/warehouse-state/:whsCode', apInvoiceController.getStateFromWarehouse);
router.get('/open-grpo', apInvoiceController.getOpenGRPO);
router.get('/grpo/:docEntry', apInvoiceController.getGRPOForCopy);
router.get('/freight-charges', apInvoiceController.getFreightCharges);
router.get('/:docEntry', apInvoiceController.getAPInvoiceByDocEntry);
router.post('/submit', apInvoiceController.submitAPInvoice);
router.post('/', apInvoiceController.submitAPInvoice);
router.patch('/:docEntry', apInvoiceController.updateAPInvoice);

module.exports = router;
