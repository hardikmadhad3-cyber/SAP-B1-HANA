/**
 * Safe ad-hoc SQL executor for the Analytics Query Manager / Dashboard Viewer.
 * Validates that author-supplied SQL is a single read-only SELECT/WITH statement,
 * enforces a row cap and execution timeout, and logs every attempt to
 * AnalyticsQueryExecutionLog. Runs against the active SAP B1 company DB via
 * dbService.query (which already dispatches to MSSQL or HANA and applies the
 * global DB concurrency limiter).
 */
const dbService = require('./dbService');
const authDbService = require('./authDbService');

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const VALID_PARAM_TYPES = new Set(['string', 'number', 'date']);
const ROW_LIMIT_PARAM = '__rowLimit';

const BLOCKED_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'EXEC', 'EXECUTE', 'CREATE', 'ALTER',
  'DROP', 'TRUNCATE', 'GRANT', 'REVOKE', 'INTO', 'OPENROWSET', 'OPENQUERY',
  'OPENDATASOURCE', 'BULK', 'SHUTDOWN', 'BACKUP', 'RESTORE',
];
const BLOCKED_KEYWORDS_PATTERN = new RegExp(`\\b(${BLOCKED_KEYWORDS.join('|')})\\b`, 'i');
const BLOCKED_PROC_PREFIX_PATTERN = /\b(xp|sp)_[a-z0-9_]*/i;

