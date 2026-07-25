import React from 'react';

const DEFAULT_EMPTY_COLUMNS_MESSAGE = 'No columns configured';
const DEFAULT_EMPTY_ROWS_MESSAGE = 'No rows found';

const getColumnWidth = (column = {}) => (
  Number(column.width) || Number(column.minWidth) || 125
);

const getVisibleColumns = (columns = []) => (
  (columns || [])
    .filter((column) => column?.visible !== false)
    .sort((left, right) => (Number(left.columnOrder ?? left.order ?? 0) - Number(right.columnOrder ?? right.order ?? 0)))
);

export default function DocumentLinesTable({
  rows = [],
  columns = [],
  loading = false,
  error = '',
  onCellChange,
  readOnly = false,
  renderCell,
  rowKey,
  renderTrailingHeaderCell,
  renderTrailingCell,
  emptyColumnsMessage = DEFAULT_EMPTY_COLUMNS_MESSAGE,
  emptyRowsMessage = DEFAULT_EMPTY_ROWS_MESSAGE,
}) {
  const visibleColumns = React.useMemo(
    () => getVisibleColumns(columns),
    [columns],
  );

  const trailingColumnWidth = renderTrailingCell ? 48 : 0;
  const minTableWidth = visibleColumns.reduce((sum, column) => sum + getColumnWidth(column), trailingColumnWidth);

  if (error) {
    return (
      <div className="so-grid-wrap so-grid-wrap--contents">
        <div className="so-grid-wrap__scroller so-grid-wrap__scroller--contents">
          <div style={{ padding: 18, color: '#c62828', fontSize: 12 }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="so-grid-wrap so-grid-wrap--contents">
      <div className="so-grid-wrap__scroller so-grid-wrap__scroller--contents">
        <table
          className="so-grid so-grid--contents"
          style={{ width: 'max-content', minWidth: Math.max(minTableWidth, 320) }}
        >
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={column.key || column.fieldName} style={{ width: getColumnWidth(column) }} />
            ))}
            {renderTrailingCell ? <col style={{ width: trailingColumnWidth }} /> : null}
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column.key || column.fieldName} style={{ minWidth: getColumnWidth(column) }}>
                  {column.columnTitle || column.label || column.fieldName || column.key}
                </th>
              ))}
              {renderTrailingHeaderCell ? renderTrailingHeaderCell() : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length + (renderTrailingCell ? 1 : 0)} style={{ padding: 18, textAlign: 'center', color: '#5b6572' }}>
                  Loading...
                </td>
              </tr>
            ) : !visibleColumns.length ? (
              <tr>
                <td colSpan={1 + (renderTrailingCell ? 1 : 0)} style={{ padding: 18, textAlign: 'center', color: '#5b6572' }}>
                  {emptyColumnsMessage}
                </td>
              </tr>
            ) : !rows.length ? (
              <tr>
                <td colSpan={visibleColumns.length + (renderTrailingCell ? 1 : 0)} style={{ padding: 18, textAlign: 'center', color: '#5b6572' }}>
                  {emptyRowsMessage}
                </td>
              </tr>
            ) : rows.map((row, rowIndex) => (
              <tr key={typeof rowKey === 'function' ? rowKey(row, rowIndex) : (row?.[rowKey] ?? rowIndex)}>
                {visibleColumns.map((column) => {
                  if (typeof renderCell === 'function') {
                    const rendered = renderCell(column, row, rowIndex, {
                      onCellChange,
                      readOnly,
                    });
                    if (rendered !== undefined && rendered !== null) {
                      return rendered;
                    }
                  }

                  return (
                    <td key={column.key || column.fieldName}>
                      {row?.[column.fieldName] ?? ''}
                    </td>
                  );
                })}
                {renderTrailingCell ? renderTrailingCell(row, rowIndex) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
