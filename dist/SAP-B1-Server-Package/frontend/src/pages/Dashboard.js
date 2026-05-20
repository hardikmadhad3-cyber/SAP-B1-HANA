import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { flattenMenuTree, normalizePath } from "../auth/routeUtils";

const DASHBOARD_LAYOUT_KEY = "sap-b1-dashboard-layout-v1";
const DASHBOARD_EXPANDED_KEY = "sap-b1-dashboard-expanded-v1";

const DEFAULT_WIDGETS = [
  { id: "quick-actions", title: "Quick Actions", size: "wide" },
  { id: "company", title: "Company Snapshot", size: "medium" },
  { id: "user", title: "User Profile", size: "compact" },
  { id: "access", title: "Access & Rights", size: "compact" },
  { id: "modules", title: "Module Map", size: "medium" },
  { id: "tips", title: "How To Use This App", size: "wide" },
];

const readStoredLayout = () => {
  if (typeof window === "undefined") return DEFAULT_WIDGETS.map((widget) => widget.id);

  try {
    const rawValue = window.localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (!rawValue) return DEFAULT_WIDGETS.map((widget) => widget.id);

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return DEFAULT_WIDGETS.map((widget) => widget.id);

    const validIds = DEFAULT_WIDGETS.map((widget) => widget.id);
    const filtered = parsed.filter((id) => validIds.includes(id));
    const missing = validIds.filter((id) => !filtered.includes(id));
    return [...filtered, ...missing];
  } catch (_error) {
    return DEFAULT_WIDGETS.map((widget) => widget.id);
  }
};

const persistLayout = (layout) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(layout));
};

const readExpandedState = () => {
  if (typeof window === "undefined") {
    return Object.fromEntries(DEFAULT_WIDGETS.map((widget) => [widget.id, true]));
  }

  try {
    const rawValue = window.localStorage.getItem(DASHBOARD_EXPANDED_KEY);
    if (!rawValue) {
      return Object.fromEntries(DEFAULT_WIDGETS.map((widget) => [widget.id, true]));
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return Object.fromEntries(DEFAULT_WIDGETS.map((widget) => [widget.id, true]));
    }

    return Object.fromEntries(
      DEFAULT_WIDGETS.map((widget) => [widget.id, parsed[widget.id] !== false]),
    );
  } catch (_error) {
    return Object.fromEntries(DEFAULT_WIDGETS.map((widget) => [widget.id, true]));
  }
};

const persistExpandedState = (state) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DASHBOARD_EXPANDED_KEY, JSON.stringify(state));
};

const moveWidget = (layout, draggedId, targetId) => {
  if (!draggedId || !targetId || draggedId === targetId) return layout;

  const next = [...layout];
  const fromIndex = next.indexOf(draggedId);
  const toIndex = next.indexOf(targetId);

  if (fromIndex === -1 || toIndex === -1) return layout;

  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, draggedId);
  return next;
};

const countVisibleItems = (menu) => {
  const childCount = menu.children?.reduce((sum, child) => sum + countVisibleItems(child), 0) || 0;
  return (menu.menuPath ? 1 : 0) + childCount;
};

