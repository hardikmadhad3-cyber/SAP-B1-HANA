const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

module.exports = {
  port: Number(process.env.PORT || 5001),
  jwtSecret: process.env.JWT_SECRET || 'sap-b1-auth-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  pendingJwtExpiresIn: process.env.PENDING_JWT_EXPIRES_IN || '15m',
  sapBaseUrl: process.env.SAP_BASE_URL || '',
  sapUsername: process.env.SAP_USERNAME || '',
  sapPassword: process.env.SAP_PASSWORD || '',
  sapCompanyDb: process.env.SAP_COMPANY_DB || '',
  sapRejectUnauthorized: parseBoolean(process.env.SAP_REJECT_UNAUTHORIZED, false),
  reportServiceBaseUrl: process.env.SAP_REPORT_SERVICE_BASE_URL || 'https://DESKTOP-ICFN0OJ:60020',
  reportServiceDefaultDocCode: process.env.SAP_REPORT_SERVICE_DEFAULT_DOC_CODE || 'RDR20010',
  reportServiceDefaultSchema: process.env.SAP_REPORT_SERVICE_DEFAULT_SCHEMA || 'NCPL_110126',
  reportServiceTimeoutMs: Number(process.env.SAP_REPORT_SERVICE_TIMEOUT_MS || 60000),
  reportServiceRejectUnauthorized: parseBoolean(process.env.SAP_REPORT_SERVICE_REJECT_UNAUTHORIZED, false),
  reportServiceUsername: process.env.SAP_REPORT_SERVICE_USERNAME || process.env.SAP_USERNAME || '',
  reportServicePassword: process.env.SAP_REPORT_SERVICE_PASSWORD || process.env.SAP_PASSWORD || '',
  reportServiceCompanyDb: process.env.SAP_REPORT_SERVICE_COMPANY_DB || process.env.SAP_COMPANY_DB || '',
  incomingPaymentCashAccount: process.env.INCOMING_PAYMENT_CASH_ACCOUNT || '',
  outgoingPaymentCashAccount: process.env.OUTGOING_PAYMENT_CASH_ACCOUNT || '',
  // Direct SQL Server
  dbServer:    process.env.DB_SERVER    || '',
  dbInstance:  process.env.DB_INSTANCE  || '',
  dbName:      process.env.DB_NAME      || '',
  authDbName:  process.env.AUTH_DB_NAME || 'henny_master',
  dbUser:      process.env.DB_USER      || '',
  dbPassword:  process.env.DB_PASSWORD  || '',
  dbEncrypt:   parseBoolean(process.env.DB_ENCRYPT,   false),
  dbTrustCert: parseBoolean(process.env.DB_TRUST_CERT, true),
};
