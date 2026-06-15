const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const env = require('../config/env');

const cache = new Map();
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
let db = null;
let schemaReady = false;

const BACKEND_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(BACKEND_ROOT, 'db', 'auth-schema.sqlite.sql');

const resolveSqlitePath = () => {
  const configuredPath = env.authSqlitePath || './data/henny_auth.sqlite';
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(BACKEND_ROOT, configuredPath);
};

const toDbValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'bigint') return Number(value);
  return value;
};

const normalizeParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).map(([key, value]) => [key, toDbValue(value)]));

const normalizeRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === 'bigint' ? Number(value) : value,
    ]),
  );
};

const getDb = () => {
  if (db) return db;

  const dbPath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, '');
  }
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
};

const ensureSchema = async () => {
  if (schemaReady) return;

  const database = getDb();
  database.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  schemaReady = true;
  console.log(`[AUTH_DB] SQLite connected to ${resolveSqlitePath()}`);
};

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

const stripSqlServerSyntax = (queryText) =>
  String(queryText || '')
    .replace(/\bdbo\./gi, '')
    .replace(/\bSYSUTCDATETIME\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bGETDATE\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bCONCAT\s*\(\s*'([^']*)'\s*,\s*([^)]+?)\s*\)/gi, "('$1' || $2)")
    .replace(/\bWITH\s*\(\s*HOLDLOCK\s*\)/gi, '');

const applyTopLimit = (sqlText) => {
  let limit = null;
  const sql = sqlText.replace(/\bSELECT\s+TOP\s*\(?\s*(\d+)\s*\)?\s+/i, (_match, value) => {
    limit = Number(value);
    return 'SELECT ';
  });

  if (!limit || /\bLIMIT\s+\d+\b/i.test(sql)) {
    return sql;
  }

  const trimmed = sql.trimEnd();
  const suffix = trimmed.endsWith(';') ? ';' : '';
  const body = suffix ? trimmed.slice(0, -1).trimEnd() : trimmed;
  return `${body} LIMIT ${limit}${suffix}`;
};

const normalizeSql = (queryText) => applyTopLimit(stripSqlServerSyntax(queryText)).trim();

const splitSqlList = (value) => {
  const items = [];
  let current = '';
  let bracketDepth = 0;
  let quote = '';

  for (const char of String(value || '')) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }

    if (char === '(') bracketDepth += 1;
    if (char === ')') bracketDepth -= 1;

    if (char === ',' && bracketDepth === 0) {
      items.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) items.push(current.trim());
  return items;
};

