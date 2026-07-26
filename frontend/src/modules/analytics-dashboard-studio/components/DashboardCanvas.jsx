import React, { useMemo } from 'react';
// react-grid-layout v2 moved the class-based Responsive/WidthProvider API
// (the simplest fit for this app's plain-React, no-hooks-required style)
// to a dedicated legacy compatibility entry point.
import { ReactGridLayout } from 'react-grid-layout/legacy';
import WidgetTile from './WidgetTile';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

export const DEFAULT_WIDGET_SIZE = { w: 4, h: 6, minW: 2, minH: 3 };
export const CANVAS_COLS = 12;
export const CANVAS_ROW_HEIGHT = 40;

const buildLayout = (widgets, savedLayout) => {
  const savedByWidgetId = new Map((savedLayout || []).map((item) => [String(item.i), item]));

  return widgets.map((widget, index) => {
    const saved = savedByWidgetId.get(String(widget.widgetId));
    if (saved) return { ...DEFAULT_WIDGET_SIZE, ...saved, i: String(widget.widgetId) };

    return {
      ...DEFAULT_WIDGET_SIZE,
      i: String(widget.widgetId),
      x: (index * DEFAULT_WIDGET_SIZE.w) % CANVAS_COLS,
      y: Infinity,
    };
  });
};

const toComparableLayout = (layout) =>
  JSON.stringify(layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })).sort((a, b) => a.i.localeCompare(b.i)));

/**
 * react-grid-layout's onLayoutChange fires on every internal re-layout
 * (mount, breakpoint changes, container resize) - not just user drags. It
 * must never be wired directly to a save-to-API callback: saving triggers a
 * parent re-render, which recomputes this layout array, which the grid sees
 * as a changed `layouts` prop and reflows again, firing onLayoutChange again
 * - an infinite loop that floods the API and trips the rate limiter within
 * seconds. Only persist on drag/resize *stop* (a real user action), and only
 * when the layout actually changed.
 */
const DashboardCanvas = ({
  widgets,
  layout,
  canvasWidth = 1280,
  canvasHeight = 800,
  filters,
  filterValues,
  onWidgetDataLoaded,
  onLayoutChange,
  onEditWidget,
  onRemoveWidget,
}) => {
  const gridLayout = useMemo(() => buildLayout(widgets, layout), [widgets, layout]);
  const maxRows = Math.max(1, Math.floor(canvasHeight / CANVAS_ROW_HEIGHT));

  const persistIfChanged = (nextLayout) => {
    if (toComparableLayout(nextLayout) === toComparableLayout(gridLayout)) return;
    onLayoutChange(nextLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })));
  };

  return (
    <div className="ads-canvas">
      <div className="ads-artboard" style={{ width: canvasWidth, minHeight: canvasHeight }}>
        <ReactGridLayout
          layout={gridLayout}
          width={canvasWidth}
          cols={CANVAS_COLS}
          rowHeight={CANVAS_ROW_HEIGHT}
          maxRows={maxRows}
          onDragStop={(nextLayout) => persistIfChanged(nextLayout)}
          onResizeStop={(nextLayout) => persistIfChanged(nextLayout)}
          draggableHandle=".ads-widget-tile__header"
        >
          {widgets.map((widget) => (
            <div key={String(widget.widgetId)}>
              <WidgetTile
                widget={widget}
                onEdit={onEditWidget}
                onRemove={onRemoveWidget}
                filters={filters}
                filterValues={filterValues}
                onDataLoaded={onWidgetDataLoaded}
              />
            </div>
          ))}
        </ReactGridLayout>
      </div>
    </div>
  );
};

export default DashboardCanvas;
