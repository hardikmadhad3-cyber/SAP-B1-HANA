const express = require('express');
const router = express.Router();
const { getPerformanceStats } = require('../controllers/performanceController');

// GET /api/performance/stats - Get performance statistics
router.get('/stats', getPerformanceStats);

module.exports = router;
