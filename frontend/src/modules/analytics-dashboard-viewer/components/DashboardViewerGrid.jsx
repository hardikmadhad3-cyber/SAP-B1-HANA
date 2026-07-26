import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WidgetRenderer from './WidgetRenderer';
import DashboardFilterBar from './DashboardFilterBar';
import DashboardFieldFilterBar from '../../../components/analytics/DashboardFieldFilterBar';
import { fetchAnalyticsDashboardView, runAnalyticsDashboardWidget } from '../../../api/analyticsDashboardApi';
import { buildDefaultFieldFilterValues } from '../../../components/analytics/fieldFilterUtils';

const normalizeError = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

// Union of every widget's query parameters, deduped by name - one shared
// filter control per distinct parameter name, the same way Query Manager
// declares parameters on a single query, just fanned out across widgets.
const buildDistinctParameters = (widgets) => {
  const byName = new Map();
  widgets.forEach((widget) => {
    (widget.parameters || []).forEach((parameter) => {
      if (!byName.has(parameter.name)) byName.set(parameter.name, parameter);
    });
  });
  return [...byName.values()];
};

const buildDefaultFilterValues = (parameters) =>
  Object.fromEntries(parameters.map((parameter) => [parameter.name, parameter.default || '']));

const DashboardViewerGrid = ({ dashboardCode }) => {
  const [shell, setShell] = useState(null);
  const [shellError, setShellError] = useState('');
  const [widgetStates, setWidgetStates] = useState({});
  const [filterValues, setFilterValues] = useState({});
  const [applying, setApplying] = useState(false);
  const [fieldFilterValues, setFieldFilterValues] = useState({});

  // A monotonically-increasing request id (rather than a single `ignore`
  // flag) so an Apply-Filters click can cleanly supersede the initial load,
  // and vice versa, without stale results from either landing after the
  // fact - each async callback below checks its own id is still current.
  const requestIdRef = useRef(0);
  const controllerRef = useRef(null);

  const distinctParameters = useMemo(() => buildDistinctParameters(shell?.widgets || []), [shell]);

  const runWidgets = useCallback((widgets, paramValues, signal, requestId) =>
    widgets.map((widget) => {
      setWidgetStates((prev) => ({ ...prev, [widget.widgetId]: { loading: true, error: '', rows: prev[widget.widgetId]?.rows || [] } }));

      return runAnalyticsDashboardWidget(dashboardCode, widget.widgetId, { paramValues }, { signal })
        .then((result) => {
          if (requestIdRef.current !== requestId) return;
          setWidgetStates((prev) => ({ ...prev, [widget.widgetId]: { loading: false, error: '', rows: result.rows || [] } }));
        })
        .catch((error) => {
          if (requestIdRef.current !== requestId) return;
          setWidgetStates((prev) => ({
            ...prev,
            [widget.widgetId]: { loading: false, error: normalizeError(error, 'Failed to load widget.'), rows: [] },
          }));
        });
    }), [dashboardCode]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setShell(null);
    setShellError('');
    setWidgetStates({});

    fetchAnalyticsDashboardView(dashboardCode, { signal: controller.signal })
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setShell(data);

        const initialFilterValues = buildDefaultFilterValues(buildDistinctParameters(data.widgets));
        setFilterValues(initialFilterValues);
        setFieldFilterValues(buildDefaultFieldFilterValues(data.filters));

        // Parallel per-widget loading - one widget's failure or timeout must
        // not blank the rest of the dashboard.
        runWidgets(data.widgets, initialFilterValues, controller.signal, requestId);
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId) return;
        setShellError(normalizeError(error, 'Failed to load dashboard.'));
      });

    return () => controller.abort();
  }, [dashboardCode, runWidgets]);

  const handleFilterChange = (name, value) => setFilterValues((prev) => ({ ...prev, [name]: value }));

  const handleApplyFilters = async () => {
    if (!shell) return;
    // Only widgets whose underlying query actually declares a parameter get
    // re-run - a widget with no parameters is unaffected by any filter, so
    // skipping it avoids needless load on the shared rate limit.
    const affectedWidgets = shell.widgets.filter((widget) => (widget.parameters || []).length > 0);
    if (!affectedWidgets.length) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setApplying(true);
    try {
      await Promise.allSettled(runWidgets(affectedWidgets, filterValues, controller.signal, requestId));
    } finally {
      if (requestIdRef.current === requestId) setApplying(false);
    }
  };

  const widgetRowsById = useMemo(() => {
    const result = {};
    Object.entries(widgetStates).forEach(([widgetId, state]) => { result[widgetId] = state.rows || []; });
    return result;
  }, [widgetStates]);

  const widgetsWithLayout = useMemo(() => {
    if (!shell) return [];
    const layoutByWidgetId = new Map((shell.layout || []).map((item) => [String(item.i), item]));
    return shell.widgets.map((widget) => ({
      ...widget,
      layout: layoutByWidgetId.get(String(widget.widgetId)) || { x: 0, y: 0, w: 4, h: 6 },
    }));
  }, [shell]);

  if (shellError) {
    return <div className="adv-status adv-status--error">{shellError}</div>;
  }

  if (!shell) {
    return <div className="adv-status">Loading dashboard...</div>;
  }

  return (
    <div className="adv-dashboard">
      <h2 className="adv-dashboard__title">{shell.dashboardName}</h2>
      {shell.description && <p className="adv-dashboard__description">{shell.description}</p>}
      <DashboardFilterBar
        parameters={distinctParameters}
        values={filterValues}
        onChange={handleFilterChange}
        onApply={handleApplyFilters}
        applying={applying}
      />
      <DashboardFieldFilterBar
        filters={shell.filters || []}
        widgetRowsById={widgetRowsById}
        values={fieldFilterValues}
        onChange={setFieldFilterValues}
      />
      <div className="adv-scroll-area">
        <div className="adv-grid">
          {widgetsWithLayout.map((widget) => (
            <WidgetRenderer
              key={widget.widgetId}
              widget={widget}
              state={widgetStates[widget.widgetId] || { loading: true, error: '', rows: [] }}
              filters={shell.filters || []}
              fieldFilterValues={fieldFilterValues}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardViewerGrid;
