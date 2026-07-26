import React, { useEffect, useState } from 'react';
import ChartWidget from '../../../components/analytics/ChartWidget';
import { runAnalyticsQuery } from '../../../api/analyticsQueryApi';
import { applyFieldFilters } from '../../../components/analytics/fieldFilterUtils';

const WidgetTile = ({ widget, onEdit, onRemove, filters, filterValues, onDataLoaded }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // See DashboardViewerGrid.jsx for why this needs an AbortController, not
    // just an `ignore` flag: React.StrictMode double-mounts in development,
    // and without aborting, the first pass's request still hits the server.
    const controller = new AbortController();
    let ignore = false;
    setLoading(true);
    setError('');

    runAnalyticsQuery(widget.queryId, { paramValues: {}, widgetId: widget.widgetId }, { signal: controller.signal })
      .then((result) => {
        if (ignore) return;
        const nextRows = result.rows || [];
        setRows(nextRows);
        onDataLoaded?.(widget.widgetId, nextRows);
      })
      .catch((err) => { if (!ignore) setError(err?.response?.data?.message || 'Failed to load widget data.'); })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [widget.queryId, widget.widgetId]);

  const filteredRows = applyFieldFilters(rows, filters, filterValues);
  const titleStyle = widget.fieldMapping?.style || {};

  return (
    <div className="ads-widget-tile">
      <div className="ads-widget-tile__header">
        <span
          className="ads-widget-tile__title"
          style={{
            fontSize: titleStyle.titleFontSize ? `${titleStyle.titleFontSize}px` : undefined,
            fontWeight: titleStyle.titleFontWeight || undefined,
            color: titleStyle.titleColor || undefined,
          }}
        >
          {widget.title || widget.widgetType}
        </span>
        <div className="ads-widget-tile__actions">
          <button type="button" className="ads-widget-tile__btn" onClick={() => onEdit(widget)} title="Edit widget">Edit</button>
          <button type="button" className="ads-widget-tile__btn" onClick={() => onRemove(widget)} title="Remove widget">Remove</button>
        </div>
      </div>
      <div className="ads-widget-tile__body">
        {loading && <div className="chart-widget__loading">Loading...</div>}
        {!loading && error && <div className="chart-widget__empty">{error}</div>}
        {!loading && !error && (
          <ChartWidget widgetType={widget.widgetType} rows={filteredRows} fieldMapping={widget.fieldMapping} title={widget.title} />
        )}
      </div>
    </div>
  );
};

export default WidgetTile;
