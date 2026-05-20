const authService = require('../services/authService');
const { ensureSameUser } = require('../middleware/authMiddleware');

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await authService.login(username, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getActiveCompanies = async (_req, res, next) => {
  try {
    const companies = await authService.getActiveCompanies();
    res.json(companies);
  } catch (error) {
    next(error);
  }
};

const getCompanies = async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: 'A valid userId is required.' });
    }

    ensureSameUser(req, userId);
    const companies = await authService.getCompaniesForUser(userId);
    res.json(companies);
  } catch (error) {
    next(error);
  }
};

const selectCompany = async (req, res, next) => {
  try {
    const { userId, companyId } = req.body || {};
    if (!Number.isFinite(Number(userId)) || !Number.isFinite(Number(companyId))) {
      return res.status(400).json({ message: 'userId and companyId are required.' });
    }

    ensureSameUser(req, userId);
    const result = await authService.selectCompany(Number(userId), Number(companyId));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getActiveCompanies,
  getCompanies,
  selectCompany,
};
