const express = require('express');
const analyticsQueryController = require('../controllers/analyticsQueryController');

const router = express.Router();

router.get('/queries', analyticsQueryController.listQueries);
router.post('/queries', analyticsQueryController.createQuery);
router.post('/queries/preview', analyticsQueryController.previewQuery);
router.get('/queries/:id', analyticsQueryController.getQueryById);
router.put('/queries/:id', analyticsQueryController.updateQuery);
router.delete('/queries/:id', analyticsQueryController.deleteQuery);
router.post('/queries/:id/publish', analyticsQueryController.publishQuery);
router.post('/queries/:id/unpublish', analyticsQueryController.unpublishQuery);
router.post('/queries/:id/run', analyticsQueryController.runQuery);
router.get('/queries/:id/executions', analyticsQueryController.listExecutions);

module.exports = router;
