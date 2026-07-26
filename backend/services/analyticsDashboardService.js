const authDbService = require('./authDbService');
const menuSync = require('./analyticsDashboardMenuSyncService');
const { syncApplicationSidebarMenus } = require('./applicationMenuSyncService');

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

const VALID_WIDGET_TYPES = new Set([
  'kpi', 'table', 'gauge', 'matrix',
  'bar', 'column-stacked',
  'bar-horizontal', 'bar-horizontal-stacked',
  'line', 'area', 'area-stacked',
  'pie', 'donut',
  'combo',
  'scatter', 'funnel', 'treemap', 'radar',
  'waterfall', 'bullet', 'card-trend', 'heatmap',
]);

const requireAuth = (auth) => {
  const userId = toInt(auth?.userId);
  const companyId = toInt(auth?.companyId);
  if (!userId || !companyId) {
    throw createHttpError(401, 'A valid company session is required.');
  }
  return { userId, companyId, roleId: toInt(auth?.roleId) };
};

const normalizeRoleIds = (roleIds) => {
  if (!Array.isArray(roleIds)) return [];
  return [...new Set(roleIds.map((id) => toInt(id)).filter((id) => Number.isInteger(id)))];
};

const normalizeDashboardRow = (row, widgets = []) => ({
  dashboardId: row.DashboardId,
  dashboardCode: row.DashboardCode,
  dashboardName: row.DashboardName,
  description: row.Description || '',
  layout: JSON.parse(row.LayoutJson || '[]'),
  canvasWidth: Number(row.CanvasWidth || 1280),
  canvasHeight: Number(row.CanvasHeight || 800),
  filters: JSON.parse(row.FiltersJson || '[]'),
  status: row.Status,
  visibleRoleIds: JSON.parse(row.VisibleRoleIdsJson || '[]'),
  sortOrder: Number(row.SortOrder || 0),
  createdBy: row.CreatedBy,
  companyId: row.CompanyId,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  widgets: widgets.map(normalizeWidgetRow),
});

function normalizeWidgetRow(row) {
  return {
    widgetId: row.WidgetId,
    dashboardId: row.DashboardId,
    queryId: row.QueryId,
    widgetType: row.WidgetType,
    title: row.Title || '',
    fieldMapping: JSON.parse(row.FieldMappingJson || '{}'),
    parameterBindings: JSON.parse(row.ParameterBindingsJson || '{}'),
    sortOrder: Number(row.SortOrder || 0),
  };
}

const getDashboardRow = async (dashboardId) => {
  const normalizedId = toInt(dashboardId);
  if (!normalizedId) return null;
  return authDbService.queryOne(`SELECT * FROM dbo.AnalyticsDashboards WHERE DashboardId = @dashboardId`, { dashboardId: normalizedId });
};

const getWidgetsForDashboard = async (dashboardId) =>
  authDbService.queryRows(`
    SELECT * FROM dbo.AnalyticsDashboardWidgets WHERE DashboardId = @dashboardId ORDER BY SortOrder ASC, WidgetId ASC
  `, { dashboardId: toInt(dashboardId) });

const requireOwnedDashboardRow = async (dashboardId, companyId, userId) => {
  const row = await getDashboardRow(dashboardId);
  if (!row || Number(row.CompanyId) !== companyId) {
    throw createHttpError(404, 'Dashboard not found.');
  }
  if (Number(row.CreatedBy) !== userId) {
    throw createHttpError(403, 'You can only modify your own dashboards.');
  }
  return row;
};

const listDashboards = async (auth, filters = {}) => {
  const { companyId } = requireAuth(auth);
  const status = normalizeText(filters.status);

  const conditions = ['CompanyId = @companyId'];
  const params = { companyId };
  if (status) {
    conditions.push('Status = @status');
    params.status = status;
  }

  const rows = await authDbService.queryRows(`
    SELECT * FROM dbo.AnalyticsDashboards
    WHERE ${conditions.join(' AND ')}
    ORDER BY SortOrder ASC, DashboardName ASC, DashboardId ASC
  `, params);

  return rows.map((row) => normalizeDashboardRow(row, []));
};

const getDashboardById = async (dashboardId, auth) => {
  const { companyId } = requireAuth(auth);
  const row = await getDashboardRow(dashboardId);
  if (!row || Number(row.CompanyId) !== companyId) {
    throw createHttpError(404, 'Dashboard not found.');
  }
  const widgets = await getWidgetsForDashboard(row.DashboardId);
  return normalizeDashboardRow(row, widgets);
};

