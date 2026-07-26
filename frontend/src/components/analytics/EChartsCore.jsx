import React, { Suspense, lazy } from 'react';

// Modular echarts import (echarts/core + explicit chart/component registration)
// instead of the full 'echarts' barrel, to keep the lazy vendor-echarts chunk
// as small as reasonably possible for an MVP. Dynamic so it only ever lands
// in that async chunk (see craco.config.js), never the main bundle.
const EChartsRenderer = lazy(async () => {
  const [echartsCore, charts, components, renderers, echartsForReactCore] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
    import('echarts-for-react/lib/core'),
  ]);

  echartsCore.use([
    charts.BarChart,
    charts.LineChart,
    charts.PieChart,
    charts.GaugeChart,
    charts.ScatterChart,
    charts.FunnelChart,
    charts.TreemapChart,
    charts.RadarChart,
    charts.HeatmapChart,
    components.GridComponent,
    components.TooltipComponent,
    components.LegendComponent,
    components.RadarComponent,
    components.VisualMapComponent,
    components.MarkLineComponent,
    renderers.CanvasRenderer,
  ]);

  const ReactEChartsCore = echartsForReactCore.default;

  return {
    default: ({ option, style }) => (
      <ReactEChartsCore echarts={echartsCore} option={option} style={style} notMerge lazyUpdate />
    ),
  };
});

const EChartsCore = ({ option, style }) => (
  <Suspense fallback={<div className="chart-widget__loading">Loading chart...</div>}>
    <EChartsRenderer option={option} style={style} />
  </Suspense>
);

export default EChartsCore;
