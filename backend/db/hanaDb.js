let hanaClient = null;

try {
  hanaClient = require('@sap/hana-client');
} catch (_error) {
  hanaClient = null;
}

const SQL_KEYWORDS = new Set([
  'ADD',
  'AND',
  'AS',
  'ASC',
  'BETWEEN',
  'BY',
  'CASE',
  'CAST',
  'COALESCE',
  'COUNT',
  'CURRENT_DATE',
  'CURRENT_TIMESTAMP',
  'DATE',
  'DECIMAL',
  'DESC',
  'DISTINCT',
  'ELSE',
  'END',
  'FROM',
  'GROUP',
  'IFNULL',
  'IN',
  'INNER',
  'INT',
  'INTEGER',
  'IS',
  'JOIN',
  'LEFT',
  'LENGTH',
  'LIKE',
  'LIKE_REGEXPR',
  'LIMIT',
  'LOWER',
  'MAX',
  'MIN',
  'NOT',
  'NULL',
  'NULLIF',
  'NVARCHAR',
  'ON',
  'OR',
  'ORDER',
  'OUTER',
  'RIGHT',
  'SELECT',
  'SET',
  'SUM',
  'THEN',
  'TO_VARCHAR',
  'UPPER',
  'VARCHAR',
  'WHEN',
  'WHERE',
]);

const isReadQuery = (sqlText) => /^\s*(SELECT|WITH)\b/i.test(sqlText);

const quoteIdentifier = (value) =>
  `"${String(value || '').replace(/"/g, '""')}"`;

const HANA_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HANA_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

const isIdentifierChar = (char = '') => /[A-Za-z0-9_]/.test(char);

const withSqlSegments = (sqlText, replacer) => {
  const parts = [];
  let current = '';
  let inString = false;

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index];
    current += char;

    if (char !== "'") {
      continue;
    }

    if (inString && sqlText[index + 1] === "'") {
      current += sqlText[index + 1];
      index += 1;
      continue;
    }

    if (inString) {
      parts.push({ text: current, string: true });
      current = '';
      inString = false;
    } else {
      if (current.slice(0, -1)) {
        parts.push({ text: current.slice(0, -1), string: false });
      }
      current = "'";
      inString = true;
    }
  }

  if (current) {
    parts.push({ text: current, string: inString });
  }

  return parts
    .map((part) => (part.string ? part.text : replacer(part.text)))
    .join('');
};

const findTopLevelPattern = (sqlText, matcher) => {
  let inString = false;
  let depth = 0;

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index];

    if (char === "'") {
      if (inString && sqlText[index + 1] === "'") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (inString) continue;
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;

    const match = matcher(sqlText.slice(index), index, sqlText);
    if (match) return { ...match, start: index, end: index + match.text.length };
  }

  return null;
};

const hasTopLevelKeyword = (sqlText, keyword) =>
  Boolean(findTopLevelPattern(sqlText, (rest, index, fullText) => {
    const pattern = new RegExp(`^${keyword}\\b`, 'i');
    if (!pattern.test(rest)) return null;
    const previous = fullText[index - 1] || '';
    if (isIdentifierChar(previous)) return null;
    const text = rest.match(pattern)[0];
    return { text };
  }));

const applyTopLimit = (sqlText) => {
  const match = findTopLevelPattern(sqlText, (rest, index, fullText) => {
    const previous = fullText[index - 1] || '';
    if (isIdentifierChar(previous)) return null;

    const topMatch = rest.match(/^SELECT\s+TOP\s*(?:\(\s*)?(@[A-Za-z_][A-Za-z0-9_]*|\d+)(?:\s*\))?\s+/i);
    if (!topMatch) return null;

    return {
      text: topMatch[0],
      limit: topMatch[1],
    };
  });

  if (!match) {
    return sqlText;
  }

  const sql = `${sqlText.slice(0, match.start)}SELECT ${sqlText.slice(match.end)}`;
  if (hasTopLevelKeyword(sql, 'LIMIT')) {
    return sql;
  }

  const trimmed = sql.trimEnd();
  const suffix = trimmed.endsWith(';') ? ';' : '';
  const body = suffix ? trimmed.slice(0, -1).trimEnd() : trimmed;
  return `${body} LIMIT ${match.limit}${suffix}`;
};

