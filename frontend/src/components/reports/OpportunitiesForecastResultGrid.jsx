import React, { useMemo } from 'react';

const COLUMNS = [
  { key: 'OpprID', label: 'Opportunity No.' },
  { key: 'OpprName', label: 'Opportunity Name' },
  { key: 'CardCode', label: 'BP Code' },
  { key: 'CardName', label: 'BP Name' },
  { key: 'Territory', label: 'Territory' },
  { key: 'Industry', label: 'Industry' },
  { key: 'SourceName', label: 'Source' },
  { key: 'PotentialAmount', label: 'Potential Amount (LC)', numeric: true, format: 'amount' },
  { key: 'WeightedAmount', label: 'Weighted Amount (LC)', numeric: true, format: 'amount' },
  { key: 'ClosingPercent', label: 'Closing %', numeric: true, format: 'percent' },
  { key: 'PredictedAmount', label: 'Predicted Closing', numeric: true, format: 'amount' },
  { key: 'ClosingDate', label: 'Closing Date', format: 'date' },
  { key: 'LastStage', label: 'Last Stage' },
  { key: 'MainSalesEmp', label: 'Main Sales Emp.' },
  { key: 'LastSalesEmp', label: 'Last Sales Emp.' },
  { key: 'ProjectCode', label: 'Project' },
];

const GROUP_LABELS = {
  CardCode: 'Business Partner',
  Territory: 'Territories',
  MainSalesEmp: 'Main Sales Emp.',
  LastSalesEmp: 'Last Sales Emp.',
  LastStage: 'Stages',
  Industry: 'Industry',
  ChannelCode: 'BP Channel Code',
  InterestLevel: 'Level of Interest',
  SourceName: 'Sources',
  PartnerName: 'Partners',
  CompetitorName: 'Competitors',
  ProjectCode: 'Project',
};

const formatAmount = (value) =>
  Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN');
};

const formatCell = (row, column) => {
  const value = row[column.key];
  if (column.format === 'amount') return formatAmount(value);
  if (column.format === 'percent') return formatPercent(value);
  if (column.format === 'date') return formatDate(value);
  return value || '';
};

const groupRows = (rows, groupBy1, groupBy2) => {
  if (!groupBy1) return new Map([['', rows]]);
  const grouped = new Map();

  rows.forEach((row) => {
    const key1 = String(row[groupBy1] || 'Blank');
    if (!grouped.has(key1)) grouped.set(key1, groupBy2 ? new Map() : []);

    if (!groupBy2) {
      grouped.get(key1).push(row);
      return;
    }

    const childGroups = grouped.get(key1);
    const key2 = String(row[groupBy2] || 'Blank');
    if (!childGroups.has(key2)) childGroups.set(key2, []);
    childGroups.get(key2).push(row);
  });

  return grouped;
};

const calculateTotals = (rows = []) => ({
  totalPotential: rows.reduce((sum, row) => sum + Number(row.PotentialAmount || 0), 0),
  totalWeighted: rows.reduce((sum, row) => sum + Number(row.WeightedAmount || 0), 0),
  totalPredicted: rows.reduce((sum, row) => sum + Number(row.PredictedAmount || 0), 0),
  avgClosing: rows.length
    ? rows.reduce((sum, row) => sum + Number(row.ClosingPercent || 0), 0) / rows.length
    : 0,
});

function DataRow({ row }) {
  return (
    <tr>
      {COLUMNS.map((column) => (
        <td key={column.key} className={column.numeric ? 'is-numeric' : ''}>
          {formatCell(row, column)}
        </td>
      ))}
    </tr>
  );
}

function TotalRow({ label, rows }) {
  const totals = calculateTotals(rows);
  return (
    <tr className="opp-total-row">
      <td colSpan="7">{label}</td>
      <td className="is-numeric">{formatAmount(totals.totalPotential)}</td>
      <td className="is-numeric">{formatAmount(totals.totalWeighted)}</td>
      <td className="is-numeric">{formatPercent(totals.avgClosing)}</td>
      <td className="is-numeric">{formatAmount(totals.totalPredicted)}</td>
      <td colSpan="5" />
    </tr>
  );
}

export default function OpportunitiesForecastResultGrid({ data = [], groupBy1 = '', groupBy2 = '', loading = false }) {
  const grouped = useMemo(() => groupRows(data, groupBy1, groupBy2), [data, groupBy1, groupBy2]);

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

  const renderGroupedRows = () => {
    if (!groupBy1) {
      return (
        <>
          {data.map((row, index) => <DataRow key={`${row.OpprID || 'opp'}-${index}`} row={row} />)}
          <TotalRow label="Total" rows={data} />
        </>
      );
    }

    return Array.from(grouped.entries()).map(([groupKey, groupValue]) => {
      if (!groupBy2) {
        const rows = groupValue;
        return (
          <React.Fragment key={groupKey}>
            <tr className="opp-group-row">
              <td colSpan={COLUMNS.length}>{GROUP_LABELS[groupBy1] || groupBy1}: {groupKey}</td>
            </tr>
            {rows.map((row, index) => <DataRow key={`${groupKey}-${row.OpprID || index}`} row={row} />)}
            <TotalRow label={`Subtotal - ${groupKey}`} rows={rows} />
          </React.Fragment>
        );
      }

      const allRows = Array.from(groupValue.values()).flat();
      return (
        <React.Fragment key={groupKey}>
          <tr className="opp-group-row">
            <td colSpan={COLUMNS.length}>{GROUP_LABELS[groupBy1] || groupBy1}: {groupKey}</td>
          </tr>
          {Array.from(groupValue.entries()).map(([childKey, childRows]) => (
            <React.Fragment key={`${groupKey}-${childKey}`}>
              <tr className="opp-group-row opp-group-row--child">
                <td colSpan={COLUMNS.length}>{GROUP_LABELS[groupBy2] || groupBy2}: {childKey}</td>
              </tr>
              {childRows.map((row, index) => <DataRow key={`${groupKey}-${childKey}-${row.OpprID || index}`} row={row} />)}
              <TotalRow label={`Subtotal - ${childKey}`} rows={childRows} />
            </React.Fragment>
          ))}
          <TotalRow label={`Total - ${groupKey}`} rows={allRows} />
        </React.Fragment>
      );
    });
  };

  return (
    <div className="sales-analysis-report__grid-wrap opp-grid-wrap sap-report-grid-wrap">
      <table className="sales-analysis-report__grid sap-report-grid opp-grid">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} className={column.numeric ? 'is-numeric' : ''}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{renderGroupedRows()}</tbody>
      </table>
    </div>
  );
}
