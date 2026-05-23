require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const env     = require('./config/env');

if (!env.verboseSapLogs) {
  const originalLog = console.log.bind(console);
  console.debug = () => {};
  console.log = (...args) => {
    const first = String(args[0] ?? '');
    const noisyPatterns = [
      'RECEIVED PAYLOAD',
      'SAP PAYLOAD',
      'Constructed SAP Payload',
      'Validated Payload',
      'Service Layer search result',
      'FINAL CONVERTED VALUES',
      'ODBC Data Loaded',
      'Available Sales Employees',
      'Reference data:',
      'response keys',
      '════════',
      '🔥',
      '🔍',
      '✅',
      '⚠️',
    ];

    if (noisyPatterns.some((pattern) => first.includes(pattern))) {
      return;
    }

    originalLog(...args);
  };
}

const { authenticateAccessToken } = require('./middleware/authMiddleware');
const { runWithRequestContext } = require('./services/requestContextService');
const apiTimingMiddleware = require('./middleware/apiTiming');
const { cacheMiddleware, invalidateCacheMiddleware } = require('./middleware/cacheMiddleware');

const authRoutes            = require('./routes/authRoutes');
const menuRoutes            = require('./routes/menuRoutes');
const sapRoutes             = require('./routes/sapRoutes');
const itemRoutes            = require('./routes/itemRoutes');
const businessPartnerRoutes = require('./routes/businessPartnerRoutes');
const warehouseRoutes       = require('./routes/warehouseRoutes');
const priceListRoutes       = require('./routes/priceListRoutes');
const taxCodeRoutes         = require('./routes/taxCodeRoutes');
const uomGroupRoutes        = require('./routes/uomGroupRoutes');
const paymentTermsRoutes    = require('./routes/paymentTermsRoutes');
const shippingTypeRoutes    = require('./routes/shippingTypeRoutes');
const branchRoutes          = require('./routes/branchRoutes');
const chartOfAccountsRoutes = require('./routes/chartOfAccountsRoutes');
const purchaseOrderRoutes   = require('./routes/purchaseOrder');
const purchaseQuotationRoutes = require('./routes/purchaseQuotation');
const purchaseRequestRoutes = require('./routes/purchaseRequest');
const salesOrderRoutes      = require('./routes/salesOrder');
const salesQuotationRoutes  = require('./routes/salesQuotation');
const blanketAgreementRoutes = require('./routes/blanketAgreement');
const printRoutes           = require('./routes/printRoutes');
const documentPrintRoutes   = require('./routes/documentPrintRoutes');
const reportLayoutRoutes    = require('./routes/reportLayoutRoutes');
const salesAnalysisRoutes   = require('./routes/salesAnalysisRoutes');
const bomRoutes             = require('./routes/bomRoutes');
const productionOrderRoutes    = require('./routes/productionOrder');
const issueForProductionRoutes   = require('./routes/issueForProduction');
const receiptFromProductionRoutes = require('./routes/receiptFromProduction');
const grpoRoutes                 = require('./routes/grpo');
const deliveryRoutes             = require('./routes/delivery');
const apInvoiceRoutes            = require('./routes/apInvoice');
const arInvoiceRoutes            = require('./routes/arInvoice');
const serviceArInvoiceRoutes      = require('./routes/serviceArInvoice');
const serviceApInvoiceRoutes      = require('./routes/serviceApInvoice');
const incomingPaymentsRoutes      = require('./routes/incomingPayments');
const outgoingPaymentsRoutes      = require('./routes/outgoingPayments');
const apCreditMemoRoutes         = require('./routes/apCreditMemo');
const arCreditMemoRoutes         = require('./routes/arCreditMemo');
const hsnCodeRoutes              = require('./routes/hsnCodeRoutes');
const goodsReceiptRoutes         = require('./routes/goodsReceipt');
const goodsReceiptController     = require('./controllers/goodsReceiptController');
const goodsIssueRoutes           = require('./routes/goodsIssue');
const inventoryTransferRequestRoutes = require('./routes/inventoryTransferRequest');
const inventoryTransferRoutes    = require('./routes/inventoryTransfer');
const purchaseAnalysisRoutes     = require('./routes/reports/purchaseAnalysis.routes');
const purchaseRequestReportRoutes = require('./routes/reports/purchaseRequestReport.routes');
const reportStudioRoutes         = require('./routes/reportStudioRoutes');
const reportLookupsRoutes        = require('./routes/reportLookups');
const adminPanelRoutes           = require('./routes/adminPanelRoutes');
const performanceRoutes          = require('./routes/performanceRoutes');

