const express = require('express');
const documentPrintController = require('../controllers/documentPrintController');

const router = express.Router();

router.get('/:documentType/layouts', documentPrintController.getLayouts);
router.get('/:documentType/parameters', documentPrintController.getLayoutParameters);
router.get('/:documentType/:docEntry/metadata', documentPrintController.getReportMetadata);
router.post('/:documentType/print', documentPrintController.printDocument);
router.post('/:documentType/download-pdf', documentPrintController.downloadPdf);
router.post('/:documentType/download-all-layouts', documentPrintController.downloadAllLayouts);

module.exports = router;
