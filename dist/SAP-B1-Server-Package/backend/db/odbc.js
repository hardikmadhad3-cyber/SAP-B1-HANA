const dbService = require('../services/dbService');

const query = async (sql, params = {}, options = {}) => dbService.query(sql, params, options);

module.exports = {
  query,
};
