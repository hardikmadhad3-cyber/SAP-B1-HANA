import React from 'react';
import EChartsCore from './EChartsCore';
import { aggregateForChart, aggregateSingleValue, aggregateForRadar, buildScatterPoints, buildMatrixData, aggregateForHeatmap } from './chartDataUtils';
import '../../styles/analytics-chart-widget.css';

const CHART_COLORS = ['#28588d', '#f0b31d', '#2f7d4f', '#a53a34', '#6b4fa0', '#1c8f9d'];

const formatNumber = (value) => {
  const numeric = Number(value) || 0;
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

/**
 * Post-processes a finished ECharts option with the widget's optional
 * fieldMapping.style settings (axis label / data label font size+color) -
 * applied as a decorator over every option-builder's output rather than
 * threading a `style` param through each one individually, since the target
 * fields (xAxis/yAxis.axisLabel, series[].label) are the same shape
 * regardless of chart type.
 */
const applyStyle = (option, style = {}) => {
  const axisTextStyle = {};
  if (style.axisFontSize) axisTextStyle.fontSize = Number(style.axisFontSize);
  if (style.axisColor) axisTextStyle.color = style.axisColor;

  const hasLabelStyle = Boolean(style.labelFontSize || style.labelColor);
  const labelStyle = { show: true };
  if (style.labelFontSize) labelStyle.fontSize = Number(style.labelFontSize);
  if (style.labelColor) labelStyle.color = style.labelColor;

  if (!Object.keys(axisTextStyle).length && !hasLabelStyle) return option;

  const withAxisLabel = (axis) => (axis ? { ...axis, axisLabel: { ...(axis.axisLabel || {}), ...axisTextStyle } } : axis);
  const decorateAxis = (axis) => (Array.isArray(axis) ? axis.map(withAxisLabel) : withAxisLabel(axis));

  return {
    ...option,
    xAxis: Object.keys(axisTextStyle).length ? decorateAxis(option.xAxis) : option.xAxis,
    yAxis: Object.keys(axisTextStyle).length ? decorateAxis(option.yAxis) : option.yAxis,
    series: Array.isArray(option.series) && hasLabelStyle
      ? option.series.map((series) => ({ ...series, label: { ...(series.label || {}), ...labelStyle } }))
      : option.series,
  };
};

/**
 * Shared builder for the whole bar/column/line/area family - they all share
 * the same dimension-to-categories, measures-to-series shape and only differ
 * in orientation (horizontal), stacking, and area fill.
 */
const buildCategoryChartOption = (rows, fieldMapping, kind, { horizontal = false, stacked = false, area = false } = {}) => {
  const { categories, series } = aggregateForChart(rows, fieldMapping);
  const decoratedSeries = series.map((item) => ({
    ...item,
    type: kind,
    ...(stacked ? { stack: 'total' } : {}),
    ...(area ? { areaStyle: {} } : {}),
  }));
  const categoryAxis = { type: 'category', data: categories };
  const valueAxis = { type: 'value' };

  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis' },
    legend: series.length > 1 ? { bottom: 0 } : undefined,
    grid: { left: 40, right: 20, top: 20, bottom: series.length > 1 ? 36 : 20, containLabel: true },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: decoratedSeries,
  };
};

const buildPieChartOption = (rows, fieldMapping, { donut = false } = {}) => {
  const { categories, series } = aggregateForChart(rows, fieldMapping);
  const values = series[0]?.data || [];
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: donut ? ['40%', '70%'] : '65%',
      data: categories.map((category, index) => ({ name: category, value: values[index] || 0 })),
    }],
  };
};

const buildGaugeChartOption = (rows, fieldMapping) => {
  const value = aggregateSingleValue(rows, fieldMapping);
  return {
    series: [{
      type: 'gauge',
      progress: { show: true },
      detail: { valueAnimation: true, formatter: (val) => formatNumber(val) },
      data: [{ value }],
    }],
  };
};

