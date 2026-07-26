import React from 'react';

const formatCell = (value) => {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const PreviewResultGrid = ({ result, error, loading }) => {
  if (loading) {
    return <div className="aqm-preview__status">Running query...</div>;
  }

  if (error) {
    return <div className="aqm-preview__status aqm-preview__status--error">{error}</div>;
  }

  if (!result) {
    return <div className="aqm-preview__status">Run the query to preview results.</div>;
  }

  const { columns = [], rows = [], rowCount = 0, durationMs = 0, truncated = false } = result;

  return (
    <div className="aqm-preview">
      <div className="aqm-preview__meta">
        {rowCount} row{rowCount === 1 ? '' : 's'} in {durationMs}ms
        {truncated && <span className="aqm-preview__truncated"> - truncated at row limit</span>}
      </div>
      <div className="aqm-preview__grid-wrap">
        <table className="aqm-preview__grid">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.name}>{column.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column.name}>{formatCell(row[column.name])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreviewResultGrid;
