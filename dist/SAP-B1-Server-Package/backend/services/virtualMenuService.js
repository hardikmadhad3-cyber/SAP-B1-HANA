const DEFAULT_RIGHTS = {
  canView: true,
  canAdd: false,
  canEdit: false,
  canDelete: false,
};

const cloneMenuNode = (node) => ({
  ...node,
  rights: { ...(node.rights || DEFAULT_RIGHTS) },
  children: Array.isArray(node.children) ? node.children.map(cloneMenuNode) : [],
});

const normalizeMenuName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const findMatchingChild = (items, template) =>
  items.find((item) => {
    if (template.menuPath) {
      return String(item.menuPath || '').trim().toLowerCase() === String(template.menuPath).trim().toLowerCase();
    }

    return normalizeMenuName(item.menuName) === normalizeMenuName(template.menuName);
  });

const mergeMenuNode = (existingNode, templateNode) => {
  if (!existingNode.menuPath && templateNode.menuPath) {
    existingNode.menuPath = templateNode.menuPath;
  }

  if (!existingNode.icon && templateNode.icon) {
    existingNode.icon = templateNode.icon;
  }

  if (existingNode.sortOrder === undefined || existingNode.sortOrder === null) {
    existingNode.sortOrder = templateNode.sortOrder ?? 0;
  }

  if (!existingNode.rights) {
    existingNode.rights = { ...(templateNode.rights || DEFAULT_RIGHTS) };
  }

  if (!Array.isArray(existingNode.children)) {
    existingNode.children = [];
  }

  for (const childTemplate of templateNode.children || []) {
    upsertMenuNode(existingNode.children, childTemplate, existingNode.menuId);
  }
};

const upsertMenuNode = (items, templateNode, parentId = null) => {
  const existingNode = findMatchingChild(items, templateNode);
  if (existingNode) {
    mergeMenuNode(existingNode, templateNode);
    return existingNode;
  }

  const newNode = cloneMenuNode({
    ...templateNode,
    parentId,
  });
  items.push(newNode);
  return newNode;
};

const appendVirtualMenus = (menuPayload = {}) => {
  const menus = Array.isArray(menuPayload.menus) ? [...menuPayload.menus] : [];
  const menuPaths = Array.isArray(menuPayload.menuPaths) ? [...menuPayload.menuPaths] : [];

  if (menuPayload.includeAdminPanel) {
    upsertMenuNode(menus, {
      menuId: 'virtual-admin-panel',
      menuName: 'Admin Panel',
      menuPath: '/admin',
      icon: 'AP',
      sortOrder: 80,
      rights: {
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
      },
      children: [
        { menuId: 'virtual-admin-overview', menuName: 'Overview', menuPath: '/admin', sortOrder: 0 },
        { menuId: 'virtual-admin-companies', menuName: 'Companies', menuPath: '/admin/companies', sortOrder: 1 },
        { menuId: 'virtual-admin-users', menuName: 'Users', menuPath: '/admin/users', sortOrder: 2 },
        { menuId: 'virtual-admin-roles', menuName: 'Roles', menuPath: '/admin/roles', sortOrder: 3 },
        { menuId: 'virtual-admin-user-companies', menuName: 'User Companies', menuPath: '/admin/user-companies', sortOrder: 4 },
        { menuId: 'virtual-admin-user-roles', menuName: 'User Roles', menuPath: '/admin/user-roles', sortOrder: 5 },
        { menuId: 'virtual-admin-menus', menuName: 'Menus', menuPath: '/admin/menus', sortOrder: 6 },
        { menuId: 'virtual-admin-report-menus', menuName: 'Report Menus', menuPath: '/admin/report-menus', sortOrder: 7 },
        { menuId: 'virtual-admin-role-rights', menuName: 'Role Rights', menuPath: '/admin/role-rights', sortOrder: 8 },
      ],
    });

    const adminPaths = [
      '/admin',
      '/admin/companies',
      '/admin/users',
      '/admin/roles',
      '/admin/user-companies',
      '/admin/user-roles',
      '/admin/menus',
      '/admin/report-menus',
      '/admin/role-rights',
    ];

    for (const path of adminPaths) {
      if (!menuPaths.includes(path)) {
        menuPaths.push(path);
      }
    }
  }

  return {
    menus,
    menuPaths,
  };
};

module.exports = {
  appendVirtualMenus,
};
