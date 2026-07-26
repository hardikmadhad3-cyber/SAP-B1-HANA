/**
 * Mirrors each Published AnalyticsDashboards row into the shared dbo.Menus
 * table under the static "Analytics Report" parent (see
 * applicationMenuSyncService.APP_MENU_DEFINITIONS), and reconciles
 * dbo.RoleRights against the dashboard's own VisibleRoleIdsJson so role
 * visibility is enforced through the same table every other menu uses.
 * Structural port of reportMenuSidebarSyncService.js.
 */
const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const authDbService = require('./authDbService');

const ANALYTICS_MENU_PATH_PREFIX = '/analytics/dashboard/';
const ANALYTICS_REPORT_PARENT_NAME = 'analytics report';

const toInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const normalizeText = (value) => String(value || '').trim();

const buildAnalyticsMenuPath = (dashboardCode) => `${ANALYTICS_MENU_PATH_PREFIX}${dashboardCode}`;

const hasRequiredTables = async () => ({
  hasMenus: await authDbService.tableExists('Menus'),
  hasRoleRights: await authDbService.tableExists('RoleRights'),
});

const getDashboardRow = async (db, dashboardId) => {
  const normalizedId = toInt(dashboardId);
  if (!normalizedId) return null;

  return db.queryOne(`
    SELECT * FROM dbo.AnalyticsDashboards WHERE DashboardId = @dashboardId
  `, { dashboardId: normalizedId });
};

const getSyncedSidebarMenu = async (db, dashboardCode) =>
  db.queryOne(`
    SELECT MenuId, MenuName, MenuPath, ParentId, Icon, SortOrder
    FROM dbo.Menus
    WHERE MenuPath = @menuPath
  `, { menuPath: buildAnalyticsMenuPath(dashboardCode) });

const getAnalyticsReportParentMenuId = async (db) => {
  const parent = await db.queryOne(`
    SELECT MenuId FROM dbo.Menus WHERE LOWER(LTRIM(RTRIM(COALESCE(MenuName, '')))) = @name
  `, { name: ANALYTICS_REPORT_PARENT_NAME });

  return toInt(parent?.MenuId);
};

const reconcileRoleRights = async (db, menuId, visibleRoleIds) => {
  const { hasRoleRights } = await hasRequiredTables();
  if (!hasRoleRights) return;

  const normalizedRoleIds = Array.isArray(visibleRoleIds)
    ? [...new Set(visibleRoleIds.map((id) => toInt(id)).filter((id) => Number.isInteger(id)))]
    : [];

  const existingRights = await db.queryRows(`
    SELECT RoleId FROM dbo.RoleRights WHERE MenuId = @menuId
  `, { menuId });
  const existingRoleIds = new Set(existingRights.map((row) => Number(row.RoleId)));

  for (const roleId of existingRoleIds) {
    if (!normalizedRoleIds.includes(roleId)) {
      await db.query(`
        DELETE FROM dbo.RoleRights WHERE MenuId = @menuId AND RoleId = @roleId
      `, { menuId, roleId });
    }
  }

  for (const roleId of normalizedRoleIds) {
    if (existingRoleIds.has(roleId)) continue;
    await db.query(`
      INSERT INTO dbo.RoleRights (RoleId, MenuId, CanView, CanAdd, CanEdit, CanDelete)
      VALUES (@roleId, @menuId, 1, 0, 0, 0)
    `, { roleId, menuId });
  }
};

async function syncAnalyticsDashboardMenu(db, dashboardRow) {
  const dashboardId = toInt(dashboardRow?.DashboardId);
  if (!dashboardId) {
    throw createHttpError(400, 'A valid dashboard ID is required for sidebar sync.');
  }

  const dashboardCode = normalizeText(dashboardRow.DashboardCode);
  const dashboardName = normalizeText(dashboardRow.DashboardName);
  if (!dashboardCode || !dashboardName) {
    throw createHttpError(400, 'DashboardCode and DashboardName are required for sidebar sync.');
  }

  const parentId = await getAnalyticsReportParentMenuId(db);
  if (!parentId) {
    throw createHttpError(500, 'The "Analytics Report" parent menu is missing. Run the application menu sync first.');
  }

  const menuPath = buildAnalyticsMenuPath(dashboardCode);
  const sortOrder = toInt(dashboardRow.SortOrder) ?? 0;
  const existingMenu = await getSyncedSidebarMenu(db, dashboardCode);

  let menu;
  if (existingMenu) {
    await db.query(`
      UPDATE dbo.Menus
      SET MenuName = @menuName, ParentId = @parentId, SortOrder = @sortOrder
      WHERE MenuId = @menuId
    `, { menuId: existingMenu.MenuId, menuName: dashboardName, parentId, sortOrder });

    menu = { ...existingMenu, MenuName: dashboardName, ParentId: parentId, SortOrder: sortOrder };
  } else {
    const inserted = await db.query(`
      INSERT INTO dbo.Menus (MenuName, MenuPath, ParentId, Icon, SortOrder)
      OUTPUT INSERTED.MenuId, INSERTED.MenuName, INSERTED.MenuPath, INSERTED.ParentId, INSERTED.Icon, INSERTED.SortOrder
      VALUES (@menuName, @menuPath, @parentId, 'analytics', @sortOrder)
    `, { menuName: dashboardName, menuPath, parentId, sortOrder });

    menu = inserted.recordset?.[0] || null;
  }

  if (menu?.MenuId) {
    const visibleRoleIds = JSON.parse(dashboardRow.VisibleRoleIdsJson || '[]');
    await reconcileRoleRights(db, menu.MenuId, visibleRoleIds);
  }

  return menu;
}

const syncAnalyticsDashboardMenuById = async (db, dashboardId) => {
  const dashboardRow = await getDashboardRow(db, dashboardId);
  if (!dashboardRow) {
    throw createHttpError(404, 'Dashboard not found.');
  }

  if (dashboardRow.Status !== 'Published') {
    return deleteAnalyticsDashboardMenu(db, dashboardId);
  }

  return syncAnalyticsDashboardMenu(db, dashboardRow);
};

const deleteAnalyticsDashboardMenu = async (db, dashboardId) => {
  const dashboardRow = await getDashboardRow(db, dashboardId);
  if (!dashboardRow) return false;

  const existingMenu = await getSyncedSidebarMenu(db, dashboardRow.DashboardCode);
  if (!existingMenu) return false;

  const { hasRoleRights } = await hasRequiredTables();
  if (hasRoleRights) {
    await db.query(`DELETE FROM dbo.RoleRights WHERE MenuId = @menuId`, { menuId: existingMenu.MenuId });
  }

  await db.query(`DELETE FROM dbo.Menus WHERE MenuId = @menuId`, { menuId: existingMenu.MenuId });
  return true;
};

const syncAllAnalyticsDashboardMenus = async (db) => {
  const dashboards = await db.queryRows(`
    SELECT * FROM dbo.AnalyticsDashboards ORDER BY DashboardId ASC
  `);

  let syncCount = 0;
  for (const dashboardRow of dashboards) {
    if (dashboardRow.Status === 'Published') {
      await syncAnalyticsDashboardMenu(db, dashboardRow);
    } else {
      await deleteAnalyticsDashboardMenu(db, dashboardRow.DashboardId);
    }
    syncCount += 1;
  }

  return syncCount;
};

module.exports = {
  buildAnalyticsMenuPath,
  syncAnalyticsDashboardMenu,
  syncAnalyticsDashboardMenuById,
  syncAllAnalyticsDashboardMenus,
  deleteAnalyticsDashboardMenu,
};
