const analyticsDashboardService = require('../services/analyticsDashboardService');

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message || error?.message || fallbackMessage;

const respondError = (res, error, fallback) =>
  res.status(error.statusCode || 500).json({ message: getErrorMessage(error, fallback) });

const listDashboards = async (req, res) => {
  try {
    const data = await analyticsDashboardService.listDashboards(req.auth, req.query || {});
    res.json({ items: data });
  } catch (error) {
    respondError(res, error, 'Failed to load dashboards.');
  }
};

const getDashboardById = async (req, res) => {
  try {
    const data = await analyticsDashboardService.getDashboardById(req.params.id, req.auth);
    res.json(data);
  } catch (error) {
    respondError(res, error, 'Failed to load dashboard.');
  }
};

const createDashboard = async (req, res) => {
  try {
    const data = await analyticsDashboardService.createDashboard(req.body || {}, req.auth);
    res.status(201).json(data);
  } catch (error) {
    respondError(res, error, 'Failed to create dashboard.');
  }
};

const updateDashboard = async (req, res) => {
  try {
    const data = await analyticsDashboardService.updateDashboard(req.params.id, req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    respondError(res, error, 'Failed to update dashboard.');
  }
};

const publishDashboard = async (req, res) => {
  try {
    const data = await analyticsDashboardService.setDashboardStatus(req.params.id, req.auth, 'Published');
    res.json(data);
  } catch (error) {
    respondError(res, error, 'Failed to publish dashboard.');
  }
};

const unpublishDashboard = async (req, res) => {
  try {
    const data = await analyticsDashboardService.setDashboardStatus(req.params.id, req.auth, 'Draft');
    res.json(data);
  } catch (error) {
    respondError(res, error, 'Failed to unpublish dashboard.');
  }
};

const deleteDashboard = async (req, res) => {
  try {
    const data = await analyticsDashboardService.deleteDashboard(req.params.id, req.auth);
    res.json(data);
  } catch (error) {
    respondError(res, error, 'Failed to delete dashboard.');
  }
};

const addWidget = async (req, res) => {
  try {
    const data = await analyticsDashboardService.addWidget(req.params.id, req.body || {}, req.auth);
    res.status(201).json(data);
  } catch (error) {
    respondError(res, error, 'Failed to add widget.');
  }
};

const updateWidget = async (req, res) => {
  try {
    const data = await analyticsDashboardService.updateWidget(req.params.id, req.params.widgetId, req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    respondError(res, error, 'Failed to update widget.');
  }
};

const removeWidget = async (req, res) => {
  try {
    const data = await analyticsDashboardService.removeWidget(req.params.id, req.params.widgetId, req.auth);
    res.json(data);
  } catch (error) {
    respondError(res, error, 'Failed to remove widget.');
  }
};

const listRoles = async (req, res) => {
  try {
    const data = await analyticsDashboardService.listRolesForCompany(req.auth);
    res.json({ items: data });
  } catch (error) {
    respondError(res, error, 'Failed to load roles.');
  }
};

module.exports = {
  listDashboards,
  getDashboardById,
  createDashboard,
  updateDashboard,
  publishDashboard,
  unpublishDashboard,
  deleteDashboard,
  addWidget,
  updateWidget,
  removeWidget,
  listRoles,
};
