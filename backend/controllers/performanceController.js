/**
 * Performance Controller
 * Collects and reports performance metrics
 */

const performanceMetrics = {
  requests: [],
  maxStoredRequests: 1000,
};

function recordRequest(method, path, duration, statusCode) {
  performanceMetrics.requests.push({
    timestamp: Date.now(),
    method,
    path,
    duration,
    statusCode,
  });
  
  // Keep only last 1000 requests
  if (performanceMetrics.requests.length > performanceMetrics.maxStoredRequests) {
    performanceMetrics.requests.shift();
  }
}

function getPerformanceStats(req, res) {
  const requests = performanceMetrics.requests;
  
  if (requests.length === 0) {
    return res.json({
      totalRequests: 0,
      avgDuration: 0,
      slowestRequests: [],
      endpointStats: [],
      message: 'No performance data collected yet',
    });
  }
  
  // Calculate statistics
  const totalRequests = requests.length;
  const avgDuration = requests.reduce((sum, r) => sum + r.duration, 0) / totalRequests;
  const slowestRequests = [...requests]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);
  
  // Group by endpoint
  const byEndpoint = requests.reduce((acc, r) => {
    const key = `${r.method} ${r.path}`;
    if (!acc[key]) {
      acc[key] = { count: 0, totalDuration: 0 };
    }
    acc[key].count++;
    acc[key].totalDuration += r.duration;
    return acc;
  }, {});
  
  const endpointStats = Object.entries(byEndpoint).map(([endpoint, stats]) => ({
    endpoint,
    count: stats.count,
    avgDuration: Math.round(stats.totalDuration / stats.count),
  }));
  
  res.json({
    totalRequests,
    avgDuration: Math.round(avgDuration),
    slowestRequests: slowestRequests.map(r => ({
      ...r,
      duration: Math.round(r.duration),
    })),
    endpointStats: endpointStats
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 20),
  });
}

module.exports = { recordRequest, getPerformanceStats };
