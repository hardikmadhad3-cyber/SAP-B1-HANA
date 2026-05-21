# Implementation Plan: Web Performance Optimization

## Overview

This implementation plan breaks down the comprehensive performance optimization of the SAP-B1 Web Client into actionable coding tasks. The optimization follows a phased approach targeting both frontend (React 19.2.4) and backend (Node.js/Express) components through six core strategies: lazy loading, code splitting, bundle optimization, API caching, database query optimization, and performance monitoring.

The implementation prioritizes quick wins (lazy loading, code splitting) before deeper optimizations (database tuning), allowing for incremental delivery of value while managing risk.

## Tasks

- [x] 1. Phase 0: Baseline Measurement and Monitoring Setup
  - [x] 1.1 Install and configure performance monitoring tools
    - Install development dependencies: @craco/craco, webpack-bundle-analyzer, source-map-explorer, @lhci/cli, compression-webpack-plugin
    - Create .lighthouserc.json configuration file for Lighthouse CI
    - Add npm scripts for bundle analysis (analyze, build:analyze)
    - _Requirements: 6.1, 6.2_
  
  - [x] 1.2 Implement backend API timing middleware
    - Create middleware/apiTiming.js with request duration logging
    - Add X-Response-Time header to all API responses
    - Integrate middleware into server.js
    - _Requirements: 6.3, 6.4_
  
  - [x] 1.3 Implement Web Vitals tracking in frontend
    - Update src/reportWebVitals.js to track CLS, FID, FCP, LCP, TTFB
    - Add analytics endpoint integration for production
    - _Requirements: 6.5_
  
  - [x] 1.4 Create performance dashboard endpoint
    - Create controllers/performanceController.js with metrics collection
    - Implement getPerformanceStats endpoint with request statistics
    - Add route for /api/performance/stats
    - _Requirements: 6.3_
  
  - [x] 1.5 Run baseline performance measurements
    - Execute Lighthouse audit and document current scores
    - Run webpack-bundle-analyzer and document current bundle sizes
    - Measure current page load times across network conditions
    - Document baseline metrics in a performance report
    - _Requirements: 7.3_

- [~] 2. Checkpoint - Verify monitoring infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [~] 3. Phase 1: Frontend Lazy Loading
  - [x] 3.1 Create loading and error handling components
    - Create components/RouteLoadingFallback.js with Bootstrap spinner
    - Create components/LazyLoadErrorBoundary.js error boundary component
    - Create utils/lazyWithRetry.js utility with retry logic (3 attempts, 1s interval)
    - Add CSS styles for loading indicators
    - _Requirements: 1.3_
  
  - [x] 3.2 Convert route imports to lazy loading
    - Update frontend/src/App.js to import React.lazy and Suspense
    - Keep LoginPage and Dashboard as synchronous imports
    - Convert all other route components (55+ routes) to lazy imports using React.lazy()
    - Wrap Routes in Suspense with RouteLoadingFallback
    - Wrap Suspense in LazyLoadErrorBoundary
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [ ]* 3.3 Test lazy loading functionality
    - Test navigation to all lazy-loaded routes
    - Verify loading indicators display during chunk loading
    - Verify error boundaries catch chunk load failures
    - Verify all routes render correctly with existing functionality
    - _Requirements: 1.5_
  
  - [~] 3.4 Measure Phase 1 improvements
    - Run bundle analyzer to measure bundle size reduction
    - Measure page load time improvements
    - Document metrics and compare to baseline
    - _Requirements: 7.4_

