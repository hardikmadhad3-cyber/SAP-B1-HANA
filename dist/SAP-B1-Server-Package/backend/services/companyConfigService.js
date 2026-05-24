const env = require('../config/env');
const authDbService = require('./authDbService');
const { getRequestContext, getOrSetContextValue } = require('./requestContextService');

const firstText = (...values) => {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }

  return '';
};

const sourceForText = (companyValue, fallbackValue, companySource = 'admin-panel', fallbackSource = 'environment') => {
  if (String(companyValue ?? '').trim()) return companySource;
  if (String(fallbackValue ?? '').trim()) return fallbackSource;
  return 'missing';
};

const reportCompanyDbSource = (company = {}) => {
  if (String(company.ReportServiceCompanyDb ?? '').trim()) return 'admin-panel';
  if (String(company.SapCompanyDb ?? '').trim() || String(company.DbName ?? '').trim()) return 'admin-panel fallback';
  if (String(env.reportServiceCompanyDb ?? '').trim()) return 'environment';
  return 'missing';
};

const reportDefaultSchemaSource = (company = {}) => {
  if (String(company.ReportServiceDefaultSchema ?? '').trim()) return 'admin-panel';
  if (
    String(company.ReportServiceCompanyDb ?? '').trim() ||
    String(company.SapCompanyDb ?? '').trim() ||
    String(company.DbName ?? '').trim()
  ) {
    return 'admin-panel fallback';
  }
  if (String(env.reportServiceDefaultSchema ?? '').trim()) return 'environment';
  return 'missing';
};

const boolFromConfig = (value, fallback = false) => {
  if (value === null || value === undefined || value === '') {
    return Boolean(fallback);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const numberFromConfig = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
};

const splitSqlServerName = (serverName = '', explicitInstance = '') => {
  const normalizedServer = String(serverName || '').trim();
  const normalizedInstance = String(explicitInstance || '').trim();
  const instanceMatch = normalizedServer.match(/^([^\\/]+)[\\/](.+)$/);

  if (instanceMatch) {
    return {
      server: instanceMatch[1],
      instanceName: instanceMatch[2],
    };
  }

  return {
    server: normalizedServer,
    instanceName: normalizedInstance || undefined,
  };
};

const getAssignedCompanyFromContext = async () => {
  const context = getRequestContext();
  const userId = Number(context?.req?.auth?.userId);
  const companyId = Number(context?.req?.auth?.companyId);

  if (!Number.isFinite(userId) || !Number.isFinite(companyId)) {
    return null;
  }

  return getOrSetContextValue(
    `assignedCompany:${userId}:${companyId}`,
    () => authDbService.getAssignedCompanyForUser(userId, companyId),
  );
};

const buildCompanyConfig = (company = {}) => {
  const sqlDatabase = firstText(company.DbName, env.dbName);
  const sapCompanyDb = firstText(company.SapCompanyDb, sqlDatabase, env.sapCompanyDb);
  const reportCompanyDb = firstText(company.ReportServiceCompanyDb, sapCompanyDb, env.reportServiceCompanyDb);
  const reportDefaultSchema = firstText(
    company.ReportServiceDefaultSchema,
    reportCompanyDb,
    sqlDatabase,
    env.reportServiceDefaultSchema,
  );

  return {
    companyId: company.CompanyId ?? null,
    companyName: firstText(company.CompanyName),
    port: numberFromConfig(company.Port, env.port),
    authDbName: firstText(company.AuthDbName, env.authDbName),
    sql: {
      server: firstText(company.DbServer, company.ServerName, env.dbServer),
      instanceName: env.dbInstance || undefined,
      database: sqlDatabase,
      user: firstText(company.DbUser, env.dbUser),
      password: firstText(company.DbPassword, env.dbPassword),
      encrypt: boolFromConfig(company.DbEncrypt, env.dbEncrypt),
      trustServerCertificate: boolFromConfig(company.DbTrustCert, env.dbTrustCert),
    },
    serviceLayer: {
      baseUrl: firstText(company.SapBaseUrl, env.sapBaseUrl),
      username: firstText(company.SapUsername, env.sapUsername),
      password: firstText(company.SapPassword, env.sapPassword),
      companyDb: sapCompanyDb,
      rejectUnauthorized: boolFromConfig(company.SapRejectUnauthorized, env.sapRejectUnauthorized),
    },
    reportService: {
      baseUrl: firstText(company.ReportServiceBaseUrl, env.reportServiceBaseUrl),
      username: firstText(company.ReportServiceUsername, env.reportServiceUsername),
      password: firstText(company.ReportServicePassword, env.reportServicePassword),
      companyDb: reportCompanyDb,
      defaultSchema: reportDefaultSchema,
      rejectUnauthorized: boolFromConfig(
        company.ReportServiceRejectUnauthorized,
        env.reportServiceRejectUnauthorized,
      ),
      fieldSources: {
        baseUrl: sourceForText(company.ReportServiceBaseUrl, env.reportServiceBaseUrl),
        username: sourceForText(company.ReportServiceUsername, env.reportServiceUsername),
        password: sourceForText(company.ReportServicePassword, env.reportServicePassword),
        companyDb: reportCompanyDbSource(company),
        defaultSchema: reportDefaultSchemaSource(company),
      },
    },
  };
};

const getActiveCompanyConfig = async (overrides = {}) => {
  const company = overrides.company || await getAssignedCompanyFromContext();
  const config = buildCompanyConfig(company || {});

  if (overrides.companyDb) {
    config.serviceLayer.companyDb = String(overrides.companyDb).trim();
    config.reportService.companyDb = String(overrides.companyDb).trim();
  }

  if (overrides.databaseName) {
    config.sql.database = String(overrides.databaseName).trim();
  }

  return config;
};

module.exports = {
  boolFromConfig,
  buildCompanyConfig,
  getActiveCompanyConfig,
  splitSqlServerName,
};
