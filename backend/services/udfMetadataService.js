const db = require('./dbService');

const safe = async (promise) => {
  try {
    const result = await promise;
    return result.recordset || [];
  } catch (_error) {
    return [];
  }
};

const getColumnSet = async (tableName) => {
  const rows = await safe(db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @tableName
  `, { tableName }));

  return new Set(rows.map((row) => String(row.COLUMN_NAME || '').trim()));
};

const TYPE_MAP = {
  A: 'text',
  M: 'textarea',
  N: 'number',
  D: 'date',
  B: 'number',
  S: 'select',
};

const SUBTYPE_MAP = {
  D: 'date',
  T: 'time',
  R: 'number',
  P: 'number',
  Q: 'number',
  A: 'textarea',
};

const normalizeUdfKey = (aliasId) => {
  const value = String(aliasId || '').trim();
  if (!value) return '';
  return value.startsWith('U_') ? value : `U_${value}`;
};

const YES_NO_VALUES = new Set(['y', 'n', 'yes', 'no', 'tYES'.toLowerCase(), 'tNO'.toLowerCase(), '1', '0']);

const isYesNoOptions = (options = []) => {
  const values = options.map((option) => String(option.value || '').trim().toLowerCase()).filter(Boolean);
  return values.length === 2 && values.every((value) => YES_NO_VALUES.has(value));
};

const getDefaultValue = (type, options, defaultValue) => {
  if (defaultValue !== undefined && defaultValue !== null) {
    return String(defaultValue);
  }

  if (type === 'select' && options.length > 0) return '';
  return '';
};

const mapType = (row, options) => {
  if (isYesNoOptions(options)) return 'checkbox';
  if (options.length > 0) return 'select';
  const typeId = String(row.TypeID || '').trim().toUpperCase();
  const subtypeId = String(row.SubType || row.SubTypeID || '').trim().toUpperCase();
  return SUBTYPE_MAP[subtypeId] || TYPE_MAP[typeId] || 'text';
};

const getUdfDefinitions = async (tableId) => {
  const normalizedTableId = String(tableId || '').trim();
  if (!normalizedTableId) return [];

  const cufdColumns = await getColumnSet('CUFD');
  const selectSubType = cufdColumns.has('SubType') ? 'T0.SubType' : "'' AS SubType";
  const selectMandatoryAlt = cufdColumns.has('Mandatory') ? 'T0.Mandatory AS MandatoryAlt' : "'' AS MandatoryAlt";
  const selectEditable = cufdColumns.has('Editable') ? 'T0.Editable' : "'' AS Editable";

  const rows = await safe(db.query(`
    SELECT
      T0.TableID,
      T0.FieldID,
      T0.AliasID,
      T0.Descr,
      T0.TypeID,
      ${selectSubType},
      T0.EditSize,
      T0.NotNull AS Mandatory,
      ${selectMandatoryAlt},
      ${selectEditable},
      T0.Dflt,
      T1.FldValue,
      T1.Descr AS ValueDescr
    FROM CUFD T0
    LEFT JOIN UFD1 T1
      ON T1.TableID = T0.TableID
     AND T1.FieldID = T0.FieldID
    WHERE T0.TableID = @tableId
    ORDER BY T0.FieldID, T1.IndexID
  `, { tableId: normalizedTableId }));

  const byKey = new Map();

  rows.forEach((row) => {
    const key = normalizeUdfKey(row.AliasID);
    if (!key) return;

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: row.Descr || key,
        type: 'text',
        defaultValue: '',
        required: [row.Mandatory, row.MandatoryAlt].some((value) => String(value || '').toUpperCase() === 'Y'),
        readOnly: String(row.Editable || '').toUpperCase() === 'N',
        maxLength: row.EditSize || undefined,
        options: [],
      });
    }

    if (row.FldValue != null && String(row.FldValue).trim() !== '') {
      byKey.get(key).options.push({
        value: String(row.FldValue),
        label: row.ValueDescr || String(row.FldValue),
      });
    }
  });

  return Array.from(byKey.values()).map((field) => {
    const sourceRow = rows.find((row) => normalizeUdfKey(row.AliasID) === field.key) || {};
    const type = mapType(sourceRow, field.options);

    return {
      ...field,
      type,
      defaultValue: getDefaultValue(type, field.options, sourceRow.Dflt),
      tableId: sourceRow.TableID || undefined,
      fieldId: sourceRow.FieldID,
      aliasId: sourceRow.AliasID || field.key.replace(/^U_/, ''),
      sapField: field.key,
    };
  });
};

const getMarketingDocumentUdfs = async ({ headerTable, lineTable }) => {
  const [header, rows] = await Promise.all([
    getUdfDefinitions(headerTable),
    getUdfDefinitions(lineTable),
  ]);

  return { header, rows };
};

const toColumnName = (key) => String(key || '').replace(/]/g, ']]');

const formatValue = (value) => {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return value == null ? '' : String(value);
};

const getHeaderUdfValues = async ({ tableId, keyColumn = 'DocEntry', keyValue }) => {
  const definitions = await getUdfDefinitions(tableId);
  if (!definitions.length) return {};

  const selectList = definitions.map((field) => `[${toColumnName(field.key)}]`).join(', ');
  const rows = await safe(db.query(`
    SELECT ${selectList}
    FROM ${tableId}
    WHERE ${keyColumn} = @keyValue
  `, { keyValue }));

  const row = rows[0] || {};
  return definitions.reduce((acc, field) => {
    acc[field.key] = formatValue(row[field.key]);
    return acc;
  }, {});
};

const getLineUdfValues = async ({ tableId, keyColumn = 'DocEntry', keyValue }) => {
  const definitions = await getUdfDefinitions(tableId);
  if (!definitions.length) return {};

  const selectList = definitions.map((field) => `[${toColumnName(field.key)}]`).join(', ');
  const rows = await safe(db.query(`
    SELECT LineNum, ${selectList}
    FROM ${tableId}
    WHERE ${keyColumn} = @keyValue
  `, { keyValue }));

  return rows.reduce((acc, row) => {
    acc[row.LineNum] = definitions.reduce((values, field) => {
      values[field.key] = formatValue(row[field.key]);
      return values;
    }, {});
    return acc;
  }, {});
};

module.exports = {
  getMarketingDocumentUdfs,
  getUdfDefinitions,
  getHeaderUdfValues,
  getLineUdfValues,
};
