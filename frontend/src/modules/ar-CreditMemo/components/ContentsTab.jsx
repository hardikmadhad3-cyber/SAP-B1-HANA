import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';
import { useSapItemCodeTab } from '../../../utils/sapTabNavigation';
import { getLineTotalsForDisplay } from '../../../utils/lineTotals';
import { AR_CREDIT_MEMO_WORKBOOK_COLUMNS } from '../../../config/workbookMatrixColumns';

const MATRIX_COLS = AR_CREDIT_MEMO_WORKBOOK_COLUMNS;

const INDEX_COL_WIDTH = 42;
const ACTION_COL_WIDTH = 48;
const SUPPRESSED_ROW_UDFS = new Set([
  'APIVDOCKEY',
  'APIVDOCNUM',
  'APIVLINENUM',
  'APINVDOCKEY',
  'APINVDOCNUM',
  'APINVLINENUM',
]);

const pickerButtonStyle = {
  padding: '0 6px',
  fontSize: 11,
  border: '1px solid #a0aab4',
  background: 'linear-gradient(180deg, #fff 0%, #e8ecf0 100%)',
  minWidth: '24px',
  height: '22px',
  cursor: 'pointer',
  borderRadius: '2px',
};

const isCheckedValue = (value) =>
  ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase());

const getLineFieldValue = (line = {}, key = '') => {
  if (key === 'itemNo') {
    return line.itemNo || line.ItemCode || line.itemCode || '';
  }
  if (key === 'itemDescription') {
    return line.itemDescription || line.ItemDescription || line.Dscription || line.description || line.itemName || '';
  }
  return line[key] || '';
};

const normalizeUdfKey = (value) =>
  String(value || '').trim().toUpperCase().replace(/^U_/, '').replace(/[^A-Z0-9]/g, '');

