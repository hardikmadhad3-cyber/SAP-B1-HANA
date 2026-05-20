const { AsyncLocalStorage } = require('async_hooks');

const requestContextStorage = new AsyncLocalStorage();

const runWithRequestContext = (req, callback) =>
  requestContextStorage.run({ req }, callback);

const getRequestContext = () => requestContextStorage.getStore() || null;

module.exports = {
  runWithRequestContext,
  getRequestContext,
};
