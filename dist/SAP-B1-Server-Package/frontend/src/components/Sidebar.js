import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { normalizePath } from '../auth/routeUtils';
import { restoreTargetWindowState } from '../utils/copyToState';
import '../styles/sidebar.css';

const DASHBOARD_PATH = '/dashboard';
const STATIC_DASHBOARD_MENU = {
  menuId: 'dashboard-static',
  menuName: 'Dashboard',
  menuPath: DASHBOARD_PATH,
  parentId: null,
  icon: 'dashboard',
  sortOrder: -1,
  children: [],
};
const SIDEBAR_COLLAPSED_KEY = 'sap-b1-sidebar-collapsed';

const TOP_LEVEL_MENU_PRIORITY = new Map([
  ['dashboard', 0],
  ['sales', 1],
  ['sales a r', 1],
  ['services', 2],
  ['purchase', 3],
  ['purchase a p', 3],
  ['purchasing', 3],
  ['purchasing a p', 3],
  ['master', 4],
  ['production', 5],
  ['inventory', 6],
  ['banking', 7],
  ['reports', 8],
  ['report layout manager', 9],
  ['admin panel', 10],
]);

const buildShortLabel = (label, fallback = 'MN') => {
  const words = String(label || '')
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const REPORT_STUDIO_NAME = 'report studio';
const MASTER_MENU_NAME = 'master';
const MASTER_VISIBLE_CHILDREN = new Set(['item master', 'business partner']);
const MASTER_VISIBLE_PATHS = new Set(['/item-master', '/business-partner']);
const SALES_MENU_NAMES = new Set(['sales', 'sales a r']);
const SALES_CHILD_PRIORITY = new Map([
  ['sales quotation', 1],
  ['sales order', 2],
  ['dc sales order', 3],
  ['nc sales order', 4],
  ['delivery', 5],
  ['dc delivery', 6],
  ['nc delivery', 7],
  ['a r invoice', 8],
  ['a r credit memo', 9],
]);
const SALES_CHILD_PATH_PRIORITY = new Map([
  ['/sales-quotation', 1],
  ['/sales-order', 2],
  ['/dc-sales-order', 3],
  ['/nc-sales-order', 4],
  ['/delivery', 5],
  ['/dc-delivery', 6],
  ['/nc-delivery', 7],
  ['/ar-invoice', 8],
  ['/ar-credit-memo', 9],
]);
const isAdminMenuPath = (menuPath = '') => normalizePath(menuPath).startsWith('/admin');
const getDisplayMenuName = (menu) => {
  const normalized = String(menu?.menuName || '').trim().toLowerCase();
  if (normalized === 'sales' && !menu?.parentId) {
    return 'Sales - A/R';
  }

  if (normalized === REPORT_STUDIO_NAME) {
    return 'Report Layout Manager';
  }

  return menu?.menuName;
};

const normalizeMenuPriorityName = (menuName) =>
  String(menuName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const isDashboardMenu = (menu) => {
  const menuPath = menu?.menuPath ? normalizePath(menu.menuPath) : '';
  return menuPath === DASHBOARD_PATH || normalizeMenuPriorityName(menu?.menuName) === 'dashboard';
};

const extractDashboardMenu = (menus = []) => {
  let dashboardMenu = null;

  const stripDashboard = (items) =>
    items.reduce((nextItems, item) => {
      const nextChildren = item.children?.length ? stripDashboard(item.children) : item.children;

      if (isDashboardMenu(item)) {
        if (!dashboardMenu) {
          dashboardMenu = {
            ...item,
            parentId: null,
            menuPath: DASHBOARD_PATH,
            children: [],
          };
        }
        return nextItems;
      }

      nextItems.push(
        nextChildren === item.children
          ? item
          : {
              ...item,
              children: nextChildren,
            },
      );
      return nextItems;
    }, []);

  return {
    dashboardMenu: dashboardMenu || STATIC_DASHBOARD_MENU,
    remainingMenus: stripDashboard(menus),
  };
};

const sortTopLevelMenus = (menus = []) =>
  [...menus].sort((a, b) => {
    const priorityA = TOP_LEVEL_MENU_PRIORITY.get(normalizeMenuPriorityName(a.menuName)) ?? Number.MAX_SAFE_INTEGER;
    const priorityB = TOP_LEVEL_MENU_PRIORITY.get(normalizeMenuPriorityName(b.menuName)) ?? Number.MAX_SAFE_INTEGER;

    if (priorityA !== priorityB) return priorityA - priorityB;
    if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return String(a.menuId).localeCompare(String(b.menuId), undefined, { numeric: true });
  });

const getSalesChildPriority = (menu) => {
  const menuPath = menu?.menuPath ? normalizePath(menu.menuPath) : '';
  return SALES_CHILD_PATH_PRIORITY.get(menuPath)
    ?? SALES_CHILD_PRIORITY.get(normalizeMenuPriorityName(menu?.menuName))
    ?? Number.MAX_SAFE_INTEGER;
};

const sortSalesMenuChildren = (items = [], parentMenu = null) => {
  const isSalesBranch = SALES_MENU_NAMES.has(normalizeMenuPriorityName(parentMenu?.menuName));
  const nextItems = items.map((item) => ({
    ...item,
    children: sortSalesMenuChildren(item.children || [], item),
  }));

  if (!isSalesBranch) {
    return nextItems;
  }

  return nextItems.sort((a, b) => {
    const priorityA = getSalesChildPriority(a);
    const priorityB = getSalesChildPriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;
    if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return String(a.menuId).localeCompare(String(b.menuId), undefined, { numeric: true });
  });
};

const buildSidebarMenus = (menus = []) => {
  const { dashboardMenu, remainingMenus } = extractDashboardMenu(menus);

  const shouldShowMasterChild = (item, menuPath) =>
    MASTER_VISIBLE_CHILDREN.has(normalizeMenuPriorityName(item?.menuName)) ||
    MASTER_VISIBLE_PATHS.has(menuPath);

  const removeHiddenSidebarItems = (items = [], insideMaster = false) =>
    items.reduce((nextItems, item) => {
      const menuPath = item?.menuPath ? normalizePath(item.menuPath) : '';
      const isMasterMenu = normalizeMenuPriorityName(item?.menuName) === MASTER_MENU_NAME;
      const isInsideMaster = insideMaster || isMasterMenu;
      const filteredChildren = removeHiddenSidebarItems(item.children || [], isInsideMaster);

      if (insideMaster && !shouldShowMasterChild(item, menuPath) && !filteredChildren.length) {
        return nextItems;
      }

      if (!menuPath && !filteredChildren.length) {
        return nextItems;
      }

      nextItems.push({
        ...item,
        children: filteredChildren,
      });
      return nextItems;
    }, []);

  const visibleMenus = sortSalesMenuChildren(removeHiddenSidebarItems(remainingMenus));

  return [
    dashboardMenu,
    ...sortTopLevelMenus(visibleMenus),
  ];
};

const hasActiveChild = (menu, pathname) => {
  const menuPath = menu.menuPath ? normalizePath(menu.menuPath) : '';
  if (menuPath && (pathname === menuPath || pathname.startsWith(`${menuPath}/`))) {
    return true;
  }

  return menu.children?.some((child) => hasActiveChild(child, pathname));
};

const SidebarMenuNode = ({ menu, collapsed, openState, setOpenState, pathname, onNavigate, depth = 0 }) => {
  const hasChildren = Boolean(menu.children?.length);
  const menuPath = menu.menuPath ? normalizePath(menu.menuPath) : '';
  const isOpen = openState[menu.menuId] ?? hasActiveChild(menu, pathname);
  const displayMenuName = getDisplayMenuName(menu);
  const shortLabel = buildShortLabel(displayMenuName, buildShortLabel(menu.icon, 'MN'));
  const isNested = depth > 0;

  if (hasChildren) {
    return (
      <div className="sidebar__section">
        <button
          type="button"
          className={`sidebar__section-toggle${isOpen ? ' is-open' : ''}${isNested ? ' sidebar__section-toggle--nested' : ''}`}
          onClick={() => setOpenState((current) => ({ ...current, [menu.menuId]: !isOpen }))}
          title={collapsed ? displayMenuName : undefined}
        >
          <span className="sidebar__section-icon" aria-hidden="true">{shortLabel}</span>
          {!collapsed ? (
            <span className="sidebar__section-title">{displayMenuName}</span>
          ) : null}
          {!collapsed ? (
            <span className={`sidebar__section-caret${isOpen ? ' is-open' : ''}`} aria-hidden="true">
              {'>'}
            </span>
          ) : null}
        </button>

        {isOpen ? (
          <div className={`sidebar__section-body${collapsed ? ' is-collapsed' : ''}`}>
            {menu.children.map((child) => (
              <SidebarMenuNode
                key={child.menuId}
                menu={child}
                collapsed={collapsed}
                openState={openState}
                setOpenState={setOpenState}
                pathname={pathname}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (!menuPath) {
    return null;
  }

  if (isAdminMenuPath(menuPath)) {
    return (
      <a
        href={menuPath}
        target="_blank"
        rel="noreferrer"
        className={`sidebar__link${isNested ? ' sidebar__link--nested' : ''}`}
        title={collapsed ? `${displayMenuName} (opens in new window)` : undefined}
      >
        <span className="sidebar__link-icon">{shortLabel}</span>
        {!collapsed ? <span className="sidebar__link-text">{displayMenuName}</span> : null}
      </a>
    );
  }

  return (
    <NavLink
      to={menuPath}
      end={menuPath === DASHBOARD_PATH}
      onClick={(event) => onNavigate(event, menuPath)}
      className={({ isActive }) =>
        `sidebar__link${isActive ? ' sidebar__link--active' : ''}${isNested ? ' sidebar__link--nested' : ''}`
      }
      title={collapsed ? displayMenuName : undefined}
    >
      <span className="sidebar__link-icon">{shortLabel}</span>
      {!collapsed ? <span className="sidebar__link-text">{displayMenuName}</span> : null}
    </NavLink>
  );
};

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { menus, company } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [openState, setOpenState] = useState({});
  const pathname = normalizePath(location.pathname);

  const sidebarMenus = useMemo(
    () => buildSidebarMenus(menus),
    [menus],
  );

  const handleNavigate = (event, menuPath) => {
    if (!menuPath) return;
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    restoreTargetWindowState(menuPath);
    navigate(menuPath, { state: null });
  };

  const handleToggleCollapsed = () => {
    setCollapsed((current) => {
      const nextCollapsed = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextCollapsed));
      } catch {
        // Ignore storage errors; the visual toggle should still work.
      }
      return nextCollapsed;
    });
  };

  return (
    <aside className={`sidebar-shell${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar">
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <div className="sidebar__brand-mark">SB</div>
            {!collapsed ? (
              <div>
                <div className="sidebar__brand-title">SAP Client</div>
                <div className="sidebar__brand-subtitle">{company?.dbName || 'Business One'}</div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="sidebar__collapse-btn"
            onClick={handleToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span aria-hidden="true">{collapsed ? '>' : '<'}</span>
          </button>
        </div>

        <div className="sidebar__content">
          <nav className="sidebar__nav">
            {sidebarMenus.length ? (
              sidebarMenus.map((menu) => (
                <SidebarMenuNode
                  key={menu.menuId}
                  menu={menu}
                  collapsed={collapsed}
                  openState={openState}
                  setOpenState={setOpenState}
                  pathname={pathname}
                  onNavigate={handleNavigate}
                  depth={0}
                />
              ))
            ) : (
              <div className="sidebar__empty">
                No menus are available for this role.
              </div>
            )}
          </nav>
        </div>
      </div>
    </aside>
  );
}
