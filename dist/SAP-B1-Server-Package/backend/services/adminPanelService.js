const bcrypt = require('bcryptjs');
const authDbService = require('./authDbService');
const { syncApplicationSidebarMenus } = require('./applicationMenuSyncService');
const {
  deleteReportMenuSidebarMenu,
  syncAllReportMenuSidebarMenus,
  syncReportMenuSidebarMenuById,
} = require('./reportMenuSidebarSyncService');

const MAX_LIST_ROWS = 500;

const ENTITY_CONFIGS = [
  {
    key: 'companies',
    tableName: 'Companies',
    title: 'Companies',
    description: 'Company database connections and status flags.',
    path: '/admin/companies',
    group: 'Core Setup',
    lookupLabelColumns: ['CompanyName', 'DbName'],
    listColumns: ['CompanyId', 'CompanyName', 'DbName', 'ServerName', 'SAPVersion', 'IsActive', 'CreatedAt'],
  },
  {
    key: 'users',
    tableName: 'Users',
    title: 'Users',
    description: 'Application users who can sign in to the portal.',
    path: '/admin/users',
    group: 'Security',
    lookupLabelColumns: ['FullName', 'Username'],
    listColumns: ['UserId', 'Username', 'FullName', 'Email', 'IsActive', 'CreatedAt'],
  },
  {
    key: 'roles',
    tableName: 'Roles',
    title: 'Roles',
    description: 'Security roles assigned to users.',
    path: '/admin/roles',
    group: 'Security',
    lookupLabelColumns: ['RoleName'],
    listColumns: ['RoleId', 'RoleName'],
  },
  {
    key: 'user-companies',
    tableName: 'UserCompanies',
    title: 'User Companies',
    description: 'Company access assignments per user.',
    path: '/admin/user-companies',
    group: 'Security',
    lookupLabelColumns: ['Id'],
    listColumns: ['Id', 'UserId', 'CompanyId', 'IsDefault'],
  },
  {
    key: 'user-roles',
    tableName: 'UserRoles',
    title: 'User Roles',
    description: 'Role assignments per user and company.',
    path: '/admin/user-roles',
    group: 'Security',
    lookupLabelColumns: ['Id'],
    listColumns: ['Id', 'UserId', 'RoleId', 'CompanyId'],
  },
  {
    key: 'menus',
    tableName: 'Menus',
    title: 'Menus',
    description: 'Navigation menu definitions for the application shell.',
    path: '/admin/menus',
    group: 'Navigation',
    lookupLabelColumns: ['MenuName', 'MenuPath'],
    listColumns: ['MenuId', 'MenuName', 'MenuPath', 'ParentId', 'SortOrder', 'Icon', 'ReportId'],
  },
  {
    key: 'report-menus',
    tableName: 'ReportMenus',
    title: 'Report Menus',
    description: 'Admin-defined menu groups for reporting screens.',
    path: '/admin/report-menus',
    group: 'Reporting',
    lookupLabelColumns: ['MenuName'],
    listColumns: ['ReportMenuId', 'MenuName', 'ParentId', 'CompanyId', 'SortOrder', 'CreatedBy', 'CreatedAt', 'UpdatedAt'],
  },
  {
    key: 'role-rights',
    tableName: 'RoleRights',
    title: 'Role Rights',
    description: 'Menu permissions by role.',
    path: '/admin/role-rights',
    group: 'Security',
    lookupLabelColumns: ['Id'],
    listColumns: ['Id', 'RoleId', 'MenuId', 'CanView', 'CanAdd', 'CanEdit'],
    hiddenColumns: ['CanDelete'],
    multiSelectColumns: ['MenuId'],
    forcedValues: { CanDelete: false },
  },
];

const ENTITY_CONFIG_BY_KEY = new Map(
  ENTITY_CONFIGS.map((config) => [config.key, config]),
);

const ENTITY_CONFIG_BY_TABLE = new Map(
  ENTITY_CONFIGS.map((config) => [config.tableName.toLowerCase(), config]),
);

