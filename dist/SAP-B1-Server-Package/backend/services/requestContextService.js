const { AsyncLocalStorage } = require('async_hooks');

const requestContextStorage = new AsyncLocalStorage();

const runWithRequestContext = (req, callback) =>
  requestContextStorage.run({ req }, callback);

const getRequestContext = () => requestContextStorage.getStore() || null;

const getOrSetContextValue = (key, factory) => {
  const context = getRequestContext();
  if (!context) return factory();

  if (!Object.prototype.hasOwnProperty.call(context, key)) {
    context[key] = factory();
  }

  return context[key];
};

module.exports = {
  runWithRequestContext,
  getRequestContext,
  getOrSetContextValue,
};
