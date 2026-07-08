import React from 'react';

const COLUMNS = [
  { key: 'rowNumber', label: '#', numeric: true },
  { key: 'OpprID', label: 'Oppr. No.' },
  { key: 'OpprName', label: 'Oppr. Name' },
  { key: 'CardCode', label: 'BP Code' },
  { key: 'CardName', label: 'BP Name' },
  { key: 'LastSalesEmp', label: 'Last Sales Emp.' },
  { key: 'LastStage', label: 'Last Stage' },
  { key: 'StatusName', label: 'Status' },
  { key: 'ClosingPercent', label: 'Closing %', numeric: true, format: 'percent' },
  { key: 'PotentialAmount', label: 'Potential Amount (LC)', numeric: true, format: 'amount' },
];

const formatAmount = (value) =>
  Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatPercent = (value) => {
  const percent = Number(value || 0);
  return percent ? percent.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '';
};

const formatCell = (row, column, index) => {
  if (column.key === 'rowNumber') return index + 1;
  if (column.format === 'amount') return formatAmount(row[column.key]);
  if (column.format === 'percent') return formatPercent(row[column.key]);
  return row[column.key] || '';
};

export default function OpportunitiesReportResultGrid({ data = [], loading = false }) {
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

  return (
    <div className="sales-analysis-report__grid-wrap opp-grid-wrap sap-report-grid-wrap">
      <table className="sales-analysis-report__grid sap-report-grid opp-grid opp-report-grid">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} className={column.numeric ? 'is-numeric' : ''}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={`${row.OpprID || 'opp'}-${index}`}>
              {COLUMNS.map((column) => (
                <td key={column.key} className={column.numeric ? 'is-numeric' : ''}>
                  {formatCell(row, column, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
