import React, { useMemo, useRef } from 'react';
import { exportReportAsExcel, exportReportAsPdf } from '../../utils/reportExportUtils';
import useFloatingWindow from './useFloatingWindow';

const GRAPH_TYPE_OPTIONS = [
  { value: 'line', label: 'Line Graph' },
  { value: 'drawLine', label: 'Draw Line Graph' },
  { value: 'bar', label: 'Bar Graph' },
  { value: 'spline', label: 'Spline Graph' },
];

const SERIES_CONFIG = [
  { key: 'grossProfit', label: 'Gross Profit', color: '#f1c84e' },
  { key: 'appliedAmount', label: 'Applied Amount', color: '#b7d75e' },
  { key: 'salesAmount', label: 'Sales Amount', color: '#6e8fd5' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTER_LABELS = ['I', 'II', 'III', 'IV'];

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getFullYear()).slice(-2),
  ].join('/');
};

const formatAmount = (value, currencyCode = '') => {
  const formatted = Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return currencyCode ? `${currencyCode} ${formatted}` : formatted;
};

const buildSplinePath = (points = []) => {
  if (points.length < 2) return '';

  const [firstPoint, ...restPoints] = points;
  let path = `M ${firstPoint.x} ${firstPoint.y}`;

  for (let index = 0; index < restPoints.length; index += 1) {
    const currentPoint = restPoints[index];
    const previousPoint = index === 0 ? firstPoint : restPoints[index - 1];
    const controlX = (previousPoint.x + currentPoint.x) / 2;
    path += ` C ${controlX} ${previousPoint.y}, ${controlX} ${currentPoint.y}, ${currentPoint.x} ${currentPoint.y}`;
  }

  return path;
};

