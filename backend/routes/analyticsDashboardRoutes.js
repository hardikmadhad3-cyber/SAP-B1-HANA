const express = require('express');
const analyticsDashboardController = require('../controllers/analyticsDashboardController');
const analyticsDashboardViewerService = require('../services/analyticsDashboardViewerService');

const router = express.Router();

const respondError = (res, error, fallback) =>
  res.status(error.statusCode || 500).json({ message: error?.message || fallback });

router.get('/roles', analyticsDashboardController.listRoles);

router.get('/dashboards', analyticsDashboardController.listDashboards);
router.post('/dashboards', analyticsDashboardController.createDashboard);
router.get('/dashboards/:id', analyticsDashboardController.getDashboardById);
router.put('/dashboards/:id', analyticsDashboardController.updateDashboard);
router.delete('/dashboards/:id', analyticsDashboardController.deleteDashboard);
router.post('/dashboards/:id/publish', analyticsDashboardController.publishDashboard);
router.post('/dashboards/:id/unpublish', analyticsDashboardController.unpublishDashboard);
router.post('/dashboards/:id/widgets', analyticsDashboardController.addWidget);
router.put('/dashboards/:id/widgets/:widgetId', analyticsDashboardController.updateWidget);
router.delete('/dashboards/:id/widgets/:widgetId', analyticsDashboardController.removeWidget);

router.get('/dashboard-view/:dashboardCode', async (req, res) => {
  try {
    const data = await analyticsDashboardViewerService.getDashboardShell(req.params.dashboardCode, req.auth);
    res.json(data);
  } catch (error) {
    respondError(res, error, 'Failed to load dashboard.');
  }
});

router.post('/dashboard-view/:dashboardCode/widgets/:widgetId/run', async (req, res) => {
  try {
    const data = await analyticsDashboardViewerService.runWidget(
      req.params.dashboardCode, req.params.widgetId, req.body || {}, req.auth,
    );
    res.json(data);
  } catch (error) {
    respondError(res, error, 'Failed to run widget.');
  }
});

module.exports = router;
