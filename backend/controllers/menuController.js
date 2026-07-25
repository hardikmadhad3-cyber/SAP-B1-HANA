const authService = require('../services/authService');

const getMenu = async (req, res, next) => {
  try {
    const result = await authService.getMenuForRole(req.auth.roleId, req.auth.companyId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMenu,
};