const SENSITIVE_FIELD_PATTERN = /(password|secret|token)/i;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeIdentifier = (value) => `[${String(value || '').replace(/]/g, ']]')}]`;

const prettifyLabel = (value) =>
  String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\bId\b/g, 'ID')
    .trim();

const normalizeStringValue = (value) => {
  if (value === undefined || value === null) return '';
  return String(value);
};

const isDateType = (dataType) => ['date', 'datetime', 'datetime2', 'smalldatetime', 'datetimeoffset'].includes(dataType);
const isNumericType = (dataType) => ['bigint', 'decimal', 'float', 'int', 'money', 'numeric', 'real', 'smallint', 'smallmoney', 'tinyint'].includes(dataType);

const getInputType = (column) => {
  if (column.isSensitive) return 'password';
  if (column.isForeignKey) return 'select';
  if (column.dataType === 'bit') return 'checkbox';
  if (isDateType(column.dataType)) return 'datetime-local';
  if (isNumericType(column.dataType)) return 'number';
  return 'text';
};

const getEntityConfig = (entityKey) => {
  const config = ENTITY_CONFIG_BY_KEY.get(entityKey);
  if (!config) {
    throw createHttpError(404, `Unknown admin entity: ${entityKey}`);
  }
  return config;
};

const getSchemaRows = async (tableName) => authDbService.queryRows(`
  SELECT
    c.COLUMN_NAME AS columnName,
    c.DATA_TYPE AS dataType,
    c.IS_NULLABLE AS isNullable,
    c.CHARACTER_MAXIMUM_LENGTH AS maxLength,
    c.ORDINAL_POSITION AS ordinalPosition,
    COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS isIdentity,
    CASE WHEN pk.COLUMN_NAME IS NULL THEN 0 ELSE 1 END AS isPrimaryKey,
    fk.referencedTable,
    fk.referencedColumn
  FROM INFORMATION_SCHEMA.COLUMNS c
  LEFT JOIN (
    SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
      ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
      AND tc.TABLE_NAME = ku.TABLE_NAME
    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
  ) pk
    ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA
    AND pk.TABLE_NAME = c.TABLE_NAME
    AND pk.COLUMN_NAME = c.COLUMN_NAME
  LEFT JOIN (
    SELECT
      cu.TABLE_SCHEMA,
      cu.TABLE_NAME,
      cu.COLUMN_NAME,
      pk.TABLE_NAME AS referencedTable,
      pku.COLUMN_NAME AS referencedColumn
    FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE cu
      ON rc.CONSTRAINT_NAME = cu.CONSTRAINT_NAME
    INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS pk
      ON rc.UNIQUE_CONSTRAINT_NAME = pk.CONSTRAINT_NAME
    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pku
      ON pk.CONSTRAINT_NAME = pku.CONSTRAINT_NAME
      AND pk.TABLE_SCHEMA = pku.TABLE_SCHEMA
      AND cu.ORDINAL_POSITION = pku.ORDINAL_POSITION
  ) fk
    ON fk.TABLE_SCHEMA = c.TABLE_SCHEMA
    AND fk.TABLE_NAME = c.TABLE_NAME
    AND fk.COLUMN_NAME = c.COLUMN_NAME
  WHERE c.TABLE_SCHEMA = 'dbo'
    AND c.TABLE_NAME = @tableName
  ORDER BY c.ORDINAL_POSITION ASC
`, { tableName });

const sanitizeRecord = (columns, row) => {
  const sanitized = { ...row };

  for (const column of columns) {
    if (column.isSensitive) {
      sanitized[column.name] = '';
    }
  }

  return sanitized;
};

