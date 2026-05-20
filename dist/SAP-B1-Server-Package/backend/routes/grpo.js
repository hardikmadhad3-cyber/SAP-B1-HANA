const express = require('express');
const grpoController = require('../controllers/grpoController');

const router = express.Router();

router.get('/reference-data', grpoController.getReferenceData);
router.get('/items-modal', grpoController.getItemsForModal);
router.get('/list', grpoController.getGRPOs);
router.get('/vendors/search', grpoController.getVendorFilterOptions);
router.get('/series', grpoController.getDocumentSeries);
router.get('/series/:series/next-number', grpoController.getNextNumber);
router.get('/vendors/:vendorCode', grpoController.getVendorDetails);
router.get('/warehouse-state/:whsCode', grpoController.getStateFromWarehouse);
router.get('/open-purchase-orders', grpoController.getOpenPurchaseOrders);
router.get('/purchase-order/:docEntry/copy', grpoController.getPurchaseOrderForCopy);
router.get('/batches', grpoController.getBatchesByItem);
router.get('/freight-charges', grpoController.getFreightCharges);
router.get('/:docEntry', grpoController.getGRPOByDocEntry);
router.post('/submit', grpoController.submitGRPO);
router.post('/', grpoController.submitGRPO);
router.patch('/:docEntry', grpoController.updateGRPO);

module.exports = router;
