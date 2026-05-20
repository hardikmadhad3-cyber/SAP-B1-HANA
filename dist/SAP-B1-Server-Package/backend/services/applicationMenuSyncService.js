const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const APP_MENU_DEFINITIONS = [
  { key: 'dashboard', menuName: 'Dashboard', menuPath: '/dashboard', icon: 'dashboard', sortOrder: -1 },
  { key: 'sales', menuName: 'Sales', aliases: ['Sales - A/R', 'Sales A/R'], icon: 'sales', sortOrder: 1 },
  { key: 'sales-order', parentKey: 'sales', menuName: 'Sales Order', menuPath: '/sales-order', icon: 'document', sortOrder: 1 },
  { key: 'sales-quotation', parentKey: 'sales', menuName: 'Sales Quotation', menuPath: '/sales-quotation', icon: 'document', sortOrder: 2 },
  { key: 'delivery', parentKey: 'sales', menuName: 'Delivery', menuPath: '/delivery', icon: 'delivery', sortOrder: 3 },
  { key: 'ar-invoice', parentKey: 'sales', menuName: 'A/R Invoice', menuPath: '/ar-invoice', icon: 'invoice', sortOrder: 4 },
  { key: 'ar-credit-memo', parentKey: 'sales', menuName: 'A/R Credit Memo', menuPath: '/ar-credit-memo', icon: 'invoice', sortOrder: 5 },

  { key: 'purchase', menuName: 'Purchase', aliases: ['Purchase - A/P', 'Purchase A/P', 'Purchasing', 'Purchasing - A/P', 'Purchasing A/P'], icon: 'purchase', sortOrder: 2 },
  { key: 'purchase-request', parentKey: 'purchase', menuName: 'Purchase Request', menuPath: '/purchase-request', icon: 'document', sortOrder: 1 },
  { key: 'purchase-quotation', parentKey: 'purchase', menuName: 'Purchase Quotation', menuPath: '/purchase-quotation', icon: 'document', sortOrder: 2 },
  { key: 'purchase-order', parentKey: 'purchase', menuName: 'Purchase Order', menuPath: '/purchase-order', icon: 'document', sortOrder: 3 },
  { key: 'grpo', parentKey: 'purchase', menuName: 'Goods Receipt PO', menuPath: '/grpo', icon: 'receipt', sortOrder: 4 },
  { key: 'ap-invoice', parentKey: 'purchase', menuName: 'A/P Invoice', menuPath: '/ap-invoice', icon: 'invoice', sortOrder: 5 },
  { key: 'ap-credit-memo', parentKey: 'purchase', menuName: 'A/P Credit Memo', menuPath: '/ap-credit-memo', icon: 'invoice', sortOrder: 6 },

  { key: 'master', menuName: 'Master', icon: 'master', sortOrder: 3 },
  { key: 'item-master', parentKey: 'master', menuName: 'Item Master', menuPath: '/item-master', icon: 'item', sortOrder: 1 },
  { key: 'business-partner', parentKey: 'master', menuName: 'Business Partner', menuPath: '/business-partner', icon: 'partner', sortOrder: 2 },
  { key: 'warehouse', parentKey: 'master', menuName: 'Warehouse', menuPath: '/warehouse', icon: 'warehouse', sortOrder: 3 },
  { key: 'price-list', parentKey: 'master', menuName: 'Price List', menuPath: '/price-list', icon: 'price', sortOrder: 4 },
  { key: 'tax-code', parentKey: 'master', menuName: 'Tax Code', menuPath: '/tax-code', icon: 'tax', sortOrder: 5 },
  { key: 'uom-group', parentKey: 'master', menuName: 'UoM Group', menuPath: '/uom-group', icon: 'uom', sortOrder: 6 },
  { key: 'payment-terms', parentKey: 'master', menuName: 'Payment Terms', menuPath: '/payment-terms', icon: 'terms', sortOrder: 7 },
  { key: 'shipping-type', parentKey: 'master', menuName: 'Shipping Type', menuPath: '/shipping-type', icon: 'shipping', sortOrder: 8 },
  { key: 'branch', parentKey: 'master', menuName: 'Branch', menuPath: '/branch', icon: 'branch', sortOrder: 9 },
  { key: 'chart-of-accounts', parentKey: 'master', menuName: 'Chart Of Accounts', menuPath: '/chart-of-accounts', icon: 'accounts', sortOrder: 10 },

  { key: 'production', menuName: 'Production', icon: 'production', sortOrder: 4 },
  { key: 'bom', parentKey: 'production', menuName: 'Bill of Materials', menuPath: '/bom', icon: 'bom', sortOrder: 1 },
  { key: 'production-order', parentKey: 'production', menuName: 'Production Order', menuPath: '/production-order', icon: 'production', sortOrder: 2 },
  { key: 'issue-for-production', parentKey: 'production', menuName: 'Issue For Production', menuPath: '/issue-for-production', icon: 'issue', sortOrder: 3 },
  { key: 'receipt-from-production', parentKey: 'production', menuName: 'Receipt From Production', menuPath: '/receipt-from-production', icon: 'receipt', sortOrder: 4 },

  { key: 'inventory', menuName: 'Inventory', icon: 'inventory', sortOrder: 5 },
  { key: 'goods-receipt', parentKey: 'inventory', menuName: 'Goods Receipt', menuPath: '/goods-receipt', icon: 'receipt', sortOrder: 1 },
  { key: 'goods-issue', parentKey: 'inventory', menuName: 'Goods Issue', menuPath: '/goods-issue', icon: 'issue', sortOrder: 2 },
  { key: 'inventory-transfer-request', parentKey: 'inventory', menuName: 'Inventory Transfer Request', menuPath: '/inventory-transfer-request', icon: 'transfer', sortOrder: 3 },
  { key: 'inventory-transfer', parentKey: 'inventory', menuName: 'Inventory Transfer', menuPath: '/inventory-transfer', icon: 'transfer', sortOrder: 4 },

  { key: 'banking', menuName: 'Banking', icon: 'banking', sortOrder: 6 },
  {
    key: 'incoming-payments',
    parentKey: 'banking',
    menuName: 'Incoming Payments',
    aliases: ['Incoming Payment'],
    menuPath: '/incoming-payments',
    legacyPaths: ['/incoming-payment', '/banking/incoming-payment', '/banking/incoming-payments'],
    icon: 'payments',
    sortOrder: 1,
  },
  {
    key: 'outgoing-payments',
    parentKey: 'banking',
    menuName: 'Outgoing Payments',
    aliases: ['Outgoing Payment'],
    menuPath: '/outgoing-payments',
    legacyPaths: ['/outgoing-payment', '/banking/outgoing-payment', '/banking/outgoing-payments'],
    icon: 'payments',
    sortOrder: 2,
  },

  { key: 'reports', menuName: 'Reports', icon: 'reports', sortOrder: 7 },
  { key: 'sales-analysis', parentKey: 'reports', menuName: 'Sales Analysis', menuPath: '/reports/sales/analysis', icon: 'report', sortOrder: 1 },
  { key: 'purchase-analysis', parentKey: 'reports', menuName: 'Purchase Analysis', menuPath: '/reports/purchasing/analysis', icon: 'report', sortOrder: 2 },
  { key: 'purchase-request-report', parentKey: 'reports', menuName: 'Purchase Request Report', menuPath: '/reports/purchasing/purchase-request-report', icon: 'report', sortOrder: 3 },
  { key: 'report-layout-manager', menuName: 'Report Layout Manager', aliases: ['Report Studio'], menuPath: '/reportlayoutmanager', icon: 'reports', sortOrder: 8 },
];