const buildLookupLabel = (config, row) => {
  const labelParts = (config.lookupLabelColumns || [])
    .map((columnName) => normalizeStringValue(row[columnName]).trim())
    .filter(Boolean);

  if (labelParts.length) return labelParts.join(' - ');

  const fallbackValues = Object.entries(row)
    .filter(([key, value]) => key !== config.primaryKey && value !== null && value !== undefined && value !== '')
    .slice(0, 2)
    .map(([, value]) => normalizeStringValue(value).trim())
    .filter(Boolean);

  if (fallbackValues.length) return fallbackValues.join(' - ');
  return normalizeStringValue(row[config.primaryKey]);
};

const buildEntitySchema = (config, schemaRows) => {
  const columns = schemaRows.map((row) => {
    const referencedConfig = row.referencedTable
      ? ENTITY_CONFIG_BY_TABLE.get(String(row.referencedTable).toLowerCase())
      : null;
    const name = row.columnName;
    const isPrimaryKey = Boolean(row.isPrimaryKey);
    const isIdentity = Boolean(row.isIdentity);
    const isSensitive = SENSITIVE_FIELD_PATTERN.test(name);
    const isForeignKey = Boolean(row.referencedTable);
    const isHidden = (config.hiddenColumns || []).includes(name);
    const isMultiSelect = (config.multiSelectColumns || []).includes(name);

    return {
      name,
      label: prettifyLabel(name),
      dataType: String(row.dataType || '').toLowerCase(),
      nullable: String(row.isNullable || '').toUpperCase() === 'YES',
      maxLength: row.maxLength === null ? null : Number(row.maxLength),
      ordinalPosition: Number(row.ordinalPosition),
      isPrimaryKey,
      isIdentity,
      isSensitive,
      isForeignKey,
      referencedTable: row.referencedTable || null,
      referencedColumn: row.referencedColumn || null,
      referencedEntityKey: referencedConfig?.key || null,
      readOnly: isIdentity,
      hidden: isHidden,
      multiSelect: isMultiSelect,
      editable: !isIdentity && !isHidden,
      inputType: isMultiSelect ? 'multiselect' : '',
      helpText: '',
    };
  });

  for (const column of columns) {
    column.inputType = column.multiSelect ? 'multiselect' : getInputType(column);

    if (column.isSensitive) {
      column.helpText = column.isPrimaryKey
        ? ''
        : 'Leave blank during edit to keep the current stored value.';
    }
  }

  const primaryKeyColumn = columns.find((column) => column.isPrimaryKey);
  if (!primaryKeyColumn) {
    throw createHttpError(500, `No primary key metadata found for ${config.tableName}.`);
  }

  return {
    entity: {
      key: config.key,
      title: config.title,
      description: config.description,
      path: config.path,
      group: config.group,
      listColumns: config.listColumns,
    },
    tableName: config.tableName,
    primaryKey: primaryKeyColumn.name,
    columns,
  };
};

const getEntitySchema = async (entityKey) => {
  const config = getEntityConfig(entityKey);
  const schemaRows = await getSchemaRows(config.tableName);
  return buildEntitySchema(config, schemaRows);
};

const getListQueryColumns = (schema) =>
  schema.columns.map((column) => escapeIdentifier(column.name)).join(', ');

const getRecordsForEntity = async (schema) => {
  const rows = await authDbService.queryRows(`
    SELECT TOP (${MAX_LIST_ROWS}) ${getListQueryColumns(schema)}
    FROM dbo.${escapeIdentifier(schema.tableName)}
    ORDER BY ${escapeIdentifier(schema.primaryKey)} DESC
  `);

  return rows.map((row) => sanitizeRecord(schema.columns, row));
};

const getLookupOptionsForColumn = async (column) => {
  if (!column.referencedEntityKey) return [];

  const lookupSchema = await getEntitySchema(column.referencedEntityKey);
  const lookupConfig = getEntityConfig(column.referencedEntityKey);
  const lookupColumns = Array.from(
    new Set([lookupSchema.primaryKey, ...(lookupConfig.lookupLabelColumns || [])]),
  );

  const rows = await authDbService.queryRows(`
    SELECT ${lookupColumns.map(escapeIdentifier).join(', ')}
    FROM dbo.${escapeIdentifier(lookupSchema.tableName)}
    ORDER BY ${escapeIdentifier(lookupSchema.primaryKey)} DESC
  `);

  return rows.map((row) => ({
    value: row[lookupSchema.primaryKey],
    label: buildLookupLabel({ ...lookupConfig, primaryKey: lookupSchema.primaryKey }, row),
  }));
};

