const analyticsQueryService = require('../services/analyticsQueryService');

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message || error?.message || fallbackMessage;

const listQueries = async (req, res) => {
  try {
    const data = await analyticsQueryService.listQueries(req.auth, req.query || {});
    res.json({ items: data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to load queries.') });
  }
};

const getQueryById = async (req, res) => {
  try {
    const data = await analyticsQueryService.getQueryById(req.params.id, req.auth);
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to load query.') });
  }
};

const createQuery = async (req, res) => {
  try {
    const data = await analyticsQueryService.createQuery(req.body || {}, req.auth);
    res.status(201).json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to create query.') });
  }
};

const updateQuery = async (req, res) => {
  try {
    const data = await analyticsQueryService.updateQuery(req.params.id, req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to update query.') });
  }
};

const publishQuery = async (req, res) => {
  try {
    const data = await analyticsQueryService.setQueryStatus(req.params.id, req.auth, 'Published');
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to publish query.') });
  }
};

const unpublishQuery = async (req, res) => {
  try {
    const data = await analyticsQueryService.setQueryStatus(req.params.id, req.auth, 'Draft');
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to unpublish query.') });
  }
};

const deleteQuery = async (req, res) => {
  try {
    const data = await analyticsQueryService.deleteQuery(req.params.id, req.auth);
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to delete query.') });
  }
};

const previewQuery = async (req, res) => {
  try {
    const data = await analyticsQueryService.previewQuery(req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to run query.') });
  }
};

const runQuery = async (req, res) => {
  try {
    const data = await analyticsQueryService.runSavedQuery(req.params.id, req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to run query.') });
  }
};

const listExecutions = async (req, res) => {
  try {
    const data = await analyticsQueryService.listExecutions(req.params.id, req.auth, req.query || {});
    res.json({ items: data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: getErrorMessage(error, 'Failed to load execution log.') });
  }
};

module.exports = {
  listQueries,
  getQueryById,
  createQuery,
  updateQuery,
  publishQuery,
  unpublishQuery,
  deleteQuery,
  previewQuery,
  runQuery,
  listExecutions,
};
