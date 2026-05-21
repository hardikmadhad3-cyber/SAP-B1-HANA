/**
 * Adds X-Response-Time header to all API responses.
 */

function apiTimingMiddleware(req, res, next) {
  const startTime = Date.now();
  const originalEnd = res.end;

  res.end = function(...args) {
    const duration = Date.now() - startTime;

    res.setHeader('X-Response-Time', `${duration}ms`);
    originalEnd.apply(res, args);
  };

  next();
}

module.exports = apiTimingMiddleware;