const getLookupsForSchema = async (schema) => {
  const lookupColumns = schema.columns.filter((column) => column.isForeignKey && column.referencedEntityKey);
  const lookups = {};

  for (const column of lookupColumns) {
    lookups[column.name] = await getLookupOptionsForColumn(column);
  }

  return lookups;
};

const getEntityCount = async (tableName) => {
  const result = await authDbService.queryOne(`
    SELECT COUNT(1) AS totalRows
    FROM dbo.${escapeIdentifier(tableName)}
  `);

  return Number(result?.totalRows || 0);
};

const getEntityList = async () => {
  await authDbService.transaction(async (db) => {
    await syncApplicationSidebarMenus(db);
    await syncAllReportMenuSidebarMenus(db);
  });

  const entities = await Promise.all(
    ENTITY_CONFIGS.map(async (config) => ({
      key: config.key,
      title: config.title,
      description: config.description,
      path: config.path,
      group: config.group,
      count: await getEntityCount(config.tableName),
    })),
  );

  return entities;
};

const getEntityBootstrap = async (entityKey) => {
  if (['menus', 'role-rights', 'report-menus'].includes(entityKey)) {
    await authDbService.transaction(async (db) => {
      await syncApplicationSidebarMenus(db);
      await syncAllReportMenuSidebarMenus(db);
    });
  }

  const schema = await getEntitySchema(entityKey);
  const [records, lookups] = await Promise.all([
    getRecordsForEntity(schema),
    getLookupsForSchema(schema),
  ]);

  return {
    entity: schema.entity,
    schema,
    records,
    lookups,
  };
};

const normalizeValueByColumn = async (column, value, mode) => {
  if (value === undefined) return undefined;

  if (column.multiSelect) {
    const values = Array.isArray(value)
      ? value
      : (value === '' || value === null ? [] : [value]);

    if (!values.length) {
      return column.nullable ? [] : undefined;
    }

    if (isNumericType(column.dataType)) {
      const normalizedValues = values.map((entry) => Number(entry));
      if (normalizedValues.some((entry) => !Number.isFinite(entry))) {
        throw createHttpError(400, `${column.label} must contain valid numbers.`);
      }

      return Array.from(new Set(normalizedValues));
    }

    return Array.from(new Set(values.map((entry) => String(entry).trim()).filter(Boolean)));
  }

  if (column.isSensitive) {
    const normalized = normalizeStringValue(value);
    if (!normalized.trim()) {
      return mode === 'update' ? undefined : (column.nullable ? null : '');
    }

    if (column.name === 'PasswordHash' && !BCRYPT_HASH_PATTERN.test(normalized)) {
      return bcrypt.hash(normalized, 10);
    }

    return normalized;
  }

  if (column.dataType === 'bit') {
    if (value === '' || value === null) {
      return column.nullable ? null : false;
    }

    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
  }

  if (isNumericType(column.dataType)) {
    if (value === '' || value === null) {
      return column.nullable ? null : 0;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw createHttpError(400, `${column.label} must be a valid number.`);
    }
    return numericValue;
  }

  if (isDateType(column.dataType)) {
    if (value === '' || value === null) {
      return column.nullable ? null : undefined;
    }

    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
      throw createHttpError(400, `${column.label} must be a valid date/time value.`);
    }

    return dateValue;
  }

  if (value === '' || value === null) {
    return column.nullable ? null : '';
  }

  return String(value).trim();
};

