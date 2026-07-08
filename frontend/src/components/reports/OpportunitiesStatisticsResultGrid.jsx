import React from 'react';

const METRIC_COLUMNS = [
  { key: 'Total', label: 'Total', format: 'count' },
  { key: 'TotalOpen', label: 'Total Open', format: 'count' },
  { key: 'TotalWon', label: 'Total Won', format: 'count' },
  { key: 'TotalLost', label: 'Total Lost', format: 'count' },
  { key: 'TotalClosed', label: 'Total Closed', format: 'count' },
  { key: 'SuccessPercent', label: 'Success %', format: 'percent' },
  { key: 'PotentialOpenAmount', label: 'Pot. Open Amount', format: 'amount' },
  { key: 'WeightedOpenAmount', label: 'Weighted Open Amt', format: 'amount' },
  { key: 'WonAmount', label: 'Won Amount', format: 'amount' },
  { key: 'LostAmount', label: 'Lost Amount', format: 'amount' },
];

const formatAmount = (value) =>
  Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatCount = (value) => {
  const count = Number(value || 0);
  return count ? count.toLocaleString('en-IN') : '';
};

const formatPercent = (value) => {
  const percent = Number(value || 0);
  return percent ? percent.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '';
};

const formatMetric = (row, column) => {
  if (column.format === 'amount') return formatAmount(row[column.key]);
  if (column.format === 'percent') return formatPercent(row[column.key]);
  return formatCount(row[column.key]);
};

const buildColumns = (groupLabels = {}) => {
  const columns = [
    { key: 'rowNumber', label: '#', numeric: true, compact: true },
    { key: 'Group1Code', label: groupLabels.group1Label || 'BP Code' },
    { key: 'Group1Name', label: groupLabels.group1NameLabel || 'BP Name' },
  ];

  if (groupLabels.group2Label) {
    columns.push(
      { key: 'Group2Code', label: groupLabels.group2Label },
      { key: 'Group2Name', label: groupLabels.group2NameLabel || groupLabels.group2Label },
    );
  }

  return [...columns, ...METRIC_COLUMNS.map((column) => ({ ...column, numeric: true }))];
};

export default function OpportunitiesStatisticsResultGrid({ data = [], groupLabels = {}, loading = false }) {
  if (loading) {
    return (
      <div className="sales-analysis-report__grid-wrap opp-grid-wrap">
        <div className="sales-analysis-report__empty">Loading report data...</div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="sales-analysis-report__grid-wrap opp-grid-wrap">
        <div className="sales-analysis-report__empty">No records found matching the criteria.</div>
      </div>
    );
  }

  const columns = buildColumns(groupLabels);
  const groupColumnCount = columns.length - METRIC_COLUMNS.length;
  const totals = METRIC_COLUMNS.reduce((summary, column) => {
    summary[column.key] = data.reduce((sum, row) => sum + Number(row[column.key] || 0), 0);
    return summary;
  }, {});

  totals.SuccessPercent = totals.TotalClosed ? (totals.TotalWon * 100) / totals.TotalClosed : 0;

  return (
    <div className="sales-analysis-report__grid-wrap opp-grid-wrap sap-report-grid-wrap">
      <table className="sales-analysis-report__grid sap-report-grid opp-grid opp-statistics-grid">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.numeric ? 'is-numeric' : ''}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={`${row.Group1Code || row.Group1Name || 'group'}-${row.Group2Code || row.Group2Name || 'none'}-${index}`}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? 'is-numeric' : ''}>
                  {column.key === 'rowNumber'
                    ? index + 1
                    : column.format
                      ? formatMetric(row, column)
                      : row[column.key] || ''}
                </td>
              ))}
            </tr>
          ))}
          <tr className="opp-total-row">
            <td colSpan={groupColumnCount}>Total</td>
            {METRIC_COLUMNS.map((column) => (
              <td key={column.key} className="is-numeric">
                {formatMetric(totals, column)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
