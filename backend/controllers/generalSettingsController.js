const generalSettingsService = require('../services/generalSettingsService');

const getAssignedSettings = async (req, res, next) => {
  try {
    res.json({ settings: await generalSettingsService.getSettingsForAuth(req.auth) });
  } catch (error) {
    next(error);
  }
};

const getAdminBootstrap = async (_req, res, next) => {
  try {
    res.json(await generalSettingsService.getAdminBootstrap());
  } catch (error) {
    next(error);
  }
};

const getAdminSettings = async (req, res, next) => {
  try {
    res.json(await generalSettingsService.getAdminSettings(req.query.userId, req.query.companyId));
  } catch (error) {
    next(error);
  }
};

const saveAdminSettings = async (req, res, next) => {
  try {
    res.json(await generalSettingsService.saveAdminSettings(
      req.body?.userId,
      req.body?.companyId,
      req.body?.settings,
    ));
  } catch (error) {
    next(error);
  }
};

const getAdminOptions = async (req, res, next) => {
  try {
    res.json(await generalSettingsService.getAdminOptions(
      req,
      req.query.userId,
      req.query.companyId,
      req.query.date,
    ));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAssignedSettings,
  getAdminBootstrap,
  getAdminSettings,
  saveAdminSettings,
  getAdminOptions,
};