const quoteAliasColumns = (sqlText) =>
  withSqlSegments(sqlText, (segment) =>
    segment.replace(/\b([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b/g, (match, alias, column) => {
      if (alias.toLowerCase() === 'dbo') return column;
      if (column === column.toUpperCase()) return match;
      return `${alias}.${quoteIdentifier(column)}`;
    }));

const quoteBareIdentifiers = (sqlText) =>
  withSqlSegments(sqlText, (segment) =>
    segment.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (match, word, offset, fullText) => {
      if (!/[a-z]/.test(word)) return match;
      if (SQL_KEYWORDS.has(word.toUpperCase())) return match;

      const previous = fullText[offset - 1] || '';
      const next = fullText[offset + word.length] || '';
      if (previous === '@' || previous === '.' || previous === '"' || next === '"') return match;
      if (next === '(') return match;

      return quoteIdentifier(word);
    }));

const quoteTables = (sqlText) =>
  withSqlSegments(sqlText, (segment) =>
    segment.replace(/\b(FROM|JOIN|UPDATE|INTO)\s+([A-Z][A-Z0-9_]{2,})\b/g, (_match, keyword, tableName) =>
      `${keyword} ${quoteIdentifier(tableName)}`));

const replaceInformationSchemaViews = (sqlText) =>
  withSqlSegments(sqlText, (segment) =>
    segment
      .replace(
        /\bINFORMATION_SCHEMA\.COLUMNS\b/gi,
        `(SELECT
          SCHEMA_NAME AS TABLE_SCHEMA,
          TABLE_NAME,
          COLUMN_NAME,
          DATA_TYPE_NAME AS DATA_TYPE,
          LENGTH AS CHARACTER_MAXIMUM_LENGTH,
          LENGTH AS NUMERIC_PRECISION,
          SCALE AS NUMERIC_SCALE,
          IS_NULLABLE,
          POSITION AS ORDINAL_POSITION
        FROM SYS.TABLE_COLUMNS
        WHERE SCHEMA_NAME = CURRENT_SCHEMA)`,
      )
      .replace(
        /\bINFORMATION_SCHEMA\.TABLES\b/gi,
        `(SELECT
          SCHEMA_NAME AS TABLE_SCHEMA,
          TABLE_NAME,
          TABLE_TYPE
        FROM SYS.TABLES
        WHERE SCHEMA_NAME = CURRENT_SCHEMA)`,
      ));

const splitTopLevelArgs = (text) => {
  const args = [];
  let current = '';
  let inString = false;
  let depth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "'") {
      current += char;
      if (inString && text[index + 1] === "'") {
        current += text[index + 1];
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '(') depth += 1;
      if (char === ')') depth = Math.max(0, depth - 1);
      if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) args.push(current.trim());
  return args;
};

const buildNestedConcat = (args) => {
  const normalizedArgs = args.map((arg) => replaceConcatCalls(arg));
  if (normalizedArgs.length <= 2) return `CONCAT(${normalizedArgs.join(', ')})`;
  return normalizedArgs
    .slice(1)
    .reduce((expression, arg) => `CONCAT(${expression}, ${arg})`, normalizedArgs[0]);
};

const replaceConcatCalls = (sqlText) => {
  let output = '';
  let index = 0;
  let inString = false;

  while (index < sqlText.length) {
    const char = sqlText[index];

    if (char === "'") {
      output += char;
      if (inString && sqlText[index + 1] === "'") {
        output += sqlText[index + 1];
        index += 2;
        continue;
      }
      inString = !inString;
      index += 1;
      continue;
    }

    if (inString) {
      output += char;
      index += 1;
      continue;
    }

    const rest = sqlText.slice(index);
    const match = rest.match(/^CONCAT\s*\(/i);
    const previous = sqlText[index - 1] || '';
    if (!match || isIdentifierChar(previous)) {
      output += char;
      index += 1;
      continue;
    }

    const openParen = index + match[0].length - 1;
    let depth = 0;
    let nestedString = false;
    let closeParen = -1;

    for (let cursor = openParen; cursor < sqlText.length; cursor += 1) {
      const cursorChar = sqlText[cursor];
      if (cursorChar === "'") {
        if (nestedString && sqlText[cursor + 1] === "'") {
          cursor += 1;
          continue;
        }
        nestedString = !nestedString;
        continue;
      }
      if (nestedString) continue;
      if (cursorChar === '(') depth += 1;
      if (cursorChar === ')') {
        depth -= 1;
        if (depth === 0) {
          closeParen = cursor;
          break;
        }
      }
    }

    if (closeParen === -1) {
      output += char;
      index += 1;
      continue;
    }

    const args = splitTopLevelArgs(sqlText.slice(openParen + 1, closeParen));
    output += buildNestedConcat(args);
    index = closeParen + 1;
  }

  return output;
};

const replaceIsNumericCalls = (sqlText) =>
  withSqlSegments(sqlText, (segment) => {
    let output = '';
    let index = 0;

    while (index < segment.length) {
      const match = segment.slice(index).match(/\bISNUMERIC\s*\(/i);
      if (!match) {
        output += segment.slice(index);
        break;
      }

      const start = index + match.index;
      const openParen = start + match[0].length - 1;
      let depth = 0;
      let closeParen = -1;

      for (let cursor = openParen; cursor < segment.length; cursor += 1) {
        if (segment[cursor] === '(') depth += 1;
        if (segment[cursor] === ')') {
          depth -= 1;
          if (depth === 0) {
            closeParen = cursor;
            break;
          }
        }
      }

      if (closeParen === -1) {
        output += segment.slice(index);
        break;
      }

      const expression = segment.slice(openParen + 1, closeParen).trim();
      output += segment.slice(index, start);
      output += `(CASE WHEN CAST(${expression} AS NVARCHAR(5000)) LIKE_REGEXPR '^[+-]?[0-9]+([.][0-9]+)?$' THEN 1 ELSE 0 END)`;
      index = closeParen + 1;
    }

    return output;
  });

const normalizeSql = (sqlText) => {
  let sql = String(sqlText || '')
    .replace(/\bdbo\./gi, '')
    .replace(/\[([^\]]+)\]/g, (_match, identifier) => quoteIdentifier(identifier))
    .replace(/\bSYSUTCDATETIME\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bGETDATE\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bCONVERT\s*\(\s*date\s*,\s*CURRENT_TIMESTAMP\s*\)/gi, 'CURRENT_DATE')
    .replace(/\bDATEDIFF\s*\(\s*DAY\s*,\s*([^,]+?)\s*,\s*CURRENT_TIMESTAMP\s*\)/gi, 'DAYS_BETWEEN($1, CURRENT_DATE)')
    .replace(/\bISNULL\s*\(/gi, 'IFNULL(')
    .replace(/\bLEN\s*\(/gi, 'LENGTH(')
    .replace(/\bOFFSET\s+(@[A-Za-z_][A-Za-z0-9_]*|\d+)\s+ROWS\s+FETCH\s+NEXT\s+(@[A-Za-z_][A-Za-z0-9_]*|\d+)\s+ROWS\s+ONLY/gi, 'LIMIT $2 OFFSET $1')
    .replace(/\bCONVERT\s*\(\s*VARCHAR\s*\(\s*10\s*\)\s*,\s*([^)]+?)\s*,\s*23\s*\)/gi, "TO_VARCHAR($1, 'YYYY-MM-DD')");

  sql = replaceInformationSchemaViews(sql);
  sql = replaceConcatCalls(sql);
  sql = replaceIsNumericCalls(sql);
  sql = applyTopLimit(sql);
  sql = quoteAliasColumns(sql);
  sql = quoteTables(sql);
  sql = quoteBareIdentifiers(sql);
  return sql.trim();
};

const bindParams = (sqlText, params = {}) => {
  const values = [];
  const sql = withSqlSegments(sqlText, (segment) =>
    segment.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name) => {
      values.push(params[name]);
      return '?';
    }));

  return { sql, values };
};

