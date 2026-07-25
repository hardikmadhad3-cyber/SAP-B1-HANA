require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { DatabaseSync } = require('node:sqlite');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(BACKEND_ROOT, 'db', 'auth-schema.sqlite.sql');
const SQLITE_PATH = path.isAbsolute(process.env.AUTH_SQLITE_PATH || '')
  ? process.env.AUTH_SQLITE_PATH
  : path.resolve(BACKEND_ROOT, process.env.AUTH_SQLITE_PATH || './data/henny_auth.sqlite');

const TABLES = [
  { name: 'Companies', pk: 'CompanyId' },
  { name: 'Users', pk: 'UserId' },
  { name: 'Roles', pk: 'RoleId' },
  { name: 'Menus', pk: 'MenuId' },
  { name: 'Reports', pk: 'ReportId' },
  { name: 'CompanyReports', pk: 'Id' },
  { name: 'MenuReports', pk: 'Id' },
  { name: 'RoleRights', pk: 'Id' },
  { name: 'UserCompanies', pk: 'Id' },
  { name: 'UserRoles', pk: 'Id' },
  { name: 'ReportMenus', pk: 'ReportMenuId' },
  { name: 'ReportParameters', pk: 'ParamId' },
  { name: 'UserFormSettings', pk: 'FormSettingId' },
  { name: 'UserGeneralSettings', pk: 'UserGeneralSettingId' },
  { name: 'ReportLayoutMenuEntries', pk: 'MenuEntryID' },
  { name: 'ReportLayouts', pk: 'LayoutID' },
  { name: 'ReportLayoutVersions', pk: 'VersionID' },
];

const args = new Set(process.argv.slice(2));

const toDbValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
};

const sourceConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.AUTH_DB_NAME || 'henny_master',
  options: {
    instanceName: process.env.DB_INSTANCE || undefined,
    trustServerCertificate: String(process.env.DB_TRUST_CERT || 'true').toLowerCase() === 'true',
    encrypt: String(process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
  },
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
    },
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

const getSqliteColumns = (db, tableName) =>
  db.prepare(`PRAGMA table_info([${tableName}])`).all().map((column) => column.name);

const tableExistsInSqlServer = async (pool, tableName) => {
  const result = await pool.request()
    .input('tableName', sql.NVarChar, tableName)
    .query(`
      SELECT 1 AS existsFlag
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = @tableName
    `);

  return Boolean(result.recordset?.[0]?.existsFlag);
};

const getSourceRows = async (pool, table) => {
  if (!(await tableExistsInSqlServer(pool, table.name))) {
    return [];
  }

  const result = await pool.request().query(`
    SELECT *
    FROM dbo.[${table.name}]
    ORDER BY [${table.pk}] ASC
  `);

  return result.recordset || [];
};

const insertRows = (db, table, rows) => {
  if (!rows.length) return 0;

  const targetColumns = new Set(getSqliteColumns(db, table.name));
  const columns = Object.keys(rows[0]).filter((column) => targetColumns.has(column));
  if (!columns.length) return 0;

  const insertSql = `
    INSERT INTO [${table.name}] (${columns.map((column) => `[${column}]`).join(', ')})
    VALUES (${columns.map((column) => `@${column}`).join(', ')})
  `;
  const statement = db.prepare(insertSql);
  let inserted = 0;

  for (const row of rows) {
    const payload = Object.fromEntries(columns.map((column) => [column, toDbValue(row[column])]));
    const result = statement.run(payload);
    inserted += Number(result.changes || 0);
  }

  return inserted;
};

const resetSqliteSchema = (db) => {
  db.exec('PRAGMA foreign_keys = OFF;');
  const objects = db.prepare(`
    SELECT type, name
    FROM sqlite_master
    WHERE type IN ('table', 'view')
      AND name NOT LIKE 'sqlite_%'
    ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END
  `).all();

  for (const object of objects) {
    db.exec(`DROP ${object.type.toUpperCase()} IF EXISTS [${object.name}];`);
  }
};

const main = async () => {
  if (fs.existsSync(SQLITE_PATH)) {
    if (!args.has('--force')) {
      throw new Error(`SQLite database already exists at ${SQLITE_PATH}. Re-run with --force to recreate it.`);
    }
  }

  fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
  if (!fs.existsSync(SQLITE_PATH)) {
    fs.writeFileSync(SQLITE_PATH, '');
  }
  const sqliteDb = new DatabaseSync(SQLITE_PATH);
  resetSqliteSchema(sqliteDb);
  sqliteDb.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  const pool = await new sql.ConnectionPool(sourceConfig).connect();
  const summary = [];

  try {
    sqliteDb.exec('BEGIN IMMEDIATE TRANSACTION;');
    for (const table of TABLES) {
      const rows = await getSourceRows(pool, table);
      const inserted = insertRows(sqliteDb, table, rows);
      summary.push({ table: table.name, source: rows.length, sqlite: inserted });
      console.log(`[migrate] ${table.name}: ${inserted}/${rows.length}`);
    }
    sqliteDb.exec('COMMIT;');
  } catch (error) {
    sqliteDb.exec('ROLLBACK;');
    throw error;
  } finally {
    await pool.close();
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
    sqliteDb.close();
  }

  const mismatches = summary.filter((row) => row.source !== row.sqlite);
  if (mismatches.length) {
    console.error('[migrate] Count mismatches:');
    for (const row of mismatches) {
      console.error(`  ${row.table}: source=${row.source}, sqlite=${row.sqlite}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log(`[migrate] SQLite auth database ready: ${SQLITE_PATH}`);
};

main().catch((error) => {
  console.error('[migrate] Failed:', error.message);
  process.exitCode = 1;
});
