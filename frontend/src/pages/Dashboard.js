import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { flattenMenuTree, normalizePath } from "../auth/routeUtils";

const DASHBOARD_LAYOUT_KEY = "sap-b1-dashboard-layout-v2";
const DASHBOARD_EXPANDED_KEY = "sap-b1-dashboard-expanded-v2";

const DEFAULT_WIDGETS = [
  { id: "quick-actions", title: "Quick Actions", size: "wide" },
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

const getDisplayMenuName = (menuName) => {
  const normalized = String(menuName || "").trim().toLowerCase();
  if (normalized === "sales") {
    return "Sales - A/R";
  }

  return menuName;
};

const prioritizeMenus = (items = [], preferredNames = []) => {
  const preferred = preferredNames.map((name) => String(name || "").trim().toLowerCase());
  return [...items].sort((left, right) => {
    const leftIndex = preferred.indexOf(String(left.menuName || "").trim().toLowerCase());
    const rightIndex = preferred.indexOf(String(right.menuName || "").trim().toLowerCase());
    const leftPriority = leftIndex === -1 ? 999 : leftIndex;
    const rightPriority = rightIndex === -1 ? 999 : rightIndex;

    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
  });
};

const ActionGrid = ({ items, emptyText, navigate }) => (
  <div className="dashboard-quick-grid">
    {items.length ? (
      items.map((menu) => (
        <button
          key={menu.menuId}
          type="button"
          className="dashboard-quick-card"
          onClick={() => navigate(normalizePath(menu.menuPath))}
        >
          <span className="dashboard-quick-card__name">{menu.menuName}</span>
        </button>
      ))
    ) : (
      <div className="dashboard-empty-state">{emptyText}</div>
    )}
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { company, menus } = useAuth();
  const flatMenus = flattenMenuTree(menus);
  const actionMenus = flatMenus
    .filter((menu) => menu.menuPath)
    .map((menu) => ({
      ...menu,
      menuPath: normalizePath(menu.menuPath),
      menuName: getDisplayMenuName(menu.menuName),
    }));
  const shortcutMenus = prioritizeMenus(actionMenus, [
    "Sales Order",
    "Delivery",
    "A/R Invoice",
    "A/P Invoice",
    "Business Partner",
    "Item Master",
  ]).slice(0, 12);
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

  const widgetsById = useMemo(
    () => ({
      "quick-actions": (
        <div className="dashboard-widget__content">
          <ActionGrid
            items={shortcutMenus}
            emptyText="No shortcuts are available for this role."
            navigate={navigate}
          />
        </div>
      ),
    }),
    [navigate, shortcutMenus],
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
          <div className="dashboard-banner__eyebrow">SAP Business One</div>
          <h2>{company?.companyName || "SAP Business One Web Client"}</h2>
          <p>Open daily SAP B1 transactions, service documents, master data, and reports from one working dashboard.</p>
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