function SalesAnalysisChart({
  labels,
  series,
  graphType,
  width,
  height,
  showLegend = false,
}) {
  const margin = {
    top: 14,
    right: 10,
    bottom: showLegend ? 50 : 28,
    left: 26,
  };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(
    1,
    ...series.flatMap((item) => item.values.map((value) => Number(value || 0))),
  );
  const roundedMax = Math.ceil(maxValue / 50) * 50;

  const categoryStep = labels.length > 1 ? plotWidth / (labels.length - 1) : plotWidth;
  const barGroupWidth = labels.length ? plotWidth / labels.length : plotWidth;
  const barWidth = Math.min(18, barGroupWidth / Math.max(series.length + 1, 4));

  const getY = (value) => margin.top + plotHeight - ((Number(value || 0) / roundedMax) * plotHeight);
  const getX = (index) =>
    graphType === 'bar'
      ? margin.left + (index * barGroupWidth)
      : margin.left + (index * categoryStep);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales analysis diagram">
      <rect x="0" y="0" width={width} height={height} fill="#dfeaf5" stroke="#b7cde2" />

      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = margin.top + (plotHeight * ratio);
        return (
          <line
            key={ratio}
            x1={margin.left}
            y1={y}
            x2={width - margin.right}
            y2={y}
            stroke="#c5d7e8"
            strokeWidth="1"
          />
        );
      })}

      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="#8fa5bc" strokeWidth="2" />
      <line
        x1={margin.left}
        y1={margin.top + plotHeight}
        x2={width - margin.right}
        y2={margin.top + plotHeight}
        stroke="#8fa5bc"
        strokeWidth="2"
      />

      <text x="4" y={margin.top + 8} fill="#294764" fontSize="11">{roundedMax}</text>
      <text x="10" y={margin.top + plotHeight + 4} fill="#294764" fontSize="11">0</text>

      {labels.map((label, index) => {
        const x = graphType === 'bar'
          ? margin.left + (index * barGroupWidth) + (barGroupWidth / 2)
          : getX(index);
        return (
          <text
            key={label}
            x={x}
            y={margin.top + plotHeight + (showLegend ? 18 : 20)}
            textAnchor="middle"
            fill="#233f5c"
            fontSize="11"
          >
            {label}
          </text>
        );
      })}

      {graphType === 'bar'
        ? labels.map((label, index) => (
          <g key={label}>
            {series.map((item, seriesIndex) => {
              const value = Number(item.values[index] || 0);
              const rectHeight = (value / roundedMax) * plotHeight;
              const x = margin.left + (index * barGroupWidth) + (seriesIndex * (barWidth + 3)) + 8;
              const y = margin.top + plotHeight - rectHeight;

              return (
                <rect
                  key={`${item.key}-${label}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={rectHeight}
                  fill={item.color}
                  stroke="#8aa4bc"
                />
              );
            })}
          </g>
        ))
        : series.map((item) => {
          const points = item.values.map((value, index) => ({
            x: getX(index),
            y: getY(value),
          }));

          return (
            <g key={item.key}>
              <path
                d={
                  graphType === 'spline'
                    ? buildSplinePath(points)
                    : `M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')}`
                }
                fill="none"
                stroke={item.color}
                strokeWidth="2.2"
              />
              {graphType === 'drawLine'
                ? points.map((point, index) => (
                  <rect
                    key={`${item.key}-${labels[index]}`}
                    x={point.x - 3}
                    y={point.y - 3}
                    width="6"
                    height="6"
                    fill={item.color}
                    stroke="#7d93a9"
                  />
                ))
                : null}
            </g>
          );
        })}

      {showLegend ? (
        <g transform={`translate(${margin.left + 48}, ${height - 8})`}>
          {series.map((item, index) => (
            <g key={item.key} transform={`translate(${index * 132}, 0)`}>
              <rect x="0" y="-9" width="10" height="10" fill={item.color} stroke="#8aa4bc" />
              <text x="16" y="0" fill="#233f5c" fontSize="11">{item.label}</text>
            </g>
          ))}
        </g>
      ) : null}
    </svg>
  );
}

function SalesAnalysisDetailModal({
  isOpen,
  isLoading,
  report,
  companyName,
  dateRanges,
  documentLabel,
  graphType,
  onGraphTypeChange,
  printDiagram,
  onPrintDiagramChange,
  onOpenDocument,
  onOpenCustomer,
  onExportError,
  onClose,
}) {
  const quarterChartRef = useRef(null);
  const monthChartRef = useRef(null);
  const windowFrame = useFloatingWindow({ isOpen, defaultTop: 20 });
  const chartSeries = useMemo(() => {
    const baseQuarterValues = {
      grossProfit: [0, 0, 0, 0],
      appliedAmount: [0, 0, 0, 0],
      salesAmount: [0, 0, 0, 0],
    };

    const baseMonthValues = {
      grossProfit: new Array(12).fill(0),
      appliedAmount: new Array(12).fill(0),
      salesAmount: new Array(12).fill(0),
    };

    (report?.rows || []).forEach((row) => {
      const date = new Date(row.postingDate);
      if (Number.isNaN(date.getTime())) return;

      const monthIndex = date.getMonth();
      const quarterIndex = Math.floor(monthIndex / 3);

      baseMonthValues.salesAmount[monthIndex] += Number(row.salesAmount || 0) / 1000;
      baseMonthValues.appliedAmount[monthIndex] += Number(row.appliedAmount || 0) / 1000;
      baseMonthValues.grossProfit[monthIndex] += Number(row.grossProfit || 0) / 1000;

      baseQuarterValues.salesAmount[quarterIndex] += Number(row.salesAmount || 0) / 1000;
      baseQuarterValues.appliedAmount[quarterIndex] += Number(row.appliedAmount || 0) / 1000;
      baseQuarterValues.grossProfit[quarterIndex] += Number(row.grossProfit || 0) / 1000;
    });

    return {
      quarter: SERIES_CONFIG.map((item) => ({ ...item, values: baseQuarterValues[item.key] })),
      month: SERIES_CONFIG.map((item) => ({ ...item, values: baseMonthValues[item.key] })),
    };
  }, [report]);

  const buildDetailExportSections = () => {
    if (!printDiagram) {
      return [];
    }

    const quarterSvg = quarterChartRef.current?.innerHTML || '';
    const monthSvg = monthChartRef.current?.innerHTML || '';

    if (!quarterSvg && !monthSvg) {
      return [];
    }

    return [
      `
        <div>
          <div class="report-export__diagram-title">Diagram</div>
          <div class="report-export__diagram-grid">
            <div>${quarterSvg}</div>
            <div>${monthSvg}</div>
          </div>
          <div style="margin-top: 6px; font-size: 11px;">
            Amounts are Multiples of ${report?.currencyCode || 'INR'} 1,000.00
          </div>
        </div>
      `,
    ];
  };

  const buildDetailExportConfig = (includeSections = false) => ({
    companyName: companyName || 'SAP Business One',
    reportTitle: report?.reportTitle || 'Sales Analysis Report by Customer (Detailed)',
    documentLabel: documentLabel || '',
    criteriaRows: Object.entries({
      postingDate: 'Reference Date',
      dueDate: 'Value Date',
      documentDate: 'Document Date',
    })
      .map(([key, label]) => {
        const range = dateRanges?.[key];
        if (!range?.enabled) {
          return null;
        }

        return {
          label,
          from: String(range.from || '').trim(),
          to: String(range.to || '').trim(),
        };
      })
      .filter(Boolean),
    fileName: report?.reportTitle || 'Sales Analysis Detail',
    columns: [
      { label: '#', align: 'center' },
      { label: 'Document', align: 'left' },
      { label: 'Installment', align: 'left' },
      { label: 'Posting Date', align: 'left' },
      { label: 'Due Date', align: 'left' },
      { label: 'Customer Name', align: 'left' },
      { label: 'Sales Amount', align: 'right' },
      { label: 'Applied Amount', align: 'right' },
      { label: 'Gross Profit', align: 'right' },
      { label: 'Gross Profit %', align: 'right' },
      { label: 'Agreement No.', align: 'left' },
    ],
    rows: (report?.rows || []).map((row) => ([
      { value: row.rowNumber, align: 'center' },
      row.document,
      row.installment,
      formatDate(row.postingDate),
      formatDate(row.dueDate),
      row.customerName,
      { value: formatAmount(row.salesAmount, report?.currencyCode), align: 'right' },
      { value: formatAmount(row.appliedAmount, report?.currencyCode), align: 'right' },
      { value: formatAmount(row.grossProfit, report?.currencyCode), align: 'right' },
      { value: Number(row.grossProfitPercent || 0).toFixed(3), align: 'right' },
      row.agreementNumber,
    ])),
    footer: [
      { value: '', colSpan: 6 },
      { value: formatAmount(report?.totals?.salesAmount, report?.currencyCode), align: 'right' },
      { value: formatAmount(report?.totals?.appliedAmount, report?.currencyCode), align: 'right' },
      { value: formatAmount(report?.totals?.grossProfit, report?.currencyCode), align: 'right' },
      { value: Number(report?.totals?.grossProfitPercent || 0).toFixed(3), align: 'right' },
      '',
    ],
    sections: includeSections ? buildDetailExportSections() : [],
  });

  const handleExportExcel = () => {
    try {
      exportReportAsExcel(buildDetailExportConfig(false));
    } catch (error) {
      onExportError?.(error?.message || 'Could not export the detailed report to Excel.');
    }
  };

  const handleExportPdf = () => {
    try {
      exportReportAsPdf(buildDetailExportConfig(true));
    } catch (error) {
      onExportError?.(error?.message || 'Could not export the detailed report to PDF.');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="sales-analysis-detail-modal__backdrop">
      <div
        className={`sales-analysis-detail-modal${windowFrame.isMinimized ? ' is-minimized' : ''}`}
        {...windowFrame.windowProps}
      >
        <div className="sales-analysis-detail-modal__titlebar" {...windowFrame.titleBarProps}>
          <div className="sales-analysis-detail-modal__title">
            {report?.reportTitle || 'Sales Analysis Report by Customer (Detailed)'}
          </div>
          <div className="sales-analysis-detail-modal__controls">
            <button
              type="button"
              aria-label={windowFrame.isMinimized ? 'Restore' : 'Minimize'}
              onClick={windowFrame.toggleMinimize}
            >
              {windowFrame.isMinimized ? '□' : '-'}
            </button>
            <button type="button" aria-label="Restore">□</button>
            <button type="button" aria-label="Close" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="sales-analysis-detail-modal__accent" />

        {!windowFrame.isMinimized ? (
          <div className="sales-analysis-detail-modal__body">
          {isLoading ? (
            <div className="sales-analysis-detail-modal__loading">Loading detailed report...</div>
          ) : (
            <>
              <div className="sales-analysis-detail-modal__grid-wrap">
                <table className="sales-analysis-detail-modal__grid">
                  <thead>
                    <tr>
                      <th className="is-index">#</th>
                      <th>Document</th>
                      <th>Installment</th>
                      <th>Posting Date</th>
                      <th>Due Date</th>
                      <th>Customer Name</th>
                      <th>Sales Amount</th>
                      <th>Applied Amount</th>
                      <th>Gross Profit</th>
                      <th>Gross Profit %</th>
                      <th>Agreement No.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report?.rows || []).map((row) => (
                      <tr key={`${row.document}-${row.rowNumber}`}>
                        <td className="is-index">{row.rowNumber}</td>
                        <td>
                          <button
                            type="button"
                            className="sales-analysis-detail-modal__link-cell"
                            onClick={() => onOpenDocument?.(row)}
                          >
                            <span className="sales-analysis-detail-modal__link-icon" aria-hidden="true">
                              ➜
                            </span>
                            <span>{row.document}</span>
                          </button>
                        </td>
                        <td>{row.installment}</td>
                        <td>{formatDate(row.postingDate)}</td>
                        <td>{formatDate(row.dueDate)}</td>
                        <td>
                          <button
                            type="button"
                            className="sales-analysis-detail-modal__link-cell"
                            onClick={() => onOpenCustomer?.(row)}
                          >
                            <span className="sales-analysis-detail-modal__link-icon" aria-hidden="true">
                              ➜
                            </span>
                            <span>{row.customerName}</span>
                          </button>
                        </td>
                        <td className="is-numeric">{formatAmount(row.salesAmount, report?.currencyCode)}</td>
                        <td className="is-numeric">{formatAmount(row.appliedAmount, report?.currencyCode)}</td>
                        <td className="is-numeric">{formatAmount(row.grossProfit, report?.currencyCode)}</td>
                        <td className="is-numeric">{Number(row.grossProfitPercent || 0).toFixed(2)}</td>
                        <td>{row.agreementNumber}</td>
                      </tr>
                    ))}
                    {!report?.rows?.length ? (
                      <tr>
                        <td colSpan="11" className="sales-analysis-detail-modal__empty">
                          No detailed rows are available for this customer.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="6">&nbsp;</td>
                      <td className="is-numeric">{formatAmount(report?.totals?.salesAmount, report?.currencyCode)}</td>
                      <td className="is-numeric">{formatAmount(report?.totals?.appliedAmount, report?.currencyCode)}</td>
                      <td className="is-numeric">{formatAmount(report?.totals?.grossProfit, report?.currencyCode)}</td>
                      <td className="is-numeric">{Number(report?.totals?.grossProfitPercent || 0).toFixed(3)}</td>
                      <td>&nbsp;</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="sales-analysis-detail-modal__diagram-row">
                <div className="sales-analysis-detail-modal__diagram-stack" ref={quarterChartRef}>
                  <SalesAnalysisChart
                    labels={QUARTER_LABELS}
                    series={chartSeries.quarter}
                    graphType={graphType}
                    width={180}
                    height={108}
                  />
                  <div className="sales-analysis-detail-modal__diagram-note">
                    Amounts are Multiples of {report?.currencyCode || 'INR'} 1,000.00
                  </div>
                </div>

                <div className="sales-analysis-detail-modal__diagram-main" ref={monthChartRef}>
                  <SalesAnalysisChart
                    labels={MONTH_LABELS}
                    series={chartSeries.month}
                    graphType={graphType}
                    width={430}
                    height={138}
                    showLegend
                  />
                </div>
              </div>

              <div className="sales-analysis-detail-modal__footer">
                <div className="sales-analysis-detail-modal__footer-left">
                  <button
                    type="button"
                    className="sales-analysis-report__back-btn"
                    onClick={onClose}
                    aria-label="Back"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    className="sales-analysis__sap-btn"
                    onClick={onClose}
                  >
                    OK
                  </button>
                </div>

                <div className="sales-analysis-detail-modal__footer-right">
                  <label className="sales-analysis-detail-modal__print-line">
                    <input
                      type="checkbox"
                      checked={printDiagram}
                      onChange={(event) => onPrintDiagramChange(event.target.checked)}
                    />
                    <span>Print Diagram</span>
                  </label>

                  <div className="sales-analysis-detail-modal__diagram-select">
                    <span>Diagram</span>
                    <select value={graphType} onChange={(event) => onGraphTypeChange(event.target.value)}>
                      {GRAPH_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="sales-analysis__sap-btn sales-analysis__sap-btn--secondary"
                    onClick={handleExportExcel}
                  >
                    Export Excel
                  </button>
                  <button
                    type="button"
                    className="sales-analysis__sap-btn sales-analysis__sap-btn--secondary"
                    onClick={handleExportPdf}
                  >
                    Export PDF
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default SalesAnalysisDetailModal;