const normalizeText = (value) => String(value || '').trim();
const normalizePath = (value) => normalizeText(value).toLowerCase().replace(/\/+$/g, '');
const normalizeName = (value) => normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Add new code-owned sidebar pages here. They will appear in Admin > Menus automatically,
// but they will not show in the app sidebar until Role Rights grants CanView.
const hasMenusTable = async (db) => {
  const row = await db.queryOne(`
    SELECT CASE WHEN OBJECT_ID(N'dbo.Menus', N'U') IS NULL THEN 0 ELSE 1 END AS hasMenus
  `);

  return Boolean(row?.hasMenus);
};

const getExistingMenus = async (db) => db.queryRows(`
  SELECT MenuId, MenuName, MenuPath, ParentId, Icon, SortOrder
  FROM dbo.Menus
  ORDER BY MenuId ASC
`);

const findExistingMenu = (menus, definition) => {
  const menuPaths = new Set([definition.menuPath, ...(definition.legacyPaths || [])].map(normalizePath).filter(Boolean));
  if (menuPaths.size) {
    return menus.find((menu) => menuPaths.has(normalizePath(menu.MenuPath))) || null;
  }

  const menuNames = new Set([definition.menuName, ...(definition.aliases || [])].map(normalizeName));
  return menus.find((menu) => menuNames.has(normalizeName(menu.MenuName))) || null;
};

