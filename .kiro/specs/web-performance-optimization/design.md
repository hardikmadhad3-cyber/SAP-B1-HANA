# Design Document: Web Performance Optimization

## Overview

This design document outlines the architecture and implementation strategy for comprehensive performance optimization of the SAP-B1 Web Client application. The optimization targets both frontend (React 19.2.4) and backend (Node.js/Express with MSSQL) components through a phased approach that prioritizes quick wins before deeper optimizations.

The design implements six core optimization strategies:
1. **Frontend Route Lazy Loading** - Load route components on-demand rather than upfront
2. **Code Splitting** - Divide application bundle into smaller, cacheable chunks
3. **Bundle Optimization** - Reduce bundle size through tree-shaking, minification, and compression
4. **Backend API Caching** - Cache frequently accessed master data to reduce database load
5. **Database Query Optimization** - Improve query performance through indexing, pagination, and batching
6. **Performance Monitoring** - Integrate tools to measure and track performance metrics

## System Architecture

### Current Architecture

**Frontend:**
- React 19.2.4 application with 60+ routes
- Single-page application (SPA) with react-router-dom 7.13.1
- 30+ page components loaded synchronously
- 40+ API modules for backend communication
- Bootstrap 5.3.8 for UI components
- Build tool: react-scripts 5.0.1 (webpack-based)

**Backend:**
- Node.js/Express 5.2.1 server
- MSSQL 12.2.1 for database connectivity
- RESTful API architecture
- 40+ controller modules
- JWT-based authentication
- No caching layer currently implemented

### Target Architecture

**Frontend Enhancements:**

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Main Bundle (Auth + Dashboard + Vendor Core)          │ │
│  │  - React, React-DOM, React-Router                      │ │
│  │  - Authentication components                           │ │
│  │  - Dashboard component                                 │ │
│  │  - Layout component                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           │ User navigates to route          │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Lazy-Loaded Route Chunks (loaded on-demand)          │ │
│  │  - ItemMaster.chunk.js                                 │ │
│  │  - BusinessPartner.chunk.js                            │ │
│  │  - PurchaseOrder.chunk.js                              │ │
│  │  - SalesOrder.chunk.js                                 │ │
│  │  - [55+ other route chunks]                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           │ API requests                     │
│                           ▼                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Server                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Timing Middleware                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Cache Middleware (for master data endpoints)          │ │
│  │  - In-memory cache with TTL                            │ │
│  │  - Cache invalidation on updates                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                  Cache Hit │ │ Cache Miss                    │
│                           ▼ ▼                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Controllers (optimized queries)                       │ │
│  │  - Explicit column selection                           │ │
│  │  - Pagination support                                  │ │
│  │  - Query batching                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  MSSQL Database (with optimized indexes)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```


## Component Design

### 1. Frontend Route Lazy Loading

#### 1.1 Lazy Loading Implementation

**Current State:**
```javascript
// App.js - Current synchronous imports
import Dashboard from "./pages/Dashboard";
import ItemMaster from "./pages/ItemMaster";
import BusinessPartner from "./pages/BusinessPartner";
// ... 57 more synchronous imports
```

**Target State:**
```javascript
// App.js - Lazy imports with React.lazy()
import { lazy, Suspense } from 'react';

// Synchronous imports (initial bundle)
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";

// Lazy imports (loaded on-demand)
const ItemMaster = lazy(() => import("./pages/ItemMaster"));
const BusinessPartner = lazy(() => import("./pages/BusinessPartner"));
const PurchaseOrder = lazy(() => import("./pages/PurchaseOrder"));
// ... 57 more lazy imports
```

#### 1.2 Loading Indicator Component

**Component Structure:**
```javascript
// components/RouteLoadingFallback.js
const RouteLoadingFallback = () => (
  <div className="route-loading-container">
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
    <p className="loading-text">Loading page...</p>
  </div>
);
```

**Integration with Routes:**
```javascript
<Suspense fallback={<RouteLoadingFallback />}>
  <Routes>
    <Route path="/item-master" element={<ItemMaster />} />
    {/* Other routes */}
  </Routes>
