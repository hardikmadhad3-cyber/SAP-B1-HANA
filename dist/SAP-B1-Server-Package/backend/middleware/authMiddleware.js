const jwt = require('jsonwebtoken');
const env = require('../config/env');

const unauthorized = (message = 'Authentication required.') => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const forbidden = (message = 'You do not have permission to perform this action.') => {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
};

const getBearerToken = (req) => {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
};

const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

const authenticateAccessToken = (req, _res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) throw unauthorized();

    const payload = verifyToken(token);
    if (payload.tokenType !== 'access') {
      throw unauthorized('A company session must be selected before accessing this resource.');
    }

    req.auth = payload;
    next();
  } catch (error) {
    next(error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError'
      ? unauthorized('Your session has expired. Please sign in again.')
      : error);
  }
};

const authenticatePendingOrAccessToken = (req, _res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) throw unauthorized();

    req.auth = verifyToken(token);
    next();
  } catch (error) {
    next(error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError'
      ? unauthorized('Your session has expired. Please sign in again.')
      : error);
  }
};

const ensureSameUser = (req, userId) => {
  if (Number(req.auth?.userId) !== Number(userId)) {
    throw forbidden('You can only access your own company assignments.');
  }
};

module.exports = {
  authenticateAccessToken,
  authenticatePendingOrAccessToken,
  ensureSameUser,
};
