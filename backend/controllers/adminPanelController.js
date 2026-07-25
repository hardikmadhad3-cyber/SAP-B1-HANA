const adminPanelService = require('../services/adminPanelService');

const listEntities = async (_req, res, next) => {
  try {
    const entities = await adminPanelService.getEntityList();
    res.json({ entities });
  } catch (error) {
    next(error);
  }
};

const getEntityBootstrap = async (req, res, next) => {
  try {
    const payload = await adminPanelService.getEntityBootstrap(req.params.entityKey);
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

const createRecord = async (req, res, next) => {
  try {
    const payload = await adminPanelService.createRecord(req.params.entityKey, req.body || {}, req.auth);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
};

const updateRecord = async (req, res, next) => {
  try {
    const payload = await adminPanelService.updateRecord(
      req.params.entityKey,
      req.params.recordId,
      req.body || {},
      req.auth,
    );
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

const deleteRecord = async (req, res, next) => {
  try {
    const payload = await adminPanelService.deleteRecord(req.params.entityKey, req.params.recordId);
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listEntities,
  getEntityBootstrap,
  createRecord,
  updateRecord,
  deleteRecord,
};
