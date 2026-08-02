const express = require('express');
const controller = require('../controllers/journalEntryController');

const router = express.Router();

router.post('/preview', controller.previewJournalEntry);
router.get('/reference-data', controller.getReferenceData);
router.get('/remark-templates', controller.getRemarkTemplates);
router.get('/:transId', controller.getJournalEntryByTransId);
router.post('/', controller.createManualJournalEntry);
router.post('/generate-from-ar-invoice', controller.generateFromARInvoice);
router.post('/generate-from-ap-invoice', controller.generateFromAPInvoice);
router.post('/generate-from-ap-credit-memo', controller.generateFromAPCreditMemo);
router.post('/generate-from-ar-credit-memo', controller.generateFromARCreditMemo);

module.exports = router;
