const express = require('express');
const purchaseOrderController = require('../controllers/purchaseOrderController');

const router = express.Router();

router.get('/reference-data', purchaseOrderController.getReferenceData);
router.get('/items-modal', purchaseOrderController.getItemsForModal);
router.get('/list', purchaseOrderController.getPurchaseOrders);
router.get('/vendors/search', purchaseOrderController.getVendorFilterOptions);
router.get('/series', purchaseOrderController.getDocumentSeries);
router.get('/series/:series/next-number', purchaseOrderController.getNextNumber);
router.get('/vendors/:vendorCode', purchaseOrderController.getVendorDetails);
router.get('/state/:vendorCode/:addressCode', purchaseOrderController.getStateFromAddress);
router.get('/warehouse-state/:whsCode', purchaseOrderController.getStateFromWarehouse);
router.get('/open-purchase-quotations', purchaseOrderController.getOpenPurchaseQuotations);
router.get('/open-purchase-requests', purchaseOrderController.getOpenPurchaseRequests);
router.get('/quotation/:docEntry/copy', purchaseOrderController.getPurchaseQuotationForCopy);
router.get('/request/:docEntry/copy', purchaseOrderController.getPurchaseRequestForCopy);
router.get('/freight-charges', purchaseOrderController.getFreightCharges);
router.get('/:docEntry', purchaseOrderController.getPurchaseOrderByDocEntry);
router.post('/submit', purchaseOrderController.submitPurchaseOrder);
router.post('/', purchaseOrderController.submitPurchaseOrder);
router.patch('/:docEntry', purchaseOrderController.updatePurchaseOrder);

module.exports = router;