const applyAutomaticDefaults = (payload, schema, mode, authContext) => {
  const nextPayload = { ...payload };

  for (const column of schema.columns) {
    if (!column.editable || nextPayload[column.name] !== undefined) {
      continue;
    }

    if (mode === 'create' && column.name === 'CreatedAt' && !column.nullable) {
      nextPayload[column.name] = new Date();
      continue;
    }

    if (column.name === 'UpdatedAt') {
      nextPayload[column.name] = new Date();
      continue;
    }

    if (mode === 'create' && column.name === 'CreatedBy' && authContext?.userId) {
      nextPayload[column.name] = Number(authContext.userId);
      continue;
    }

    if (mode === 'create' && column.name === 'CompanyId' && authContext?.companyId && !column.nullable) {
      nextPayload[column.name] = Number(authContext.companyId);
      continue;
    }

    if (mode === 'create' && column.dataType === 'bit' && !column.nullable) {
      nextPayload[column.name] = false;
    }
  }

  return nextPayload;
};

const validatePayload = (payload, schema, mode) => {
  for (const column of schema.columns) {
    if (!column.editable) continue;

    const value = payload[column.name];
    if (value === undefined) continue;

    if ((value === null || value === '' || (Array.isArray(value) && !value.length)) && !column.nullable) {
      throw createHttpError(400, `${column.label} is required.`);
    }
  }

  if (mode === 'create') {
    for (const column of schema.columns) {
      if (!column.editable || column.nullable) continue;
      if (payload[column.name] === undefined) {
        throw createHttpError(400, `${column.label} is required.`);
      }
    }
  }
};

const buildPayload = async (schema, input = {}, mode, authContext) => {
  const payload = {};

  for (const column of schema.columns) {
    if (!column.editable) continue;

    const normalizedValue = await normalizeValueByColumn(column, input[column.name], mode);
    if (normalizedValue !== undefined) {
      payload[column.name] = normalizedValue;
    }
  }

  const payloadWithDefaults = applyAutomaticDefaults(payload, schema, mode, authContext);
  validatePayload(payloadWithDefaults, schema, mode);
  return payloadWithDefaults;
};

const applyForcedValues = (entityKey, payload) => ({
  ...payload,
  ...(getEntityConfig(entityKey).forcedValues || {}),
});

const insertRoleRightRows = async (db, schema, payload, currentRecordId = null, requireInsertedRows = true) => {
  const menuIds = Array.isArray(payload.MenuId) ? payload.MenuId : [payload.MenuId];
  const uniqueMenuIds = Array.from(new Set(menuIds.map((value) => Number(value)).filter(Number.isFinite)));

  if (!uniqueMenuIds.length) {
    throw createHttpError(400, 'Menu ID is required.');
  }

  const basePayload = {
    ...payload,
    CanDelete: false,
  };

  delete basePayload.MenuId;
  delete basePayload[schema.primaryKey];

  let affectedRows = 0;
  for (const menuId of uniqueMenuIds) {
    const duplicate = await db.queryRows(`
      SELECT TOP 1 ${escapeIdentifier(schema.primaryKey)} AS Id
      FROM dbo.${escapeIdentifier(schema.tableName)}
      WHERE RoleId = @RoleId
        AND MenuId = @MenuId
        ${currentRecordId ? `AND ${escapeIdentifier(schema.primaryKey)} <> @CurrentRecordId` : ''}
    `, {
      RoleId: basePayload.RoleId,
      MenuId: menuId,
      ...(currentRecordId ? { CurrentRecordId: currentRecordId } : {}),
    });

    if (duplicate.length) {
      continue;
    }

    const rowPayload = {
      ...basePayload,
      MenuId: menuId,
    };
    const query = buildInsertQuery(schema, rowPayload);
    const result = await db.query(query.sqlText, query.params);
    affectedRows += result.rowsAffected?.[0] || 0;
  }

  if (requireInsertedRows && !affectedRows) {
    throw createHttpError(409, 'The selected role/menu rights already exist.');
  }
};

