const sql = require('mssql');
const env = require('../config/env');

const COMPANY_CREDENTIAL_COLUMNS = [
  { name: 'Port', definition: 'INT NULL' },
  { name: 'AuthDbName', definition: 'NVARCHAR(128) NULL' },
  { name: 'SapBaseUrl', definition: 'NVARCHAR(500) NULL' },
  { name: 'SapUsername', definition: 'NVARCHAR(128) NULL' },
  { name: 'SapPassword', definition: 'NVARCHAR(255) NULL' },
  { name: 'SapCompanyDb', definition: 'NVARCHAR(128) NULL' },
  { name: 'SapRejectUnauthorized', definition: 'BIT NULL' },
  { name: 'ReportServiceBaseUrl', definition: 'NVARCHAR(500) NULL' },
  { name: 'ReportServiceUsername', definition: 'NVARCHAR(128) NULL' },
  { name: 'ReportServicePassword', definition: 'NVARCHAR(255) NULL' },
  { name: 'ReportServiceCompanyDb', definition: 'NVARCHAR(128) NULL' },
  { name: 'ReportServiceDefaultSchema', definition: 'NVARCHAR(128) NULL' },
  { name: 'ReportServiceRejectUnauthorized', definition: 'BIT NULL' },
  { name: 'SalesOrderDefaultToVendorCode', definition: 'NVARCHAR(50) NULL' },
  { name: 'DbServer', definition: 'NVARCHAR(255) NULL' },
  { name: 'DbEncrypt', definition: 'BIT NULL' },
  { name: 'DbTrustCert', definition: 'BIT NULL' },
];

const authDbConfig = {
  server: env.dbServer,
  database: env.authDbName,
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
};

let authPool = null;
let authPoolPromise = null;
const cache = new Map();
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
let companyCredentialColumnsReady = false;

const getCached = (key) => {
  const entry = cache.get(key);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  return entry.value;
};

const setCached = (key, value, ttlMs = DEFAULT_CACHE_TTL_MS) => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
};

const cachedQuery = async (key, queryFn, ttlMs) => {
  const cachedValue = getCached(key);
  if (cachedValue !== undefined) return cachedValue;

  const value = await queryFn();
  return setCached(key, value, ttlMs);
};

const getPool = async () => {
  if (authPool && authPool.connected) return authPool;
  if (authPoolPromise) {
    authPool = await authPoolPromise;
    return authPool;
  }

  authPoolPromise = new sql.ConnectionPool(authDbConfig).connect();

  try {
    authPool = await authPoolPromise;
    console.log(`[AUTH_DB] SQL Server pool connected to ${env.authDbName}`);
    return authPool;
  } finally {
    authPoolPromise = null;
  }
};

const bindParams = (request, params = {}) => {
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
};

const query = async (queryText, params = {}) => {
  const pool = await getPool();
  const request = pool.request();

  bindParams(request, params);

  return request.query(queryText);
};

const transaction = async (callback) => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  const runQuery = async (queryText, params = {}) => {
    const request = new sql.Request(tx);
    bindParams(request, params);
    return request.query(queryText);
  };

  try {
    const result = await callback({
      query: runQuery,
      queryRows: async (queryText, params = {}) => {
        const response = await runQuery(queryText, params);
        return response.recordset || [];
      },
      queryOne: async (queryText, params = {}) => {
        const rows = await runQuery(queryText, params);
        return rows.recordset?.[0] || null;
      },
    });

    await tx.commit();
    return result;
  } catch (error) {
    if (!tx._aborted) {
      await tx.rollback().catch(() => {});
    }
    throw error;
  }
};

const queryRows = async (queryText, params = {}) => {
  const result = await query(queryText, params);
  return result.recordset || [];
};

const queryOne = async (queryText, params = {}) => {
  const rows = await queryRows(queryText, params);
  return rows[0] || null;
};

const ensureCompanyCredentialColumns = async () => {
  if (companyCredentialColumnsReady) return;

  for (const column of COMPANY_CREDENTIAL_COLUMNS) {
    await query(`
      IF COL_LENGTH(N'dbo.Companies', N'${column.name}') IS NULL
        ALTER TABLE dbo.Companies ADD ${column.name} ${column.definition};
    `);
  }

  companyCredentialColumnsReady = true;
};

const clearCache = (prefix = '') => {
  if (!prefix) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (String(key).startsWith(prefix)) {
      cache.delete(key);
    }
  }
};

