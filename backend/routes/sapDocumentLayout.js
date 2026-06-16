const express = require('express');
const sapDocumentLayoutController = require('../controllers/sapDocumentLayoutController');

const router = express.Router();

router.get('/document', sapDocumentLayoutController.getDocumentLayout);
router.post('/import', sapDocumentLayoutController.importDocumentLayout);
router.post('/sync-udfs', sapDocumentLayoutController.syncDocumentLayoutUdfs);

module.exports = router;
