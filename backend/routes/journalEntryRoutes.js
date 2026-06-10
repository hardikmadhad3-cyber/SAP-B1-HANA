const express = require('express');
const controller = require('../controllers/journalEntryController');

const router = express.Router();

router.post('/', controller.createManualJournalEntry);
router.post('/generate-from-ar-invoice', controller.generateFromARInvoice);
router.post('/generate-from-ap-invoice', controller.generateFromAPInvoice);

module.exports = router;