export default function ContentsTab({
  lines,
  onLineChange,
  onNumBlur,
  onAddLine,
  onRemoveLine,
  onOpenHSNModal,
  onOpenItemModal,
  onOpenLineLookup,
  lineItemOptions,
  getUomOptions,
  effectiveTaxCodes,
  effectiveWarehouses,
  getBranchName,
  valErrors,
  isEditable = true,
  formSettings = {},
  matrixFields = [],
  rowUdfFields = [],
  onRowUdfChange,
}) {
  const sapItemTab = useSapItemCodeTab({ lineItemOptions, onLineChange, onOpenItemModal });
  const standardColumnByKey = new Map(MATRIX_COLS.map((column) => [column.key, column]));
  const standardColumnOrderByKey = new Map(MATRIX_COLS.map((column, index) => [column.key, index + 1]));
  const rowUdfByNormalizedKey = new Map();
  (rowUdfFields || []).forEach((field) => {
    [field.key, field.sapField, field.aliasId, field.label]
      .map(normalizeUdfKey)
      .filter(Boolean)
      .forEach((key) => {
        if (!rowUdfByNormalizedKey.has(key)) rowUdfByNormalizedKey.set(key, field);
      });
  });
  const getColumnUdfField = (column) => {
    if (!column?.isUdf) return column?.field;
    const key = column.valueKey || column.rendererKey || column.key;
    return rowUdfByNormalizedKey.get(normalizeUdfKey(key)) || column.field || {
      key,
      label: column.label || key,
      type: column.type || (column.numeric ? 'number' : 'text'),
      options: column.options || [],
      readOnly: column.readOnly,
    };
  };
  const hasLiveMatrixFields = Array.isArray(matrixFields) && matrixFields.length > 0;
  const isVisibleBySetting = (field = {}, setting = {}) => (
    field.visible === false ? false : setting?.visible !== undefined ? setting.visible !== false : true
  );
  const usesMetadataDrivenMatrix = hasLiveMatrixFields && matrixFields.some((field) => field?.sapControlled || field?.importedLayout);
  const standardColumns = hasLiveMatrixFields
    ? matrixFields
        .map((field) => {
          const fallbackOrder = standardColumnOrderByKey.get(field.key) || 90000;
          return {
            ...(standardColumnByKey.get(field.key) || {}),
            ...field,
            order: Number.isFinite(Number(field.order)) ? Number(field.order) : fallbackOrder,
            field: getColumnUdfField(field),
          };
        })
        .filter((column) => column.key)
    : MATRIX_COLS.map((column, index) => ({
        ...column,
        order: index + 1,
        field: getColumnUdfField(column),
      }));

  const udfColumns = usesMetadataDrivenMatrix ? [] : rowUdfFields
    .filter((field) => {
      const fieldKeys = [field.key, field.sapField, field.aliasId, field.label]
        .map(normalizeUdfKey)
        .filter(Boolean);
      return !fieldKeys.some((key) => SUPPRESSED_ROW_UDFS.has(key));
    })
    .map((field) => ({
      key: field.key,
      label: field.label || field.key,
      minWidth: field.minWidth || (field.type === 'textarea' ? 180 : 125),
      order: field.order,
      isUdf: true,
      field,
    }));

  const matrixCols = [...standardColumns, ...udfColumns]
    .filter((column) => {
      if (column.isUdf) {
        return isVisibleBySetting(column, formSettings.rowUdfs?.[column.field.key] || {});
      }
      return isVisibleBySetting(column, formSettings.matrixColumns?.[column.key] || {});
    })
    .sort((left, right) => {
      const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : 99999;
      const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : 99999;
      return leftOrder - rightOrder;
    });
  const tableMinWidth = INDEX_COL_WIDTH + ACTION_COL_WIDTH + matrixCols.reduce((total, col) => total + col.minWidth, 0);

  const isStandardDisabled = (column) =>
    !isEditable || column.readOnly || formSettings.matrixColumns?.[column.key]?.active === false;

  const renderLookupCell = (column, line, i, title) => {
    const disabled = isStandardDisabled(column);
    const lineErrors = valErrors.lines[i] || {};

    return (
      <td key={column.key}>
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          <input
            className={`del-grid__input${lineErrors[column.key] ? ' del-field__input--error' : ''}`}
            style={{ flex: 1, textAlign: 'left' }}
            name={column.key}
            value={line[column.key] || ''}
            onChange={(event) => onLineChange(i, event)}
            disabled={disabled}
            title={String(line[column.key] || '')}
          />
          <button
            type="button"
            onClick={() => onOpenLineLookup && onOpenLineLookup(column.key, i)}
            style={pickerButtonStyle}
            title={title}
            disabled={disabled}
          >
            ...
          </button>
        </div>
      </td>
    );
  };

  const renderUdfCell = (field, line, i) => {
    if (!field?.key) {
      return (
        <td>
          <input className="del-grid__input" value="" readOnly />
        </td>
      );
    }
    const disabled = !isEditable || field.readOnly || formSettings.rowUdfs?.[field.key]?.active === false;
    const value = line.udf?.[field.key] || '';
    const isSellerItem = normalizeUdfKey(field.key || field.aliasId || field.label) === 'SITEM';

    if (isSellerItem) {
      return (
        <td key={field.key}>
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            <input
              className="del-grid__input"
              value={value}
              onChange={(event) => onRowUdfChange && onRowUdfChange(i, field.key, event.target.value)}
              disabled={disabled}
              title={String(value || '')}
            />
            <button
              type="button"
              onClick={() => onOpenLineLookup && onOpenLineLookup('sItem', i, field)}
              style={pickerButtonStyle}
              title="Select S_Item"
              disabled={disabled}
            >
              ...
            </button>
          </div>
        </td>
      );
    }

    if (field.type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
      return (
        <td key={field.key}>
          <select
            className="del-grid__input"
            value={value}
            onChange={(event) => onRowUdfChange && onRowUdfChange(i, field.key, event.target.value)}
            disabled={disabled}
          >
            <option value=""></option>
            {(field.options || []).map((option) => {
              const normalizedOption = typeof option === 'object' ? option : { value: option, label: option };
              return (
                <option key={normalizedOption.value} value={normalizedOption.value}>
                  {normalizedOption.label}
                </option>
              );
            })}
          </select>
        </td>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <td key={field.key} style={{ textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={isCheckedValue(value)}
            disabled={disabled}
            onChange={(event) => onRowUdfChange && onRowUdfChange(i, field.key, event.target.checked ? 'Y' : 'N')}
          />
        </td>
      );
    }

    return (
      <td key={field.key}>
        <input
          className="del-grid__input"
          type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(event) => onRowUdfChange && onRowUdfChange(i, field.key, event.target.value)}
          disabled={disabled}
        />
      </td>
    );
  };

  const renderCell = (column, line, i, uomOpts, lineTotals) => {
    if (column.isUdf && column.field) {
      return renderUdfCell(column.field, line, i);
    }

    const disabled = isStandardDisabled(column);
    const lineErrors = valErrors.lines[i] || {};

    switch (column.rendererKey || column.valueKey || column.key) {
      case 'itemNo':
        return (
          <td key="itemNo">
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              <input
                className={`del-grid__input${lineErrors.itemNo ? ' del-field__input--error' : ''}`}
                style={{ flex: 1, textAlign: 'left' }}
                name="itemNo"
                data-sap-lookup="item"
                data-sap-row-index={i}
                onKeyDown={(event) => sapItemTab.handleItemCodeTab(event, i)}
                value={getLineFieldValue(line, 'itemNo')}
                onChange={(event) => onLineChange(i, event)}
                placeholder="Item Code"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => onOpenItemModal && onOpenItemModal(i)}
                style={pickerButtonStyle}
                title="Select Item"
                disabled={disabled}
              >
                ...
              </button>
            </div>
            {lineErrors.itemNo && (
              <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{lineErrors.itemNo}</div>
            )}
          </td>
        );
      case 'itemDescription':
        return (
          <td key="itemDescription">
            <input
              className="del-grid__input"
              style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              name="itemDescription"
              value={getLineFieldValue(line, 'itemDescription')}
              onChange={(event) => onLineChange(i, event)}
              title={getLineFieldValue(line, 'itemDescription')}
              disabled={disabled}
            />
          </td>
        );
      case 'hsnCode':
        return (
          <td key="hsnCode">
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              <input
                className={`del-grid__input${lineErrors.hsnCode ? ' del-field__input--error' : ''}`}
                style={{ flex: 1, textAlign: 'left' }}
                name="hsnCode"
                value={line.hsnCode}
                onChange={(event) => onLineChange(i, event)}
                placeholder="HSN/SAC"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => onOpenHSNModal && onOpenHSNModal(i)}
                style={pickerButtonStyle}
                title="Select HSN Code"
                disabled={disabled}
              >
                ...
              </button>
            </div>
          </td>
        );
      case 'quantity':
      case 'unitPrice':
      case 'stdDiscount':
        return (
          <td key={column.key}>
            <input
              className={`del-grid__input${lineErrors[column.key] ? ' del-field__input--error' : ''}`}
              name={column.key}
              value={line[column.key]}
              onChange={(event) => onLineChange(i, event)}
              onBlur={() => onNumBlur(column.key, 'line', i)}
              disabled={disabled}
            />
          </td>
        );
      case 'uomCode':
        return (
          <td key="uomCode">
            <select
              className={`del-grid__input${lineErrors.uomCode ? ' del-field__select--error' : ''}`}
              style={{ textAlign: 'center', height: '20px', padding: '0 4px' }}
              name="uomCode"
              value={line.uomCode}
              onChange={(event) => onLineChange(i, event)}
              disabled={disabled}
            >
              <option value=""></option>
              {uomOpts.map((uom) => (
                <option key={uom} value={uom}>
                  {uom}
                </option>
              ))}
              {line.uomCode && !uomOpts.includes(line.uomCode) && (
                <option value={line.uomCode}>{line.uomCode}</option>
              )}
            </select>
          </td>
        );
      case 'taxCode':
        return (
          <td key={column.key}>
            <TaxCodeLookup
              className="del-grid__input"
              style={{ textAlign: 'left', height: '20px', padding: '0 4px' }}
              name="taxCode"
              value={line.taxCode}
              onChange={(event) => onLineChange(i, event)}
              taxCodes={effectiveTaxCodes}
              disabled={disabled}
            />
          </td>
        );
      case 'totalBeforeTax':
      case 'totalLC':
        return (
          <td key={column.key}>
            <input className="del-grid__input" value={lineTotals.beforeTax} readOnly />
          </td>
        );
      case 'total':
        return (
          <td key="total">
            <input className="del-grid__input" value={lineTotals.total} readOnly />
          </td>
        );
      case 'taxAmount': {
        const taxAmount = line.taxAmount || (
          lineTotals.beforeTax && lineTotals.total
            ? (Number(lineTotals.total || 0) - Number(lineTotals.beforeTax || 0)).toFixed(2)
            : ''
        );
        return (
          <td key="taxAmount">
            <input className="del-grid__input" value={taxAmount} readOnly />
          </td>
        );
      }
      case 'uomName':
        return (
          <td key="uomName">
            <input className="del-grid__input" value={line.uomName || line.uomCode || ''} readOnly />
          </td>
        );
      case 'whse':
        return (
          <td key="whse">
            <select
              className={`del-grid__input${lineErrors.whse ? ' del-field__select--error' : ''}`}
              style={{ textAlign: 'left', height: '20px', padding: '0 4px' }}
              name="whse"
              value={line.whse || ''}
              onChange={(event) => onLineChange(i, event)}
              disabled={disabled}
            >
              <option value="">Select</option>
              {effectiveWarehouses.map((warehouse) => (
                <option key={warehouse.WhsCode} value={warehouse.WhsCode}>{warehouse.WhsCode}</option>
              ))}
              {line.whse && !effectiveWarehouses.some((warehouse) => warehouse.WhsCode === line.whse) && (
                <option value={line.whse}>{line.whse}</option>
              )}
            </select>
          </td>
        );
      case 'glAccount':
        return renderLookupCell(column, line, i, 'Select G/L Account');
      case 'distRule':
        return renderLookupCell(column, line, i, 'Select Distribution Rule');
      case 'loc':
      case 'branch':
        return (
          <td key={column.key}>
            <input
              className="del-grid__input"
              value={getBranchName ? getBranchName(line.branch) : line[column.key] || ''}
              disabled
              style={{ background: '#f5f5f5', cursor: 'not-allowed', textAlign: 'left' }}
              title={column.key === 'loc' ? 'LOC is synced from branch' : 'Branch is synced from header'}
            />
          </td>
        );
      default:
        if (column.type === 'checkbox') {
          return (
            <td key={column.key} style={{ textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={isCheckedValue(line[column.key])}
                disabled={disabled}
                onChange={(event) => onLineChange(i, { target: { name: column.key, value: event.target.checked ? 'Y' : 'N' } })}
              />
            </td>
          );
        }

        if (column.type === 'yesNo') {
          return (
            <td key={column.key}>
              <select
                className="del-grid__input"
                name={column.key}
                value={isCheckedValue(line[column.key]) ? 'Y' : 'N'}
                onChange={(event) => onLineChange(i, event)}
                disabled={disabled}
              >
                <option value="N">No</option>
                <option value="Y">Yes</option>
              </select>
            </td>
          );
        }

        return (
          <td key={column.key}>
            <input
              className={`del-grid__input${lineErrors[column.key] ? ' del-field__input--error' : ''}`}
              name={column.valueKey || column.rendererKey || column.key}
              value={line[column.valueKey || column.rendererKey || column.key] || ''}
              onChange={(event) => onLineChange(i, event)}
              disabled={disabled}
              readOnly={column.readOnly}
              title={String(line[column.valueKey || column.rendererKey || column.key] || '')}
            />
          </td>
        );
    }
  };

  return (
    <div className="del-tab-panel" style={{ overflow: 'visible', minWidth: 0, maxWidth: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="del-section-title" style={{ margin: 0 }}>Document Lines</div>
        <button type="button" className="del-btn del-btn--primary" onClick={onAddLine}>
          + Add Line
        </button>
      </div>
      <div className="del-grid-wrap del-grid-wrap--contents">
        <div className="del-grid-wrap__scroller del-grid-wrap__scroller--contents">
          <table
            className="del-grid del-grid--contents"
            style={{ width: 'max-content', minWidth: tableMinWidth, tableLayout: 'auto' }}
          >
            <colgroup>
              <col style={{ width: INDEX_COL_WIDTH }} />
              {matrixCols.map((column) => (
                <col key={column.key} style={{ width: column.minWidth }} />
              ))}
              <col style={{ width: ACTION_COL_WIDTH }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: INDEX_COL_WIDTH }}>#</th>
                {matrixCols.map((column) => (
                  <th key={column.key} style={{ minWidth: column.minWidth }}>
                    {column.label}
                  </th>
                ))}
                <th style={{ width: ACTION_COL_WIDTH }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const uomOpts = getUomOptions(line);
                const lineTotals = getLineTotalsForDisplay(line, effectiveTaxCodes);

                return (
                  <tr key={i}>
                    <td className="del-grid__cell--muted" style={{ textAlign: 'center', fontSize: 11 }}>{i + 1}</td>
                    {matrixCols.map((column) => renderCell(column, line, i, uomOpts, lineTotals))}
                    <td>
                      <button
                        type="button"
                        className="del-btn del-btn--danger"
                        style={{ padding: '2px 6px' }}
                        onClick={() => onRemoveLine(i)}
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
    </div>
  );
}