const app = express();

const masterDataCache = (namespace, ttlSeconds) => [
  cacheMiddleware({ namespace, ttlSeconds }),
  invalidateCacheMiddleware(namespace),
];

const isReusableLookupRequest = (req) => {
  if (req.method !== 'GET') return false;

  const path = req.path.toLowerCase();
  return (
    path.endsWith('/reference-data') ||
    path.includes('/lookup/') ||
    path.endsWith('/metadata') ||
    path.endsWith('/series') ||
    path.includes('/series/') ||
    path.endsWith('/items-modal') ||
    path.endsWith('/freight-charges') ||
    path.endsWith('/print-layouts') ||
    path.includes('/warehouse-state') ||
    path.includes('/state-from-address')
  );
};

const reusableLookupCache = cacheMiddleware({
  namespace: (req) => `lookup:${req.path.toLowerCase()}`,
  ttlSeconds: 300,
  shouldCache: isReusableLookupRequest,
});

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  try {
    const { protocol, hostname, port } = new URL(origin);
    if (protocol !== 'http:' || !['3000', '3001'].includes(port)) {
      return false;
    }

    const isPrivateLanHost =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      isPrivateLanHost
    );
  } catch (_error) {
    return false;
  }
};


const redactSensitiveFields = (value) => {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(redactSensitiveFields);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => {
      if (/(password|token|secret)/i.test(key)) {
        return [key, '[REDACTED]'];
      }

      return [key, redactSensitiveFields(fieldValue)];
    }),
  );
};

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (error, origin) => {
  console.error('[UNCAUGHT_EXCEPTION]', origin || 'unknown');
  console.error(error?.stack || error?.message || error);
});

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(apiTimingMiddleware);
app.use((req, res, next) => runWithRequestContext(req, next));

// Request logging middleware
app.use((req, res, next) => {
  const isWriteRequest = req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT';
  if (isWriteRequest) {
    console.log(`[${req.method}] ${req.path}`);
    console.log('Request body:', JSON.stringify(redactSensitiveFields(req.body), null, 2));
  } else if (env.verboseRequestLogs) {
    console.log(`[${req.method}] ${req.path}`);
  }
  next();
});

app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (!req.path.startsWith('/api')) return next();
  if (
    req.path === '/api/login' ||
    req.path === '/api/companies-public' ||
    req.path === '/api/select-company' ||
    req.path.startsWith('/api/companies/')
  ) {
    return next();
  }
  return authenticateAccessToken(req, res, next);
});

app.use('/api', reusableLookupCache);