const assertUniqueCode = async (dashboardCode, excludeDashboardId = null) => {
  const existing = await authDbService.queryOne(`
    SELECT DashboardId FROM dbo.AnalyticsDashboards WHERE DashboardCode = @dashboardCode
  `, { dashboardCode });

  if (existing && Number(existing.DashboardId) !== Number(excludeDashboardId)) {
    throw createHttpError(409, 'A dashboard with this code already exists.');
  }
};

const createDashboard = async (payload, auth) => {
  const { userId, companyId, roleId } = requireAuth(auth);

  const dashboardCode = normalizeText(payload?.dashboardCode).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const dashboardName = normalizeText(payload?.dashboardName);
  const description = normalizeText(payload?.description) || null;
  const sortOrder = toInt(payload?.sortOrder) || 0;
  const canvasWidth = toInt(payload?.canvasWidth) || 1280;
  const canvasHeight = toInt(payload?.canvasHeight) || 800;
  const filters = Array.isArray(payload?.filters) ? payload.filters : [];
  // Default to the creator's own role so a newly published dashboard is at
  // least visible to the person who built it, without requiring them to
  // remember to check their own role in the visibility picker first.
  const visibleRoleIds = roleId ? [roleId] : [];

  if (!dashboardCode || !dashboardName) {
    throw createHttpError(400, 'DashboardCode and DashboardName are required.');
  }

  await assertUniqueCode(dashboardCode);

  const inserted = await authDbService.query(`
    INSERT INTO dbo.AnalyticsDashboards (
      DashboardCode, DashboardName, Description, LayoutJson, CanvasWidth, CanvasHeight, FiltersJson, Status, VisibleRoleIdsJson, SortOrder, CreatedBy, CompanyId, CreatedAt
    )
    OUTPUT INSERTED.DashboardId
    VALUES (
      @dashboardCode, @dashboardName, @description, '[]', @canvasWidth, @canvasHeight, @filtersJson, 'Draft', @visibleRoleIdsJson, @sortOrder, @createdBy, @companyId, SYSUTCDATETIME()
    )
  `, { dashboardCode, dashboardName, description, sortOrder, canvasWidth, canvasHeight, filtersJson: JSON.stringify(filters), createdBy: userId, companyId, visibleRoleIdsJson: JSON.stringify(visibleRoleIds) });

  const dashboardId = inserted.recordset?.[0]?.DashboardId;
  if (!dashboardId) {
    throw createHttpError(500, 'Failed to create dashboard.');
  }

  return getDashboardById(dashboardId, auth);
};

const updateDashboard = async (dashboardId, payload, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const existing = await requireOwnedDashboardRow(dashboardId, companyId, userId);

  const dashboardName = normalizeText(payload?.dashboardName) || existing.DashboardName;
  const description = payload?.description != null ? (normalizeText(payload.description) || null) : existing.Description;
  const layout = payload?.layout != null ? JSON.stringify(payload.layout) : existing.LayoutJson;
  const canvasWidth = payload?.canvasWidth != null ? (toInt(payload.canvasWidth) || 1280) : Number(existing.CanvasWidth || 1280);
  const canvasHeight = payload?.canvasHeight != null ? (toInt(payload.canvasHeight) || 800) : Number(existing.CanvasHeight || 800);
  const filters = Array.isArray(payload?.filters) ? payload.filters : JSON.parse(existing.FiltersJson || '[]');
  const visibleRoleIds = payload?.visibleRoleIds != null
    ? normalizeRoleIds(payload.visibleRoleIds)
    : JSON.parse(existing.VisibleRoleIdsJson || '[]');
  const sortOrder = payload?.sortOrder != null ? (toInt(payload.sortOrder) || 0) : Number(existing.SortOrder || 0);

  await authDbService.transaction(async (db) => {
    await db.query(`
      UPDATE dbo.AnalyticsDashboards
      SET DashboardName = @dashboardName, Description = @description, LayoutJson = @layout,
          CanvasWidth = @canvasWidth, CanvasHeight = @canvasHeight, FiltersJson = @filtersJson,
          VisibleRoleIdsJson = @visibleRoleIdsJson, SortOrder = @sortOrder, UpdatedAt = SYSUTCDATETIME()
      WHERE DashboardId = @dashboardId
    `, {
      dashboardId: Number(existing.DashboardId),
      dashboardName, description, layout, canvasWidth, canvasHeight,
      filtersJson: JSON.stringify(filters),
      visibleRoleIdsJson: JSON.stringify(visibleRoleIds),
      sortOrder,
    });

    const updatedRow = await db.queryOne(`SELECT * FROM dbo.AnalyticsDashboards WHERE DashboardId = @dashboardId`, { dashboardId: Number(existing.DashboardId) });
    if (updatedRow.Status === 'Published') {
      await syncApplicationSidebarMenus(db);
      await menuSync.syncAnalyticsDashboardMenu(db, updatedRow);
    }
  });

  return getDashboardById(existing.DashboardId, auth);
};

