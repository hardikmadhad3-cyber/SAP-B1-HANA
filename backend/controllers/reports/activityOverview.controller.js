const activityOverviewService = require("../../services/reports/activityOverview.service");

const getErrorMessage = (error) =>
  error?.message ||
  error?.response?.data?.error?.message?.value ||
  error?.response?.data?.error?.message ||
  "Could not load Activity Overview report.";

const getLookups = async (_req, res) => {
  try {
    res.json(await activityOverviewService.getLookups());
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const postActivityOverview = async (req, res) => {
  try {
    res.json(await activityOverviewService.getActivityOverview(req.body || {}));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const getActivity = async (req, res) => {
  try {
    res.json(await activityOverviewService.getActivityByNumber(req.params.activityNo));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const lookupUsers = async (req, res) => {
  try {
    res.json(await activityOverviewService.lookupUsers(req.query.query || ""));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const lookupEmployees = async (req, res) => {
  try {
    res.json(await activityOverviewService.lookupEmployees(req.query.query || ""));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const lookupRecipientLists = async (req, res) => {
  try {
    res.json(await activityOverviewService.lookupRecipientLists(req.query.query || ""));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

const lookupUserDefinedFields = async (req, res) => {
  try {
    res.json(await activityOverviewService.lookupUserDefinedFields(req.query.query || ""));
  } catch (error) {
    res.status(error.status || 500).json({ message: getErrorMessage(error) });
  }
};

module.exports = {
  getLookups,
  postActivityOverview,
  getActivity,
  lookupUsers,
  lookupEmployees,
  lookupRecipientLists,
  lookupUserDefinedFields,
};