const buildConnectionParams = (connectionConfig) => {
  const server = String(connectionConfig.server || '').trim();
  const port = Number(connectionConfig.port || 30015);
  const database = String(connectionConfig.database || '').trim();

  if (!server || !database || !connectionConfig.user) {
    throw new Error('No company database is configured for HANA access.');
  }

  const params = {
    serverNode: `${server}:${port}`,
    uid: connectionConfig.user,
    pwd: connectionConfig.password || '',
    currentSchema: database,
  };

  if (connectionConfig.encrypt) {
    params.encrypt = 'true';
    params.sslValidateCertificate = connectionConfig.trustServerCertificate ? 'false' : 'true';
  }

  return params;
};

const connect = (connectionConfig) => new Promise((resolve, reject) => {
  if (!hanaClient) {
    reject(new Error('SAP HANA client is not installed. Install @sap/hana-client in the backend package before using HANA companies.'));
    return;
  }

  const connection = hanaClient.createConnection();
  connection.connect(buildConnectionParams(connectionConfig), (error) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(connection);
  });
});

const exec = (connection, sqlText, values = []) => new Promise((resolve, reject) => {
  connection.exec(sqlText, values, (error, rows) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(Array.isArray(rows) ? rows : []);
  });
});

const normalizeDateValue = (value) => {
  if (typeof value !== 'string') return value;
  if (HANA_DATE_PATTERN.test(value)) return new Date(`${value}T00:00:00.000Z`);
  if (HANA_TIMESTAMP_PATTERN.test(value)) return new Date(`${value.replace(' ', 'T')}Z`);
  return value;
};

const normalizeRowValues = (row) => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeDateValue(value)]),
  );
};

const disconnect = (connection) => {
  try {
    connection.disconnect();
  } catch (_error) {
    // Ignore disconnect errors after a query has already completed.
  }
};

const query = async (queryStr, params = {}, options = {}) => {
  const normalizedSql = normalizeSql(queryStr);
  const { sql, values } = bindParams(normalizedSql, params);
  const connection = await connect(options.connectionConfig || options);

  try {
    if (options.connectionConfig?.database || options.database) {
      const schema = options.connectionConfig?.database || options.database;
      await exec(connection, `SET SCHEMA ${quoteIdentifier(schema)}`);
    }

    const rows = await exec(connection, sql, values);
    const recordset = isReadQuery(sql) ? rows.map(normalizeRowValues) : [];
    return {
      recordset,
      rowsAffected: isReadQuery(sql) ? [0] : [rows?.length || 0],
    };
  } finally {
    disconnect(connection);
  }
};

module.exports = {
  bindParams,
  normalizeSql,
  query,
};
