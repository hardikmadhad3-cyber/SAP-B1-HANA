import React, { useRef } from 'react';

const COLUMN_ORDER = [
  'itemCode',
  'itemDescription',
  'fromWarehouse',
  'toWarehouse',
  'location',
  'quantity',
  'distributionRule',
  'uomCode',
  'uomName',
  'branch',
  'assessableValue',
];

const COLUMN_LABELS = {
  itemCode: 'Item No',
  itemDescription: 'Item Description',
  fromWarehouse: 'From Warehouse',
  toWarehouse: 'To Warehouse',
  location: 'Loc.',
  quantity: 'Quantity',
  distributionRule: 'Distr. Rule',
  uomCode: 'UoM Code',
  uomName: 'UoM Name',
  branch: 'To Branch',
  assessableValue: 'Assessable Value',
};

const READ_ONLY_COLUMNS = new Set([
  'itemDescription',
  'uomCode',
  'uomName',
  'branch',
  'assessableValue',
]);

const NUMERIC_COLUMNS = new Set(['quantity', 'assessableValue']);

function ContentsTab({
  lines,
  fromWarehouses,
  warehouses,
  activeRow,
  onFocusRow,
  onItemCodeChange,
  onItemCommit,
  onOpenItemModal,
  onFieldChange,
  onAddLine,
  onRemoveLine,
  errors,
  getBranchDisplay = () => '',
}) {
  const inputRefs = useRef({});

  const focusCell = (rowIndex, columnKey) => {
    const target = inputRefs.current[`${rowIndex}:${columnKey}`];
    if (target) {
      target.focus();
      target.select?.();
    }
  };

  const handleCellKeyDown = (event, rowIndex, columnKey) => {
    const columnIndex = COLUMN_ORDER.indexOf(columnKey);
    if (columnIndex === -1) return;

    if (event.key === 'ArrowRight' || event.key === 'Tab') {
      event.preventDefault();
      const nextColumn = COLUMN_ORDER[columnIndex + 1];
      if (nextColumn) {
        focusCell(rowIndex, nextColumn);
        return;
      }
      if (lines[rowIndex + 1]) {
        focusCell(rowIndex + 1, COLUMN_ORDER[0]);
        return;
      }
      onAddLine();
      requestAnimationFrame(() => focusCell(rowIndex + 1, COLUMN_ORDER[0]));
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const previousColumn = COLUMN_ORDER[columnIndex - 1];
      if (previousColumn) {
        focusCell(rowIndex, previousColumn);
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      if (lines[rowIndex + 1]) {
        focusCell(rowIndex + 1, columnKey);
        return;
      }
      onAddLine();
      requestAnimationFrame(() => focusCell(rowIndex + 1, columnKey));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (rowIndex > 0) {
        focusCell(rowIndex - 1, columnKey);
      }
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div className="po-section-title" style={{ marginBottom: 0 }}>
          Transfer Lines
        </div>
        <button type="button" className="po-btn po-btn--primary" onClick={onAddLine}>
          + Add Line
        </button>
      </div>

      <div className="po-grid-wrap itr-transfer-request__grid-wrap">
        <table className="po-grid itr-transfer-request__grid">
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              {COLUMN_ORDER.map((columnKey) => (
                <th key={columnKey}>{COLUMN_LABELS[columnKey]}</th>
              ))}
              <th style={{ width: 34 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, rowIndex) => {
              const rowErrors = errors[rowIndex] || {};

              return (
                <tr
                  key={`${rowIndex}-${line.itemCode || 'blank'}`}
                  className={activeRow === rowIndex ? 'itr-transfer-request__row--active' : ''}
                >
                  <td className="po-grid__cell--muted" style={{ textAlign: 'center' }}>
                    {rowIndex + 1}
                  </td>

                  <td>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <input
                        ref={(node) => {
                          inputRefs.current[`${rowIndex}:itemCode`] = node;
                        }}
                        className={`po-grid__input po-grid__input--text ${
                          rowErrors.itemCode ? 'itr-transfer-request__input--error' : ''
                        }`}
                        value={line.itemCode}
                        placeholder="Item Code"
                        onFocus={() => onFocusRow(rowIndex)}
                        onChange={(event) => onItemCodeChange(rowIndex, event.target.value)}
                        onBlur={() => onItemCommit(rowIndex)}
                        onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 'itemCode')}
                      />
                      <button
                        type="button"
                        onClick={() => onOpenItemModal(rowIndex)}
                        style={{
                          padding: '0 6px',
                          fontSize: 11,
                          border: '1px solid #a0aab4',
                          background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)',
                          minWidth: 24,
                          height: 22,
                          cursor: 'pointer',
                          borderRadius: 2,
                        }}
                        title="Select Item"
                      >
                        ...
                      </button>
                    </div>
                    {rowErrors.itemCode && (
                      <div className="po-error-feedback">{rowErrors.itemCode}</div>
                    )}
                  </td>

                  {COLUMN_ORDER.slice(1).map((columnKey) => {
                    if (columnKey === 'fromWarehouse' || columnKey === 'toWarehouse') {
                      const warehouseOptions =
                        columnKey === 'fromWarehouse' ? fromWarehouses : warehouses;
                      const errorKey =
                        columnKey === 'fromWarehouse' ? 'fromWarehouse' : 'toWarehouse';

                      return (
                        <td key={columnKey}>
                          <select
                            ref={(node) => {
                              inputRefs.current[`${rowIndex}:${columnKey}`] = node;
                            }}
                            className={`po-grid__input po-grid__input--text ${
                              rowErrors[errorKey]
                                ? 'itr-transfer-request__input--error'
                                : ''
                            }`}
                            value={line[columnKey]}
                            onFocus={() => onFocusRow(rowIndex)}
                            onChange={(event) =>
                              onFieldChange(rowIndex, columnKey, event.target.value)
                            }
                            onKeyDown={(event) =>
                              handleCellKeyDown(event, rowIndex, columnKey)
                            }
                          >
                            <option value="">Select</option>
                            {warehouseOptions.map((warehouse) => (
                              <option key={warehouse.whsCode} value={warehouse.whsCode}>
                                {warehouse.whsCode} - {warehouse.whsName}
                              </option>
                            ))}
                          </select>
                          {rowErrors[errorKey] && (
                            <div className="po-error-feedback">{rowErrors[errorKey]}</div>
                          )}
                        </td>
                      );
                    }

                    const readOnly = READ_ONLY_COLUMNS.has(columnKey);
                    const displayValue =
                      columnKey === 'branch'
                        ? getBranchDisplay(line.toWarehouse, line.branch)
                        : line[columnKey] ?? '';

                    return (
                      <td key={columnKey}>
                        <input
                          ref={(node) => {
                            inputRefs.current[`${rowIndex}:${columnKey}`] = node;
                          }}
                          className={`po-grid__input ${
                            NUMERIC_COLUMNS.has(columnKey) ? '' : 'po-grid__input--text'
                          } ${rowErrors[columnKey] ? 'itr-transfer-request__input--error' : ''}`}
                          value={displayValue}
                          readOnly={readOnly}
                          onFocus={() => onFocusRow(rowIndex)}
                          onChange={(event) =>
                            onFieldChange(rowIndex, columnKey, event.target.value)
                          }
                          onKeyDown={(event) => handleCellKeyDown(event, rowIndex, columnKey)}
                        />
                        {rowErrors[columnKey] && (
                          <div className="po-error-feedback">{rowErrors[columnKey]}</div>
                        )}
                      </td>
                    );
                  })}

                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="po-btn po-btn--danger"
                      style={{ padding: '1px 7px' }}
                      onClick={() => onRemoveLine(rowIndex)}
                    >
                      x
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ContentsTab;