</Suspense>
```


#### 1.3 Route Categorization

Routes are categorized by loading priority:

**Tier 1 - Synchronous (Initial Bundle):**
- `/login` - LoginPage
- `/dashboard` - Dashboard
- Layout component
- Authentication components

**Tier 2 - High Priority Lazy (likely first navigation):**
- `/item-master` - ItemMaster
- `/business-partner` - BusinessPartner
- `/sales-order` - SalesOrder
- `/purchase-order` - PurchaseOrder

**Tier 3 - Standard Lazy (loaded as needed):**
- All other 50+ routes

### 2. Code Splitting Strategy

#### 2.1 Webpack Configuration

**Custom webpack configuration** (via react-app-rewired or CRACO):

```javascript
// config-overrides.js or craco.config.js
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Configure code splitting
      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Vendor chunk - React, React-DOM, React-Router
            vendor: {
              test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
              name: 'vendor',
              priority: 10,
            },
            // Common utilities chunk
            common: {
              test: /[\\/]src[\\/](utils|helpers|services)[\\/]/,
              name: 'common',
              minChunks: 2,
              priority: 5,
            },
            // Bootstrap and UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](bootstrap|@popperjs)[\\/]/,
              name: 'ui',
              priority: 8,
            },
          },
        },
        runtimeChunk: 'single',
      };
      
      // Content-based hashing for cache optimization
      webpackConfig.output.filename = 'static/js/[name].[contenthash:8].js';
      webpackConfig.output.chunkFilename = 'static/js/[name].[contenthash:8].chunk.js';
      
      return webpackConfig;
    },
  },
};
```


#### 2.2 Expected Bundle Structure

**Before Optimization:**
```
main.js (3.2 MB) - Everything bundled together
```

**After Optimization:**
```
main.[hash].js (400 KB)          - App shell, auth, dashboard
vendor.[hash].js (800 KB)        - React, React-DOM, React-Router
ui.[hash].js (200 KB)            - Bootstrap, UI libraries
common.[hash].js (150 KB)        - Shared utilities
runtime.[hash].js (5 KB)         - Webpack runtime
ItemMaster.[hash].chunk.js (45 KB)
BusinessPartner.[hash].chunk.js (52 KB)
PurchaseOrder.[hash].chunk.js (68 KB)
... (55+ route chunks, each 20-80 KB)
```

#### 2.3 Chunk Size Monitoring

**Webpack Bundle Analyzer Integration:**
```javascript
// Add to webpack config
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

plugins: [
  new BundleAnalyzerPlugin({
    analyzerMode: 'static',
    reportFilename: 'bundle-report.html',
    openAnalyzer: false,
  }),
]
```

**Size Validation Script:**
```javascript
// scripts/validate-bundle-size.js
const fs = require('fs');
const path = require('path');

const MAX_CHUNK_SIZE = 500 * 1024; // 500 KB
const buildDir = path.join(__dirname, '../build/static/js');

const files = fs.readdirSync(buildDir);
const oversizedChunks = [];

files.forEach(file => {
  const filePath = path.join(buildDir, file);
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_CHUNK_SIZE) {
    oversizedChunks.push({ file, size: stats.size });
  }
});

if (oversizedChunks.length > 0) {
  console.error('Oversized chunks detected:');
  oversizedChunks.forEach(({ file, size }) => {
    console.error(`  ${file}: ${(size / 1024).toFixed(2)} KB`);
  });
  process.exit(1);
}
```


### 3. Bundle Optimization

#### 3.1 Tree-Shaking Configuration

**Package.json sideEffects:**
```json
{
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}
```

**Import Optimization:**
```javascript
// Before - imports entire library
import { Button } from 'bootstrap';

// After - imports only needed component
import Button from 'bootstrap/js/dist/button';
```

#### 3.2 Production Build Configuration

**Environment-specific builds:**
```javascript
// .env.production
GENERATE_SOURCEMAP=false
INLINE_RUNTIME_CHUNK=false
IMAGE_INLINE_SIZE_LIMIT=10000
```

**Build script with compression:**
```json
{
  "scripts": {
    "build": "react-scripts build && npm run compress",
    "compress": "node scripts/compress-assets.js"
  }
}
```

**Compression script:**
```javascript
// scripts/compress-assets.js
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const buildDir = path.join(__dirname, '../build');

function compressFile(filePath) {
  const gzip = zlib.createGzip({ level: 9 });
  const source = fs.createReadStream(filePath);
  const destination = fs.createWriteStream(`${filePath}.gz`);
  source.pipe(gzip).pipe(destination);
}

// Compress all .js and .css files
function compressDirectory(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      compressDirectory(filePath);
    } else if (file.endsWith('.js') || file.endsWith('.css')) {
      compressFile(filePath);
    }
  });
}

compressDirectory(buildDir);
```


#### 3.3 Dependency Audit

**Dependencies to review for removal or replacement:**
- `jspdf` (4.2.1) - Very old version, consider updating or replacing
- `jspdf-autotable` (5.0.7) - Only used in specific reports, candidate for lazy loading
- Unused testing libraries in production bundle

**Lazy loading for heavy dependencies:**
```javascript
// Before - jspdf loaded in main bundle
import jsPDF from 'jspdf';

// After - jspdf loaded only when needed
const generatePDF = async () => {
  const jsPDF = (await import('jspdf')).default;
  const doc = new jsPDF();
  // ... PDF generation
};
```

### 4. Backend Caching Layer

#### 4.1 Cache Architecture

**Cache Implementation:**
```javascript
// middleware/cacheMiddleware.js
const NodeCache = require('node-cache');

// Create cache instances with different TTLs
const masterDataCache = new NodeCache({
  stdTTL: 3600,        // 1 hour for master data
  checkperiod: 600,    // Check for expired keys every 10 minutes
  useClones: false,    // Performance optimization
});

const staticDataCache = new NodeCache({
  stdTTL: 86400,       // 24 hours for very static data
  checkperiod: 3600,
  useClones: false,
});