const COMPANY_SELECT_COLUMNS = `
    CompanyId,
    CompanyName,
    DbName,
    DbUser,
    DbPassword,
    ServerName,
    LicenseServer,
    SAPVersion,
    IsActive,
    CreatedAt,
    Port,
    AuthDbName,
    SapBaseUrl,
    SapUsername,
    SapPassword,
    SapCompanyDb,
    SapRejectUnauthorized,
    ReportServiceBaseUrl,
    ReportServiceUsername,
    ReportServicePassword,
    ReportServiceCompanyDb,
    ReportServiceDefaultSchema,
    ReportServiceRejectUnauthorized,
    SalesOrderDefaultToVendorCode,
    DbServer,
    DbEncrypt,
    DbTrustCert
`;

const qualifyCompanyColumns = (alias) =>
  COMPANY_SELECT_COLUMNS
    .split('\n')
    .map((column) => column.trim())
    .filter(Boolean)
    .map((column) => `    ${alias}.${column}`)
    .join('\n');

const findUserByUsername = async (username) => queryOne(`
  SELECT UserId, Username, PasswordHash, FullName, Email, IsActive, CreatedAt
  FROM dbo.Users
  WHERE Username = @username
`, { username });

const getActiveCompanies = async () => {
  await ensureCompanyCredentialColumns();
  return cachedQuery('activeCompanies', () => queryRows(`
  SELECT
${COMPANY_SELECT_COLUMNS}
  FROM dbo.Companies
  WHERE IsActive = 1
  ORDER BY CompanyName ASC
`));
};

const getUserCompanies = async (userId) => {
  await ensureCompanyCredentialColumns();
  return cachedQuery(`userCompanies:${userId}`, () => queryRows(`
  SELECT
${qualifyCompanyColumns('c')},
    uc.IsDefault
  FROM dbo.UserCompanies uc
  INNER JOIN dbo.Companies c
    ON c.CompanyId = uc.CompanyId
  WHERE uc.UserId = @userId
    AND c.IsActive = 1
  ORDER BY uc.IsDefault DESC, c.CompanyName ASC
`, { userId }));
};

const getAssignedCompanyForUser = async (userId, companyId) => {
  await ensureCompanyCredentialColumns();
  return cachedQuery(`assignedCompany:${userId}:${companyId}`, () => queryOne(`
  SELECT
${qualifyCompanyColumns('c')},
    uc.IsDefault
  FROM dbo.UserCompanies uc
  INNER JOIN dbo.Companies c
    ON c.CompanyId = uc.CompanyId
  WHERE uc.UserId = @userId
    AND uc.CompanyId = @companyId
    AND c.IsActive = 1
`, { userId, companyId }));
};

const getUserRoleForCompany = async (userId, companyId) => cachedQuery(`userRole:${userId}:${companyId}`, () => queryOne(`
  SELECT TOP 1 ur.RoleId, r.RoleName
  FROM dbo.UserRoles ur
  INNER JOIN dbo.Roles r
    ON r.RoleId = ur.RoleId
  WHERE ur.UserId = @userId
    AND ur.CompanyId = @companyId
`, { userId, companyId }));

const getAdminRoleForUser = async (userId) => cachedQuery(`adminRole:${userId}`, () => queryOne(`
  SELECT TOP 1 ur.RoleId, r.RoleName
  FROM dbo.UserRoles ur
  INNER JOIN dbo.Roles r
    ON r.RoleId = ur.RoleId
  WHERE ur.UserId = @userId
    AND LOWER(r.RoleName) IN ('admin', 'superadmin')
  ORDER BY CASE WHEN LOWER(r.RoleName) = 'superadmin' THEN 0 ELSE 1 END, ur.RoleId ASC
`, { userId }));

const getRoleById = async (roleId) => cachedQuery(`role:${roleId}`, () => queryOne(`
  SELECT RoleId, RoleName
  FROM dbo.Roles
  WHERE RoleId = @roleId
`, { roleId }));

const getAllMenus = async () => cachedQuery('allMenus', () => queryRows(`
  SELECT MenuId, MenuName, MenuPath, ParentId, Icon, SortOrder
  FROM dbo.Menus
  ORDER BY SortOrder, MenuId
`));

const getRoleRights = async (roleId) => cachedQuery(`roleRights:${roleId}`, () => queryRows(`
  SELECT RoleId, MenuId, CanView, CanAdd, CanEdit, CanDelete
  FROM dbo.RoleRights
  WHERE RoleId = @roleId
`, { roleId }));

module.exports = {
  query,
  queryRows,
  queryOne,
  transaction,
  ensureCompanyCredentialColumns,
  clearCache,
  findUserByUsername,
  getActiveCompanies,
  getUserCompanies,
  getAssignedCompanyForUser,
  getUserRoleForCompany,
  getAdminRoleForUser,
  getRoleById,
  getAllMenus,
  getRoleRights,
};
