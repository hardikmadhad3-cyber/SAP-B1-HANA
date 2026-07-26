const authDbService = require('./authDbService');
const executor = require('./analyticsQueryExecutorService');

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const requireAuth = (auth) => {
  const userId = toInt(auth?.userId);
  const companyId = toInt(auth?.companyId);
  if (!userId || !companyId) {
    throw createHttpError(401, 'A valid company session is required.');
  }
  return { userId, companyId };
};

// The sidebar's NavLink runs every menu path through a normalizer that
// lowercases it and turns underscores into hyphens (fine for the app's
// existing static routes, which are already lowercase-hyphenated - but
// DashboardCode is stored upper/underscore, e.g. PURCHASE_ORDER, so the
// browser actually requests /analytics/dashboard/purchase-order). Undo that
// exact transform before looking up the code. Safe because DashboardCode is
// restricted to [A-Z0-9_] at creation time, so this round-trip is exact.
const denormalizeDashboardCode = (dashboardCode) =>
  String(dashboardCode || '').toUpperCase().replace(/-/g, '_');

const getPublishedDashboardByCode = async (dashboardCode, companyId) => {
  const normalizedCode = denormalizeDashboardCode(dashboardCode);
  const row = await authDbService.queryOne(`
    SELECT * FROM dbo.AnalyticsDashboards WHERE DashboardCode = @dashboardCode AND CompanyId = @companyId
  `, { dashboardCode: normalizedCode, companyId });

  if (!row || row.Status !== 'Published') {
    throw createHttpError(404, 'Dashboard not found or not published.');
  }
  return row;
};

const getDashboardShell = async (dashboardCode, auth) => {
  const { companyId } = requireAuth(auth);
  const dashboardRow = await getPublishedDashboardByCode(dashboardCode, companyId);

  const widgets = await authDbService.queryRows(`
    SELECT W.WidgetId, W.QueryId, W.WidgetType, W.Title, W.FieldMappingJson, W.SortOrder,
           Q.QueryName, Q.ColumnMetaJson, Q.ParametersJson
    FROM dbo.AnalyticsDashboardWidgets W
    INNER JOIN dbo.AnalyticsQueries Q ON Q.QueryId = W.QueryId
    WHERE W.DashboardId = @dashboardId
    ORDER BY W.SortOrder ASC, W.WidgetId ASC
  `, { dashboardId: Number(dashboardRow.DashboardId) });

  return {
    dashboardId: dashboardRow.DashboardId,
    dashboardCode: dashboardRow.DashboardCode,
    dashboardName: dashboardRow.DashboardName,
    description: dashboardRow.Description || '',
    layout: JSON.parse(dashboardRow.LayoutJson || '[]'),
    filters: JSON.parse(dashboardRow.FiltersJson || '[]'),
    widgets: widgets.map((widget) => ({
      widgetId: widget.WidgetId,
      queryId: widget.QueryId,
      queryName: widget.QueryName,
      widgetType: widget.WidgetType,
      title: widget.Title || '',
      fieldMapping: JSON.parse(widget.FieldMappingJson || '{}'),
      columnMeta: widget.ColumnMetaJson ? JSON.parse(widget.ColumnMetaJson) : null,
      // The query's declared parameters (name/label/type/default/required) -
      // the dashboard-level filter bar unions these across all widgets so
      // one shared control (e.g. "From Date") can drive every widget whose
      // query declares a parameter by that name.
      parameters: widget.ParametersJson ? JSON.parse(widget.ParametersJson) : [],
      sortOrder: Number(widget.SortOrder || 0),
    })),
  };
};

const runWidget = async (dashboardCode, widgetId, payload, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const dashboardRow = await getPublishedDashboardByCode(dashboardCode, companyId);

  const widgetRow = await authDbService.queryOne(`
    SELECT W.*, Q.SqlText, Q.ParametersJson, Q.RowLimit, Q.TimeoutMs
    FROM dbo.AnalyticsDashboardWidgets W
    INNER JOIN dbo.AnalyticsQueries Q ON Q.QueryId = W.QueryId
    WHERE W.WidgetId = @widgetId AND W.DashboardId = @dashboardId
  `, { widgetId: toInt(widgetId), dashboardId: Number(dashboardRow.DashboardId) });

  if (!widgetRow) {
    throw createHttpError(404, 'Widget not found.');
  }

  const parameterBindings = JSON.parse(widgetRow.ParameterBindingsJson || '{}');
  const paramValues = { ...parameterBindings, ...(payload?.paramValues || {}) };

  return executor.runAdHocSql({
    sqlText: widgetRow.SqlText,
    paramsSchema: JSON.parse(widgetRow.ParametersJson || '[]'),
    paramValues,
    auth: { userId, companyId },
    rowLimit: Number(widgetRow.RowLimit || 500),
    timeoutMs: Number(widgetRow.TimeoutMs || 15000),
    queryId: Number(widgetRow.QueryId),
    widgetId: Number(widgetRow.WidgetId),
  });
};

module.exports = {
  getDashboardShell,
  runWidget,
};