const unquoteIdentifier = (value) =>
  String(value || '')
    .trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/^"/, '')
    .replace(/"$/, '');

const getPrimaryKeyColumn = (tableName) => {
  const info = getDb().prepare(`PRAGMA table_info(${unquoteIdentifier(tableName)})`).all();
  const pkColumn = info.find((column) => Number(column.pk) === 1);
  return pkColumn?.name || null;
};

const parseOutputExpression = (expression) => {
  const normalized = expression
    .replace(/\bINSERTED\./gi, '')
    .trim();
  const aliasMatch = normalized.match(/^(.+?)\s+AS\s+(.+)$/i);
  const rawColumn = aliasMatch ? aliasMatch[1] : normalized;
  const rawAlias = aliasMatch ? aliasMatch[2] : rawColumn;
  return {
    column: unquoteIdentifier(rawColumn),
    alias: unquoteIdentifier(rawAlias),
  };
};

const tryRunInsertWithOutput = (sqlText, params) => {
  const match = sqlText.match(
    /^\s*INSERT\s+INTO\s+([A-Za-z0-9_\[\]"]+)\s*\(([\s\S]+?)\)\s*OUTPUT\s+([\s\S]+?)\s+VALUES\s*\(([\s\S]+?)\)\s*;?\s*$/i,
  );
  if (!match) return null;

  const [, tableNameRaw, columns, outputExpressionText, values] = match;
  const tableName = unquoteIdentifier(tableNameRaw);
  const outputExpressions = splitSqlList(outputExpressionText).map(parseOutputExpression);
  const insertSql = `INSERT INTO ${tableNameRaw} (${columns}) VALUES (${values})`;
  const result = getDb().prepare(insertSql).run(normalizeParams(params));
  const lastInsertId = Number(result.lastInsertRowid);
  const primaryKey = getPrimaryKeyColumn(tableName);

  let row = {};
  if (primaryKey) {
    const selectedColumns = outputExpressions
      .map((expression) => `[${expression.column}] AS [${expression.alias}]`)
      .join(', ');
    row = getDb()
      .prepare(`SELECT ${selectedColumns} FROM [${tableName}] WHERE [${primaryKey}] = @lastInsertId`)
      .get({ lastInsertId }) || {};
  } else {
    row = Object.fromEntries(outputExpressions.map((expression) => [expression.alias, lastInsertId]));
  }

  return {
    recordset: [normalizeRow(row)],
    rowsAffected: [Number(result.changes || 0)],
    lastInsertId,
  };
};

const isReadQuery = (sqlText) => /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sqlText);

const query = async (queryText, params = {}) => {
  await ensureSchema();
  const sqlText = normalizeSql(queryText);
  if (!sqlText) {
    return { recordset: [], rowsAffected: [0] };
  }

  const insertWithOutput = tryRunInsertWithOutput(sqlText, params);
  if (insertWithOutput) {
    return insertWithOutput;
  }

  const statement = getDb().prepare(sqlText);
  if (isReadQuery(sqlText)) {
    const recordset = statement.all(normalizeParams(params)).map(normalizeRow);
    return { recordset, rowsAffected: [0] };
  }

  const result = statement.run(normalizeParams(params));
  return {
    recordset: [],
    rowsAffected: [Number(result.changes || 0)],
    lastInsertId: Number(result.lastInsertRowid || 0),
  };
};

const transaction = async (callback) => {
  await ensureSchema();
  const database = getDb();
  database.exec('BEGIN IMMEDIATE TRANSACTION;');

  const txApi = {
    query,
    queryRows: async (queryText, params = {}) => {
      const response = await query(queryText, params);
      return response.recordset || [];
    },
    queryOne: async (queryText, params = {}) => {
      const response = await query(queryText, params);
      return response.recordset?.[0] || null;
    },
  };

  try {
    const result = await callback(txApi);
    database.exec('COMMIT;');
    return result;
  } catch (error) {
    database.exec('ROLLBACK;');
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

const tableExists = async (tableName) => {
  await ensureSchema();
  const row = getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(@tableName)")
    .get({ tableName: unquoteIdentifier(tableName) });
  return Boolean(row);
};

const getTableSchemaRows = async (tableName) => {
  await ensureSchema();
  const normalizedTableName = unquoteIdentifier(tableName);
  const columns = getDb().prepare(`PRAGMA table_info([${normalizedTableName}])`).all();
  const foreignKeys = getDb().prepare(`PRAGMA foreign_key_list([${normalizedTableName}])`).all();
  const foreignKeyByColumn = new Map(foreignKeys.map((fk) => [fk.from, fk]));

  const bitColumnNames = new Set([
    'IsActive',
    'IsDefault',
    'IsRequired',
    'IsPublic',
    'IsSystem',
    'CanView',
    'CanAdd',
    'CanEdit',
    'CanDelete',
    'SapRejectUnauthorized',
    'ReportServiceRejectUnauthorized',
    'DbEncrypt',
    'DbTrustCert',
  ].map((name) => name.toLowerCase()));

  return columns.map((column, index) => {
    const fk = foreignKeyByColumn.get(column.name);
    const type = String(column.type || 'TEXT').toLowerCase();
    const dataType = bitColumnNames.has(String(column.name).toLowerCase())
      ? 'bit'
      : (type.includes('int') ? 'int' : (type.includes('text') ? 'nvarchar' : type));
    return {
      columnName: column.name,
      dataType,
      isNullable: column.notnull ? 'NO' : 'YES',
      maxLength: null,
      ordinalPosition: index + 1,
      isIdentity: Number(column.pk) === 1 && type.includes('integer') ? 1 : 0,
      isPrimaryKey: Number(column.pk) > 0 ? 1 : 0,
      referencedTable: fk?.table || null,
      referencedColumn: fk?.to || null,
    };
  });
};

const insertAndGetId = async (sqlText, params = {}) => {
  const response = await query(sqlText, params);
  return Number(response.lastInsertId || response.recordset?.[0]?.recordId || 0);
};

const ensureCompanyCredentialColumns = async () => ensureSchema();

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
  FROM Users
  WHERE Username = @username
`, { username });

const getActiveCompanies = async () => {
  await ensureCompanyCredentialColumns();
  return cachedQuery('activeCompanies', () => queryRows(`
  SELECT
${COMPANY_SELECT_COLUMNS}
  FROM Companies
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
  FROM UserCompanies uc
  INNER JOIN Companies c
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
  FROM UserCompanies uc
  INNER JOIN Companies c
    ON c.CompanyId = uc.CompanyId
  WHERE uc.UserId = @userId
    AND uc.CompanyId = @companyId
    AND c.IsActive = 1
`, { userId, companyId }));
};

const getUserRoleForCompany = async (userId, companyId) => cachedQuery(`userRole:${userId}:${companyId}`, () => queryOne(`
  SELECT ur.RoleId, r.RoleName
  FROM UserRoles ur
  INNER JOIN Roles r
    ON r.RoleId = ur.RoleId
  WHERE ur.UserId = @userId
    AND ur.CompanyId = @companyId
  LIMIT 1
`, { userId, companyId }));

const getAdminRoleForUser = async (userId) => cachedQuery(`adminRole:${userId}`, () => queryOne(`
  SELECT ur.RoleId, r.RoleName
  FROM UserRoles ur
  INNER JOIN Roles r
    ON r.RoleId = ur.RoleId
  WHERE ur.UserId = @userId
    AND LOWER(r.RoleName) IN ('admin', 'superadmin')
  ORDER BY CASE WHEN LOWER(r.RoleName) = 'superadmin' THEN 0 ELSE 1 END, ur.RoleId ASC
  LIMIT 1
`, { userId }));

const getRoleById = async (roleId) => cachedQuery(`role:${roleId}`, () => queryOne(`
  SELECT RoleId, RoleName
  FROM Roles
  WHERE RoleId = @roleId
`, { roleId }));

const getAllMenus = async () => cachedQuery('allMenus', () => queryRows(`
  SELECT MenuId, MenuName, MenuPath, ParentId, Icon, SortOrder
  FROM Menus
  ORDER BY SortOrder, MenuId
`));

const getRoleRights = async (roleId) => cachedQuery(`roleRights:${roleId}`, () => queryRows(`
  SELECT RoleId, MenuId, CanView, CanAdd, CanEdit, CanDelete
  FROM RoleRights
  WHERE RoleId = @roleId
`, { roleId }));

module.exports = {
  query,
  queryRows,
  queryOne,
  transaction,
  ensureSchema,
  ensureCompanyCredentialColumns,
  clearCache,
  tableExists,
  getTableSchemaRows,
  insertAndGetId,
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