const getDisplayMenuName = (menuName) => {
  const normalized = String(menuName || "").trim().toLowerCase();
  if (normalized === "sales") {
    return "Sales - A/R";
  }

  return menuName;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, company, menus, roleName } = useAuth();
  const flatMenus = flattenMenuTree(menus);
  const actionMenus = flatMenus.filter((menu) => menu.menuPath);
  const shortcutMenus = actionMenus.slice(0, 6);
  const moduleSummaries = menus.slice(0, 8).map((menu) => ({
    id: menu.menuId,
    name: getDisplayMenuName(menu.menuName),
    visibleCount: countVisibleItems(menu),
    path: menu.menuPath ? normalizePath(menu.menuPath) : "",
  }));
  const [widgetOrder, setWidgetOrder] = useState(() => readStoredLayout());
  const [expandedWidgets, setExpandedWidgets] = useState(() => readExpandedState());
  const [draggedWidgetId, setDraggedWidgetId] = useState("");
  const [dropTargetId, setDropTargetId] = useState("");

  useEffect(() => {
    persistLayout(widgetOrder);
  }, [widgetOrder]);

  useEffect(() => {
    persistExpandedState(expandedWidgets);
  }, [expandedWidgets]);

  const availableAreas = useMemo(() => {
    if (!moduleSummaries.length) {
      return ["No areas assigned"];
    }

    return moduleSummaries.slice(0, 5).map((module) => module.name);
  }, [moduleSummaries]);

  const workspaceFacts = useMemo(
    () => [
      { label: "Active Role", value: roleName || "Unassigned" },
      { label: "Database", value: company?.dbName || "Not selected" },
      { label: "Server", value: company?.serverName || "Not connected" },
      { label: "Visible Menus", value: String(actionMenus.length) },
    ],
    [actionMenus.length, company?.dbName, company?.serverName, roleName],
  );

  const widgetsById = useMemo(
    () => ({
      "quick-actions": (
        <div className="dashboard-widget__content">
          <div className="dashboard-widget__intro">
            Jump into the most-used screens in one click. These shortcuts follow your assigned role rights.
          </div>
          <div className="dashboard-quick-grid">
            {shortcutMenus.length ? (
              shortcutMenus.map((menu) => (
                <button
                  key={menu.menuId}
                  type="button"
                  className="dashboard-quick-card"
                  onClick={() => navigate(normalizePath(menu.menuPath))}
                >
                  <span className="dashboard-quick-card__name">{getDisplayMenuName(menu.menuName)}</span>
                  <span className="dashboard-quick-card__path">{menu.menuPath}</span>
                </button>
              ))
            ) : (
              <div className="dashboard-empty-state">
                No shortcuts are available yet. Ask an administrator to assign view access.
              </div>
            )}
          </div>
        </div>
      ),
      company: (
        <div className="dashboard-widget__content">
          <div className="dashboard-detail-list">
            <div className="dashboard-detail-row">
              <span>Company</span>
              <strong>{company?.companyName || "No company selected"}</strong>
            </div>
            <div className="dashboard-detail-row">
              <span>Database</span>
              <strong>{company?.dbName || "-"}</strong>
            </div>
            <div className="dashboard-detail-row">
              <span>Server</span>
              <strong>{company?.serverName || "-"}</strong>
            </div>
            <div className="dashboard-detail-row">
              <span>Working Areas</span>
              <strong>{availableAreas.join(", ")}</strong>
            </div>
          </div>
        </div>
      ),
      user: (
        <div className="dashboard-widget__content">
          <div className="dashboard-profile-card">
            <div className="dashboard-profile-card__avatar">
              {(user?.fullName || user?.username || "U").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{user?.fullName || user?.username || "Unknown user"}</strong>
              <div>{user?.email || "No email recorded"}</div>
            </div>
          </div>
        </div>
      ),
      access: (
        <div className="dashboard-widget__content">
          <div className="dashboard-pill-grid">
            {workspaceFacts.map((fact) => (
              <div key={fact.label} className="dashboard-fact-pill">
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ),
      modules: (
        <div className="dashboard-widget__content">
          <div className="dashboard-module-list">
            {moduleSummaries.length ? (
              moduleSummaries.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  className="dashboard-module-row"
                  onClick={() => module.path && navigate(module.path)}
                  disabled={!module.path}
                >
                  <span>{module.name}</span>
                  <strong>{module.visibleCount} screens</strong>
                </button>
              ))
            ) : (
              <div className="dashboard-empty-state">
                No modules are visible for this role.
              </div>
            )}
          </div>
        </div>
      ),
      tips: (
        <div className="dashboard-widget__content">
          <div className="dashboard-tips-grid">
            <article className="dashboard-tip">
              <strong>Use the sidebar for full navigation</strong>
              <span>Menus and submenus are generated from your role rights automatically.</span>
            </article>
            <article className="dashboard-tip">
              <strong>Switch companies from login</strong>
              <span>Your default company loads first, and other assigned companies can be selected from Change Company.</span>
            </article>
            <article className="dashboard-tip">
              <strong>Drag cards to match your workflow</strong>
              <span>Reorder the dashboard widgets and keep the layout that feels best for your daily work.</span>
            </article>
            <article className="dashboard-tip">
              <strong>Everything here reflects app access</strong>
              <span>Shortcuts, modules, and counts only show the areas currently available to your role.</span>
            </article>
          </div>
        </div>
      ),
    }),
    [
      availableAreas,
      company?.companyName,
      company?.dbName,
      company?.serverName,
      moduleSummaries,
      navigate,
      shortcutMenus,
      user?.email,
      user?.fullName,
      user?.username,
      workspaceFacts,
    ],
  );

  const orderedWidgets = widgetOrder
    .map((widgetId) => DEFAULT_WIDGETS.find((widget) => widget.id === widgetId))
    .filter(Boolean);

  const handleDragStart = (event, widgetId) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", widgetId);
    setDraggedWidgetId(widgetId);
    setDropTargetId(widgetId);
  };

  const handleDragOver = (event, widgetId) => {
    event.preventDefault();
    if (draggedWidgetId && draggedWidgetId !== widgetId) {
      setDropTargetId(widgetId);
    }
  };

  const handleDrop = (event, widgetId) => {
    event.preventDefault();
    setWidgetOrder((current) => moveWidget(current, draggedWidgetId, widgetId));
    setDraggedWidgetId("");
    setDropTargetId("");
  };

  const handleDragEnd = () => {
    setDraggedWidgetId("");
    setDropTargetId("");
  };

  const toggleWidget = (widgetId) => {
    setExpandedWidgets((current) => ({
      ...current,
      [widgetId]: !current[widgetId],
    }));
  };

  return (
    <div className="dashboard-page">
      <section className="dashboard-banner">
        <div className="dashboard-banner__copy">
          <div className="dashboard-banner__eyebrow">Workspace Dashboard</div>
          <h2>{company?.companyName || "SAP Business One Web Client"}</h2>
          <p>
            A bright, centralized overview of your Business One workspace with draggable cards,
            role-based shortcuts, and the key information you need to navigate this app quickly.
          </p>
        </div>

        <div className="dashboard-banner__stats">
          {workspaceFacts.map((fact) => (
            <div key={fact.label} className="dashboard-banner__stat">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-board">
        {orderedWidgets.map((widget) => (
          <article
            key={widget.id}
            className={`dashboard-widget dashboard-widget--${widget.size}${dropTargetId === widget.id ? " is-drop-target" : ""}${expandedWidgets[widget.id] ? "" : " is-collapsed"}`}
            draggable
            onDragStart={(event) => handleDragStart(event, widget.id)}
            onDragOver={(event) => handleDragOver(event, widget.id)}
            onDrop={(event) => handleDrop(event, widget.id)}
            onDragEnd={handleDragEnd}
          >
            <div className="dashboard-widget__header">
              <div>
                <h3>{widget.title}</h3>
              </div>
              <div className="dashboard-widget__controls">
                <button
                  type="button"
                  className="dashboard-widget__drag"
                  onClick={() => toggleWidget(widget.id)}
                  aria-label={expandedWidgets[widget.id] ? `Collapse ${widget.title}` : `Expand ${widget.title}`}
                  title={expandedWidgets[widget.id] ? "Collapse card" : "Expand card"}
                  draggable={false}
                >
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </button>
              </div>
            </div>
            {expandedWidgets[widget.id] ? widgetsById[widget.id] : null}
          </article>
        ))}
      </section>
    </div>
  );
};

export default Dashboard;
