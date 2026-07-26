import React, { useCallback, useEffect, useState } from 'react';
import DashboardList from '../modules/analytics-dashboard-studio/components/DashboardList';
import DashboardCanvas from '../modules/analytics-dashboard-studio/components/DashboardCanvas';
import AddWidgetWizard from '../modules/analytics-dashboard-studio/components/AddWidgetWizard';
import WidgetSettingsPanel from '../modules/analytics-dashboard-studio/components/WidgetSettingsPanel';
import RoleVisibilityPicker from '../modules/analytics-dashboard-studio/components/RoleVisibilityPicker';
import DashboardFieldFilterBar from '../components/analytics/DashboardFieldFilterBar';
import { buildDefaultFieldFilterValues, COMPARISON_OPERATORS, getFilterKey } from '../components/analytics/fieldFilterUtils';
import {
  fetchAnalyticsDashboards,
  fetchAnalyticsDashboard,
  createAnalyticsDashboard,
  updateAnalyticsDashboard,
  deleteAnalyticsDashboard,
  publishAnalyticsDashboard,
  unpublishAnalyticsDashboard,
  addAnalyticsDashboardWidget,
  updateAnalyticsDashboardWidget,
  removeAnalyticsDashboardWidget,
} from '../api/analyticsDashboardApi';
import { fetchAnalyticsQuery } from '../api/analyticsQueryApi';
import '../modules/analytics-query-manager/styles/query-manager.css';
import '../modules/analytics-dashboard-studio/styles/dashboard-studio.css';

const normalizeError = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

const emptyNewDashboardForm = () => ({ dashboardCode: '', dashboardName: '', description: '' });

const CANVAS_SIZE_PRESETS = [
  { key: '1280x800', label: '1280 x 800 (Default)', width: 1280, height: 800 },
  { key: '1366x768', label: '1366 x 768', width: 1366, height: 768 },
  { key: '1920x1080', label: '1920 x 1080 (Full HD)', width: 1920, height: 1080 },
  { key: '1024x768', label: '1024 x 768 (4:3)', width: 1024, height: 768 },
];

