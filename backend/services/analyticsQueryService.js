const authDbService = require('./authDbService');
const executor = require('./analyticsQueryExecutorService');

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value) => String(value || '').trim();
const toInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const normalizeParametersInput = (parameters) => {
  if (!Array.isArray(parameters)) return [];

  return parameters.map((parameter, index) => {
    const name = normalizeText(parameter?.name);
    const label = normalizeText(parameter?.label) || name;
    const type = normalizeText(parameter?.type).toLowerCase();

    if (!name || !executor.VALID_PARAM_TYPES.has(type)) {
      throw createHttpError(400, `Parameter #${index + 1} requires a name and a valid type (string, number, or date).`);
    }

    return {
      name,
      label,
      type,
      default: parameter?.default != null ? String(parameter.default) : '',
      required: Boolean(parameter?.required),
    };
  });
};

const VALID_MEASURE_AGGS = new Set(['sum', 'avg', 'count', 'min', 'max']);

const normalizeMeasuresInput = (measures) => {
  if (!Array.isArray(measures)) return [];

  return measures.map((measure, index) => {
    const name = normalizeText(measure?.name);
    const label = normalizeText(measure?.label) || name;
    const field = normalizeText(measure?.field);
    const agg = normalizeText(measure?.agg).toLowerCase();

    if (!name || !field || !VALID_MEASURE_AGGS.has(agg)) {
      throw createHttpError(400, `Measure #${index + 1} requires a name, a field, and a valid aggregation (sum, avg, count, min, or max).`);
    }

    return { name, label, field, agg };
  });
};

const normalizeRoleIds = (roleIds) => {
  if (!Array.isArray(roleIds)) return [];
  return [...new Set(roleIds.map((id) => toInt(id)).filter((id) => Number.isInteger(id)))];
};

const normalizeQueryRow = (row) => ({
  queryId: row.QueryId,
  queryCode: row.QueryCode,
  queryName: row.QueryName,
  category: row.Category || '',
  description: row.Description || '',
  sqlText: row.SqlText,
  parameters: JSON.parse(row.ParametersJson || '[]'),
  measures: JSON.parse(row.MeasuresJson || '[]'),
  status: row.Status,
  rowLimit: Number(row.RowLimit || 500),
  timeoutMs: Number(row.TimeoutMs || 15000),
  columnMeta: row.ColumnMetaJson ? JSON.parse(row.ColumnMetaJson) : null,
  visibleRoleIds: JSON.parse(row.VisibleRoleIdsJson || '[]'),
  createdBy: row.CreatedBy,
  companyId: row.CompanyId,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
});

const requireAuth = (auth) => {
  const userId = toInt(auth?.userId);
  const companyId = toInt(auth?.companyId);
  if (!userId || !companyId) {
    throw createHttpError(401, 'A valid company session is required.');
  }
  return { userId, companyId };
};

const getQueryRow = async (queryId) => {
  const normalizedId = toInt(queryId);
  if (!normalizedId) return null;
  return authDbService.queryOne(`
    SELECT * FROM dbo.AnalyticsQueries WHERE QueryId = @queryId
  `, { queryId: normalizedId });
};

const requireOwnedQueryRow = async (queryId, companyId, userId) => {
  const row = await getQueryRow(queryId);
  if (!row || Number(row.CompanyId) !== companyId) {
    throw createHttpError(404, 'Query not found.');
  }
  if (Number(row.CreatedBy) !== userId) {
    throw createHttpError(403, 'You can only modify your own queries.');
  }
  return row;
};

const listQueries = async (auth, filters = {}) => {
  const { companyId } = requireAuth(auth);
  const status = normalizeText(filters.status);
  const category = normalizeText(filters.category);
  const search = normalizeText(filters.search);

  const conditions = ['CompanyId = @companyId'];
  const params = { companyId };

  if (status) {
    conditions.push('Status = @status');
    params.status = status;
  }
  if (category) {
    conditions.push('Category = @category');
    params.category = category;
  }
  if (search) {
    conditions.push('(QueryName LIKE @search OR QueryCode LIKE @search)');
    params.search = `%${search}%`;
  }

  const rows = await authDbService.queryRows(`
    SELECT * FROM dbo.AnalyticsQueries
    WHERE ${conditions.join(' AND ')}
    ORDER BY QueryName ASC, QueryId ASC
  `, params);

  return rows.map(normalizeQueryRow);
};

const getQueryById = async (queryId, auth) => {
  const { companyId } = requireAuth(auth);
  const row = await getQueryRow(queryId);
  if (!row || Number(row.CompanyId) !== companyId) {
    throw createHttpError(404, 'Query not found.');
  }
  return normalizeQueryRow(row);
};

