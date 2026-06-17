import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';
import { useSapItemCodeTab } from '../../../utils/sapTabNavigation';
import { getLineTotalsForDisplay } from '../../../utils/lineTotals';
import { AR_INVOICE_WORKBOOK_COLUMNS } from '../../../config/workbookMatrixColumns';

const SAP_CONTENT_COLUMNS = AR_INVOICE_WORKBOOK_COLUMNS;

const INDEX_COL_WIDTH = 42;
const ACTION_COL_WIDTH = 48;
const DEFAULT_COLUMN_ORDER = new Map(SAP_CONTENT_COLUMNS.map((column, index) => [column.key, index + 1]));
const SUPPRESSED_ROW_UDFS = new Set([
  'APIVDOCKEY',
  'APIVDOCNUM',
  'APIVLINENUM',
  'APINVDOCKEY',
  'APINVDOCNUM',
  'APINVLINENUM',
]);
const CUSTOM_UDF_COLUMN_KEYS = new Set([
  'U_Cost_Sheet',
  'U_PackingType',
  'U_ContainerType',
  'U_GrossWt',
  'U_TotalPackage',
  'U_Fix_Brock_B',
  'U_Fix_Brock_S',
  'U_FIX_BROK_BUYER',
  'U_Fix_Brock_Seller',
  'blanketAgreementNo',
  'saudaNodeRef',
  'bedRate',
  'bedAmount',
  'rg23dNo',
  'specialRebate',
  'commission',
  'sellerBrokeragePerQty',
  'sellerItem',
  'sellerUnitPrice',
  'sellerQty',
  'sellerBrokerage',
  'buyerBrokerage',
  'buyerDelivery',
  'sellerDelivery',
  'buyerQuality',
  'sellerQuality',
  'buyerPrice',
  'sellerPrice',
  'buyerSpecialInstruction',
  'sellerSpecialInstruction',
  'sellerBrokerageAmtPer',
  'sellerBrokeragePercent',
  'buyerBillDiscount',
  'sellerBillDiscount',
  'stcode',
  'buyerPaymentTerms',
  'sellerPaymentTerms',
  'freightPurchase',
  'freightSales',
  'freightProvider',
  'freightProviderName',
  'brokerageNumber',
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

const normalizeIdentity = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const isCheckedValue = (value) =>
  ['Y', 'YES', 'TRUE', '1', 'TYES', true].includes(
    typeof value === 'string' ? value.trim().toUpperCase() : value
  );

const normalizeYesNoValue = (value) => (isCheckedValue(value) ? 'Y' : 'N');

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateDisplay = (value) => {
  if (!value) return '';
  return String(value).split('T')[0];
};

const getUdfIdentities = (field = {}) => [
  field.key,
  field.sapField,
  field.aliasId,
  field.label,
  field.description,
  field.Descr,
].map(normalizeIdentity).filter(Boolean);

const normalizeUdfKey = (value) =>
  String(value || '').trim().toUpperCase().replace(/^U_/, '').replace(/[^A-Z0-9]/g, '');

const isSuppressedUdf = (field = {}) => [
  field.key,
  field.sapField,
  field.aliasId,
  field.label,
].map(normalizeUdfKey).some((key) => SUPPRESSED_ROW_UDFS.has(key));

const isSellerItemField = (field = {}) => [
  field.key,
  field.sapField,
  field.aliasId,
  field.label,
].map(normalizeUdfKey).some((key) => key === 'SITEM');

const getBoundUdf = (column, rowUdfFields) => {
  if (!CUSTOM_UDF_COLUMN_KEYS.has(column.key)) return null;
  const identities = [column.key, column.label].map(normalizeIdentity);
  return rowUdfFields.find((field) => {
    const fieldIdentities = getUdfIdentities(field);
    return identities.some((identity) => fieldIdentities.some((fieldIdentity) => (
      fieldIdentity === identity ||
      (identity.length > 3 && fieldIdentity.includes(identity)) ||
      (fieldIdentity.length > 3 && identity.includes(fieldIdentity))
    )));
  });
};

const getKnownColumnForUdf = (field, standardColumnByKey) => {
  const fieldIdentities = getUdfIdentities(field);

  return SAP_CONTENT_COLUMNS.find((column) => {
    if (!CUSTOM_UDF_COLUMN_KEYS.has(column.key)) return false;
    const columnIdentities = [column.key, column.label].map(normalizeIdentity);
    return columnIdentities.some((identity) => fieldIdentities.some((fieldIdentity) => (
      fieldIdentity === identity ||
      (identity.length > 3 && fieldIdentity.includes(identity)) ||
      (fieldIdentity.length > 3 && identity.includes(fieldIdentity))
    )));
  }) || standardColumnByKey.get(field.key) || null;
};

const getNumericOrder = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getLineValue = (line, column, boundUdf) => {
  const valueKey = column.valueKey || column.rendererKey || column.key;
  if (boundUdf) return line.udf?.[boundUdf.key] ?? '';
  if (valueKey === 'itemNo') return line.itemNo || line.ItemCode || line.itemCode || '';
  if (valueKey === 'itemDescription') {
    return line.itemDescription || line.ItemDescription || line.Dscription || line.description || line.itemName || '';
  }
  return line[valueKey] ?? line[column.key] ?? '';
};

const getLineChangeHandler = (i, column, boundUdf, onLineChange, onRowUdfChange) => (event) => {
  if (boundUdf) {
    onRowUdfChange && onRowUdfChange(i, boundUdf.key, event.target.value);
    return;
  }
  const valueKey = column.valueKey || column.rendererKey || column.key;
  onLineChange(i, valueKey === column.key
    ? event
    : { target: { name: valueKey, value: event.target.value, checked: event.target.checked } });
};

export default function ContentsTab({
  lines,
  onLineChange,
  onNumBlur,
  lineItemOptions,
  onAddLine,
  onRemoveLine,
  onOpenHSNModal,
  onOpenItemModal,
  onOpenLineLookup,
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
  const effectiveRowUdfFields = (rowUdfFields || []).filter((field) => !isSuppressedUdf(field));
  const matrixFieldByKey = new Map((matrixFields || []).map((field) => [field.key, field]));
  const hasLiveMatrixFields = matrixFieldByKey.size > 0;
  const usesMetadataDrivenMatrix = hasLiveMatrixFields && (matrixFields || []).some((field) => field?.sapControlled || field?.importedLayout);
  const standardColumnByKey = new Map(SAP_CONTENT_COLUMNS.map((column) => [column.key, column]));
  const sourceColumns = hasLiveMatrixFields
    ? matrixFields
        .map((field) => ({
          ...(standardColumnByKey.get(field.key) || {}),
          ...field,
        }))
        .filter((column) => column.key)
    : SAP_CONTENT_COLUMNS;
  const boundColumns = sourceColumns.map((column) => ({
    ...column,
    ...(matrixFieldByKey.get(column.key) || {}),
    boundUdf: getBoundUdf(column, effectiveRowUdfFields),
  })).filter((column) => {
    if (CUSTOM_UDF_COLUMN_KEYS.has(column.key)) return Boolean(column.boundUdf) || !hasLiveMatrixFields;
    return !hasLiveMatrixFields || matrixFieldByKey.has(column.key);
  });
  const boundUdfKeys = new Set(boundColumns.map((column) => column.boundUdf?.key).filter(Boolean));
  const extraUdfColumns = usesMetadataDrivenMatrix ? [] : rowUdfFields
    .filter((field) => !isSuppressedUdf(field))
    .filter((field) => !boundUdfKeys.has(field.key))
    .map((field, index) => {
      const knownColumn = getKnownColumnForUdf(field, standardColumnByKey);
      const fallbackOrder = knownColumn
        ? DEFAULT_COLUMN_ORDER.get(knownColumn.key)
        : SAP_CONTENT_COLUMNS.length + index + 1;

      return {
        ...(knownColumn || {}),
        key: knownColumn?.key || field.key,
        label: knownColumn?.label || field.label || field.key,
        minWidth: field.minWidth || knownColumn?.minWidth || (field.type === 'textarea' ? 180 : 125),
        order: getNumericOrder(field.order, fallbackOrder),
        boundUdf: field,
        isExtraUdf: true,
      };
    });
  const mergedColumns = [...boundColumns, ...extraUdfColumns]
    .map((column) => ({
      ...column,
      order: getNumericOrder(column.order, DEFAULT_COLUMN_ORDER.get(column.key) || 99999),
    }))
    .sort((left, right) => left.order - right.order);
  const matrixCols = mergedColumns.filter((column) => {
    if (column.sapControlled || column.importedLayout) return column.visible !== false;
    if (column.boundUdf || column.isExtraUdf) {
      return formSettings.rowUdfs?.[column.boundUdf?.key]?.visible !== false;
    }

    return formSettings.matrixColumns?.[column.key]?.visible !== false;
  });
  const tableMinWidth = INDEX_COL_WIDTH + ACTION_COL_WIDTH + matrixCols.reduce((total, col) => total + col.minWidth, 0);

  const getTaxAmountDisplay = (line, lineTotals) => {
    if (String(line.taxAmount ?? '').trim()) return line.taxAmount;
    if (!lineTotals.beforeTax || !lineTotals.total) return '';
    return (parseNumber(lineTotals.total) - parseNumber(lineTotals.beforeTax)).toFixed(2);
  };

  const renderLookupInput = (column, line, i, title) => {
    const errors = valErrors.lines[i] || {};
    return (
      <td key={column.key}>
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          <input
            className={`del-grid__input${errors[column.key] ? ' del-field__input--error' : ''}`}
            style={{ flex: 1, textAlign: 'left' }}
            name={column.key}
            value={line[column.key] || ''}
            onChange={(event) => onLineChange(i, event)}
            disabled={!isEditable}
            title={String(line[column.key] || '')}
          />
          <button
            type="button"
            onClick={() => onOpenLineLookup && onOpenLineLookup(column.key, i)}
            style={pickerButtonStyle}
            title={title}
            disabled={!isEditable}
          >
            ...
          </button>
        </div>
        {errors[column.key] && (
          <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{errors[column.key]}</div>
        )}
      </td>
    );
  };

  const renderGenericInput = (column, line, i, options = {}) => {
    const boundUdf = column.boundUdf;
    const fieldType = boundUdf?.type || column.type;
    const value = getLineValue(line, column, boundUdf);
    const isInactive = boundUdf
      ? formSettings.rowUdfs?.[boundUdf.key]?.active === false
      : formSettings.matrixColumns?.[column.key]?.active === false;
    const disabled = !isEditable || column.readOnly || boundUdf?.readOnly || isInactive;
    const handleChange = getLineChangeHandler(i, column, boundUdf, onLineChange, onRowUdfChange);

    if (boundUdf && isSellerItemField(boundUdf)) {
      return (
        <td key={column.key}>
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            <input
              className={`del-grid__input${options.error ? ' del-field__input--error' : ''}`}
              style={{ flex: 1, textAlign: 'left' }}
              value={value}
              onChange={handleChange}
              disabled={disabled}
              title={String(value || '')}
            />
            <button
              type="button"
              onClick={() => onOpenLineLookup && onOpenLineLookup('sItem', i, boundUdf)}
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

    if (fieldType === 'checkbox') {
      return (
        <td key={column.key} style={{ textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={isCheckedValue(value)}
            disabled={disabled}
            onChange={(event) => {
              if (boundUdf) {
                onRowUdfChange && onRowUdfChange(i, boundUdf.key, event.target.checked ? 'Y' : 'N');
              } else {
                onLineChange(i, { target: { name: column.key, value: event.target.checked ? 'Y' : 'N' } });
              }
            }}
          />
        </td>
      );
    }

    if (fieldType === 'yesNo') {
      return (
        <td key={column.key}>
          <select
            className="del-grid__input"
            name={column.key}
            value={normalizeYesNoValue(value)}
            disabled={disabled}
            onChange={handleChange}
          >
            <option value="N">No</option>
            <option value="Y">Yes</option>
          </select>
        </td>
      );
    }

    if (fieldType === 'select' && Array.isArray(boundUdf?.options) && boundUdf.options.length > 0) {
      return (
        <td key={column.key}>
          <select
            className="del-grid__input"
            value={value}
            disabled={disabled}
            onChange={handleChange}
          >
            <option value=""></option>
            {boundUdf.options.map((option) => {
              const normalized = typeof option === 'object' ? option : { value: option, label: option };
              return (
                <option key={normalized.value} value={normalized.value}>
                  {normalized.label}
                </option>
              );
            })}
          </select>
        </td>
      );
    }

    return (
      <td key={column.key}>
        <input
          className={`del-grid__input${options.error ? ' del-field__input--error' : ''}`}
          type={fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text'}
          name={column.key}
          value={options.value ?? value}
          onChange={handleChange}
          onBlur={column.numeric && !boundUdf ? () => onNumBlur(column.key, 'line', i) : undefined}
          disabled={disabled}
          readOnly={column.readOnly}
          style={{
            textAlign: column.numeric ? 'right' : 'left',
            background: column.readOnly ? '#f5f8fc' : undefined,
            ...options.style,
          }}
          title={String(options.value ?? value ?? '')}
        />
        {options.error && (
          <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{options.error}</div>
        )}
      </td>
    );
  };

  const renderCell = (column, line, i, uomOpts, lineTotals) => {
    const errors = valErrors.lines[i] || {};

    switch (column.rendererKey || column.valueKey || column.key) {
      case 'itemNo':
        return (
          <td key="itemNo">
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              <input
                className={`del-grid__input${errors.itemNo ? ' del-field__input--error' : ''}`}
                style={{ flex: 1, textAlign: 'left' }}
                name="itemNo"
              data-sap-lookup="item"
              data-sap-row-index={i}
              onKeyDown={(e) => sapItemTab.handleItemCodeTab(e, i)}
                value={getLineValue(line, { key: 'itemNo' }, null)}
                onChange={(event) => onLineChange(i, event)}
                placeholder="Item Code"
                disabled={!isEditable}
              />
              <button
                type="button"
                onClick={() => onOpenItemModal && onOpenItemModal(i)}
                style={pickerButtonStyle}
                title="Select Item"
                disabled={!isEditable}
              >
                ...
              </button>
            </div>
            {errors.itemNo && (
              <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{errors.itemNo}</div>
            )}
          </td>
        );
      case 'itemDescription':
        return renderGenericInput(column, line, i, {
          style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        });
      case 'quantity':
      case 'unitPrice':
      case 'stdDiscount':
        return renderGenericInput(column, line, i, { error: errors[column.key] });
      case 'taxCode':
        return (
          <td key={column.key}>
            <TaxCodeLookup
              className={`del-grid__input${errors.taxCode ? ' del-field__select--error' : ''}`}
              style={{ textAlign: 'left', height: '20px', padding: '0 4px' }}
              name="taxCode"
              value={line.taxCode || ''}
              onChange={(event) => onLineChange(i, event)}
              disabled={!isEditable}
              taxCodes={effectiveTaxCodes}
            />
          </td>
        );
      case 'totalLC':
        return renderGenericInput({ ...column, key: 'total', readOnly: false }, line, i, {
          value: line.total ?? lineTotals.beforeTax,
          error: errors.total || errors.totalLC,
        });
      case 'taxAmount':
        return renderGenericInput(column, line, i, { value: getTaxAmountDisplay(line, lineTotals) });
      case 'assessableValue':
        return renderGenericInput(column, line, i, { value: getLineValue(line, column, column.boundUdf) || lineTotals.beforeTax });
      case 'whse':
        return (
          <td key="whse">
            <select
              className={`del-grid__input${errors.whse ? ' del-field__select--error' : ''}`}
              style={{ textAlign: 'left', height: '20px', padding: '0 4px' }}
              name="whse"
              value={line.whse || ''}
              onChange={(event) => onLineChange(i, event)}
              disabled={!isEditable}
            >
              <option value="">Select</option>
              {effectiveWarehouses.map((warehouse) => (
                <option key={warehouse.WhsCode} value={warehouse.WhsCode}>
                  {warehouse.WhsCode}
                </option>
              ))}
              {line.whse && !effectiveWarehouses.some((warehouse) => warehouse.WhsCode === line.whse) && (
                <option value={line.whse}>{line.whse}</option>
              )}
            </select>
          </td>
        );
      case 'glAccount':
        return renderLookupInput(column, line, i, 'Select G/L Account');
      case 'distRule':
        return renderLookupInput(column, line, i, 'Select Distribution Rule');
      case 'cogsDistRule':
        return renderLookupInput(column, line, i, 'Select COGS Distribution Rule');
      case 'uomCode':
        return (
          <td key="uomCode">
            <select
              className={`del-grid__input${errors.uomCode ? ' del-field__select--error' : ''}`}
              style={{ textAlign: 'center', height: '20px', padding: '0 4px' }}
              name="uomCode"
              value={line.uomCode || ''}
              onChange={(event) => onLineChange(i, event)}
              disabled={!isEditable}
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
      case 'uomName':
        return renderGenericInput(column, line, i, { value: line.uomName || line.uomCode || '' });
      case 'loc':
        return renderGenericInput(column, line, i, {
          value: getBranchName ? getBranchName(line.branch) : line.loc || '',
          style: { background: '#f5f8fc', cursor: 'not-allowed' },
        });
      case 'qtyInventoryUom':
        return renderGenericInput(column, line, i, {
          value: line.qtyInventoryUom || line.quantity || '',
        });
      case 'uomGroup':
        return renderGenericInput(column, line, i, { value: line.uomGroup || '' });
      case 'documentCreated':
        return renderGenericInput(column, line, i, { value: formatDateDisplay(line.documentCreated) });
      case 'hsnCode':
        return (
          <td key="hsnCode">
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              <input
                className={`del-grid__input${errors.hsnCode ? ' del-field__input--error' : ''}`}
                style={{ flex: 1, textAlign: 'left' }}
                name="hsnCode"
                value={line.hsnCode || ''}
                onChange={(event) => onLineChange(i, event)}
                placeholder="HSN"
                disabled={!isEditable}
              />
              <button
                type="button"
                onClick={() => onOpenHSNModal && onOpenHSNModal(i)}
                style={pickerButtonStyle}
                title="Select HSN Code"
                disabled={!isEditable}
              >
                ...
              </button>
            </div>
            {errors.hsnCode && (
              <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{errors.hsnCode}</div>
            )}
          </td>
        );
      default:
        return renderGenericInput(column, line, i);
    }
  };

  return (
    <div className="del-tab-panel" style={{ overflow: 'visible', minWidth: 0, maxWidth: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="del-section-title" style={{ margin: 0 }}>Document Lines</div>
        <button type="button" className="del-btn del-btn--primary" onClick={onAddLine} disabled={!isEditable}>
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
                    <td className="del-grid__cell--muted" style={{ textAlign: 'center', fontSize: 11 }}>
                      {i + 1}
                    </td>
                    {matrixCols.map((column) => renderCell(column, line, i, uomOpts, lineTotals))}
                    <td>
                      <button
                        type="button"
                        className="del-btn del-btn--danger"
                        style={{ padding: '2px 6px' }}
                        onClick={() => onRemoveLine(i)}
                        disabled={!isEditable}
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
