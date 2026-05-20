const express = require('express');
const purchaseQuotationController = require('../controllers/purchaseQuotationController');

const router = express.Router();

router.get('/reference-data', purchaseQuotationController.getReferenceData);
router.get('/list', purchaseQuotationController.getPurchaseQuotations);
router.get('/vendors/search', purchaseQuotationController.getVendorFilterOptions);
router.get('/series', purchaseQuotationController.getDocumentSeries);
router.get('/series/:series/next-number', purchaseQuotationController.getNextNumber);
router.get('/vendors/:vendorCode', purchaseQuotationController.getVendorDetails);
router.get('/state/:vendorCode/:addressCode', purchaseQuotationController.getStateFromAddress);
router.get('/warehouse-state/:whsCode', purchaseQuotationController.getStateFromWarehouse);
router.get('/freight-charges', purchaseQuotationController.getFreightCharges);
router.get('/:docEntry', purchaseQuotationController.getPurchaseQuotationByDocEntry);
router.post('/submit', purchaseQuotationController.submitPurchaseQuotation);
router.post('/', purchaseQuotationController.submitPurchaseQuotation);
router.patch('/:docEntry', purchaseQuotationController.updatePurchaseQuotation);

module.exports = router;