const buildComboChartOption = (rows, fieldMapping) => {
  const { categories, series } = aggregateForChart(rows, fieldMapping);
  const measures = Array.isArray(fieldMapping?.measures) ? fieldMapping.measures : [];
  const decoratedSeries = series.map((item, index) => ({
    ...item,
    type: measures[index]?.seriesType === 'line' ? 'line' : 'bar',
  }));

  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis' },
    legend: decoratedSeries.length > 1 ? { bottom: 0 } : undefined,
    grid: { left: 40, right: 20, top: 20, bottom: decoratedSeries.length > 1 ? 36 : 20, containLabel: true },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series: decoratedSeries,
  };
};

const buildFunnelChartOption = (rows, fieldMapping) => {
  const { categories, series } = aggregateForChart(rows, fieldMapping);
  const values = series[0]?.data || [];
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'funnel',
      left: '10%',
      width: '80%',
      sort: 'descending',
      data: categories.map((category, index) => ({ name: category, value: values[index] || 0 })),
    }],
  };
};

const buildTreemapChartOption = (rows, fieldMapping) => {
  const { categories, series } = aggregateForChart(rows, fieldMapping);
  const values = series[0]?.data || [];
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item' },
    series: [{
      type: 'treemap',
      roam: false,
      data: categories.map((category, index) => ({ name: category, value: values[index] || 0 })),
    }],
  };
};

const buildRadarChartOption = (rows, fieldMapping) => {
  const { indicators, series } = aggregateForRadar(rows, fieldMapping);
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item' },
    legend: series.length > 1 ? { bottom: 0 } : undefined,
    radar: { indicator: indicators },
    series: [{
      type: 'radar',
      data: series,
    }],
  };
};

const buildScatterChartOption = (rows, fieldMapping) => {
  const points = buildScatterPoints(rows, fieldMapping);
  const maxSize = fieldMapping?.sizeField ? Math.max(1, ...points.map((point) => point[2] || 0)) : 0;

  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item' },
    grid: { left: 40, right: 20, top: 20, bottom: 20, containLabel: true },
    xAxis: { type: 'value', name: fieldMapping?.xField || '' },
    yAxis: { type: 'value', name: fieldMapping?.yField || '' },
    series: [{
      type: 'scatter',
      symbolSize: fieldMapping?.sizeField ? (val) => 8 + (val[2] / maxSize) * 32 : 10,
      data: points,
    }],
  };
};

const buildWaterfallChartOption = (rows, fieldMapping) => {
  const { categories, series } = aggregateForChart(rows, fieldMapping);
  const deltas = series[0]?.data || [];

  let running = 0;
  const base = [];
  const positive = [];
  const negative = [];
  deltas.forEach((delta) => {
    const start = running;
    running += delta;
    if (delta >= 0) {
      base.push(start);
      positive.push(delta);
      negative.push(0);
    } else {
      base.push(running);
      positive.push(0);
      negative.push(-delta);
    }
  });

  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 20, containLabel: true },
    xAxis: { type: 'category', data: [...categories, 'Total'] },
    yAxis: { type: 'value' },
    series: [
      { name: 'Base', type: 'bar', stack: 'total', itemStyle: { color: 'transparent' }, data: [...base, 0] },
      { name: 'Increase', type: 'bar', stack: 'total', itemStyle: { color: '#2f7d4f' }, data: [...positive, 0] },
      { name: 'Decrease', type: 'bar', stack: 'total', itemStyle: { color: '#a53a34' }, data: [...negative, 0] },
      { name: 'Total', type: 'bar', stack: 'total', itemStyle: { color: '#28588d' }, data: [...deltas.map(() => 0), running] },
    ],
  };
};

const buildHeatmapChartOption = (rows, fieldMapping) => {
  const { xCategories, yCategories, data } = aggregateForHeatmap(rows, fieldMapping);
  const values = data.map((cell) => cell[2]).filter((value) => value != null);

  return {
    tooltip: { position: 'top' },
    grid: { left: 80, right: 20, top: 20, bottom: 60, containLabel: true },
    xAxis: { type: 'category', data: xCategories, splitArea: { show: true } },
    yAxis: { type: 'category', data: yCategories, splitArea: { show: true } },
    visualMap: {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: false },
    }],
  };
};