// Routes
app.use('/api',                    authRoutes);
app.use('/api/menu',               menuRoutes);
app.get('/api/items',              cacheMiddleware({ namespace: 'items', ttlSeconds: 3600 }), goodsReceiptController.getItems);
app.use('/api/items',              ...masterDataCache('items', 3600), itemRoutes);
app.use('/api/business-partners',  ...masterDataCache('business-partners', 3600), businessPartnerRoutes);
app.get('/api/warehouses',         cacheMiddleware({ namespace: 'warehouses', ttlSeconds: 7200 }), goodsReceiptController.getWarehouses);
app.use('/api/warehouses',         ...masterDataCache('warehouses', 7200), warehouseRoutes);
app.use('/api/price-lists',        ...masterDataCache('price-lists', 3600), priceListRoutes);
app.use('/api/tax-codes',          ...masterDataCache('tax-codes', 14400), taxCodeRoutes);
app.use('/api/uom-groups',         ...masterDataCache('uom-groups', 14400), uomGroupRoutes);
app.use('/api/payment-terms',      ...masterDataCache('payment-terms', 14400), paymentTermsRoutes);
app.use('/api/shipping-types',     ...masterDataCache('shipping-types', 14400), shippingTypeRoutes);
app.use('/api/branches',           ...masterDataCache('branches', 28800), branchRoutes);
app.use('/api/chart-of-accounts',  ...masterDataCache('chart-of-accounts', 28800), chartOfAccountsRoutes);
app.get('/api/series',             goodsReceiptController.getSeries);
app.get('/api/purchase-orders',    goodsReceiptController.getPurchaseOrders);
app.use('/api/purchase-order',     purchaseOrderRoutes);
app.use('/api/purchase-quotation', purchaseQuotationRoutes);
app.use('/api/purchase-request',   purchaseRequestRoutes);
app.use('/api/sales-order',        salesOrderRoutes);
app.use('/api/sales-quotation',    salesQuotationRoutes);
app.use('/api/blanket-agreements', blanketAgreementRoutes);
app.use('/api',                    printRoutes);
app.use('/api/document-print',     documentPrintRoutes);
app.use('/api',                    reportLayoutRoutes);
app.use('/api',                    reportStudioRoutes);
app.use('/api/reports',            salesAnalysisRoutes);
app.use('/api/bom',                bomRoutes);
app.use('/api/production-order',   productionOrderRoutes);
app.use('/api/issue-for-production',    issueForProductionRoutes);
app.use('/api/receipt-from-production', receiptFromProductionRoutes);
app.use('/api/grpo',               grpoRoutes);
app.use('/api/delivery',           deliveryRoutes);
app.use('/api/ap-invoice',         apInvoiceRoutes);
app.use('/api/ar-invoice',         arInvoiceRoutes);
app.use('/api/services/ar-invoice', serviceArInvoiceRoutes);
app.use('/api/services/ap-invoice', serviceApInvoiceRoutes);
app.use('/api/incoming-payments',  incomingPaymentsRoutes);
app.use('/api/outgoing-payments',  outgoingPaymentsRoutes);
app.use('/api/ap-credit-memo',     apCreditMemoRoutes);
app.use('/api/ar-credit-memo',     arCreditMemoRoutes);
app.use('/api/hsn-codes',          hsnCodeRoutes);
app.use('/api/goods-receipt',      goodsReceiptRoutes);
app.use('/api/goods-issue',        goodsIssueRoutes);
app.use('/api/inventory-transfer-request', inventoryTransferRequestRoutes);
app.use('/api/inventory-transfer', inventoryTransferRoutes);
app.use('/api/reports',            purchaseAnalysisRoutes);
app.use('/api/reports',            purchaseRequestReportRoutes);
app.use('/api/lookups',            reportLookupsRoutes);
app.use('/api/admin-panel',        adminPanelRoutes);
app.use('/api/performance',        performanceRoutes);
app.use('/api',                    sapRoutes);

// Health check
app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    message: 'Backend is running',
    host: '0.0.0.0',
    port: env.port,
  }));

// SAP connection debug — remove in production
app.get('/api/debug/production-orders', async (_req, res) => {
  try {
    const sapService = require('./services/sapService');
    await sapService.ensureSession();
    const resp = await sapService.request({
      method: 'GET',
      url: `/ProductionOrders?$select=DocEntry,DocNum,ItemNo,ProductionOrderStatus&$top=5`,
    });
    res.json({ ok: true, count: resp.data?.value?.length, sample: resp.data?.value });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.response?.data || e.message });
  }
});

// Serve static files from the React frontend build for single-port LAN access
const path = require('path');
const fs = require('fs');
const frontendBuildPath = path.join(__dirname, '../frontend/build');

app.use((req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return next();
  if (!/\.(js|css|html|svg)$/.test(req.path)) return next();

  const requestedPath = path.normalize(path.join(frontendBuildPath, decodeURIComponent(req.path)));
  if (!requestedPath.startsWith(frontendBuildPath)) return next();

  const gzipPath = `${requestedPath}.gz`;
  if (!fs.existsSync(gzipPath)) return next();

  if (requestedPath.includes(`${path.sep}static${path.sep}`)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.set('Cache-Control', 'no-cache');
  }

  res.set('Content-Encoding', 'gzip');
  res.set('Vary', 'Accept-Encoding');
  res.type(requestedPath);
  return res.sendFile(gzipPath);
});

app.use(express.static(frontendBuildPath, {
  setHeaders(res, filePath) {
    if (filePath.includes(`${path.sep}static${path.sep}`)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return;
    }

    res.set('Cache-Control', 'no-cache');
  },
}));

// Catch-all route to serve the React index.html for frontend routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  console.error('[ERROR_STACK]', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`[Server] Running on http://0.0.0.0:${env.port} (accessible on LAN)`);
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.log(`[SERVER_INFO] Port ${env.port} is already in use. Another backend instance is already running, so this duplicate start will close.`);
    process.exit(0);
    return;
  }

  console.error('[SERVER_ERROR]', error?.stack || error?.message || error);
});
