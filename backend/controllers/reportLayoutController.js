const reportLayoutService = require('../services/reportLayoutService');

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.detail ||
  error?.message ||
  fallbackMessage;

const listReports = async (_req, res, next) => {
  try {
    const data = await reportLayoutService.listReports();
    res.json({ reports: data });
  } catch (error) {
    next(error);
  }
};

const getReportFields = async (req, res, next) => {
  try {
    const data = await reportLayoutService.getReportFields(req.query.report);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const listManagerCatalog = async (req, res, next) => {
  try {
    const data = await reportLayoutService.listManagerCatalog({
      userId: req.auth?.userId,
      roleId: req.auth?.roleId,
      includeLayouts: req.query.includeLayouts !== 'false',
      query: req.query.query || '',
      entryType: req.query.entryType || '',
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const searchManagerCatalog = async (req, res, next) => {
  try {
    const data = await reportLayoutService.searchManagerCatalog({
      userId: req.auth?.userId,
      roleId: req.auth?.roleId,
      query: req.query.query || '',
      entryType: req.query.entryType || '',
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const listLayouts = async (req, res, next) => {
  try {
    const data = await reportLayoutService.listLayouts({
      reportCode: req.query.report,
      menuEntryId: req.query.menuEntryId,
      userId: req.auth?.userId,
      roleId: req.auth?.roleId,
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const createMenuEntry = async (req, res, next) => {
  try {
    const data = await reportLayoutService.createMenuEntry(req.body || {}, req.auth);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

const updateMenuEntry = async (req, res, next) => {
  try {
    const data = await reportLayoutService.updateMenuEntry(Number(req.params.id), req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const deleteMenuEntry = async (req, res, next) => {
  try {
    const data = await reportLayoutService.deleteMenuEntry(Number(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const createLayout = async (req, res, next) => {
  try {
    const data = await reportLayoutService.createLayout(req.body || {}, req.auth);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

const updateLayout = async (req, res, next) => {
  try {
    const data = await reportLayoutService.updateLayout(Number(req.params.id), req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const deleteLayout = async (req, res, next) => {
  try {
    const data = await reportLayoutService.deleteLayout(Number(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const setDefaultLayout = async (req, res, next) => {
  try {
    const data = await reportLayoutService.setDefaultLayout(req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const copyLayout = async (req, res, next) => {
  try {
    const data = await reportLayoutService.copyLayout(Number(req.params.id), req.body || {}, req.auth);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

const getLayoutVersions = async (req, res, next) => {
  try {
    const data = await reportLayoutService.getLayoutVersions(Number(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const previewLayout = async (req, res) => {
  try {
    const data = await reportLayoutService.previewLayout(req.body || {});
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: getErrorMessage(error, 'Failed to preview report layout.'),
      detail: getErrorMessage(error, 'Failed to preview report layout.'),
    });
  }
};

module.exports = {
  listReports,
  getReportFields,
  listManagerCatalog,
  searchManagerCatalog,
  listLayouts,
  createMenuEntry,
  updateMenuEntry,
  deleteMenuEntry,
  createLayout,
  updateLayout,
  deleteLayout,
  setDefaultLayout,
  copyLayout,
  getLayoutVersions,
  previewLayout,
};
