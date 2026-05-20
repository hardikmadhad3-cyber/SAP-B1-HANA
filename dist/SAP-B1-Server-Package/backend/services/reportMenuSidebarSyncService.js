const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const REPORT_MENU_PATH_PREFIX = '/reportlayoutmanager/menu/';
const REPORTS_ROOT_CANDIDATE_PATHS = ['/reportlayoutmanager'];
const REPORTS_ROOT_CANDIDATE_NAMES = ['report layout manager', 'reports'];

const toInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const normalizeText = (value) => String(value || '').trim();

const buildReportMenuPath = (reportMenuId) => `${REPORT_MENU_PATH_PREFIX}${reportMenuId}`;

const hasRequiredTables = async (db) => {
  const tables = await db.queryOne(`
    SELECT
      CASE WHEN OBJECT_ID(N'dbo.ReportMenus', N'U') IS NULL THEN 0 ELSE 1 END AS hasReportMenus,
      CASE WHEN OBJECT_ID(N'dbo.Menus', N'U') IS NULL THEN 0 ELSE 1 END AS hasMenus,
      CASE WHEN OBJECT_ID(N'dbo.RoleRights', N'U') IS NULL THEN 0 ELSE 1 END AS hasRoleRights
  `);

  return {
    hasReportMenus: Boolean(tables?.hasReportMenus),
    hasMenus: Boolean(tables?.hasMenus),
    hasRoleRights: Boolean(tables?.hasRoleRights),
  };
};

const getReportMenuRow = async (db, reportMenuId) => {
  const normalizedReportMenuId = toInt(reportMenuId);
  if (!normalizedReportMenuId) {
    return null;
  }

  return db.queryOne(`
    SELECT ReportMenuId, MenuName, ParentId, Icon, SortOrder, CompanyId, CreatedBy
    FROM dbo.ReportMenus
    WHERE ReportMenuId = @reportMenuId
  `, { reportMenuId: normalizedReportMenuId });
};

const getSyncedSidebarMenu = async (db, reportMenuId) => {
  const normalizedReportMenuId = toInt(reportMenuId);
  if (!normalizedReportMenuId) {
    return null;
  }

  return db.queryOne(`
    SELECT MenuId, MenuName, MenuPath, ParentId, Icon, SortOrder, ReportId
    FROM dbo.Menus
    WHERE MenuPath = @menuPath
  `, { menuPath: buildReportMenuPath(normalizedReportMenuId) });
};

const getDefaultReportsParentMenuId = async (db) => {
  const rootMenu = await db.queryOne(`
    SELECT TOP (1) MenuId
    FROM dbo.Menus
    WHERE
      LOWER(LTRIM(RTRIM(COALESCE(MenuPath, '')))) IN (@path1)
      OR LOWER(LTRIM(RTRIM(COALESCE(MenuName, '')))) IN (@name1, @name2)
    ORDER BY
      CASE
        WHEN LOWER(LTRIM(RTRIM(COALESCE(MenuPath, '')))) = @path1 THEN 0
        WHEN LOWER(LTRIM(RTRIM(COALESCE(MenuName, '')))) = @name1 THEN 1
        WHEN LOWER(LTRIM(RTRIM(COALESCE(MenuName, '')))) = @name2 THEN 2
        ELSE 3
      END,
      SortOrder ASC,
      MenuId ASC
  `, {
    path1: REPORTS_ROOT_CANDIDATE_PATHS[0],
    name1: REPORTS_ROOT_CANDIDATE_NAMES[0],
    name2: REPORTS_ROOT_CANDIDATE_NAMES[1],
  });

  return toInt(rootMenu?.MenuId);
};

const resolveSidebarParentMenuId = async (db, parentReportMenuId) => {
  const normalizedParentReportMenuId = toInt(parentReportMenuId);
  if (!normalizedParentReportMenuId) {
    return getDefaultReportsParentMenuId(db);
  }

  let parentSidebarMenu = await getSyncedSidebarMenu(db, normalizedParentReportMenuId);
  if (!parentSidebarMenu) {
    const parentReportMenu = await getReportMenuRow(db, normalizedParentReportMenuId);
    if (!parentReportMenu) {
      throw createHttpError(400, 'The selected parent report menu does not exist.');
    }

    parentSidebarMenu = await syncReportMenuSidebarMenu(db, parentReportMenu);
  }

  return toInt(parentSidebarMenu?.MenuId);
};

