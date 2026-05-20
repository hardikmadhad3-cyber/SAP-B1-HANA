import React, { useRef } from 'react';

const COLUMN_KEYS = [
  'itemCode',
  'itemDescription',
  'quantity',
  'unitPrice',
  'total',
  'warehouse',
  'accountCode',
  'itemCost',
  'uomCode',
  'uomName',
  'distributionRule',
  'location',
  'branch',
];

const numberColumns = new Set(['quantity', 'unitPrice', 'total', 'itemCost']);

const columnLabels = {
  itemCode: 'Item No',
  itemDescription: 'Item Description',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
  total: 'Total',
  warehouse: 'Warehouse',
  accountCode: 'Account Code',
  itemCost: 'Item Cost',
  uomCode: 'UoM Code',
  uomName: 'UoM Name',
  distributionRule: 'Distribution Rule',
  location: 'Location',
  branch: 'Branch',
};

function ItemMatrix({
  lines,
  items,
  warehouses,
  activeRow,
  onFocusRow,
  onFieldChange,
  onItemChange,
  onAddRow,
  onDeleteRow,
  errors,
}) {
  const cellRefs = useRef({});

  const focusCell = (rowIndex, columnKey) => {
    const cell = cellRefs.current[`${rowIndex}:${columnKey}`];
    if (cell) {
      cell.focus();
      cell.select?.();
    }
  };

  const handleKeyDown = (event, rowIndex, columnKey) => {
    const columnIndex = COLUMN_KEYS.indexOf(columnKey);
    if (columnIndex === -1) return;

    if (event.key === 'ArrowRight' || event.key === 'Tab') {
      event.preventDefault();
      const nextColumn = COLUMN_KEYS[columnIndex + 1];
      if (nextColumn) {
        focusCell(rowIndex, nextColumn);
      } else if (lines[rowIndex + 1]) {
        focusCell(rowIndex + 1, COLUMN_KEYS[0]);
      } else {
        onAddRow();
        requestAnimationFrame(() => focusCell(rowIndex + 1, COLUMN_KEYS[0]));
      }
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const previousColumn = COLUMN_KEYS[columnIndex - 1];
      if (previousColumn) {
        focusCell(rowIndex, previousColumn);
      }
    }

    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      const nextRow = rowIndex + 1;
      if (lines[nextRow]) {
        focusCell(nextRow, columnKey);
      } else {
        onAddRow();
        requestAnimationFrame(() => focusCell(nextRow, columnKey));
      }
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previousRow = rowIndex - 1;
      if (previousRow >= 0) {
        focusCell(previousRow, columnKey);
      }
    }
  };

  const fillerRows = Math.max(0, 12 - lines.length);

  return (
    <div className="gr-document__tab-body">
      <div className="gr-document__matrix-wrap">
        <table className="gr-matrix">
          <thead>
            <tr>
              <th className="gr-matrix__index">#</th>
              {COLUMN_KEYS.map((columnKey) => (
                <th key={columnKey}>{columnLabels[columnKey]}</th>
              ))}
              <th className="gr-matrix__action"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, rowIndex) => {
              const rowErrors = errors[rowIndex] || {};
              const rowClassName = activeRow === rowIndex ? 'is-active' : '';
              const isCopiedRow = Boolean(line.lockedByCopy || line.baseEntry != null);

              return (
                <tr
                  key={`${rowIndex}-${line.itemCode}-${line.baseEntry ?? 'manual'}`}
                  className={rowClassName}
                  onFocus={() => onFocusRow(rowIndex)}
                >
                  <td className="gr-matrix__row-number">{rowIndex + 1}</td>
                  <td>
                    <select
                      ref={(node) => {
                        cellRefs.current[`${rowIndex}:itemCode`] = node;
                      }}
                      value={line.itemCode}
                      disabled={isCopiedRow}
                      className={rowErrors.itemCode ? 'has-error' : ''}
                      onFocus={() => onFocusRow(rowIndex)}
                      onChange={(event) => onItemChange(rowIndex, event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, rowIndex, 'itemCode')}
                    >
                      <option value=""></option>
                      {items.map((item) => (
                        <option key={item.itemCode} value={item.itemCode}>
                          {item.itemCode}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      ref={(node) => {
                        cellRefs.current[`${rowIndex}:itemDescription`] = node;
                      }}
                      value={line.itemDescription}
                      readOnly
                      onFocus={() => onFocusRow(rowIndex)}
                      onKeyDown={(event) => handleKeyDown(event, rowIndex, 'itemDescription')}
                    />
                  </td>
                  {COLUMN_KEYS.slice(2).map((columnKey) => {
                    if (columnKey === 'warehouse') {
                      return (
                        <td key={columnKey}>
                          <select
                            ref={(node) => {
                              cellRefs.current[`${rowIndex}:${columnKey}`] = node;
                            }}
                            value={line[columnKey]}
                            disabled={isCopiedRow}
                            className={rowErrors.warehouse ? 'has-error' : ''}
                            onFocus={() => onFocusRow(rowIndex)}
                            onChange={(event) =>
                              onFieldChange(rowIndex, columnKey, event.target.value)
                            }
                            onKeyDown={(event) => handleKeyDown(event, rowIndex, columnKey)}
                          >
                            <option value=""></option>
                            {warehouses.map((warehouse) => (
                              <option key={warehouse.whsCode} value={warehouse.whsCode}>
                                {warehouse.whsCode}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    }

                    const readOnly =
                      columnKey === 'total' ||
                      columnKey === 'itemCost' ||
                      columnKey === 'uomCode' ||
                      columnKey === 'uomName' ||
                      columnKey === 'itemDescription' ||
                      (isCopiedRow &&
                        ['quantity', 'unitPrice', 'warehouse', 'accountCode', 'branch'].includes(
                          columnKey
                        ));

                    return (
                      <td key={columnKey}>
                        <input
                          ref={(node) => {
                            cellRefs.current[`${rowIndex}:${columnKey}`] = node;
                          }}
                          value={line[columnKey] ?? ''}
                          readOnly={readOnly}
                          className={`${numberColumns.has(columnKey) ? 'is-number' : ''} ${
                            rowErrors[columnKey] ? 'has-error' : ''
                          }`.trim()}
                          onFocus={() => onFocusRow(rowIndex)}
                          onChange={(event) =>
                            onFieldChange(rowIndex, columnKey, event.target.value)
                          }
                          onKeyDown={(event) => handleKeyDown(event, rowIndex, columnKey)}
                        />
                      </td>
                    );
                  })}
                  <td className="gr-matrix__action">
                    <button
                      type="button"
                      className="gr-mini-btn gr-mini-btn--danger"
                      onClick={() => onDeleteRow(rowIndex)}
                      title="Delete row"
                    >
                      x
                    </button>
                  </td>
                </tr>
              );
            })}

            {Array.from({ length: fillerRows }).map((_, index) => (
              <tr key={`filler-${index}`} className="gr-matrix__filler">
                <td className="gr-matrix__row-number">{lines.length + index + 1}</td>
                {COLUMN_KEYS.map((columnKey) => (
                  <td key={columnKey}></td>
                ))}
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ItemMatrix;
