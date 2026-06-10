import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { flattenMenuTree, normalizePath } from "../auth/routeUtils";
import useFloatingWindow from "./reports/useFloatingWindow";
import { useSapWindowTaskbarActions } from "./SapWindowTaskbarContext";

const DASHBOARD_PATH = "/dashboard";
const WINDOW_FRAME_EXCLUDED_PATHS = new Set([
  "/dashboard",
  "/reports/sales/analysis",
  "/reports/item-list",
  "/reports/inventory/posting-list",
  "/reports/inventory/in-warehouse",
  "/reports/purchasing/analysis",
  "/reports/purchase-analysis",
  "/reports/purchase/analysis",
  "/reports/purchasing/purchase-request-report",
]);

const normalizeMenuName = (menuName = "") =>
  String(menuName || "")
    .trim()
    .toLowerCase();

const getDisplayMenuName = (menuName = "") => {
  const normalized = normalizeMenuName(menuName);
  if (normalized === "report studio") {
    return "Report Layout Manager";
  }

  if (normalized === "sales") {
    return "Sales - A/R";
  }

  if (normalized === "purchase") {
    return "Purchase - A/P";
  }

  return menuName;
};

const prettifyPathTitle = (pathname = "") => {
  const cleaned = String(pathname || "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .filter((segment) => !/^\d+$/.test(segment));

  if (!cleaned.length) {
    return "Workspace";
  }

  return cleaned
    .map((segment) =>
      segment
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
    )
    .join(" / ");
};

function PageWindowFrame({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { menus } = useAuth();
  const { closeActiveAndRestorePrevious, minimizeCurrentRouteTask } = useSapWindowTaskbarActions();
  const normalizedPath = normalizePath(location.pathname);
  const isExcludedPath = WINDOW_FRAME_EXCLUDED_PATHS.has(normalizedPath);
  const routedWindow = location.state?.sapWindow || null;

  const flattenedMenus = useMemo(
    () => flattenMenuTree(menus).filter((menu) => menu?.menuPath),
    [menus],
  );

  const currentMenu = useMemo(() => {
    const exactMatch = flattenedMenus.find(
      (menu) => normalizePath(menu.menuPath) === normalizedPath,
    );
    if (exactMatch) {
      return exactMatch;
    }

    return flattenedMenus
      .filter((menu) => normalizedPath.startsWith(`${normalizePath(menu.menuPath)}/`))
      .sort((left, right) => normalizePath(right.menuPath).length - normalizePath(left.menuPath).length)[0] || null;
  }, [flattenedMenus, normalizedPath]);

  const pageTitle = routedWindow?.title || (currentMenu?.menuName
    ? getDisplayMenuName(currentMenu.menuName)
    : prettifyPathTitle(normalizedPath));

  const getFallbackPath = () => DASHBOARD_PATH;

  const windowFrame = useFloatingWindow({
    isOpen: !isExcludedPath,
    allowPersistedMinimized: false,
    defaultTop: 10,
    resetOnClose: false,
    taskId: routedWindow?.id || `page-window:${normalizedPath}`,
    taskPath: routedWindow?.path || normalizedPath,
    taskState: location.state || undefined,
    taskTitle: pageTitle,
  });

  useEffect(() => {
    if (isExcludedPath || typeof document === "undefined") {
      return undefined;
    }

    document.body.classList.toggle(
      "sap-route-window-maximized",
      windowFrame.isMaximized && !windowFrame.isMinimized,
    );
    return () => {
      document.body.classList.remove("sap-route-window-maximized");
    };
  }, [isExcludedPath, windowFrame.isMaximized, windowFrame.isMinimized]);

  if (isExcludedPath) {
    return children;
  }

  const handleMinimize = () => {
    minimizeCurrentRouteTask();
    navigate(DASHBOARD_PATH, { state: null });
  };

  const handleClose = () => {
    if (closeActiveAndRestorePrevious()) {
      return;
    }

    const nextPath = getFallbackPath();
    if (nextPath && nextPath !== normalizedPath) {
      navigate(nextPath);
    }
  };

  if (windowFrame.isMinimized) {
    return (
      <section
        className="page-window-frame is-minimized"
        aria-hidden="true"
        {...windowFrame.windowProps}
        style={{
          ...(windowFrame.windowProps?.style || {}),
          display: "none",
        }}
      >
        <div className="page-window-frame__body">
          {children}
        </div>
      </section>
    );
  }

  const routeWindowProps = windowFrame.isMaximized
    ? windowFrame.windowProps
    : {
        ...windowFrame.windowProps,
        style: undefined,
      };

  return (
    <section
      className={`page-window-frame${windowFrame.isMaximized ? " is-maximized" : ""}`}
      {...routeWindowProps}
    >
      <header
        className="page-window-frame__titlebar"
        aria-label={`${pageTitle} window controls`}
        {...(windowFrame.isMaximized ? windowFrame.titleBarProps : {})}
      >
        <div className="page-window-frame__controls">
          <button
            type="button"
            aria-label={windowFrame.isMinimized ? "Restore" : "Minimize"}
            title={windowFrame.isMinimized ? "Restore" : "Minimize"}
            onClick={handleMinimize}
          >
            {windowFrame.isMinimized ? "□" : "-"}
          </button>
          <button
            type="button"
            aria-label={windowFrame.isMaximized ? "Restore" : "Maximize"}
            title={windowFrame.isMaximized ? "Restore" : "Maximize"}
            onClick={windowFrame.toggleMaximize}
          >
            {windowFrame.isMaximized ? "Restore" : "Maximize"}
          </button>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={handleClose}
          >
            x
          </button>
        </div>
      </header>

      <div className="page-window-frame__body">
        {children}
      </div>
    </section>
  );
}

export default PageWindowFrame;