const AnalyticsDashboardStudioPage = () => {
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newDashboardForm, setNewDashboardForm] = useState(emptyNewDashboardForm());
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [editingWidgetColumnMeta, setEditingWidgetColumnMeta] = useState([]);
  const [editingWidgetMeasures, setEditingWidgetMeasures] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const [widgetRowsById, setWidgetRowsById] = useState({});
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [addFilterWidgetId, setAddFilterWidgetId] = useState('');
  const [addFilterColumnMeta, setAddFilterColumnMeta] = useState([]);
  const [addFilterField, setAddFilterField] = useState('');
  const [addFilterLabel, setAddFilterLabel] = useState('');
  const [addFilterType, setAddFilterType] = useState('select');
  const [addFilterOperator, setAddFilterOperator] = useState('>');
  const [addFilterDefaultValue, setAddFilterDefaultValue] = useState('');
  const [addFilterFrom, setAddFilterFrom] = useState('');
  const [addFilterTo, setAddFilterTo] = useState('');
  const [addFilterN, setAddFilterN] = useState('10');
  const [addFilterDirection, setAddFilterDirection] = useState('desc');

  const handleWidgetDataLoaded = useCallback((widgetId, rows) => {
    setWidgetRowsById((prev) => ({ ...prev, [widgetId]: rows }));
  }, []);

  useEffect(() => {
    if (!isFullScreen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsFullScreen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  const loadDashboards = useCallback(async () => {
    try {
      setDashboards(await fetchAnalyticsDashboards());
    } catch (loadError) {
      setError(normalizeError(loadError, 'Failed to load dashboards.'));
    }
  }, []);

  useEffect(() => { loadDashboards(); }, [loadDashboards]);

  const selectDashboard = async (dashboard) => {
    setError('');
    try {
      const detail = await fetchAnalyticsDashboard(dashboard.dashboardId);
      setSelectedDashboard(detail);
      setCreating(false);
      setFilterValues(buildDefaultFieldFilterValues(detail.filters));
      setWidgetRowsById({});
    } catch (selectError) {
      setError(normalizeError(selectError, 'Failed to load dashboard.'));
    }
  };

  const refreshSelected = async () => {
    if (!selectedDashboard) return;
    const detail = await fetchAnalyticsDashboard(selectedDashboard.dashboardId);
    setSelectedDashboard(detail);
    await loadDashboards();
  };

  const handleCreateDashboard = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const created = await createAnalyticsDashboard(newDashboardForm);
      setNewDashboardForm(emptyNewDashboardForm());
      setCreating(false);
      await loadDashboards();
      setSelectedDashboard(created);
    } catch (createError) {
      setError(normalizeError(createError, 'Failed to create dashboard.'));
    }
  };

  const handleMetaChange = async (patch) => {
    if (!selectedDashboard) return;
    setSelectedDashboard((prev) => ({ ...prev, ...patch }));
    try {
      await updateAnalyticsDashboard(selectedDashboard.dashboardId, patch);
    } catch (updateError) {
      setError(normalizeError(updateError, 'Failed to update dashboard.'));
    }
  };

  const handlePublishToggle = async () => {
    if (!selectedDashboard) return;
    setError('');
    try {
      const updated = selectedDashboard.status === 'Published'
        ? await unpublishAnalyticsDashboard(selectedDashboard.dashboardId)
        : await publishAnalyticsDashboard(selectedDashboard.dashboardId);
      setSelectedDashboard(updated);
      await loadDashboards();
    } catch (toggleError) {
      setError(normalizeError(toggleError, 'Failed to update dashboard status.'));
    }
  };

  const handleDeleteDashboard = async () => {
    if (!selectedDashboard) return;
    if (!window.confirm(`Delete dashboard "${selectedDashboard.dashboardName}"?`)) return;
    try {
      await deleteAnalyticsDashboard(selectedDashboard.dashboardId);
      setSelectedDashboard(null);
      await loadDashboards();
    } catch (deleteError) {
      setError(normalizeError(deleteError, 'Failed to delete dashboard.'));
    }
  };

  const handleAddWidget = async (widgetPayload) => {
    if (!selectedDashboard) return;
    setBusy(true);
    try {
      await addAnalyticsDashboardWidget(selectedDashboard.dashboardId, widgetPayload);
      setShowAddWidget(false);
      await refreshSelected();
    } catch (addError) {
      setError(normalizeError(addError, 'Failed to add widget.'));
    } finally {
      setBusy(false);
    }
  };

  const handleEditWidget = async (widget) => {
    const queryDetail = await fetchAnalyticsQuery(widget.queryId);
    setEditingWidgetColumnMeta(queryDetail.columnMeta || []);
    setEditingWidgetMeasures(queryDetail.measures || []);
    setEditingWidget(widget);
  };

  const handleSaveWidgetSettings = async ({ size, ...patch }) => {
    if (!selectedDashboard || !editingWidget) return;
    setBusy(true);
    try {
      await updateAnalyticsDashboardWidget(selectedDashboard.dashboardId, editingWidget.widgetId, patch);

      if (size) {
        const currentLayout = selectedDashboard.layout || [];
        const widgetKey = String(editingWidget.widgetId);
        const existingEntry = currentLayout.find((item) => String(item.i) === widgetKey);
        const sizeChanged = !existingEntry || existingEntry.w !== size.w || existingEntry.h !== size.h;

        if (sizeChanged) {
          const nextLayout = existingEntry
            ? currentLayout.map((item) => (String(item.i) === widgetKey ? { ...item, ...size } : item))
            : [...currentLayout, { i: widgetKey, x: 0, y: Infinity, ...size }];
          await updateAnalyticsDashboard(selectedDashboard.dashboardId, { layout: nextLayout });
        }
      }

      setEditingWidget(null);
      await refreshSelected();
    } catch (saveError) {
      setError(normalizeError(saveError, 'Failed to update widget.'));
    } finally {
      setBusy(false);
    }
  };

  const openAddFilter = () => {
    setAddFilterWidgetId('');
    setAddFilterColumnMeta([]);
    setAddFilterField('');
    setAddFilterLabel('');
    setAddFilterType('select');
    setAddFilterOperator('>');
    setAddFilterDefaultValue('');
    setAddFilterFrom('');
    setAddFilterTo('');
    setAddFilterN('10');
    setAddFilterDirection('desc');
    setShowAddFilter(true);
  };

  const handleAddFilterWidgetChange = async (widgetId) => {
    setAddFilterWidgetId(widgetId);
    setAddFilterField('');
    setAddFilterColumnMeta([]);
    const widget = (selectedDashboard.widgets || []).find((item) => String(item.widgetId) === String(widgetId));
    if (!widget) return;
    const queryDetail = await fetchAnalyticsQuery(widget.queryId);
    setAddFilterColumnMeta(queryDetail.columnMeta || []);
  };

  const isAddFilterValid = () => {
    if (!addFilterField) return false;
    if (addFilterType === 'comparison') return addFilterDefaultValue !== '';
    if (addFilterType === 'dateRange') return Boolean(addFilterFrom || addFilterTo);
    if (addFilterType === 'topN') return Number(addFilterN) > 0;
    return true;
  };

  const handleSaveFilter = () => {
    if (!selectedDashboard || !isAddFilterValid()) return;

    const baseFilter = { id: Date.now(), field: addFilterField, label: addFilterLabel || addFilterField, type: addFilterType };
    const newFilter = addFilterType === 'comparison'
      ? { ...baseFilter, operator: addFilterOperator, value: addFilterDefaultValue }
      : addFilterType === 'dateRange'
        ? { ...baseFilter, from: addFilterFrom, to: addFilterTo }
        : addFilterType === 'topN'
          ? { ...baseFilter, n: Number(addFilterN) || 10, direction: addFilterDirection }
          : baseFilter;

    const nextFilters = [...(selectedDashboard.filters || []), newFilter];
    handleMetaChange({ filters: nextFilters });
    setFilterValues((prev) => ({ ...prev, ...buildDefaultFieldFilterValues([newFilter]) }));
    setShowAddFilter(false);
  };

  const handleRemoveFilter = (key) => {
    const nextFilters = (selectedDashboard.filters || []).filter((filter) => getFilterKey(filter) !== key);
    handleMetaChange({ filters: nextFilters });
    setFilterValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleRemoveWidget = async (widget) => {
    if (!selectedDashboard) return;
    if (!window.confirm('Remove this widget from the dashboard?')) return;
    try {
      await removeAnalyticsDashboardWidget(selectedDashboard.dashboardId, widget.widgetId);
      await refreshSelected();
    } catch (removeError) {
      setError(normalizeError(removeError, 'Failed to remove widget.'));
    }
  };

  const handleLayoutChange = (nextLayout) => {
    if (!selectedDashboard) return;
    handleMetaChange({ layout: nextLayout });
  };

  return (
    <div className={`ads-window${isFullScreen ? ' is-fullscreen' : ''}`}>
      <div className="ads-window__titlebar">
        <h2>Dashboard Studio</h2>
        <button
          type="button"
          className="aqm-btn"
          onClick={() => setIsFullScreen((prev) => !prev)}
        >
          {isFullScreen ? '✕ Exit Full Screen' : '⛶ Full Screen'}
        </button>
      </div>
      <div className="ads-window__body">
        <div className="aqm-card">
          <div className="aqm-card__header"><h3>Dashboards</h3></div>
          <DashboardList
            dashboards={dashboards}
            selectedDashboardId={selectedDashboard?.dashboardId}
            onSelect={selectDashboard}
            onCreateNew={() => { setCreating(true); setSelectedDashboard(null); }}
          />
        </div>

        <div className="ads-designer">
          {error && <div className="aqm-form__error">{error}</div>}

          {creating && (
            <form className="ads-designer__meta" onSubmit={handleCreateDashboard}>
              <div className="ads-designer__meta-row">
                <label className="ads-field">
                  <span>Dashboard Code</span>
                  <input
                    type="text"
                    value={newDashboardForm.dashboardCode}
                    onChange={(event) => setNewDashboardForm((prev) => ({ ...prev, dashboardCode: event.target.value.toUpperCase() }))}
                    placeholder="PURCHASE_DASHBOARD"
                  />
                </label>
                <label className="ads-field">
                  <span>Dashboard Name</span>
                  <input
                    type="text"
                    value={newDashboardForm.dashboardName}
                    onChange={(event) => setNewDashboardForm((prev) => ({ ...prev, dashboardName: event.target.value }))}
                    placeholder="Purchase Dashboard"
                  />
                </label>
                <label className="ads-field">
                  <span>Description</span>
                  <input
                    type="text"
                    value={newDashboardForm.description}
                    onChange={(event) => setNewDashboardForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </label>
              </div>
              <div className="ads-designer__toolbar">
                <button type="submit" className="aqm-btn aqm-btn--primary">Create Dashboard</button>
                <button type="button" className="aqm-btn aqm-btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </form>
          )}

          {selectedDashboard && !creating && (
            <>
              <div className="ads-designer__meta">
                <div className="ads-designer__meta-row">
                  <label className="ads-field">
                    <span>Dashboard Name</span>
                    <input
                      type="text"
                      value={selectedDashboard.dashboardName}
                      onChange={(event) => handleMetaChange({ dashboardName: event.target.value })}
                    />
                  </label>
                  <label className="ads-field">
                    <span>Description</span>
                    <input
                      type="text"
                      value={selectedDashboard.description || ''}
                      onChange={(event) => handleMetaChange({ description: event.target.value })}
                    />
                  </label>
                  <label className="ads-field">
                    <span>Status</span>
                    <span className={`aqm-status-pill aqm-status-pill--${selectedDashboard.status.toLowerCase()}`}>
                      {selectedDashboard.status}
                    </span>
                  </label>
                </div>
                <label className="ads-field">
                  <span>Visible to Roles</span>
                  <RoleVisibilityPicker
                    selectedRoleIds={selectedDashboard.visibleRoleIds || []}
                    onChange={(roleIds) => handleMetaChange({ visibleRoleIds: roleIds })}
                  />
                  {!(selectedDashboard.visibleRoleIds || []).length && (
                    <p className="ads-field-mapping__empty" style={{ color: '#a53a34' }}>
                      No roles selected - this dashboard's menu entry will be invisible to everyone until you pick at least one role above.
                    </p>
                  )}
                </label>

                <div className="ads-designer__meta-row ads-designer__meta-row--canvas">
                  <label className="ads-field">
                    <span>Canvas Size Preset</span>
                    <select
                      value="custom"
                      onChange={(event) => {
                        const preset = CANVAS_SIZE_PRESETS.find((item) => item.key === event.target.value);
                        if (preset) handleMetaChange({ canvasWidth: preset.width, canvasHeight: preset.height });
                      }}
                    >
                      <option value="custom">Custom</option>
                      {CANVAS_SIZE_PRESETS.map((preset) => (
                        <option key={preset.key} value={preset.key}>{preset.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ads-field">
                    <span>Canvas Width (px)</span>
                    <input
                      type="number"
                      min={480}
                      max={3840}
                      value={selectedDashboard.canvasWidth}
                      onChange={(event) => handleMetaChange({ canvasWidth: Number(event.target.value) || 1280 })}
                    />
                  </label>
                  <label className="ads-field">
                    <span>Canvas Height (px)</span>
                    <input
                      type="number"
                      min={360}
                      max={4320}
                      value={selectedDashboard.canvasHeight}
                      onChange={(event) => handleMetaChange({ canvasHeight: Number(event.target.value) || 800 })}
                    />
                  </label>
                </div>

                <div className="ads-designer__filters">
                  <span className="ads-field-mapping__label">Dashboard Filters</span>
                  <div className="ads-designer__filters-list">
                    {(selectedDashboard.filters || []).map((filter) => (
                      <span key={getFilterKey(filter)} className="ads-filter-chip">
                        {filter.label || filter.field}
                        <button type="button" onClick={() => handleRemoveFilter(getFilterKey(filter))} title="Remove filter">x</button>
                      </span>
                    ))}
                    {!(selectedDashboard.filters || []).length && (
                      <span className="ads-field-mapping__empty">No dashboard filters yet.</span>
                    )}
                  </div>
                  <button type="button" className="aqm-btn aqm-btn--ghost" onClick={openAddFilter} disabled={!(selectedDashboard.widgets || []).length}>
                    + Add Filter
                  </button>
                </div>
              </div>

              <div className="ads-designer__toolbar">
                <button type="button" className="aqm-btn aqm-btn--primary" onClick={() => setShowAddWidget(true)}>
                  + Add Widget
                </button>
                <button type="button" className="aqm-btn" onClick={handlePublishToggle}>
                  {selectedDashboard.status === 'Published' ? 'Unpublish' : 'Publish'}
                </button>
                <button type="button" className="aqm-btn aqm-btn--danger" onClick={handleDeleteDashboard}>
                  Delete
                </button>
              </div>

              <DashboardFieldFilterBar
                filters={selectedDashboard.filters || []}
                widgetRowsById={widgetRowsById}
                values={filterValues}
                onChange={setFilterValues}
              />

              <DashboardCanvas
                widgets={selectedDashboard.widgets || []}
                layout={selectedDashboard.layout || []}
                canvasWidth={selectedDashboard.canvasWidth}
                canvasHeight={selectedDashboard.canvasHeight}
                filters={selectedDashboard.filters || []}
                filterValues={filterValues}
                onWidgetDataLoaded={handleWidgetDataLoaded}
                onLayoutChange={handleLayoutChange}
                onEditWidget={handleEditWidget}
                onRemoveWidget={handleRemoveWidget}
              />
            </>
          )}

          {!selectedDashboard && !creating && (
            <div className="aqm-empty-state">Select a dashboard from the list, or create a new one.</div>
          )}
        </div>
      </div>

      {showAddWidget && (
        <AddWidgetWizard onAdd={handleAddWidget} onClose={() => setShowAddWidget(false)} saving={busy} />
      )}

      {showAddFilter && (
        <div className="ads-modal-overlay" role="presentation" onMouseDown={() => setShowAddFilter(false)}>
          <div className="ads-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header className="ads-modal__header">
              <span>Add Dashboard Filter</span>
              <button type="button" onClick={() => setShowAddFilter(false)}>x</button>
            </header>
            <div className="ads-modal__body">
              <label className="ads-field">
                <span>Source Widget</span>
                <select value={addFilterWidgetId} onChange={(event) => handleAddFilterWidgetChange(event.target.value)}>
                  <option value="">Select widget</option>
                  {(selectedDashboard?.widgets || []).map((widget) => (
                    <option key={widget.widgetId} value={widget.widgetId}>{widget.title || widget.widgetType}</option>
                  ))}
                </select>
              </label>
              <label className="ads-field">
                <span>Field</span>
                <select
                  value={addFilterField}
                  onChange={(event) => {
                    setAddFilterField(event.target.value);
                    if (!addFilterLabel) setAddFilterLabel(event.target.value);
                  }}
                  disabled={!addFilterColumnMeta.length}
                >
                  <option value="">Select column</option>
                  {addFilterColumnMeta.map((column) => (
                    <option key={column.name} value={column.name}>{column.name}</option>
                  ))}
                </select>
              </label>
              <label className="ads-field">
                <span>Label</span>
                <input type="text" value={addFilterLabel} onChange={(event) => setAddFilterLabel(event.target.value)} />
              </label>
              <label className="ads-field">
                <span>Filter Type</span>
                <select value={addFilterType} onChange={(event) => setAddFilterType(event.target.value)}>
                  <option value="select">Select values (checkbox list)</option>
                  <option value="comparison">Comparison (e.g. OnHand &gt; 0)</option>
                  <option value="dateRange">Date Range</option>
                  <option value="topN">Top N</option>
                </select>
              </label>
              {addFilterType === 'comparison' && (
                <div className="ads-designer__meta-row">
                  <label className="ads-field">
                    <span>Operator</span>
                    <select value={addFilterOperator} onChange={(event) => setAddFilterOperator(event.target.value)}>
                      {COMPARISON_OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </label>
                  <label className="ads-field">
                    <span>Default Value</span>
                    <input
                      type="number"
                      value={addFilterDefaultValue}
                      onChange={(event) => setAddFilterDefaultValue(event.target.value)}
                      placeholder="0"
                    />
                  </label>
                </div>
              )}
              {addFilterType === 'dateRange' && (
                <div className="ads-designer__meta-row">
                  <label className="ads-field">
                    <span>From (default)</span>
                    <input type="date" value={addFilterFrom} onChange={(event) => setAddFilterFrom(event.target.value)} />
                  </label>
                  <label className="ads-field">
                    <span>To (default)</span>
                    <input type="date" value={addFilterTo} onChange={(event) => setAddFilterTo(event.target.value)} />
                  </label>
                </div>
              )}
              {addFilterType === 'topN' && (
                <div className="ads-designer__meta-row">
                  <label className="ads-field">
                    <span>N</span>
                    <input type="number" min="1" value={addFilterN} onChange={(event) => setAddFilterN(event.target.value)} />
                  </label>
                  <label className="ads-field">
                    <span>Direction</span>
                    <select value={addFilterDirection} onChange={(event) => setAddFilterDirection(event.target.value)}>
                      <option value="desc">Highest</option>
                      <option value="asc">Lowest</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
            <footer className="ads-modal__footer">
              <button
                type="button"
                className="aqm-btn aqm-btn--primary"
                disabled={!isAddFilterValid()}
                onClick={handleSaveFilter}
              >
                Add Filter
              </button>
              <button type="button" className="aqm-btn aqm-btn--ghost" onClick={() => setShowAddFilter(false)}>Cancel</button>
            </footer>
          </div>
        </div>
      )}

      {editingWidget && (
        <WidgetSettingsPanel
          widget={editingWidget}
          columnMeta={editingWidgetColumnMeta}
          savedMeasures={editingWidgetMeasures}
          layout={selectedDashboard?.layout || []}
          canvasWidth={selectedDashboard?.canvasWidth}
          onSave={handleSaveWidgetSettings}
          onClose={() => setEditingWidget(null)}
          saving={busy}
        />
      )}
    </div>
  );
};

export default AnalyticsDashboardStudioPage;
