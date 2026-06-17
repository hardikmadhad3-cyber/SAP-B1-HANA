const sapDocumentLayoutService = require('../services/sapDocumentLayoutService');

const getDocumentLayout = async (req, res, next) => {
  try {
    const result = await sapDocumentLayoutService.getDocumentLayout(req.auth, req.query || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const importDocumentLayout = async (req, res, next) => {
  try {
    const result = await sapDocumentLayoutService.importDocumentLayout(req.auth, req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const syncDocumentLayoutUdfs = async (req, res, next) => {
  try {
    const result = await sapDocumentLayoutService.syncDocumentLayoutUdfs(req.auth, req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDocumentLayout,
  importDocumentLayout,
  syncDocumentLayoutUdfs,
};