const setDashboardStatus = async (dashboardId, auth, status) => {
  const { userId, companyId } = requireAuth(auth);
  const existing = await requireOwnedDashboardRow(dashboardId, companyId, userId);

  if (status === 'Published') {
    const widgets = await getWidgetsForDashboard(existing.DashboardId);
    if (!widgets.length) {
      throw createHttpError(400, 'Add at least one widget before publishing this dashboard.');
    }

    const visibleRoleIds = JSON.parse(existing.VisibleRoleIdsJson || '[]');
    if (!visibleRoleIds.length) {
      throw createHttpError(400, 'Select at least one role in "Visible to Roles" before publishing - otherwise nobody will see it in the menu.');
    }
  }

  await authDbService.transaction(async (db) => {
    await db.query(`
      UPDATE dbo.AnalyticsDashboards SET Status = @status, UpdatedAt = SYSUTCDATETIME() WHERE DashboardId = @dashboardId
    `, { dashboardId: Number(existing.DashboardId), status });

    await syncApplicationSidebarMenus(db);
    if (status === 'Published') {
      const publishedRow = await db.queryOne(`SELECT * FROM dbo.AnalyticsDashboards WHERE DashboardId = @dashboardId`, { dashboardId: Number(existing.DashboardId) });
      await menuSync.syncAnalyticsDashboardMenu(db, publishedRow);
    } else {
      await menuSync.deleteAnalyticsDashboardMenu(db, existing.DashboardId);
    }
  });

  return getDashboardById(existing.DashboardId, auth);
};

const deleteDashboard = async (dashboardId, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const existing = await requireOwnedDashboardRow(dashboardId, companyId, userId);

  await authDbService.transaction(async (db) => {
    await menuSync.deleteAnalyticsDashboardMenu(db, existing.DashboardId);
    await db.query(`DELETE FROM dbo.AnalyticsDashboardWidgets WHERE DashboardId = @dashboardId`, { dashboardId: Number(existing.DashboardId) });
    await db.query(`DELETE FROM dbo.AnalyticsDashboards WHERE DashboardId = @dashboardId`, { dashboardId: Number(existing.DashboardId) });
  });

  return { dashboardId: Number(existing.DashboardId), deleted: true };
};

const assertPublishedQueryInCompany = async (queryId, companyId) => {
  const query = await authDbService.queryOne(`
    SELECT QueryId, Status, CompanyId FROM dbo.AnalyticsQueries WHERE QueryId = @queryId
  `, { queryId: toInt(queryId) });

  if (!query || Number(query.CompanyId) !== companyId) {
    throw createHttpError(404, 'Query not found.');
  }
  if (query.Status !== 'Published') {
    throw createHttpError(400, 'Only Published queries can be added to a dashboard widget.');
  }
  return query;
};