const updateRoleRightRows = async (db, schema, recordId, payload) => {
  const menuIds = Array.isArray(payload.MenuId) ? payload.MenuId : [payload.MenuId];
  const uniqueMenuIds = Array.from(new Set(menuIds.map((value) => Number(value)).filter(Number.isFinite)));

  if (!uniqueMenuIds.length) {
    throw createHttpError(400, 'Menu ID is required.');
  }

  const currentRows = await db.queryRows(`
    SELECT TOP 1 MenuId
    FROM dbo.${escapeIdentifier(schema.tableName)}
    WHERE ${escapeIdentifier(schema.primaryKey)} = @recordId
  `, { recordId });

  if (!currentRows.length) {
    throw createHttpError(404, 'Record not found.');
  }

  const currentMenuId = Number(currentRows[0].MenuId);
  let primaryMenuId = uniqueMenuIds.includes(currentMenuId) ? currentMenuId : null;

  if (primaryMenuId === null) {
    for (const menuId of uniqueMenuIds) {
      const duplicate = await db.queryRows(`
        SELECT TOP 1 ${escapeIdentifier(schema.primaryKey)} AS Id
        FROM dbo.${escapeIdentifier(schema.tableName)}
        WHERE RoleId = @RoleId
          AND MenuId = @MenuId
          AND ${escapeIdentifier(schema.primaryKey)} <> @recordId
      `, {
        RoleId: payload.RoleId,
        MenuId: menuId,
        recordId,
      });

      if (!duplicate.length) {
        primaryMenuId = menuId;
        break;
      }
    }
  }

  if (primaryMenuId === null) {
    throw createHttpError(409, 'The selected role/menu rights already exist.');
  }

  const firstPayload = {
    ...payload,
    MenuId: primaryMenuId,
    CanDelete: false,
  };
  const updateQuery = buildUpdateQuery(schema, firstPayload, recordId);
  const result = await db.query(updateQuery.sqlText, updateQuery.params);

  if (!result.rowsAffected?.[0]) {
    throw createHttpError(404, 'Record not found.');
  }

  if (uniqueMenuIds.length > 1) {
    await insertRoleRightRows(db, schema, {
      ...payload,
      MenuId: uniqueMenuIds.filter((menuId) => menuId !== primaryMenuId),
      CanDelete: false,
    }, recordId, false);
  }
};

const buildInsertQuery = (schema, payload) => {
  const columnNames = Object.keys(payload);

  if (!columnNames.length) {
    throw createHttpError(400, 'No fields were provided for insert.');
  }

  const insertColumns = columnNames.map(escapeIdentifier).join(', ');
  const valuePlaceholders = columnNames.map((columnName) => `@${columnName}`).join(', ');

  return {
    sqlText: `
      INSERT INTO dbo.${escapeIdentifier(schema.tableName)} (${insertColumns})
      VALUES (${valuePlaceholders})
    `,
    params: payload,
  };
};

const buildInsertQueryWithOutput = (schema, payload, outputAlias = 'recordId') => {
  const columnNames = Object.keys(payload);

  if (!columnNames.length) {
    throw createHttpError(400, 'No fields were provided for insert.');
  }

  const insertColumns = columnNames.map(escapeIdentifier).join(', ');
  const valuePlaceholders = columnNames.map((columnName) => `@${columnName}`).join(', ');

  return {
    sqlText: `
      INSERT INTO dbo.${escapeIdentifier(schema.tableName)} (${insertColumns})
      OUTPUT INSERTED.${escapeIdentifier(schema.primaryKey)} AS ${escapeIdentifier(outputAlias)}
      VALUES (${valuePlaceholders})
    `,
    params: payload,
  };
};

const buildUpdateQuery = (schema, payload, recordId) => {
  const updateColumnNames = Object.keys(payload).filter((columnName) => columnName !== schema.primaryKey);

  if (!updateColumnNames.length) {
    throw createHttpError(400, 'No editable fields were provided for update.');
  }

  return {
    sqlText: `
      UPDATE dbo.${escapeIdentifier(schema.tableName)}
      SET ${updateColumnNames.map((columnName) => `${escapeIdentifier(columnName)} = @${columnName}`).join(', ')}
      WHERE ${escapeIdentifier(schema.primaryKey)} = @recordId
    `,
    params: {
      ...payload,
      recordId,
    },
  };
};