- [~] 4. Checkpoint - Verify lazy loading implementation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Phase 2: Code Splitting and Bundle Optimization
  - [x] 5.1 Configure webpack customization
    - Install @craco/craco dependency
    - Create craco.config.js with webpack configuration overrides
    - Configure splitChunks for vendor, common, and ui cache groups
    - Configure runtimeChunk as 'single'
    - Set content-based hashing for filenames and chunk filenames
    - Update package.json scripts to use craco instead of react-scripts
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 5.2 Configure bundle optimization settings
    - Add sideEffects configuration to frontend/package.json
    - Create .env.production with GENERATE_SOURCEMAP=false, INLINE_RUNTIME_CHUNK=false
    - Install compression-webpack-plugin
    - Add BundleAnalyzerPlugin to webpack config
    - _Requirements: 3.2, 3.5_
  
  - [x] 5.3 Create asset compression script
    - Create scripts/compress-assets.js for gzip compression
    - Add compress script to package.json
    - Update build script to run compression after build
    - _Requirements: 3.4_
  
  - [x] 5.4 Create bundle size validation script
    - Create scripts/validate-bundle-size.js with 500KB threshold
    - Add validation to build process
    - _Requirements: 2.5_
  
  - [x] 5.5 Audit and optimize dependencies
    - Review package.json for unused dependencies
    - Implement lazy loading for jspdf and jspdf-autotable (load only when PDF generation is triggered)
    - Remove any unused dependencies
    - _Requirements: 3.1_
  
  - [~]* 5.6 Test code splitting and bundle optimization
    - Run production build and verify separate chunks created
    - Verify no chunk exceeds 500KB
    - Verify gzip compression applied to assets
    - Verify source maps excluded from production build
    - Test all routes still function correctly
    - _Requirements: 2.5, 3.3, 3.4, 3.5_
  
  - [x] 5.7 Measure Phase 2 improvements
    - Run bundle analyzer and document chunk sizes
    - Measure total bundle size reduction
    - Compare against baseline and Phase 1 metrics
    - _Requirements: 7.4, 8.1_

- [~] 6. Checkpoint - Verify code splitting and optimization
  - Ensure all tests pass, ask the user if questions arise.

- [~] 7. Phase 3: Backend Caching Implementation
  - [x] 7.1 Install caching dependencies and create cache middleware
    - Install node-cache dependency in backend
    - Create middleware/cacheMiddleware.js with NodeCache instances (masterDataCache, staticDataCache)
    - Implement cacheMiddleware factory function with TTL support
    - Add X-Cache and X-Cache-Age headers
    - _Requirements: 4.1_
  
  - [x] 7.2 Create cache invalidation middleware
    - Create middleware/cacheInvalidation.js
    - Implement invalidateCache function with pattern matching
    - Implement invalidateCacheMiddleware for POST/PUT/DELETE operations
    - _Requirements: 4.4_
  
  - [x] 7.3 Apply caching to master data endpoints
    - Add caching to items endpoint (TTL: 1 hour)
    - Add caching to business partners endpoint (TTL: 1 hour)
    - Add caching to warehouses endpoint (TTL: 2 hours)
    - Add caching to price lists endpoint (TTL: 1 hour)
    - Add caching to tax codes endpoint (TTL: 4 hours)
    - Add caching to UoM groups endpoint (TTL: 4 hours)
    - Add caching to payment terms endpoint (TTL: 4 hours)
    - Add caching to shipping types endpoint (TTL: 4 hours)
    - Add caching to branches endpoint (TTL: 8 hours)
    - Add caching to chart of accounts endpoint (TTL: 8 hours)
    - _Requirements: 4.3, 4.5_
  
  - [x] 7.4 Apply cache invalidation to update endpoints
    - Add invalidation middleware to POST/PUT/DELETE routes for all cached endpoints
    - Ensure cache clears on successful updates (status 200-299)
    - _Requirements: 4.4_
  
  - [ ]* 7.5 Test caching functionality
    - Test cache hit returns data within 50ms
    - Test cache miss fetches from database
    - Test cache invalidation on data updates
    - Verify X-Cache headers present in responses
    - Test cache TTL expiration
    - _Requirements: 4.2, 4.4_
  
  - [~] 7.6 Measure Phase 3 improvements
    - Measure API response times for cached endpoints
    - Calculate cache hit rate
    - Compare response times to baseline
    - _Requirements: 7.4, 8.3_