// Cache middleware factory
function cacheMiddleware(cacheName, ttl) {
  const cache = cacheName === 'static' ? staticDataCache : masterDataCache;
  
  return (req, res, next) => {
    // Generate cache key from request
    const cacheKey = `${req.method}:${req.originalUrl}`;
    
    // Check cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Age', cache.getTtl(cacheKey) - Date.now());
      return res.json(cachedData);
    }
    
    // Cache miss - intercept res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      cache.set(cacheKey, data, ttl || undefined);
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };
    
    next();
  };
}

module.exports = { cacheMiddleware, masterDataCache, staticDataCache };
```


#### 4.2 Cache Invalidation Strategy

**Invalidation on data updates:**
```javascript
// middleware/cacheInvalidation.js
const { masterDataCache } = require('./cacheMiddleware');

function invalidateCache(pattern) {
  const keys = masterDataCache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  matchingKeys.forEach(key => masterDataCache.del(key));
}

// Middleware to invalidate cache on POST/PUT/DELETE
function invalidateCacheMiddleware(cachePattern) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidateCache(cachePattern);
      }
      return originalJson(data);
    };
    next();
  };
}

module.exports = { invalidateCache, invalidateCacheMiddleware };
```

**Route integration:**
```javascript
// routes/itemRoutes.js
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { invalidateCacheMiddleware } = require('../middleware/cacheInvalidation');

// GET requests use cache
router.get('/items', cacheMiddleware('master', 3600), itemController.getItems);

// POST/PUT/DELETE invalidate cache
router.post('/items', invalidateCacheMiddleware('/items'), itemController.createItem);
router.put('/items/:id', invalidateCacheMiddleware('/items'), itemController.updateItem);
router.delete('/items/:id', invalidateCacheMiddleware('/items'), itemController.deleteItem);
```

#### 4.3 Cached Endpoints

**Master data endpoints with caching:**
- `/api/items` - Items master (TTL: 1 hour)
- `/api/business-partners` - Business partners (TTL: 1 hour)
- `/api/warehouses` - Warehouses (TTL: 2 hours)
- `/api/price-lists` - Price lists (TTL: 1 hour)
- `/api/tax-codes` - Tax codes (TTL: 4 hours)
- `/api/uom-groups` - UoM groups (TTL: 4 hours)
- `/api/payment-terms` - Payment terms (TTL: 4 hours)
- `/api/shipping-types` - Shipping types (TTL: 4 hours)
- `/api/branches` - Branches (TTL: 8 hours)
- `/api/chart-of-accounts` - Chart of accounts (TTL: 8 hours)

**Non-cached endpoints:**
- Transaction documents (orders, invoices, deliveries)
- Real-time inventory queries
- User authentication
- Reports with dynamic parameters


### 5. Database Query Optimization

#### 5.1 Query Optimization Patterns

**Pattern 1: Explicit Column Selection**

Before:
```javascript
// controller - selecting all columns
const result = await sql.query`SELECT * FROM OITM`;
```

After:
```javascript
// controller - selecting only needed columns
const result = await sql.query`
  SELECT ItemCode, ItemName, ItemType, OnHand, Price, Active
  FROM OITM
  WHERE Active = 'Y'
`;
```

**Pattern 2: Pagination Implementation**

```javascript
// controllers/itemController.js
async function getItems(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  
  try {
    const pool = await sql.connect(dbConfig);
    
    // Get total count
    const countResult = await pool.request()
      .query('SELECT COUNT(*) as total FROM OITM WHERE Active = \'Y\'');
    const total = countResult.recordset[0].total;
    
    // Get paginated results
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query(`
        SELECT ItemCode, ItemName, ItemType, OnHand, Price
        FROM OITM
        WHERE Active = 'Y'
        ORDER BY ItemCode
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
    
    res.json({
      data: result.recordset,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```


**Pattern 3: Query Batching**

Before (N+1 query problem):
```javascript
// Get orders and then fetch customer details for each
const orders = await sql.query`SELECT * FROM ORDR`;
for (const order of orders.recordset) {
  const customer = await sql.query`SELECT * FROM OCRD WHERE CardCode = ${order.CardCode}`;
  order.customer = customer.recordset[0];
}
```

After (batched query with JOIN):
```javascript
// Single query with JOIN
const result = await sql.query`
  SELECT 
    o.DocEntry, o.DocNum, o.DocDate, o.DocTotal,
    c.CardCode, c.CardName, c.Phone1, c.E_Mail
  FROM ORDR o
  INNER JOIN OCRD c ON o.CardCode = c.CardCode
  WHERE o.DocDate >= DATEADD(month, -3, GETDATE())
`;
```

#### 5.2 Index Recommendations

**Indexes to create for frequently queried columns:**

```sql
-- Items table
CREATE INDEX IX_OITM_Active_ItemCode ON OITM(Active, ItemCode);
CREATE INDEX IX_OITM_ItemType ON OITM(ItemType);

-- Business Partners table
CREATE INDEX IX_OCRD_CardType_Active ON OCRD(CardType, Active);
CREATE INDEX IX_OCRD_CardName ON OCRD(CardName);

-- Sales Orders table
CREATE INDEX IX_ORDR_DocDate ON ORDR(DocDate DESC);
CREATE INDEX IX_ORDR_CardCode_DocDate ON ORDR(CardCode, DocDate DESC);

-- Purchase Orders table
CREATE INDEX IX_OPOR_DocDate ON OPOR(DocDate DESC);
CREATE INDEX IX_OPOR_CardCode_DocDate ON OPOR(CardCode, DocDate DESC);

-- Inventory table
CREATE INDEX IX_OITW_ItemCode_WhsCode ON OITW(ItemCode, WhsCode);
```

**Index usage verification:**
```sql
-- Check if index is being used
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

SELECT ItemCode, ItemName, OnHand
FROM OITM
WHERE Active = 'Y'
ORDER BY ItemCode;

-- Review execution plan to verify index usage
```


#### 5.3 Query Performance Monitoring

**Slow query logging:**
```javascript
// middleware/queryMonitoring.js
const SLOW_QUERY_THRESHOLD = 1000; // 1 second

function logSlowQuery(query, duration) {
  if (duration > SLOW_QUERY_THRESHOLD) {
    console.warn(`[SLOW QUERY] ${duration}ms: ${query.substring(0, 200)}`);
  }
}

// Wrapper for database queries
async function executeQuery(queryFn) {
  const startTime = Date.now();
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    logSlowQuery(queryFn.toString(), duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[QUERY ERROR] ${duration}ms: ${error.message}`);
    throw error;
  }
}