// Replaces the *content* of every quoted/bracketed literal with 'x' characters
// (same length, so indices still line up with the original text) so keyword
// and semicolon checks below never accidentally match text inside a string
// literal, while the literal's real value is preserved in the SQL that is
// actually sent to the database.
const maskLiterals = (sqlText) => {
  let out = '';
  let i = 0;
  const len = sqlText.length;

  while (i < len) {
    const ch = sqlText[i];

    if (ch === "'" || ch === '"') {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < len) {
        if (sqlText[i] === quote && sqlText[i + 1] === quote) {
          out += 'xx';
          i += 2;
          continue;
        }
        if (sqlText[i] === quote) {
          out += quote;
          i += 1;
          break;
        }
        out += 'x';
        i += 1;
      }
      continue;
    }

    if (ch === '[') {
      out += ch;
      i += 1;
      while (i < len && sqlText[i] !== ']') {
        out += 'x';
        i += 1;
      }
      if (i < len) {
        out += ']';
        i += 1;
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
};

// Strips -- line comments and /* */ block comments (quote-aware, so a "--"
// inside a string literal is left alone), replacing each comment with a
// single space. Runs before masking so a comment can never hide a second
// statement or a blocked keyword from the checks below.
const stripComments = (sqlText) => {
  let out = '';
  let i = 0;
  const len = sqlText.length;
  let inSingle = false;
  let inDouble = false;
  let inBracket = false;

  while (i < len) {
    const ch = sqlText[i];
    const next = sqlText[i + 1];

    if (inSingle || inDouble) {
      const quote = inSingle ? "'" : '"';
      out += ch;
      if (ch === quote && next === quote) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === quote) {
        inSingle = false;
        inDouble = false;
      }
      i += 1;
      continue;
    }

    if (inBracket) {
      out += ch;
      if (ch === ']') inBracket = false;
      i += 1;
      continue;
    }

    if (ch === "'") { inSingle = true; out += ch; i += 1; continue; }
    if (ch === '"') { inDouble = true; out += ch; i += 1; continue; }
    if (ch === '[') { inBracket = true; out += ch; i += 1; continue; }

    if (ch === '-' && next === '-') {
      i += 2;
      while (i < len && sqlText[i] !== '\n') i += 1;
      out += ' ';
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < len && !(sqlText[i] === '*' && sqlText[i + 1] === '/')) i += 1;
      i += 2;
      out += ' ';
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
};

// Finds the index of the outermost (paren depth 0) SELECT keyword in a masked
// string - i.e. the final SELECT of a `WITH x AS (...) SELECT ...` CTE, not
// any SELECT nested inside a subquery or the CTE body.
const findTopLevelSelectIndex = (maskedText) => {
  let depth = 0;

  for (let i = 0; i < maskedText.length; i += 1) {
    const ch = maskedText[i];
    if (ch === '(') { depth += 1; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth !== 0) continue;

    if (/^select\b/i.test(maskedText.slice(i))) {
      const previous = maskedText[i - 1] || '';
      if (!/[A-Za-z0-9_]/.test(previous)) {
        return i;
      }
    }
  }

  return -1;
};

const findUnquotedSemicolons = (maskedText) => {
  const indexes = [];
  for (let i = 0; i < maskedText.length; i += 1) {
    if (maskedText[i] === ';') indexes.push(i);
  }
  return indexes;
};

/**
 * Validates that sqlText is a single, safe, read-only SELECT/WITH statement.
 * Returns the sanitized SQL (comments stripped, trailing ';' removed) plus
 * the masked version used for the row-limit injection step. Throws a 400
 * httpError describing the violation otherwise.
 */
const validateReadOnlySql = (sqlText) => {
  const raw = String(sqlText || '');
  if (!raw.trim()) {
    throw createHttpError(400, 'SQL text is required.');
  }

  const commentsStripped = stripComments(raw);
  let masked = maskLiterals(commentsStripped);
  let body = commentsStripped;

  // Trim trailing whitespace consistently on both strings, then allow (and
  // consume) exactly one trailing semicolon before checking for more.
  const trailingWhitespace = masked.match(/\s*$/)[0].length;
  const trimmedLength = masked.length - trailingWhitespace;
  masked = masked.slice(0, trimmedLength);
  body = body.slice(0, trimmedLength);

  if (masked.endsWith(';')) {
    masked = masked.slice(0, -1);
    body = body.slice(0, -1);
  }

  const remainingSemicolons = findUnquotedSemicolons(masked);
  if (remainingSemicolons.length > 0) {
    throw createHttpError(400, 'Only a single SQL statement is allowed (no semicolon-separated statements).');
  }

  if (!/^\s*(SELECT|WITH)\b/i.test(masked)) {
    throw createHttpError(400, 'Only SELECT (or WITH ... SELECT) statements are allowed.');
  }

  if (BLOCKED_KEYWORDS_PATTERN.test(masked)) {
    const match = masked.match(BLOCKED_KEYWORDS_PATTERN);
    throw createHttpError(400, `The keyword "${match[0].toUpperCase()}" is not allowed in analytics queries.`);
  }

  if (BLOCKED_PROC_PREFIX_PATTERN.test(masked)) {
    throw createHttpError(400, 'Calling system/extended stored procedures is not allowed in analytics queries.');
  }

  return { sanitizedSql: body, maskedSql: masked };
};

// Injects `TOP (@__rowLimit)` right after the outermost SELECT (and DISTINCT,
// if present) so every analytics query is capped regardless of dialect -
// HANA's normalizeSql already converts a leading `SELECT TOP (@name)` into
// `... LIMIT @name`, so this single injection point works for both dialects.
const applyRowLimit = (sanitizedSql, maskedSql, rowLimit) => {
  const selectIndex = findTopLevelSelectIndex(maskedSql);
  if (selectIndex === -1) {
    throw createHttpError(400, 'Unable to safely determine a row limit for this query. Please simplify it and try again.');
  }

  let insertPos = selectIndex + 'SELECT'.length;
  const distinctMatch = maskedSql.slice(insertPos).match(/^\s+DISTINCT\b/i);
  if (distinctMatch) {
    insertPos += distinctMatch[0].length;
  }

  const existingTopMatch = maskedSql.slice(insertPos).match(/^\s+TOP\s*\(?\s*(\d+|@[A-Za-z_][A-Za-z0-9_]*)\s*\)?/i);
  if (existingTopMatch) {
    const value = existingTopMatch[1];
    if (/^\d+$/.test(value) && Number(value) > rowLimit) {
      const valueOffsetInMatch = existingTopMatch[0].indexOf(value);
      const start = insertPos + valueOffsetInMatch;
      const end = start + value.length;
      return `${sanitizedSql.slice(0, start)}${rowLimit}${sanitizedSql.slice(end)}`;
    }
    return sanitizedSql;
  }

  return `${sanitizedSql.slice(0, insertPos)} TOP (@${ROW_LIMIT_PARAM})${sanitizedSql.slice(insertPos)}`;
};

const coerceParamValue = (paramDef, rawValue) => {
  const hasValue = rawValue !== undefined && rawValue !== null && rawValue !== '';
  const value = hasValue ? rawValue : paramDef.default;

  if (paramDef.required && (value === undefined || value === null || value === '')) {
    throw createHttpError(400, `Parameter "${paramDef.label || paramDef.name}" is required.`);
  }

  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (paramDef.type === 'number') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw createHttpError(400, `Parameter "${paramDef.label || paramDef.name}" must be a valid number.`);
    }
    return numeric;
  }

  if (paramDef.type === 'date') {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw createHttpError(400, `Parameter "${paramDef.label || paramDef.name}" must be a valid date.`);
    }
    return parsed.toISOString().slice(0, 10);
  }

  return String(value);
};

const buildBoundParams = (sanitizedSql, paramsSchema, paramValues, rowLimit) => {
  const schema = Array.isArray(paramsSchema) ? paramsSchema : [];
  const schemaByName = new Map(schema.map((param) => [String(param.name || '').trim(), param]));

  const referenced = new Set();
  const paramTokenPattern = /@([A-Za-z_][A-Za-z0-9_]*)/g;
  let match;
  while ((match = paramTokenPattern.exec(sanitizedSql))) {
    referenced.add(match[1]);
  }

  for (const name of referenced) {
    if (name === ROW_LIMIT_PARAM) continue;
    if (!schemaByName.has(name)) {
      throw createHttpError(400, `The SQL references parameter "@${name}", which is not declared.`);
    }
  }

  const bound = { [ROW_LIMIT_PARAM]: rowLimit };
  for (const paramDef of schema) {
    const name = String(paramDef.name || '').trim();
    if (!name) continue;
    bound[name] = coerceParamValue(paramDef, (paramValues || {})[name]);
  }

  return bound;
};

