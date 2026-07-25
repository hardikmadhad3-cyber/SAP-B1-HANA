const express = require('express');
const apCreditMemoController = require('../controllers/apCreditMemoController');

const router = express.Router();

router.get('/reference-data', apCreditMemoController.getReferenceData);
router.get('/items-modal', apCreditMemoController.getItemsForModal);
router.get('/list', apCreditMemoController.getAPCreditMemos);
router.get('/vendors/search', apCreditMemoController.getVendorFilterOptions);
router.get('/series', apCreditMemoController.getDocumentSeries);
router.get('/series/:series/next-number', apCreditMemoController.getNextNumber);
router.get('/vendors/:vendorCode', apCreditMemoController.getVendorDetails);
router.get('/warehouse-state/:whsCode', apCreditMemoController.getStateFromWarehouse);
router.get('/open-grpo', apCreditMemoController.getOpenGRPO);
router.get('/grpo/:docEntry', apCreditMemoController.getGRPOForCopy);
router.get('/freight-charges', apCreditMemoController.getFreightCharges);
router.get('/:docEntry', apCreditMemoController.getAPCreditMemoByDocEntry);
router.post('/submit', apCreditMemoController.submitAPCreditMemo);
router.post('/', apCreditMemoController.submitAPCreditMemo);
router.patch('/:docEntry', apCreditMemoController.updateAPCreditMemo);

module.exports = router;