const buildBulletChartOption = (rows, fieldMapping) => {
  const actual = aggregateSingleValue(rows, fieldMapping);
  const targetMeasure = fieldMapping?.targetField
    ? { field: fieldMapping.targetField, agg: fieldMapping?.measures?.[0]?.agg || 'sum' }
    : null;
  const target = targetMeasure
    ? aggregateSingleValue(rows, { measures: [targetMeasure] })
    : Number(fieldMapping?.targetValue) || 0;
  const rangeMax = Math.max(actual, target, 1) * 1.25;

  return {
    grid: { left: 60, right: 40, top: 20, bottom: 20, containLabel: true },
    xAxis: { type: 'value', max: rangeMax },
    yAxis: { type: 'category', data: [''], axisLine: { show: false }, axisTick: { show: false } },
    series: [
      {
        name: 'Range',
        type: 'bar',
        barWidth: 30,
        data: [rangeMax],
        itemStyle: { color: '#edf1f5' },
        silent: true,
        tooltip: { show: false },
        z: 1,
      },
      {
        name: 'Actual',
        type: 'bar',
        barWidth: 12,
        data: [actual],
        itemStyle: { color: '#28588d' },
        z: 2,
        markLine: {
          symbol: 'none',
          label: { formatter: () => `Target: ${formatNumber(target)}` },
          lineStyle: { color: '#a53a34', width: 2, type: 'solid' },
          data: [{ xAxis: target }],
        },
      },
    ],
  };
};

const KpiWidget = ({ rows, fieldMapping, title }) => {
  const value = aggregateSingleValue(rows, fieldMapping);
  return (
    <div className="chart-widget__kpi">
      <div className="chart-widget__kpi-value">{formatNumber(value)}</div>
      <div className="chart-widget__kpi-label">{title}</div>
    </div>
  );
};

const CardTrendWidget = ({ rows, fieldMapping, title }) => {
  const current = aggregateSingleValue(rows, fieldMapping);
  const compareMeasure = fieldMapping?.compareMeasure;
  const compare = compareMeasure ? aggregateSingleValue(rows, { measures: [compareMeasure] }) : null;
  const change = compare ? ((current - compare) / Math.abs(compare)) * 100 : null;
  const isUp = (change || 0) >= 0;

  return (
    <div className="chart-widget__kpi">
      <div className="chart-widget__kpi-value">{formatNumber(current)}</div>
      <div className="chart-widget__kpi-label">{title}</div>
      {change != null && Number.isFinite(change) && (
        <div className={`chart-widget__kpi-trend ${isUp ? 'is-up' : 'is-down'}`}>
          {isUp ? '▲' : '▼'} {formatNumber(Math.abs(change))}%
        </div>
      )}
    </div>
  );
};

