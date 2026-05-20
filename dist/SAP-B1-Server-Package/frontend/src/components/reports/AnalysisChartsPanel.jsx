import React, { useMemo, useState } from "react";

const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

const getMaxValue = (points = []) =>
  Math.max(
    0,
    ...points.flatMap((point) => [Number(point?.primary || 0), Number(point?.secondary || 0)])
  );

function SimpleChart({ title, points = [], primaryLabel, secondaryLabel, chartStyle }) {
  const width = 520;
  const height = 210;
  const padding = { top: 16, right: 14, bottom: 42, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const step = points.length > 1 ? innerWidth / points.length : innerWidth;
  const maxValue = getMaxValue(points) || 1;

  const linePath = (key) =>
    points
      .map((point, index) => {
        const x = padding.left + step * index + step / 2;
        const y = padding.top + innerHeight - (Number(point?.[key] || 0) / maxValue) * innerHeight;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  return (
    <div className="sar-chart-card">
      <div className="sar-chart-card__title">{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="sar-chart-svg" role="img" aria-label={title}>
        <line
          className="sar-chart-axis"
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={width - padding.right}
          y2={padding.top + innerHeight}
        />
        <line
          className="sar-chart-axis"
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + innerHeight}
        />

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight - innerHeight * ratio;
          const label = formatNumber(maxValue * ratio);
          return (
            <g key={ratio}>
              <line className="sar-chart-axis" x1={padding.left} y1={y} x2={width - padding.right} y2={y} opacity="0.28" />
              <text className="sar-chart-tick" x={padding.left - 6} y={y + 4} textAnchor="end">{label}</text>
            </g>
          );
        })}

        {chartStyle === "line" ? (
          <>
            <path className="sar-chart-line sar-chart-line--primary" d={linePath("primary")} />
            <path className="sar-chart-line sar-chart-line--secondary" d={linePath("secondary")} />
            {points.map((point, index) => {
              const x = padding.left + step * index + step / 2;
              const primaryY = padding.top + innerHeight - (Number(point?.primary || 0) / maxValue) * innerHeight;
              const secondaryY = padding.top + innerHeight - (Number(point?.secondary || 0) / maxValue) * innerHeight;
              return (
                <g key={point.label || index}>
                  <circle className="sar-chart-point sar-chart-point--primary" cx={x} cy={primaryY} r="4" />
                  <circle className="sar-chart-point sar-chart-point--secondary" cx={x} cy={secondaryY} r="4" />
                  <text className="sar-chart-label" x={x} y={height - 12} textAnchor="middle">{point.label}</text>
                </g>
              );
            })}
          </>
        ) : (
          points.map((point, index) => {
            const baseX = padding.left + step * index + step * 0.16;
            const barWidth = Math.max(12, step * 0.26);
            const primaryHeight = (Number(point?.primary || 0) / maxValue) * innerHeight;
            const secondaryHeight = (Number(point?.secondary || 0) / maxValue) * innerHeight;

            return (
              <g key={point.label || index}>
                <rect
                  className="sar-chart-bar sar-chart-bar--primary"
                  x={baseX}
                  y={padding.top + innerHeight - primaryHeight}
                  width={barWidth}
                  height={primaryHeight}
                />
                <rect
                  className="sar-chart-bar sar-chart-bar--secondary"
                  x={baseX + barWidth + 6}
                  y={padding.top + innerHeight - secondaryHeight}
                  width={barWidth}
                  height={secondaryHeight}
                />
                <text className="sar-chart-label" x={padding.left + step * index + step / 2} y={height - 12} textAnchor="middle">
                  {point.label}
                </text>
              </g>
            );
          })
        )}
      </svg>

      <div className="sar-chart-legend">
        <span className="sar-chart-legend__item">
          <span className="sar-chart-legend__swatch sar-chart-legend__swatch--primary" />
          {primaryLabel}
        </span>
        <span className="sar-chart-legend__item">
          <span className="sar-chart-legend__swatch sar-chart-legend__swatch--secondary" />
          {secondaryLabel}
        </span>
      </div>
    </div>
  );
}

export default function AnalysisChartsPanel({ chartData, currencyCode, showControls = false }) {
  const [chartStyle, setChartStyle] = useState("bar");

  const note = useMemo(() => {
    if (!currencyCode) return "";
    return `Amounts shown in ${currencyCode}`;
  }, [currencyCode]);

  if (!chartData?.monthly?.length && !chartData?.quarterly?.length) {
    return null;
  }

  return (
    <div className="sar-charts-panel">
      <div className="sar-charts-grid">
        {chartData?.quarterly?.length ? (
          <SimpleChart
            title="Quarterly Overview"
            points={chartData.quarterly}
            primaryLabel={chartData.primaryLabel || "Primary"}
            secondaryLabel={chartData.secondaryLabel || "Secondary"}
            chartStyle={chartStyle}
          />
        ) : null}

        {chartData?.monthly?.length ? (
          <SimpleChart
            title="Monthly Overview"
            points={chartData.monthly}
            primaryLabel={chartData.primaryLabel || "Primary"}
            secondaryLabel={chartData.secondaryLabel || "Secondary"}
            chartStyle={chartStyle}
          />
        ) : null}
      </div>

      <div className="sar-charts-panel__footer">
        <div className="sar-charts-panel__note">{note}</div>
        {showControls ? (
          <div className="sar-charts-panel__controls">
            <label className="sar-chart-style-field">
              Diagram
              <select
                className="im-field__input"
                value={chartStyle}
                onChange={(event) => setChartStyle(event.target.value)}
              >
                <option value="bar">Bar Graph</option>
                <option value="line">Line Graph</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
