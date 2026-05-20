/**
 * Direct SQL Server connection to SAP B1 company database.
 * Uses mssql (TDS protocol) and automatically resolves the
 * active company database from the logged-in user's assignment.
 */
const sql = require('mssql');
const env = require('../config/env');
const authDbService = require('./authDbService');
const { getRequestContext } = require('./requestContextService');

const buildConfig = (databaseName = env.dbName) => ({
  server: env.dbServer,
  database: databaseName,
  options: {
    instanceName: env.dbInstance || undefined,
    trustServerCertificate: env.dbTrustCert,
    encrypt: env.dbEncrypt,
  },
  authentication: {
    type: 'default',
    options: { userName: env.dbUser, password: env.dbPassword },
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
});

const pools = new Map();
const pendingPools = new Map();

const resolveDatabaseName = async (options = {}) => {
  const explicitDatabaseName = String(options.databaseName || '').trim();
  if (explicitDatabaseName) {
    return explicitDatabaseName;
  }

  const context = getRequestContext();
  if (context?.databaseName) {
    return context.databaseName;
  }

  const userId = Number(context?.req?.auth?.userId);
  const companyId = Number(context?.req?.auth?.companyId);

  if (Number.isFinite(userId) && Number.isFinite(companyId)) {
    const assignedCompany = await authDbService.getAssignedCompanyForUser(userId, companyId);
    const resolvedFromAssignment = String(assignedCompany?.DbName || '').trim();

    if (resolvedFromAssignment) {
      if (context) {
        context.databaseName = resolvedFromAssignment;
      }
      return resolvedFromAssignment;
    }
  }

  return String(env.dbName || '').trim();
};

const getPool = async (databaseName = env.dbName) => {
  const resolvedDatabase = String(databaseName || env.dbName || '').trim();
  if (!resolvedDatabase) {
    throw new Error('No company database is configured for SQL access.');
  }

  const existingPool = pools.get(resolvedDatabase);
  if (existingPool?.connected) {
    return existingPool;
  }

  const pendingPool = pendingPools.get(resolvedDatabase);
  if (pendingPool) {
    return pendingPool;
  }

  const poolPromise = new sql.ConnectionPool(buildConfig(resolvedDatabase)).connect()
    .then((pool) => {
      pools.set(resolvedDatabase, pool);
      console.log(`[DB] SQL Server pool connected to ${resolvedDatabase}`);
      return pool;
    })
    .finally(() => {
      pendingPools.delete(resolvedDatabase);
    });

  pendingPools.set(resolvedDatabase, poolPromise);
  return poolPromise;
};

const query = async (queryStr, params = {}, options = {}) => {
  const resolvedDatabaseName = await resolveDatabaseName(options);
  const pool = await getPool(resolvedDatabaseName);
  const req = pool.request();

  for (const [key, value] of Object.entries(params)) {
    req.input(key, value);
  }

  return req.query(queryStr);
};

module.exports = {
  query,
  sql,
  getPool,
  resolveDatabaseName,
};