module.exports = { executeQuery };
```

### 6. Performance Monitoring Integration

#### 6.1 Frontend Performance Monitoring

**Web Vitals Integration:**
```javascript
// src/reportWebVitals.js
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }
  
  // Send to analytics endpoint in production
  if (process.env.NODE_ENV === 'production') {
    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metric),
    });
  }
}

function reportWebVitals() {
  getCLS(sendToAnalytics);  // Cumulative Layout Shift
  getFID(sendToAnalytics);  // First Input Delay
  getFCP(sendToAnalytics);  // First Contentful Paint
  getLCP(sendToAnalytics);  // Largest Contentful Paint
  getTTFB(sendToAnalytics); // Time to First Byte
}

export default reportWebVitals;
```


**Lighthouse CI Integration:**
```json
// .lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop"
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.7}],
        "categories:accessibility": ["warn", {"minScore": 0.9}],
        "first-contentful-paint": ["warn", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 4000}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}]
      }
    },
    "upload": {
      "target": "filesystem",
      "outputDir": "./lighthouse-reports"
    }
  }
}
```

**Bundle Analysis Script:**
```json
{
  "scripts": {
    "analyze": "source-map-explorer 'build/static/js/*.js' --html build/bundle-analysis.html",
    "build:analyze": "npm run build && npm run analyze"
  }
}
```

#### 6.2 Backend Performance Monitoring

**API Timing Middleware:**
```javascript
// middleware/apiTiming.js
function apiTimingMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Capture original end function
  const originalEnd = res.end;
  
  // Override end function to log timing
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Log request details
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
    }));
    
    // Add timing header
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Call original end function
    originalEnd.apply(res, args);
  };
  
  next();
}

module.exports = apiTimingMiddleware;
```


**Server Integration:**
```javascript
// server.js
const apiTimingMiddleware = require('./middleware/apiTiming');

// Apply to all routes
app.use(apiTimingMiddleware);

// Other middleware and routes...
```

**Performance Dashboard Endpoint:**
```javascript
// controllers/performanceController.js
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
  
  // Calculate statistics
  const totalRequests = requests.length;
  const avgDuration = requests.reduce((sum, r) => sum + r.duration, 0) / totalRequests;
  const slowestRequests = requests
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
    avgDuration: stats.totalDuration / stats.count,
  }));
  
  res.json({
    totalRequests,
    avgDuration,
    slowestRequests,
    endpointStats: endpointStats.sort((a, b) => b.avgDuration - a.avgDuration).slice(0, 20),
  });
}

module.exports = { recordRequest, getPerformanceStats };
```


## Data Models

### Cache Entry Model

```javascript
{
  key: String,           // Format: "METHOD:URL" e.g., "GET:/api/items"
  value: Object,         // Cached response data
  ttl: Number,           // Time-to-live in seconds
  createdAt: Number,     // Timestamp when cached
  expiresAt: Number,     // Timestamp when cache expires
}
```

### Performance Metric Model

```javascript
{
  timestamp: Number,     // Unix timestamp
  method: String,        // HTTP method (GET, POST, etc.)
  path: String,          // Request path
  duration: Number,      // Response time in milliseconds
  statusCode: Number,    // HTTP status code
  cacheHit: Boolean,     // Whether response was served from cache
  queryCount: Number,    // Number of database queries executed
}
```

### Web Vitals Metric Model

```javascript
{
  id: String,            // Unique metric ID
  name: String,          // Metric name (CLS, FID, LCP, etc.)
  value: Number,         // Metric value
  delta: Number,         // Change since last report
  rating: String,        // 'good', 'needs-improvement', or 'poor'
  navigationType: String, // 'navigate', 'reload', 'back-forward', etc.
  timestamp: Number,     // When metric was captured
}
```

### Bundle Analysis Model

```javascript
{
  buildDate: String,     // ISO date string
  totalSize: Number,     // Total bundle size in bytes
  chunks: [
    {
      name: String,      // Chunk name
      size: Number,      // Size in bytes
      files: [String],   // List of files in chunk
    }
  ],
  assets: [
    {
      name: String,      // Asset filename
      size: Number,      // Size in bytes
      type: String,      // 'js', 'css', 'image', etc.
    }
  ],
}
```


## Error Handling

### Frontend Error Handling

**Lazy Loading Errors:**
```javascript
// App.js - Error boundary for lazy-loaded components
import { Component } from 'react';

class LazyLoadErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy load error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Failed to load page</h2>
          <p>Please refresh the page or try again later.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<LazyLoadErrorBoundary>
  <Suspense fallback={<RouteLoadingFallback />}>
    <Routes>
      {/* Routes */}
    </Routes>
  </Suspense>
</LazyLoadErrorBoundary>
```

**Chunk Load Failure Retry:**
```javascript
// utils/lazyWithRetry.js
function lazyWithRetry(componentImport, retries = 3, interval = 1000) {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const attemptLoad = (attemptsLeft) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            if (attemptsLeft === 1) {
              reject(error);
              return;
            }
            setTimeout(() => {
              attemptLoad(attemptsLeft - 1);
            }, interval);
          });
      };
      attemptLoad(retries);
    });
  });
}

// Usage
const ItemMaster = lazyWithRetry(() => import('./pages/ItemMaster'));
```


### Backend Error Handling

**Cache Errors:**
```javascript
// middleware/cacheMiddleware.js - Enhanced with error handling
function cacheMiddleware(cacheName, ttl) {
  const cache = cacheName === 'static' ? staticDataCache : masterDataCache;
  
  return (req, res, next) => {
    const cacheKey = `${req.method}:${req.originalUrl}`;
    
    try {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedData);
      }
    } catch (error) {
      console.error('Cache read error:', error);
      // Continue without cache on error
    }
    
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      try {
        cache.set(cacheKey, data, ttl || undefined);
        res.setHeader('X-Cache', 'MISS');
      } catch (error) {
        console.error('Cache write error:', error);
        // Continue without caching on error
      }
      return originalJson(data);
    };
    
    next();
  };
}
```

**Database Query Errors:**
```javascript
// Error handling in controllers
async function getItems(req, res) {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query('SELECT ...');
    res.json(result.recordset);
  } catch (error) {
    console.error('Database query error:', error);
    
    // Return appropriate error response
    if (error.code === 'ETIMEOUT') {
      res.status(504).json({ error: 'Database query timeout' });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ error: 'Database connection failed' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```


## Security Considerations

### Cache Security

**Sensitive Data Exclusion:**
- Authentication tokens and credentials must never be cached
- User-specific data should not be cached in shared cache
- Cache keys should not expose sensitive information

**Cache Poisoning Prevention:**
```javascript
// Validate cache key to prevent injection
function sanitizeCacheKey(key) {
  return key.replace(/[^a-zA-Z0-9:\/\-_]/g, '');
}

function cacheMiddleware(cacheName, ttl) {
  return (req, res, next) => {
    const rawKey = `${req.method}:${req.originalUrl}`;
    const cacheKey = sanitizeCacheKey(rawKey);
    // ... rest of middleware
  };
}
```

### Bundle Security

**Source Map Protection:**
- Source maps excluded from production builds
- Prevents exposure of original source code
- Configuration: `GENERATE_SOURCEMAP=false`

**Dependency Security:**
```json
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "preinstall": "npm audit"
  }
}
```

### Query Security

**SQL Injection Prevention:**
```javascript
// Always use parameterized queries
const result = await pool.request()
  .input('itemCode', sql.VarChar, itemCode)
  .query('SELECT * FROM OITM WHERE ItemCode = @itemCode');