async function syncReportMenuSidebarMenu(db, reportMenuInput) {
  const normalizedReportMenuId = toInt(
    reportMenuInput?.ReportMenuId ?? reportMenuInput?.reportMenuId ?? reportMenuInput?.MenuId ?? reportMenuInput?.menuId,
  );

  if (!normalizedReportMenuId) {
    throw createHttpError(400, 'A valid report menu ID is required for sidebar sync.');
  }

  const reportMenu = reportMenuInput?.MenuName
    ? reportMenuInput
    : await getReportMenuRow(db, normalizedReportMenuId);

  if (!reportMenu) {
    throw createHttpError(404, 'Report menu not found for sidebar sync.');
  }

  const menuName = normalizeText(reportMenu.MenuName);
  if (!menuName) {
    throw createHttpError(400, 'Report menu name is required for sidebar sync.');
  }

  const parentId = await resolveSidebarParentMenuId(db, reportMenu.ParentId);
  const menuPath = buildReportMenuPath(normalizedReportMenuId);
  const sortOrder = toInt(reportMenu.SortOrder) ?? 0;
  const existingMenu = await getSyncedSidebarMenu(db, normalizedReportMenuId);
  const nextIcon = normalizeText(reportMenu.Icon) || normalizeText(existingMenu?.Icon) || null;

  if (existingMenu) {
    await db.query(`
      UPDATE dbo.Menus
      SET
        MenuName = @menuName,
        MenuPath = @menuPath,
        ParentId = @parentId,
        Icon = @icon,
        SortOrder = @sortOrder
      WHERE MenuId = @menuId
    `, {
      menuId: existingMenu.MenuId,
      menuName,
      menuPath,
      parentId,
      icon: nextIcon,
      sortOrder,
    });

    return {
      ...existingMenu,
      MenuName: menuName,
      MenuPath: menuPath,
      ParentId: parentId,
      Icon: nextIcon,
      SortOrder: sortOrder,
    };
  }

  const inserted = await db.query(`
    INSERT INTO dbo.Menus (
      MenuName,
      MenuPath,
      ParentId,
      Icon,
      SortOrder,
      ReportId
    )
    OUTPUT INSERTED.MenuId, INSERTED.MenuName, INSERTED.MenuPath, INSERTED.ParentId, INSERTED.Icon, INSERTED.SortOrder, INSERTED.ReportId
    VALUES (
      @menuName,
      @menuPath,
      @parentId,
      @icon,
      @sortOrder,
      NULL
    )
  `, {
    menuName,
    menuPath,
    parentId,
    icon: nextIcon,
    sortOrder,
  });

  return inserted.recordset?.[0] || null;
}

const syncReportMenuSidebarMenuById = async (db, reportMenuId) => {
  const reportMenu = await getReportMenuRow(db, reportMenuId);
  if (!reportMenu) {
    throw createHttpError(404, 'Report menu not found.');
  }

  return syncReportMenuSidebarMenu(db, reportMenu);
};

const syncAllReportMenuSidebarMenus = async (db) => {
  const tableStatus = await hasRequiredTables(db);
  if (!tableStatus.hasReportMenus || !tableStatus.hasMenus) {
    return 0;
  }

  const reportMenus = await db.queryRows(`
    SELECT ReportMenuId, MenuName, ParentId, Icon, SortOrder, CompanyId, CreatedBy
    FROM dbo.ReportMenus
    ORDER BY ReportMenuId ASC
  `);

  const validPaths = new Set(reportMenus.map((reportMenu) => buildReportMenuPath(reportMenu.ReportMenuId)));
  const syncedMenus = await db.queryRows(`
    SELECT MenuId, MenuPath
    FROM dbo.Menus
    WHERE MenuPath LIKE @reportMenuPathPrefix
  `, {
    reportMenuPathPrefix: `${REPORT_MENU_PATH_PREFIX}%`,
  });

  for (const menu of syncedMenus) {
    if (validPaths.has(normalizeText(menu.MenuPath))) {
      continue;
    }

    if (tableStatus.hasRoleRights) {
      await db.query(`
        DELETE FROM dbo.RoleRights
        WHERE MenuId = @menuId
      `, { menuId: menu.MenuId });
    }

    await db.query(`
      DELETE FROM dbo.Menus
      WHERE MenuId = @menuId
    `, { menuId: menu.MenuId });
  }

  for (const reportMenu of reportMenus) {
    await syncReportMenuSidebarMenu(db, reportMenu);
  }

  return reportMenus.length;
};

const deleteReportMenuSidebarMenu = async (db, reportMenuId) => {
  const tableStatus = await hasRequiredTables(db);
  if (!tableStatus.hasMenus) {
    return false;
  }

  const existingMenu = await getSyncedSidebarMenu(db, reportMenuId);
  if (!existingMenu) {
    return false;
  }

  if (tableStatus.hasRoleRights) {
    await db.query(`
      DELETE FROM dbo.RoleRights
      WHERE MenuId = @menuId
    `, { menuId: existingMenu.MenuId });
  }

  await db.query(`
    DELETE FROM dbo.Menus
    WHERE MenuId = @menuId
  `, { menuId: existingMenu.MenuId });

  return true;
};

module.exports = {
  buildReportMenuPath,
  syncReportMenuSidebarMenu,
  syncReportMenuSidebarMenuById,
  syncAllReportMenuSidebarMenus,
  deleteReportMenuSidebarMenu,
};