const insertMenu = async (db, definition, parentId) => {
  const inserted = await db.query(`
    INSERT INTO dbo.Menus (
      MenuName,
      MenuPath,
      ParentId,
      Icon,
      SortOrder
    )
    OUTPUT INSERTED.MenuId, INSERTED.MenuName, INSERTED.MenuPath, INSERTED.ParentId, INSERTED.Icon, INSERTED.SortOrder
    VALUES (
      @menuName,
      @menuPath,
      @parentId,
      @icon,
      @sortOrder
    )
  `, {
    menuName: normalizeText(definition.menuName),
    menuPath: normalizeText(definition.menuPath) || null,
    parentId,
    icon: normalizeText(definition.icon) || null,
    sortOrder: Number.isFinite(Number(definition.sortOrder)) ? Number(definition.sortOrder) : 0,
  });

  return inserted.recordset?.[0] || null;
};

const updateMenuMetadata = async (db, menu, definition, parentId, shouldUseCanonicalPath) => {
  const nextMenuName = normalizeText(menu.MenuName) || normalizeText(definition.menuName);
  const nextMenuPath = shouldUseCanonicalPath
    ? (normalizeText(definition.menuPath) || null)
    : (normalizeText(menu.MenuPath) || normalizeText(definition.menuPath) || null);
  const nextIcon = normalizeText(menu.Icon) || normalizeText(definition.icon) || null;
  const nextSortOrder = Number.isFinite(Number(menu.SortOrder))
    ? Number(menu.SortOrder)
    : (Number.isFinite(Number(definition.sortOrder)) ? Number(definition.sortOrder) : 0);
  const nextParentId = parentId ?? null;

  if (
    normalizeText(menu.MenuName) === nextMenuName
    && normalizeText(menu.MenuPath || '') === normalizeText(nextMenuPath || '')
    && normalizeText(menu.Icon || '') === normalizeText(nextIcon || '')
    && Number(menu.SortOrder ?? 0) === nextSortOrder
    && (menu.ParentId ?? null) === nextParentId
  ) {
    return menu;
  }

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
    menuId: menu.MenuId,
    menuName: nextMenuName,
    menuPath: nextMenuPath,
    parentId: nextParentId,
    icon: nextIcon,
    sortOrder: nextSortOrder,
  });

  return {
    ...menu,
    MenuName: nextMenuName,
    MenuPath: nextMenuPath,
    ParentId: nextParentId,
    Icon: nextIcon,
    SortOrder: nextSortOrder,
  };
};

const syncApplicationSidebarMenus = async (db) => {
  if (!(await hasMenusTable(db))) {
    return 0;
  }

  const existingMenus = await getExistingMenus(db);
  const menuByKey = new Map();
  let syncCount = 0;

  for (const definition of APP_MENU_DEFINITIONS) {
    const parentId = definition.parentKey ? menuByKey.get(definition.parentKey)?.MenuId : null;
    if (definition.parentKey && !parentId) {
      throw createHttpError(500, `Missing parent menu definition for ${definition.key}.`);
    }

    const existingMenu = findExistingMenu(existingMenus, definition);
    const shouldUseCanonicalPath = Boolean(
      existingMenu
      && definition.menuPath
      && normalizePath(existingMenu.MenuPath) !== normalizePath(definition.menuPath),
    );
    const syncedMenu = existingMenu
      ? await updateMenuMetadata(db, existingMenu, definition, parentId, shouldUseCanonicalPath)
      : await insertMenu(db, definition, parentId);

    if (!existingMenu) {
      existingMenus.push(syncedMenu);
    }

    menuByKey.set(definition.key, syncedMenu);
    syncCount += 1;
  }

  return syncCount;
};

module.exports = {
  APP_MENU_DEFINITIONS,
  syncApplicationSidebarMenus,
};