const assertUniqueCode = async (queryCode, companyId, excludeQueryId = null) => {
  const existing = await authDbService.queryOne(`
    SELECT QueryId FROM dbo.AnalyticsQueries WHERE QueryCode = @queryCode
  `, { queryCode });

  if (existing && Number(existing.QueryId) !== Number(excludeQueryId)) {
    throw createHttpError(409, 'A query with this code already exists.');
  }
  void companyId;
};

const createQuery = async (payload, auth) => {
  const { userId, companyId } = requireAuth(auth);

  const queryCode = normalizeText(payload?.queryCode).toUpperCase();
  const queryName = normalizeText(payload?.queryName);
  const sqlText = String(payload?.sqlText || '');
  const category = normalizeText(payload?.category) || null;
  const description = normalizeText(payload?.description) || null;
  const parameters = normalizeParametersInput(payload?.parameters);
  const measures = normalizeMeasuresInput(payload?.measures);
  const rowLimit = toInt(payload?.rowLimit) || 500;
  const timeoutMs = toInt(payload?.timeoutMs) || 15000;
  const visibleRoleIds = normalizeRoleIds(payload?.visibleRoleIds);

  if (!queryCode || !queryName || !sqlText.trim()) {
    throw createHttpError(400, 'QueryCode, QueryName, and SqlText are required.');
  }

  executor.validateReadOnlySql(sqlText);
  await assertUniqueCode(queryCode, companyId);

  const inserted = await authDbService.query(`
    INSERT INTO dbo.AnalyticsQueries (
      QueryCode, QueryName, Category, Description, SqlText, ParametersJson, MeasuresJson,
      Status, RowLimit, TimeoutMs, VisibleRoleIdsJson, CreatedBy, CompanyId, CreatedAt
    )
    OUTPUT INSERTED.QueryId
    VALUES (
      @queryCode, @queryName, @category, @description, @sqlText, @parametersJson, @measuresJson,
      'Draft', @rowLimit, @timeoutMs, @visibleRoleIdsJson, @createdBy, @companyId, SYSUTCDATETIME()
    )
  `, {
    queryCode, queryName, category, description, sqlText,
    parametersJson: JSON.stringify(parameters),
    measuresJson: JSON.stringify(measures),
    rowLimit, timeoutMs,
    visibleRoleIdsJson: JSON.stringify(visibleRoleIds),
    createdBy: userId, companyId,
  });

  const queryId = inserted.recordset?.[0]?.QueryId;
  if (!queryId) {
    throw createHttpError(500, 'Failed to create query.');
  }

  return getQueryById(queryId, auth);
};

const updateQuery = async (queryId, payload, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const existing = await requireOwnedQueryRow(queryId, companyId, userId);

  const queryName = normalizeText(payload?.queryName) || existing.QueryName;
  const sqlText = payload?.sqlText != null ? String(payload.sqlText) : existing.SqlText;
  const category = payload?.category != null ? (normalizeText(payload.category) || null) : existing.Category;
  const description = payload?.description != null ? (normalizeText(payload.description) || null) : existing.Description;
  const parameters = payload?.parameters != null
    ? normalizeParametersInput(payload.parameters)
    : JSON.parse(existing.ParametersJson || '[]');
  const measures = payload?.measures != null
    ? normalizeMeasuresInput(payload.measures)
    : JSON.parse(existing.MeasuresJson || '[]');
  const rowLimit = toInt(payload?.rowLimit) || Number(existing.RowLimit || 500);
  const timeoutMs = toInt(payload?.timeoutMs) || Number(existing.TimeoutMs || 15000);
  const visibleRoleIds = payload?.visibleRoleIds != null
    ? normalizeRoleIds(payload.visibleRoleIds)
    : JSON.parse(existing.VisibleRoleIdsJson || '[]');

  if (!sqlText.trim()) {
    throw createHttpError(400, 'SqlText is required.');
  }
  executor.validateReadOnlySql(sqlText);

  await authDbService.query(`
    UPDATE dbo.AnalyticsQueries
    SET
      QueryName = @queryName,
      Category = @category,
      Description = @description,
      SqlText = @sqlText,
      ParametersJson = @parametersJson,
      MeasuresJson = @measuresJson,
      RowLimit = @rowLimit,
      TimeoutMs = @timeoutMs,
      VisibleRoleIdsJson = @visibleRoleIdsJson,
      UpdatedAt = SYSUTCDATETIME()
    WHERE QueryId = @queryId
  `, {
    queryId: Number(existing.QueryId),
    queryName, category, description, sqlText,
    parametersJson: JSON.stringify(parameters),
    measuresJson: JSON.stringify(measures),
    rowLimit, timeoutMs,
    visibleRoleIdsJson: JSON.stringify(visibleRoleIds),
  });

  return getQueryById(existing.QueryId, auth);
};