- [~] 8. Checkpoint - Verify caching implementation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Phase 4: Database Query Optimization
  - [~] 9.1 Implement pagination for list endpoints
    - Update itemController.js getItems to support page and limit query parameters
    - Update businessPartnerController.js to support pagination
    - Update salesOrderController.js list endpoint to support pagination
    - Update purchaseOrderController.js list endpoint to support pagination
    - Return pagination metadata (page, limit, total, totalPages) in responses
    - Use OFFSET and FETCH NEXT for SQL Server pagination
    - _Requirements: 5.4_
  
  - [~] 9.2 Optimize queries with explicit column selection
    - Refactor item queries to select only needed columns (ItemCode, ItemName, ItemType, OnHand, Price, Active)
    - Refactor business partner queries to select only needed columns
    - Refactor order queries to select only needed columns
    - Remove SELECT * queries from all controllers
    - _Requirements: 5.3_
  
  - [~] 9.3 Implement query batching with JOINs
    - Identify N+1 query patterns in order controllers
    - Refactor order queries to JOIN with customer data in single query
    - Refactor delivery queries to JOIN with related data
    - Batch related queries where applicable
    - _Requirements: 5.5_
  
  - [~] 9.4 Create database indexes
    - Create SQL script with recommended indexes for OITM, OCRD, ORDR, OPOR, OITW tables
    - Document index creation commands
    - Provide instructions for DBA to create indexes during low-traffic period
    - _Requirements: 5.2_
  
  - [~] 9.5 Implement query performance monitoring
    - Create middleware/queryMonitoring.js with slow query logging (threshold: 1000ms)
    - Add executeQuery wrapper function for database queries
    - Log slow queries with duration and query text
    - _Requirements: 5.1_
  
  - [ ]* 9.6 Test query optimizations
    - Test pagination returns correct data subsets
    - Test no duplicate or missing records across pages
    - Verify optimized queries return same data as original queries
    - Test query execution plans show index usage
    - Verify slow queries are logged
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [~] 9.7 Measure Phase 4 improvements
    - Measure database query execution times
    - Compare query performance to baseline
    - Document query count reduction
    - _Requirements: 7.4_

- [~] 10. Checkpoint - Verify query optimization
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Phase 5: Final Validation and Documentation
  - [~] 11.1 Run comprehensive performance tests
    - Execute Lighthouse audit and document final scores
    - Run webpack-bundle-analyzer and document final bundle sizes
    - Measure final page load times across network conditions
    - Measure final API response times for all endpoint categories
    - Calculate cache hit rates
    - _Requirements: 7.4_
  
  - [~] 11.2 Compare metrics against targets
    - Calculate bundle size reduction percentage (target: ≥40%)
    - Calculate page load time reduction percentage (target: ≥30%)
    - Calculate API response time reduction percentage (target: ≥25% for cached endpoints)
    - Verify Lighthouse performance score (target: ≥70)
    - Document whether each target was met
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 11.3 Run full regression test suite
    - Test all routes are accessible and functional
    - Test all CRUD operations work correctly
    - Test authentication and authorization
    - Test report generation
    - Verify no functionality broken by optimizations
    - _Requirements: 7.5_
  
  - [~] 11.4 Document performance improvements and maintenance guidelines
    - Create final performance report with before/after metrics
    - Document any unmet targets with reasons and alternative approaches
    - Create performance maintenance guidelines document
    - Document how to use performance monitoring tools
    - Document cache management procedures
    - _Requirements: 7.4, 8.5_

- [~] 12. Final checkpoint - Performance optimization complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout the implementation
- The phased approach prioritizes quick wins (lazy loading, code splitting) before deeper optimizations (database tuning)
- Performance targets: 40% bundle reduction, 30% load time improvement, 25% API response time improvement, Lighthouse score ≥70
- All optimizations must preserve existing functionality
- Monitoring infrastructure is set up first to measure improvements throughout the process

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.5"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.4", "5.5"] },
    { "id": 7, "tasks": ["5.6", "5.7"] },
    { "id": 8, "tasks": ["7.1", "7.2"] },
    { "id": 9, "tasks": ["7.3", "7.4"] },
    { "id": 10, "tasks": ["7.5", "7.6"] },
    { "id": 11, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 12, "tasks": ["9.6", "9.7"] },
    { "id": 13, "tasks": ["11.1"] },
    { "id": 14, "tasks": ["11.2", "11.3", "11.4"] }
  ]
}
```
