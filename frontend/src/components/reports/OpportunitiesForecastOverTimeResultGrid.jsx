import React from 'react';

const COLUMNS = [
  { key: 'rowNumber', label: '#', width: 46 },
  { key: 'PeriodLabel', label: 'Period', width: 220 },
  { key: 'OpenAmount', label: 'Open Amount', numeric: true, format: 'amount', width: 220 },
  { key: 'TotalOpen', label: 'Total Open', numeric: true, format: 'count', width: 180 },
  { key: 'TotalWon', label: 'Total Won', numeric: true, format: 'count', width: 180 },
  { key: 'TotalLost', label: 'Total Lost', numeric: true, format: 'count', width: 180 },
  { key: 'TotalClosed', label: 'Total Closed', numeric: true, format: 'count', width: 180 },
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

const formatCell = (row, column, index) => {
  if (column.key === 'rowNumber') return index + 1;
  if (column.format === 'amount') return formatAmount(row[column.key]);
  if (column.format === 'count') return formatCount(row[column.key]);
  return row[column.key] || '';
};

export default function OpportunitiesForecastOverTimeResultGrid({ data = [], loading = false }) {
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

  const totalOpenAmount = data.reduce((sum, row) => sum + Number(row.OpenAmount || 0), 0);
  const totalOpen = data.reduce((sum, row) => sum + Number(row.TotalOpen || 0), 0);
  const totalWon = data.reduce((sum, row) => sum + Number(row.TotalWon || 0), 0);
  const totalLost = data.reduce((sum, row) => sum + Number(row.TotalLost || 0), 0);
  const totalClosed = data.reduce((sum, row) => sum + Number(row.TotalClosed || 0), 0);

  return (
    <div className="sales-analysis-report__grid-wrap opp-grid-wrap sap-report-grid-wrap">
      <table className="sales-analysis-report__grid sap-report-grid opp-grid opp-over-time-grid">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} className={column.numeric ? 'is-numeric' : ''} style={{ width: column.width }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={`${row.PeriodLabel || 'period'}-${index}`}>
              {COLUMNS.map((column) => (
                <td key={column.key} className={column.numeric ? 'is-numeric' : ''}>
                  {formatCell(row, column, index)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="opp-total-row">
            <td />
            <td>Total</td>
            <td className="is-numeric">{formatAmount(totalOpenAmount)}</td>
            <td className="is-numeric">{formatCount(totalOpen)}</td>
            <td className="is-numeric">{formatCount(totalWon)}</td>
            <td className="is-numeric">{formatCount(totalLost)}</td>
            <td className="is-numeric">{formatCount(totalClosed)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
