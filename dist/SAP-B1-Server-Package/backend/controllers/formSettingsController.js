const formSettingsService = require('../services/formSettingsService');

const getFormSettings = async (req, res, next) => {
  try {
    const result = await formSettingsService.getFormSettings(req.auth, req.params.formKey);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const saveFormSettings = async (req, res, next) => {
  try {
    const result = await formSettingsService.saveFormSettings(
      req.auth,
      req.params.formKey,
      req.body?.settings,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFormSettings,
  saveFormSettings,
};