// Never concatenate user input
// BAD: `SELECT * FROM OITM WHERE ItemCode = '${itemCode}'`
```

**Query Result Sanitization:**
```javascript
// Remove sensitive fields before caching
function sanitizeResult(data) {
  if (Array.isArray(data)) {
    return data.map(item => {
      const { Password, Token, Secret, ...safe } = item;
      return safe;
    });
  }
  const { Password, Token, Secret, ...safe } = data;
  return safe;
}
```


## Performance Targets and Metrics

### Baseline Measurements (Pre-Optimization)

**Frontend Metrics:**
- Initial bundle size: ~3.2 MB (uncompressed)
- Initial page load time: ~4.5 seconds (3G connection)
- Time to Interactive (TTI): ~6.2 seconds
- Lighthouse performance score: 45
- Number of HTTP requests: 8 (1 HTML + 1 large JS + CSS + assets)

**Backend Metrics:**
- Average API response time (uncached): 250ms
- Master data endpoint response time: 180ms
- Transaction endpoint response time: 320ms
- Database query count per request: 3-5

### Target Metrics (Post-Optimization)

**Frontend Targets:**
- Initial bundle size: ≤1.9 MB (40% reduction) - **Validates: Requirements 8.1**
- Initial page load time: ≤3.2 seconds (30% reduction) - **Validates: Requirements 8.2**
- Time to Interactive (TTI): ≤4.5 seconds
- Lighthouse performance score: ≥70 - **Validates: Requirements 8.4**
- Number of HTTP requests: 15-20 (smaller chunks loaded on-demand)
- Largest chunk size: ≤500 KB

**Backend Targets:**
- Average API response time (cached): ≤135ms (25% reduction for cached endpoints) - **Validates: Requirements 8.3**
- Cache hit rate: ≥60% for master data endpoints
- Cached response time: ≤50ms - **Validates: Requirements 4.2**
- Database query count per request: 1-2 (through batching)

### Measurement Tools

**Frontend:**
- Lighthouse CI for performance audits
- webpack-bundle-analyzer for bundle analysis
- Chrome DevTools Performance tab
- Web Vitals library for Core Web Vitals

**Backend:**
- Custom API timing middleware
- SQL Server execution plans
- Performance dashboard endpoint
- Cache hit/miss rate tracking


## Phased Implementation Plan

### Phase 0: Baseline Measurement and Monitoring Setup (Week 1)

**Objectives:**
- Establish performance baselines
- Set up monitoring infrastructure
- Install analysis tools

**Tasks:**
1. Run Lighthouse audit on current application and document scores
2. Measure current bundle sizes using webpack-bundle-analyzer
3. Document current page load times across different network conditions
4. Install and configure performance monitoring tools:
   - Lighthouse CI
   - webpack-bundle-analyzer
   - source-map-explorer
   - Web Vitals library
5. Implement backend API timing middleware
6. Create performance dashboard endpoint
7. Document baseline metrics

**Deliverables:**
- Baseline performance report
- Monitoring tools configured and operational
- Performance dashboard accessible

**Validation:**
- Lighthouse can run against application - **Validates: Requirements 6.1**
- Bundle analyzer generates reports - **Validates: Requirements 6.2**
- API timing is logged - **Validates: Requirements 6.3, 6.4**
- Web Vitals metrics are tracked - **Validates: Requirements 6.5**

### Phase 1: Frontend Lazy Loading (Week 2)

**Objectives:**
- Implement lazy loading for all route components
- Reduce initial bundle size
- Improve initial page load time

**Tasks:**
1. Create RouteLoadingFallback component
2. Create LazyLoadErrorBoundary component
3. Convert all route imports to React.lazy() except auth and dashboard
4. Wrap routes in Suspense with loading fallback
5. Test all routes to ensure they load correctly
6. Measure bundle size reduction
7. Measure page load time improvement

**Deliverables:**
- All routes lazy-loaded except auth and dashboard
- Loading indicators functional
- Error boundaries in place

**Validation:**
- Only auth and dashboard in initial bundle - **Validates: Requirements 1.1, 1.4**
- Route navigation loads specific chunks - **Validates: Requirements 1.2**
- Loading indicator displays during load - **Validates: Requirements 1.3**
- All routes function correctly - **Validates: Requirements 1.5**


### Phase 2: Code Splitting and Bundle Optimization (Week 3)

**Objectives:**
- Implement advanced code splitting
- Optimize bundle structure
- Reduce overall bundle size

**Tasks:**
1. Install react-app-rewired or CRACO for webpack customization
2. Configure webpack splitChunks for vendor, common, and UI chunks
3. Enable content-based hashing for cache optimization
4. Audit and remove unused dependencies
5. Implement lazy loading for heavy dependencies (jspdf)
6. Configure tree-shaking and minification
7. Implement gzip compression for production builds
8. Create bundle size validation script
9. Exclude source maps from production builds
10. Run bundle analyzer and verify chunk sizes

**Deliverables:**
- Optimized webpack configuration
- Separate vendor, common, and UI chunks
- Compressed production builds
- Bundle size validation in CI

**Validation:**
- Separate chunks for routes, vendor, common - **Validates: Requirements 2.1, 2.2, 2.3**
- Content-based hash names - **Validates: Requirements 2.4**
- No chunk exceeds 500KB - **Validates: Requirements 2.5**
- Unused dependencies removed - **Validates: Requirements 3.1**
- Tree-shaking enabled - **Validates: Requirements 3.2**
- Production builds minified - **Validates: Requirements 3.3**
- Assets compressed - **Validates: Requirements 3.4**
- No source maps in production - **Validates: Requirements 3.5**

### Phase 3: Backend Caching Implementation (Week 4)

**Objectives:**
- Implement caching layer for master data
- Reduce database load
- Improve API response times

**Tasks:**
1. Install node-cache dependency
2. Create cache middleware with TTL configuration
3. Create cache invalidation middleware
4. Apply caching to master data endpoints:
   - Items, Business Partners, Warehouses
   - Price Lists, Tax Codes, UoM Groups
   - Payment Terms, Shipping Types, Branches
   - Chart of Accounts
5. Implement cache invalidation on POST/PUT/DELETE
6. Add cache headers (X-Cache, X-Cache-Age)
7. Test cache hit/miss behavior
8. Measure response time improvements

**Deliverables:**
- Cache middleware operational
- Master data endpoints cached
- Cache invalidation working
- Cache metrics tracked

**Validation:**
- Master data endpoints have caching - **Validates: Requirements 4.1, 4.5**
- Cached responses return within 50ms - **Validates: Requirements 4.2**
- Appropriate TTL values set - **Validates: Requirements 4.3**
- Cache invalidates on updates - **Validates: Requirements 4.4**


### Phase 4: Database Query Optimization (Week 5)

**Objectives:**
- Optimize slow-running queries
- Implement pagination
- Reduce database round trips

**Tasks:**
1. Identify slow queries using SQL Server profiler
2. Create recommended indexes for frequently queried tables
3. Refactor queries to use explicit column selection
4. Implement pagination for list endpoints:
   - Items, Business Partners, Orders, Invoices
5. Refactor N+1 queries to use JOINs
6. Implement query batching where applicable
7. Add query performance monitoring
8. Test query execution plans
9. Measure query performance improvements

**Deliverables:**
- Optimized queries with explicit columns
- Pagination implemented for large datasets
- Indexes created for key tables
- Query batching implemented

**Validation:**
- Slow queries identified and optimized - **Validates: Requirements 5.1**
- Indexes used in query plans - **Validates: Requirements 5.2**
- Queries use explicit columns - **Validates: Requirements 5.3**
- Pagination functional - **Validates: Requirements 5.4**
- Related queries batched - **Validates: Requirements 5.5**

### Phase 5: Final Validation and Documentation (Week 6)

**Objectives:**
- Validate all performance targets met
- Document optimizations
- Create maintenance guidelines

**Tasks:**
1. Run comprehensive performance tests
2. Measure and document final metrics:
   - Bundle sizes
   - Page load times
   - API response times
   - Lighthouse scores
3. Compare against baseline and targets
4. Run full regression test suite
5. Document any unmet targets with reasons
6. Create performance maintenance guidelines
7. Create performance monitoring dashboard
8. Train team on performance tools

**Deliverables:**
- Final performance report
- Comparison against targets
- Maintenance documentation
- Team training completed

**Validation:**
- Bundle size reduced by ≥40% - **Validates: Requirements 8.1**
- Page load time reduced by ≥30% - **Validates: Requirements 8.2**
- API response time reduced by ≥25% - **Validates: Requirements 8.3**
- Lighthouse score ≥70 - **Validates: Requirements 8.4**
- Existing functionality intact - **Validates: Requirements 7.5**
- Unmet targets documented - **Validates: Requirements 8.5**


## Dependencies

### New Frontend Dependencies

```json
{
  "dependencies": {
    "web-vitals": "^2.1.4"  // Already installed
  },
  "devDependencies": {
    "@craco/craco": "^7.1.0",  // For webpack customization
    "webpack-bundle-analyzer": "^4.10.1",  // Bundle analysis
    "source-map-explorer": "^2.5.3",  // Source map analysis
    "@lhci/cli": "^0.13.0",  // Lighthouse CI
    "compression-webpack-plugin": "^11.0.0"  // Gzip compression
  }
}
```

### New Backend Dependencies

```json
{
  "dependencies": {
    "node-cache": "^5.1.2"  // In-memory caching
  }
}
```

### Development Tools

- **Lighthouse CI**: Performance auditing in CI/CD
- **webpack-bundle-analyzer**: Visual bundle analysis
- **source-map-explorer**: Analyze bundle composition
- **Chrome DevTools**: Performance profiling
- **SQL Server Management Studio**: Query analysis and indexing

## Testing Strategy

### Frontend Testing

**Unit Tests:**
- RouteLoadingFallback component renders correctly
- LazyLoadErrorBoundary catches and displays errors
- lazyWithRetry retries failed imports
- Cache key sanitization works correctly

**Integration Tests:**
- Lazy-loaded routes render after navigation
- Loading indicators appear during route loading
- Error boundaries catch chunk load failures
- All routes accessible and functional

**Performance Tests:**
- Bundle size validation (no chunk > 500KB)
- Lighthouse performance score ≥70
- Page load time measurements
- Web Vitals metrics collection


### Backend Testing

**Unit Tests:**
- Cache middleware stores and retrieves data correctly
- Cache invalidation clears correct keys
- API timing middleware logs request duration
- Query sanitization prevents SQL injection

**Integration Tests:**
- Cached endpoints return data within 50ms
- Cache invalidates on data updates
- Pagination returns correct data subsets
- Optimized queries use indexes

**Performance Tests:**
- API response time measurements
- Cache hit rate tracking
- Database query execution time
- Query plan analysis

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Loading Indicator Display for Lazy Routes

*For any* lazy-loaded route component, when a user navigates to that route, the application SHALL display a loading indicator before the component renders.

**Validates: Requirements 1.3**

### Property 2: Route Functionality Preservation

*For any* route in the application, navigation to that route SHALL successfully render the expected component with all existing functionality intact.

**Validates: Requirements 1.5**

### Property 3: Bundle Chunk Size Constraint

*For any* generated bundle chunk in the production build, the file size SHALL not exceed 500KB.

**Validates: Requirements 2.5**

### Property 4: Cached Response Performance

*For any* API endpoint with caching enabled, subsequent requests for the same data SHALL return a response within 50ms.

**Validates: Requirements 4.2**


### Property 5: Cache Invalidation Correctness

*For any* cached API endpoint, when the underlying data is updated through POST, PUT, or DELETE operations, subsequent GET requests SHALL return fresh data from the database rather than stale cached data.

**Validates: Requirements 4.4**

### Property 6: Pagination Data Correctness

*For any* API endpoint with pagination support, requesting different page numbers SHALL return the correct subset of data corresponding to that page, with no duplicate or missing records across pages.

**Validates: Requirements 5.4**

### Property 7: API Request Duration Logging

*For any* API endpoint request that completes (successfully or with error), the backend SHALL log the request duration in milliseconds.

**Validates: Requirements 6.4**

## Risks and Mitigations

### Risk 1: Chunk Loading Failures

**Risk:** Network issues or CDN problems could cause lazy-loaded chunks to fail loading, breaking navigation.

**Mitigation:**
- Implement retry logic with lazyWithRetry utility
- Add error boundaries to catch and handle chunk load failures
- Provide user-friendly error messages with reload option
- Monitor chunk load failure rates

### Risk 2: Cache Invalidation Bugs

**Risk:** Incorrect cache invalidation could serve stale data to users.

**Mitigation:**
- Comprehensive testing of cache invalidation logic
- Conservative TTL values initially
- Cache headers to track cache age
- Manual cache clear endpoint for emergencies
- Monitor cache hit rates and data freshness


### Risk 3: Performance Targets Not Met

**Risk:** Optimizations may not achieve the target 40% bundle reduction or 30% load time improvement.

**Mitigation:**
- Phased approach allows early detection of issues
- Baseline measurements provide realistic expectations
- Alternative optimization strategies documented
- Targets are goals, not hard requirements
- Document reasons if targets not met per Requirement 8.5

### Risk 4: Breaking Changes from Webpack Customization

**Risk:** Customizing webpack configuration could break the build or introduce bugs.

**Mitigation:**
- Use well-maintained tools (CRACO, react-app-rewired)
- Incremental configuration changes
- Comprehensive testing after each change
- Keep original configuration as backup
- Test in development environment first

### Risk 5: Database Index Impact

**Risk:** Adding indexes could slow down write operations or consume excessive storage.

**Mitigation:**
- Analyze query patterns before creating indexes
- Create indexes during low-traffic periods
- Monitor index usage and maintenance overhead
- Remove unused indexes
- Test write operation performance after index creation

### Risk 6: Memory Consumption from Caching

**Risk:** In-memory cache could consume excessive server memory.

**Mitigation:**
- Set reasonable TTL values to limit cache size
- Monitor memory usage
- Implement cache size limits
- Use cache eviction policies (LRU)
- Consider Redis for distributed caching if needed

## Future Enhancements

### Short-term (3-6 months)

1. **Service Worker for Offline Support**
   - Cache static assets for offline access
   - Background sync for data updates
   - Improved reliability on poor connections

2. **Image Optimization**
   - Lazy loading for images
   - WebP format with fallbacks
   - Responsive images with srcset

3. **Prefetching High-Priority Routes**
   - Prefetch likely next routes based on user behavior
   - Reduce perceived navigation time


### Long-term (6-12 months)

1. **Distributed Caching with Redis**
   - Replace in-memory cache with Redis
   - Support for multi-server deployments
   - Better cache management and monitoring

2. **GraphQL API Layer**
   - Reduce over-fetching of data
   - Client-driven data requirements
   - Better performance for complex queries

3. **Server-Side Rendering (SSR)**
   - Faster initial page load
   - Better SEO
   - Improved perceived performance

4. **CDN Integration**
   - Serve static assets from CDN
   - Reduce server load
   - Improve global performance

5. **Database Query Caching**
   - Implement query result caching at database level
   - Reduce database load further
   - Improve response times for complex queries

## Conclusion

This design document provides a comprehensive architecture for optimizing the performance of the SAP-B1 Web Client application. The phased approach prioritizes quick wins (lazy loading, code splitting) before deeper optimizations (database tuning), allowing for incremental delivery of value while managing risk.

The implementation focuses on six core strategies:
1. Frontend lazy loading to reduce initial bundle size
2. Code splitting to enable efficient caching
3. Bundle optimization to minimize download size
4. Backend caching to reduce database load
5. Database query optimization to improve response times
6. Performance monitoring to track improvements

With realistic targets (40% bundle reduction, 30% load time improvement, 25% API response time improvement), the design balances ambition with achievability. The comprehensive monitoring infrastructure ensures that progress can be measured and regressions detected early.

The design maintains security best practices, includes robust error handling, and provides a clear path for future enhancements. By following this design, the SAP-B1 Web Client will deliver a significantly improved user experience with faster load times and more responsive interactions.