const addWidget = async (dashboardId, payload, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const dashboard = await requireOwnedDashboardRow(dashboardId, companyId, userId);

  const queryId = toInt(payload?.queryId);
  const widgetType = normalizeText(payload?.widgetType).toLowerCase();
  const title = normalizeText(payload?.title) || null;
  const fieldMapping = payload?.fieldMapping || {};
  const parameterBindings = payload?.parameterBindings || {};
  const sortOrder = toInt(payload?.sortOrder) || 0;

  if (!queryId || !VALID_WIDGET_TYPES.has(widgetType)) {
    throw createHttpError(400, 'A valid queryId and widgetType are required.');
  }
  await assertPublishedQueryInCompany(queryId, companyId);

  const inserted = await authDbService.query(`
    INSERT INTO dbo.AnalyticsDashboardWidgets (
      DashboardId, QueryId, WidgetType, Title, FieldMappingJson, ParameterBindingsJson, SortOrder, CreatedAt
    )
    OUTPUT INSERTED.WidgetId
    VALUES (
      @dashboardId, @queryId, @widgetType, @title, @fieldMappingJson, @parameterBindingsJson, @sortOrder, SYSUTCDATETIME()
    )
  `, {
    dashboardId: Number(dashboard.DashboardId), queryId, widgetType, title,
    fieldMappingJson: JSON.stringify(fieldMapping),
    parameterBindingsJson: JSON.stringify(parameterBindings),
    sortOrder,
  });

  const widgetId = inserted.recordset?.[0]?.WidgetId;
  if (!widgetId) {
    throw createHttpError(500, 'Failed to add widget.');
  }

  return getDashboardById(dashboard.DashboardId, auth);
};

const updateWidget = async (dashboardId, widgetId, payload, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const dashboard = await requireOwnedDashboardRow(dashboardId, companyId, userId);

  const existingWidget = await authDbService.queryOne(`
    SELECT * FROM dbo.AnalyticsDashboardWidgets WHERE WidgetId = @widgetId AND DashboardId = @dashboardId
  `, { widgetId: toInt(widgetId), dashboardId: Number(dashboard.DashboardId) });

  if (!existingWidget) {
    throw createHttpError(404, 'Widget not found.');
  }

  const widgetType = payload?.widgetType != null ? normalizeText(payload.widgetType).toLowerCase() : existingWidget.WidgetType;
  if (!VALID_WIDGET_TYPES.has(widgetType)) {
    throw createHttpError(400, 'A valid widgetType is required.');
  }

  const title = payload?.title != null ? (normalizeText(payload.title) || null) : existingWidget.Title;
  const fieldMapping = payload?.fieldMapping != null ? payload.fieldMapping : JSON.parse(existingWidget.FieldMappingJson || '{}');
  const parameterBindings = payload?.parameterBindings != null ? payload.parameterBindings : JSON.parse(existingWidget.ParameterBindingsJson || '{}');
  const sortOrder = payload?.sortOrder != null ? (toInt(payload.sortOrder) || 0) : Number(existingWidget.SortOrder || 0);

  await authDbService.query(`
    UPDATE dbo.AnalyticsDashboardWidgets
    SET WidgetType = @widgetType, Title = @title, FieldMappingJson = @fieldMappingJson,
        ParameterBindingsJson = @parameterBindingsJson, SortOrder = @sortOrder, UpdatedAt = SYSUTCDATETIME()
    WHERE WidgetId = @widgetId
  `, {
    widgetId: Number(existingWidget.WidgetId), widgetType, title,
    fieldMappingJson: JSON.stringify(fieldMapping),
    parameterBindingsJson: JSON.stringify(parameterBindings),
    sortOrder,
  });

  return getDashboardById(dashboard.DashboardId, auth);
};

const removeWidget = async (dashboardId, widgetId, auth) => {
  const { userId, companyId } = requireAuth(auth);
  const dashboard = await requireOwnedDashboardRow(dashboardId, companyId, userId);

  await authDbService.query(`
    DELETE FROM dbo.AnalyticsDashboardWidgets WHERE WidgetId = @widgetId AND DashboardId = @dashboardId
  `, { widgetId: toInt(widgetId), dashboardId: Number(dashboard.DashboardId) });

  return getDashboardById(dashboard.DashboardId, auth);
};

const listRolesForCompany = async (auth) => {
  const { companyId } = requireAuth(auth);
  const rows = await authDbService.queryRows(`
    SELECT DISTINCT R.RoleId, R.RoleName
    FROM dbo.Roles R
    INNER JOIN dbo.UserRoles UR ON UR.RoleId = R.RoleId
    WHERE UR.CompanyId = @companyId
    ORDER BY R.RoleName ASC
  `, { companyId });

  return rows.map((row) => ({ roleId: row.RoleId, roleName: row.RoleName }));
};

module.exports = {
  listDashboards,
  getDashboardById,
  createDashboard,
  updateDashboard,
  setDashboardStatus,
  deleteDashboard,
  addWidget,
  updateWidget,
  removeWidget,
  listRolesForCompany,
};