const TableWidget = ({ rows, fieldMapping }) => {
  const columns = Array.isArray(fieldMapping?.columns) && fieldMapping.columns.length
    ? fieldMapping.columns
    : Object.keys(rows?.[0] || {});

  return (
    <div className="chart-widget__table-wrap">
      <table className="chart-widget__table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {(rows || []).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{String(row[column] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const flattenMatrixRows = (rowNodes, output = []) => {
  rowNodes.forEach((node) => {
    output.push(node);
    if (node.children) flattenMatrixRows(node.children, output);
  });
  return output;
};

const MatrixWidget = ({ rows, fieldMapping }) => {
  const { columnKeys, rowNodes } = buildMatrixData(rows, fieldMapping);
  const measures = Array.isArray(fieldMapping?.measures) ? fieldMapping.measures : [];

  if (!rowNodes.length) {
    return <div className="chart-widget__empty">Select row fields and at least one measure to display the matrix.</div>;
  }

  const flatRows = flattenMatrixRows(rowNodes);

  return (
    <div className="chart-widget__table-wrap">
      <table className="chart-widget__table chart-widget__matrix">
        <thead>
          <tr>
            <th>{(fieldMapping.rowFields || []).join(' / ')}</th>
            {columnKeys.map((columnKey) => (
              measures.map((measure) => (
                <th key={`${columnKey}::${measure.field}`} className="is-numeric">
                  {columnKey === '__value__' ? (measure.label || measure.field) : `${columnKey} - ${measure.label || measure.field}`}
                </th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {flatRows.map((node, index) => (
            <tr key={`${node.level}-${node.key}-${index}`} className={node.children ? 'chart-widget__matrix-group' : undefined}>
              <td style={{ paddingLeft: 12 + node.level * 18 }}>{node.key}</td>
              {columnKeys.map((columnKey) => (
                measures.map((measure) => (
                  <td key={`${columnKey}::${measure.field}`} className="is-numeric">
                    {formatNumber(node.cells[`${columnKey}::${measure.field}`])}
                  </td>
                ))
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Dumb {widgetType, rows, fieldMapping, title} -> visual renderer, shared by
 * the Dashboard Studio live preview and the Dashboard Viewer so chart-option
 * building logic isn't duplicated between the two.
 */
const ChartWidget = ({ widgetType, rows = [], fieldMapping = {}, title = '' }) => {
  if (!rows.length) {
    return <div className="chart-widget__empty">No data.</div>;
  }

  const style = fieldMapping?.style || {};
  const chart = (option) => <EChartsCore option={applyStyle(option, style)} style={{ height: '100%' }} />;

  switch (widgetType) {
    case 'kpi':
      return <KpiWidget rows={rows} fieldMapping={fieldMapping} title={title} />;
    case 'card-trend':
      return <CardTrendWidget rows={rows} fieldMapping={fieldMapping} title={title} />;
    case 'table':
      return <TableWidget rows={rows} fieldMapping={fieldMapping} />;
    case 'matrix':
      return <MatrixWidget rows={rows} fieldMapping={fieldMapping} />;
    case 'bar':
      return chart(buildCategoryChartOption(rows, fieldMapping, 'bar'));
    case 'column-stacked':
      return chart(buildCategoryChartOption(rows, fieldMapping, 'bar', { stacked: true }));
    case 'bar-horizontal':
      return chart(buildCategoryChartOption(rows, fieldMapping, 'bar', { horizontal: true }));
    case 'bar-horizontal-stacked':
      return chart(buildCategoryChartOption(rows, fieldMapping, 'bar', { horizontal: true, stacked: true }));
    case 'line':
      return chart(buildCategoryChartOption(rows, fieldMapping, 'line'));
    case 'area':
      return chart(buildCategoryChartOption(rows, fieldMapping, 'line', { area: true }));
    case 'area-stacked':
      return chart(buildCategoryChartOption(rows, fieldMapping, 'line', { area: true, stacked: true }));
    case 'pie':
      return chart(buildPieChartOption(rows, fieldMapping));
    case 'donut':
      return chart(buildPieChartOption(rows, fieldMapping, { donut: true }));
    case 'combo':
      return chart(buildComboChartOption(rows, fieldMapping));
    case 'funnel':
      return chart(buildFunnelChartOption(rows, fieldMapping));
    case 'treemap':
      return chart(buildTreemapChartOption(rows, fieldMapping));
    case 'radar':
      return chart(buildRadarChartOption(rows, fieldMapping));
    case 'scatter':
      return chart(buildScatterChartOption(rows, fieldMapping));
    case 'gauge':
      return chart(buildGaugeChartOption(rows, fieldMapping));
    case 'waterfall':
      return chart(buildWaterfallChartOption(rows, fieldMapping));
    case 'heatmap':
      return chart(buildHeatmapChartOption(rows, fieldMapping));
    case 'bullet':
      return chart(buildBulletChartOption(rows, fieldMapping));
    default:
      return <div className="chart-widget__empty">Unsupported widget type.</div>;
  }
};

export default ChartWidget;