const setQueryStatus = async (queryId, auth, status) => {
  const { userId, companyId } = requireAuth(auth);
  const existing = await requireOwnedQueryRow(queryId, companyId, userId);

  if (status === 'Draft') {
    const referencingWidget = await authDbService.queryOne(`
      SELECT WidgetId FROM dbo.AnalyticsDashboardWidgets WHERE QueryId = @queryId
    `, { queryId: Number(existing.QueryId) });

    if (referencingWidget) {
      throw createHttpError(409, 'This query is used by a dashboard widget and cannot be unpublished. Remove it from all dashboards first.');
    }
  }

  await authDbService.query(`
    UPDATE dbo.AnalyticsQueries SET Status = @status, UpdatedAt = SYSUTCDATETIME() WHERE QueryId = @queryId
  `, { queryId: Number(existing.QueryId), status });

  return getQueryById(existing.QueryId, auth);
};

const deleteQuery = async (queryId, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const existing = await requireOwnedQueryRow(queryId, companyId, userId);

  const referencingWidget = await authDbService.queryOne(`
    SELECT WidgetId FROM dbo.AnalyticsDashboardWidgets WHERE QueryId = @queryId
  `, { queryId: Number(existing.QueryId) });

  if (referencingWidget) {
    throw createHttpError(409, 'This query is used by a dashboard widget and cannot be deleted. Remove it from all dashboards first.');
  }

  await authDbService.query(`
    DELETE FROM dbo.AnalyticsQueryExecutionLog WHERE QueryId = @queryId
  `, { queryId: Number(existing.QueryId) });

  await authDbService.query(`
    DELETE FROM dbo.AnalyticsQueries WHERE QueryId = @queryId
  `, { queryId: Number(existing.QueryId) });

  return { queryId: Number(existing.QueryId), deleted: true };
};

const previewQuery = async (payload, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const sqlText = String(payload?.sqlText || '');
  if (!sqlText.trim()) {
    throw createHttpError(400, 'SqlText is required.');
  }

  const parameters = normalizeParametersInput(payload?.parameters);
  const rowLimit = toInt(payload?.rowLimit) || 500;
  const timeoutMs = toInt(payload?.timeoutMs) || 15000;

  const result = await executor.runAdHocSql({
    sqlText,
    paramsSchema: parameters,
    paramValues: payload?.paramValues || {},
    auth: { userId, companyId },
    rowLimit,
    timeoutMs,
    queryId: toInt(payload?.queryId) || null,
  });

  return result;
};

const runSavedQuery = async (queryId, payload, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const row = await getQueryRow(queryId);
  if (!row || Number(row.CompanyId) !== companyId) {
    throw createHttpError(404, 'Query not found.');
  }

  const parameters = JSON.parse(row.ParametersJson || '[]');
  const result = await executor.runAdHocSql({
    sqlText: row.SqlText,
    paramsSchema: parameters,
    paramValues: payload?.paramValues || {},
    auth: { userId, companyId },
    rowLimit: Number(row.RowLimit || 500),
    timeoutMs: Number(row.TimeoutMs || 15000),
    queryId: Number(row.QueryId),
    widgetId: toInt(payload?.widgetId) || null,
  });

  if (result.columns?.length) {
    await authDbService.query(`
      UPDATE dbo.AnalyticsQueries SET ColumnMetaJson = @columnMetaJson WHERE QueryId = @queryId
    `, { queryId: Number(row.QueryId), columnMetaJson: JSON.stringify(result.columns) });
  }

  return result;
};

const listExecutions = async (queryId, auth, { page = 1, pageSize = 50 } = {}) => {
  const { companyId } = requireAuth(auth);
  const row = await getQueryRow(queryId);
  if (!row || Number(row.CompanyId) !== companyId) {
    throw createHttpError(404, 'Query not found.');
  }

  const safePage = Math.max(1, toInt(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, toInt(pageSize) || 50));
  const offset = (safePage - 1) * safePageSize;

  const rows = await authDbService.queryRows(`
    SELECT * FROM dbo.AnalyticsQueryExecutionLog
    WHERE QueryId = @queryId
    ORDER BY ExecutedAt DESC, ExecutionId DESC
    LIMIT @pageSize OFFSET @offset
  `, { queryId: Number(row.QueryId), pageSize: safePageSize, offset });

  return rows.map((execRow) => ({
    executionId: execRow.ExecutionId,
    queryId: execRow.QueryId,
    widgetId: execRow.WidgetId,
    userId: execRow.UserId,
    parameters: execRow.ParametersJson ? JSON.parse(execRow.ParametersJson) : {},
    rowCount: execRow.RowCount,
    durationMs: execRow.DurationMs,
    status: execRow.Status,
    errorMessage: execRow.ErrorMessage,
    executedAt: execRow.ExecutedAt,
  }));
};

module.exports = {
  listQueries,
  getQueryById,
  createQuery,
  updateQuery,
  setQueryStatus,
  deleteQuery,
  previewQuery,
  runSavedQuery,
  listExecutions,
};