const createRecord = async (entityKey, input, authContext) => {
  const schema = await getEntitySchema(entityKey);
  const payload = applyForcedValues(entityKey, await buildPayload(schema, input, 'create', authContext));
  if (entityKey === 'report-menus') {
    const query = buildInsertQueryWithOutput(schema, payload);
    await authDbService.transaction(async (db) => {
      const inserted = await db.query(query.sqlText, query.params);
      const insertedRecordId = Number(inserted.recordset?.[0]?.recordId);
      if (!Number.isFinite(insertedRecordId)) {
        throw createHttpError(500, 'Failed to create report menu.');
      }

      await syncReportMenuSidebarMenuById(db, insertedRecordId);
    });
    return getEntityBootstrap(entityKey);
  }

  if (entityKey === 'role-rights') {
    await authDbService.transaction(async (db) => {
      await insertRoleRightRows(db, schema, payload);
    });
    return getEntityBootstrap(entityKey);
  }

  const query = buildInsertQuery(schema, payload);
  await authDbService.query(query.sqlText, query.params);
  return getEntityBootstrap(entityKey);
};

const updateRecord = async (entityKey, recordId, input, authContext) => {
  const schema = await getEntitySchema(entityKey);
  const numericRecordId = Number(recordId);
  if (!Number.isFinite(numericRecordId)) {
    throw createHttpError(400, 'A valid record ID is required for update.');
  }

  const payload = applyForcedValues(entityKey, await buildPayload(schema, input, 'update', authContext));
  if (entityKey === 'report-menus') {
    const query = buildUpdateQuery(schema, payload, numericRecordId);
    await authDbService.transaction(async (db) => {
      const result = await db.query(query.sqlText, query.params);
      if (!result.rowsAffected?.[0]) {
        throw createHttpError(404, 'Record not found.');
      }

      await syncReportMenuSidebarMenuById(db, numericRecordId);
    });

    return getEntityBootstrap(entityKey);
  }

  if (entityKey === 'role-rights') {
    await authDbService.transaction(async (db) => {
      await updateRoleRightRows(db, schema, numericRecordId, payload);
    });
    return getEntityBootstrap(entityKey);
  }

  const query = buildUpdateQuery(schema, payload, numericRecordId);
  const result = await authDbService.query(query.sqlText, query.params);

  if (!result.rowsAffected?.[0]) {
    throw createHttpError(404, 'Record not found.');
  }

  return getEntityBootstrap(entityKey);
};

const deleteRecord = async (entityKey, recordId) => {
  const schema = await getEntitySchema(entityKey);
  const numericRecordId = Number(recordId);
  if (!Number.isFinite(numericRecordId)) {
    throw createHttpError(400, 'A valid record ID is required for delete.');
  }

  if (entityKey === 'report-menus') {
    await authDbService.transaction(async (db) => {
      await deleteReportMenuSidebarMenu(db, numericRecordId);

      const result = await db.query(`
        DELETE FROM dbo.${escapeIdentifier(schema.tableName)}
        WHERE ${escapeIdentifier(schema.primaryKey)} = @recordId
      `, { recordId: numericRecordId });

      if (!result.rowsAffected?.[0]) {
        throw createHttpError(404, 'Record not found.');
      }
    });

    return getEntityBootstrap(entityKey);
  }

  const result = await authDbService.query(`
    DELETE FROM dbo.${escapeIdentifier(schema.tableName)}
    WHERE ${escapeIdentifier(schema.primaryKey)} = @recordId
  `, { recordId: numericRecordId });

  if (!result.rowsAffected?.[0]) {
    throw createHttpError(404, 'Record not found.');
  }

  return getEntityBootstrap(entityKey);
};

module.exports = {
  getEntityList,
  getEntityBootstrap,
  createRecord,
  updateRecord,
  deleteRecord,
};
