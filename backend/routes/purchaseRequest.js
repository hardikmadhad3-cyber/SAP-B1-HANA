const express = require('express');
const purchaseRequestController = require('../controllers/purchaseRequestController');

const router = express.Router();

router.get('/reference-data', purchaseRequestController.getReferenceData);
router.get('/list', purchaseRequestController.getPurchaseRequests);
router.get('/vendors/search', purchaseRequestController.getVendorFilterOptions);
router.get('/series', purchaseRequestController.getDocumentSeries);
router.get('/series/:series/next-number', purchaseRequestController.getNextNumber);
router.get('/freight-charges', purchaseRequestController.getFreightCharges);
router.get('/items-modal', purchaseRequestController.getItemsForModal);
router.get('/vendors/:vendorCode', purchaseRequestController.getVendorDetails);
router.get('/state/:vendorCode/:addressCode', purchaseRequestController.getStateFromAddress);
router.get('/warehouse-state/:whsCode', purchaseRequestController.getStateFromWarehouse);
router.get('/:docEntry', purchaseRequestController.getPurchaseRequestByDocEntry);
router.post('/submit', purchaseRequestController.submitPurchaseRequest);
router.post('/', purchaseRequestController.submitPurchaseRequest);
router.patch('/:docEntry', purchaseRequestController.updatePurchaseRequest);

module.exports = router;