const withTimeout = (promise, timeoutMs) => {
  let timer;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = createHttpError(504, `Query timed out after ${timeoutMs}ms.`);
      error.isTimeout = true;
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
};

const extractColumnMeta = (recordset, rows) => {
  const columnsMeta = recordset?.columns;
  if (columnsMeta && typeof columnsMeta === 'object') {
    return Object.keys(columnsMeta).map((name) => ({
      name,
      type: String(columnsMeta[name]?.type?.declaration || columnsMeta[name]?.type?.name || 'string').toLowerCase(),
    }));
  }

  const firstRow = rows?.[0];
  if (!firstRow || typeof firstRow !== 'object') return [];

  return Object.keys(firstRow).map((name) => {
    const value = firstRow[name];
    let type = 'string';
    if (typeof value === 'number') type = 'number';
    else if (typeof value === 'boolean') type = 'boolean';
    else if (value instanceof Date) type = 'date';
    return { name, type };
  });
};

const logExecution = async ({ queryId, widgetId, userId, companyId, paramValues, rowCount, durationMs, status, errorMessage }) => {
  try {
    await authDbService.query(`
      INSERT INTO dbo.AnalyticsQueryExecutionLog (
        QueryId, WidgetId, UserId, CompanyId, ParametersJson, RowCount, DurationMs, Status, ErrorMessage, ExecutedAt
      )
      VALUES (
        @queryId, @widgetId, @userId, @companyId, @parametersJson, @rowCount, @durationMs, @status, @errorMessage, CURRENT_TIMESTAMP
      )
    `, {
      queryId: queryId ?? null,
      widgetId: widgetId ?? null,
      userId,
      companyId,
      parametersJson: JSON.stringify(paramValues || {}),
      rowCount: rowCount || 0,
      durationMs: durationMs || 0,
      status,
      errorMessage: errorMessage || null,
    });
  } catch (_error) {
    // Audit logging must never block or fail a query execution.
  }
};

/**
 * Runs author-supplied SQL text against the active company DB after
 * validating it is a safe, single, read-only statement.
 *
 * @param {object} options
 * @param {string} options.sqlText - raw SQL as authored (before validation)
 * @param {Array<{name,label,type,default,required}>} [options.paramsSchema]
 * @param {object} [options.paramValues] - { paramName: value }
 * @param {{userId:number, companyId:number}} options.auth
 * @param {number} [options.rowLimit=500]
 * @param {number} [options.timeoutMs=15000]
 * @param {number|null} [options.queryId] - null for unsaved preview runs
 * @param {number|null} [options.widgetId]
 */
const runAdHocSql = async ({
  sqlText,
  paramsSchema = [],
  paramValues = {},
  auth,
  rowLimit = 500,
  timeoutMs = 15000,
  queryId = null,
  widgetId = null,
}) => {
  const userId = Number(auth?.userId);
  const companyId = Number(auth?.companyId);
  if (!userId || !companyId) {
    throw createHttpError(401, 'A valid company session is required.');
  }

  const safeRowLimit = Number.isInteger(Number(rowLimit)) && Number(rowLimit) > 0 ? Number(rowLimit) : 500;
  const safeTimeoutMs = Number.isInteger(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 15000;

  const startedAt = Date.now();
  let validated;

  try {
    validated = validateReadOnlySql(sqlText);
  } catch (error) {
    await logExecution({
      queryId, widgetId, userId, companyId, paramValues,
      rowCount: 0, durationMs: Date.now() - startedAt, status: 'blocked', errorMessage: error.message,
    });
    throw error;
  }

  let boundParams;
  let cappedSql;
  try {
    cappedSql = applyRowLimit(validated.sanitizedSql, validated.maskedSql, safeRowLimit);
    boundParams = buildBoundParams(cappedSql, paramsSchema, paramValues, safeRowLimit);
  } catch (error) {
    await logExecution({
      queryId, widgetId, userId, companyId, paramValues,
      rowCount: 0, durationMs: Date.now() - startedAt, status: 'blocked', errorMessage: error.message,
    });
    throw error;
  }

  try {
    const result = await withTimeout(dbService.query(cappedSql, boundParams), safeTimeoutMs);
    const rows = result?.recordset || [];
    const columns = extractColumnMeta(result?.recordset, rows);
    const durationMs = Date.now() - startedAt;

    await logExecution({
      queryId, widgetId, userId, companyId, paramValues,
      rowCount: rows.length, durationMs, status: 'success',
    });

    return {
      columns,
      rows,
      rowCount: rows.length,
      durationMs,
      truncated: rows.length >= safeRowLimit,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    await logExecution({
      queryId, widgetId, userId, companyId, paramValues,
      rowCount: 0, durationMs, status: error.isTimeout ? 'timeout' : 'error', errorMessage: error.message,
    });

    if (error.isTimeout) throw error;
    throw createHttpError(error.statusCode || 400, error.message || 'Failed to execute the query.');
  }
};

module.exports = {
  VALID_PARAM_TYPES,
  validateReadOnlySql,
  runAdHocSql,
};
