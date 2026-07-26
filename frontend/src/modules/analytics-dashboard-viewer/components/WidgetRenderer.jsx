import React from 'react';
import ChartWidget from '../../../components/analytics/ChartWidget';
import { applyFieldFilters } from '../../../components/analytics/fieldFilterUtils';

const WidgetRenderer = ({ widget, state, filters, fieldFilterValues }) => {
  const filteredRows = applyFieldFilters(state.rows, filters, fieldFilterValues);
  const titleStyle = widget.fieldMapping?.style || {};

  return (
    <div
      className="adv-widget"
      style={{
        gridColumn: `${(widget.layout?.x ?? 0) + 1} / span ${widget.layout?.w ?? 4}`,
        gridRow: `${(widget.layout?.y ?? 0) + 1} / span ${widget.layout?.h ?? 6}`,
      }}
    >
      <div
        className="adv-widget__header"
        style={{
          fontSize: titleStyle.titleFontSize ? `${titleStyle.titleFontSize}px` : undefined,
          fontWeight: titleStyle.titleFontWeight || undefined,
          color: titleStyle.titleColor || undefined,
        }}
      >
        {widget.title || widget.queryName}
      </div>
      <div className="adv-widget__body">
        {state.loading && <div className="chart-widget__loading">Loading...</div>}
        {!state.loading && state.error && <div className="chart-widget__empty">{state.error}</div>}
        {!state.loading && !state.error && (
          <ChartWidget widgetType={widget.widgetType} rows={filteredRows} fieldMapping={widget.fieldMapping} title={widget.title} />
        )}
      </div>
    </div>
  );
};

export default WidgetRenderer;
