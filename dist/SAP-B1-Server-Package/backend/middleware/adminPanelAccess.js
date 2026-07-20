const authDbService = require('../services/authDbService');

const forbidden = (message) => {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
};

const requireAdminPanelAccess = async (req, _res, next) => {
  try {
    const tokenRoleName = String(req.auth?.roleName || '').trim().toLowerCase();
    if (['admin', 'superadmin'].includes(tokenRoleName)) {
      return next();
    }

    const roleId = Number(req.auth?.roleId);
    if (!Number.isFinite(roleId)) {
      throw forbidden('A valid role is required to access the admin panel.');
    }

    const role = await authDbService.getRoleById(roleId);
    const normalizedRoleName = String(role?.RoleName || '').trim().toLowerCase();

    if (!['admin', 'superadmin'].includes(normalizedRoleName)) {
      throw forbidden('Only Admin users can access the admin panel.');
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireAdminPanelAccess,
};
