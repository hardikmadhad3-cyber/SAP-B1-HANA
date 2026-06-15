import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';
import { useSapItemCodeTab } from '../../../utils/sapTabNavigation';
import { getLineTotalsForDisplay } from '../../../utils/lineTotals';

const FALLBACK_MATRIX_COLS = [
  { key: 'itemNo', label: 'Item No.', minWidth: 160 },
  { key: 'itemDescription', label: 'Item Description', minWidth: 220 },
  { key: 'quantity', label: 'Quantity', minWidth: 90 },
  { key: 'unitPrice', label: 'Unit Price', minWidth: 110 },
  { key: 'stdDiscount', label: 'Discount %', minWidth: 95 },
  { key: 'taxCode', label: 'Tax Code', minWidth: 120 },
  { key: 'total', label: 'Total (LC)', minWidth: 120 },
  { key: 'whse', label: 'Whse', minWidth: 95 },
];

const INDEX_COL_WIDTH = 42;
const ACTION_COL_WIDTH = 48;

const normalizeFieldIdentity = (field = {}) =>
  [
    field.key,
    field.sapField,
    field.aliasId,
    field.label,
    field.description,
    field.Descr,
  ].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '');

const isSellerBrokerageAmtPerField = (field) => {
  const identity = normalizeFieldIdentity(field);
  return identity.includes('sellerbrokerageamtper') ||
    identity.includes('sellerbrokerageamountper') ||
    identity.includes('selbrokap');
};

const isDocumentCreatedField = (field) => {
  const identity = normalizeFieldIdentity(field);
  return identity.includes('documentcreated');
};

const isSapPairDropdownField = (field) =>
  isSellerBrokerageAmtPerField(field) || isDocumentCreatedField(field);

const getSapPairDropdownOptions = (field) => {
  const options = Array.isArray(field.options) ? field.options : [];
  if (options.length) return options;

  if (isSellerBrokerageAmtPerField(field)) {
    return [
      { value: 'Amount', label: 'Amount' },
      { value: 'Percentage', label: 'Percentage' },
    ];
  }

  if (isDocumentCreatedField(field)) {
    return [
      { value: 'N', label: 'No' },
      { value: 'Y', label: 'Yes' },
    ];
  }

  return options;
};

const normalizeSapPairDropdownOption = (field, option) => {
  const normalizedOption = typeof option === 'object'
    ? { value: option.value ?? '', label: option.label ?? option.value ?? '' }
    : { value: option, label: option };
  const value = String(normalizedOption.value ?? '');
  let label = String(normalizedOption.label ?? value);

  if (isDocumentCreatedField(field)) {
    const normalizedValue = value.trim().toUpperCase();
    if (normalizedValue === 'N') label = 'No';
    if (normalizedValue === 'Y') label = 'Yes';
  }

  if (isSellerBrokerageAmtPerField(field)) {
    const normalizedText = `${value} ${label}`.toLowerCase();
    if (normalizedText.includes('amount')) label = 'Amount';
    if (normalizedText.includes('percentage')) label = 'Percentage';
  }

  return {
    value,
    label: isSapPairDropdownField(field) ? `${value} - ${label}` : label,
  };
};

const DIRECT_LINE_FIELDS = new Set([
  'itemNo',
  'itemDescription',
  'quantity',
  'unitPrice',
  'stdDiscount',
  'rate',
  'taxCode',
  'grossPriceAfterDisc',
  'total',
  'whse',
  'glAccount',
  'distRule',
  'priceSource',
  'taxAmountLC',
  'uomCode',
  'countryOfOrigin',
  'loc',
  'blanketAgreementNo',
]);

const NUMERIC_LINE_FIELDS = new Set(['quantity', 'unitPrice', 'stdDiscount']);

const normalizeIdentity = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const parseNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatNumber = (value) => {
  if (value === '' || value == null) return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toFixed(2);
};

const getTaxRate = (line = {}, taxCodes = []) => {
  const code = String(line.taxCode || '').trim();
  if (!code) return 0;
  const match = taxCodes.find((entry) => String(entry?.Code || '').trim() === code);
  return parseNumber(match?.Rate);
};

const getGrossPriceAfterDiscount = (line = {}) => {
  if (line.unitPrice === '' || line.unitPrice == null) return '';
  const price = parseNumber(line.unitPrice);
  const discount = parseNumber(line.stdDiscount);
  return formatNumber(price * (1 - discount / 100));
};

const getTaxAmount = (lineTotals = {}, taxRate = 0) => {
  if (!lineTotals.beforeTax) return '';
  return formatNumber(parseNumber(lineTotals.beforeTax) * taxRate / 100);
};

const getUdfIdentitySet = (field = {}) =>
  new Set([
    field.key,
    field.sapField,
    field.aliasId,
    field.label,
    field.description,
    field.Descr,
  ].map(normalizeIdentity).filter(Boolean));

const getColumnIdentitySet = (column = {}) =>
  new Set([
    column.key,
    column.label,
    ...(column.udfLabels || []),
  ].map(normalizeIdentity).filter(Boolean));

const findMatchingUdfField = (column = {}, rowUdfFields = []) => {
  const columnIdentities = getColumnIdentitySet(column);
  return rowUdfFields.find((field) => {
    const fieldIdentities = getUdfIdentitySet(field);
    return Array.from(columnIdentities).some((identity) => fieldIdentities.has(identity));
  });
};

const isColumnVisible = (column = {}, formSettings = {}) =>
  formSettings?.matrixColumns?.[column.key]?.visible !== false;

const isColumnActive = (column = {}, formSettings = {}) =>
  formSettings?.matrixColumns?.[column.key]?.active !== false;

export default function ContentsTab({
  lines,
  onLineChange,
  onNumBlur,
  onAddLine,
  onRemoveLine,
  lineItemOptions,
  getUomOptions,
  effectiveTaxCodes,
  effectiveWarehouses,
  valErrors,
  onOpenHSNModal,
  onOpenItemModal,
  onOpenLineLookup,
  getBranchName,
  matrixFields = FALLBACK_MATRIX_COLS,
  formSettings = {},
  rowUdfFields = [],
  onRowUdfChange,
}) {
  const sapItemTab = useSapItemCodeTab({ lineItemOptions, onLineChange, onOpenItemModal });
  const baseColumns = (matrixFields?.length ? matrixFields : FALLBACK_MATRIX_COLS)
    .filter((column) => isColumnVisible(column, formSettings))
    .map((column) => {
      const matchedUdfField = DIRECT_LINE_FIELDS.has(column.key)
        ? null
        : findMatchingUdfField(column, rowUdfFields);
      return {
        ...column,
        minWidth: column.minWidth || 125,
        active: isColumnActive(column, formSettings),
        matchedUdfField,
        udfField: matchedUdfField,
      };
    });
  const representedUdfKeys = new Set(baseColumns.map((column) => column.matchedUdfField?.key).filter(Boolean));
  const matrixCols = [
    ...baseColumns,
    ...rowUdfFields
      .filter((field) => !representedUdfKeys.has(field.key))
      .map((field) => ({
        key: field.key,
        label: field.label || field.key,
        minWidth: field.type === 'textarea' ? 180 : 125,
        isUdf: true,
        field,
        active: field.active !== false,
      })),
  ];
  const tableMinWidth = INDEX_COL_WIDTH + ACTION_COL_WIDTH + matrixCols.reduce((total, col) => total + col.minWidth, 0);

  const renderUdfCell = (field, line, rowIndex) => {
    const disabled = field.active === false || field.readOnly === true;
    const value = line.udf?.[field.key] || '';
    const renderAsSelect = field.type === 'select' || isSapPairDropdownField(field);

    if (renderAsSelect) {
      return (
        <select
          className="po-grid__input"
          value={value}
          onChange={(event) => onRowUdfChange && onRowUdfChange(rowIndex, field.key, event.target.value)}
          disabled={disabled}
        >
          <option value=""></option>
          {getSapPairDropdownOptions(field).map((option) => {
            const normalizedOption = normalizeSapPairDropdownOption(field, option);
            return (
              <option key={normalizedOption.value} value={normalizedOption.value}>
                {normalizedOption.label}
              </option>
            );
          })}
        </select>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase())}
          disabled={disabled}
          onChange={(event) => onRowUdfChange && onRowUdfChange(rowIndex, field.key, event.target.checked ? 'Y' : 'N')}
        />
      );
    }

    return (
      <input
        className="po-grid__input"
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(event) => onRowUdfChange && onRowUdfChange(rowIndex, field.key, event.target.value)}
        disabled={disabled}
      />
    );
  };

  const renderUdfLookupCell = (field, line, rowIndex, lookupFieldName, title) => {
    const disabled = field.active === false || field.readOnly === true;
    const value = line.udf?.[field.key] || '';

    return (
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <input
          className="po-grid__input"
          style={{ flex: 1, textAlign: 'left' }}
          value={value}
          onChange={(event) => onRowUdfChange && onRowUdfChange(rowIndex, field.key, event.target.value)}
          disabled={disabled}
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => onOpenHSNModal && onOpenHSNModal(rowIndex, lookupFieldName, field.key)}
            style={{ padding: '0 6px', fontSize: 11, border: '1px solid #a0aab4', background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)', minWidth: 24, height: 22, cursor: 'pointer', borderRadius: 2 }}
            title={title}
          >
            ...
          </button>
        )}
      </div>
    );
  };

  const renderUdfTaxCodeCell = (field, line, rowIndex) => {
    const disabled = field.active === false || field.readOnly === true;

    return (
      <TaxCodeLookup
        className="po-grid__input"
        style={{ width: '100%', textAlign: 'left' }}
        name={field.key}
        value={line.udf?.[field.key] || ''}
        onChange={(event) => onRowUdfChange && onRowUdfChange(rowIndex, field.key, event.target.value)}
        taxCodes={effectiveTaxCodes}
        disabled={disabled}
      />
    );
  };

  const renderLineLookupCell = (column, line, rowIndex, field = null) => {
    const disabled = column.active === false || column.readOnly === true || field?.active === false || field?.readOnly === true;
    const value = field ? line.udf?.[field.key] || '' : line[column.key] || '';

    return (
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <input
          className="po-grid__input"
          style={{ flex: 1, textAlign: 'left' }}
          name={field ? undefined : column.key}
          value={value}
          onChange={(event) => {
            if (field) {
              onRowUdfChange && onRowUdfChange(rowIndex, field.key, event.target.value);
              return;
            }
            onLineChange(rowIndex, event);
          }}
          disabled={disabled}
          title={String(value || '')}
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => onOpenLineLookup && onOpenLineLookup(column, rowIndex, field)}
            style={{ padding: '0 6px', fontSize: 11, border: '1px solid #a0aab4', background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)', minWidth: 24, height: 22, cursor: 'pointer', borderRadius: 2 }}
            title={`Select ${column.label}`}
          >
            ...
          </button>
        )}
      </div>
    );
  };

  const renderCell = (column, line, rowIndex, lineTotals, uomOpts) => {
    const lineErrors = valErrors?.lines?.[rowIndex] || {};
    const disabled = column.active === false || column.readOnly === true;
    const taxRate = getTaxRate(line, effectiveTaxCodes);

    if (column.isUdf) {
      return renderUdfCell(column.field, line, rowIndex);
    }

    if (column.udfField) {
      const mergedField = {
        ...column.udfField,
        active: column.active && column.udfField.active !== false,
        type: column.type || column.udfField.type,
        options: column.options || column.udfField.options,
      };

      if (column.key === 'sac') {
        return renderUdfLookupCell(mergedField, line, rowIndex, 'sac', 'Select SAC');
      }

      if (column.key === 'freight1TaxCode' || column.key === 'stcode') {
        return renderUdfTaxCodeCell(mergedField, line, rowIndex);
      }

      if (column.lookup) {
        return renderLineLookupCell(column, line, rowIndex, mergedField);
      }

      return renderUdfCell(mergedField, line, rowIndex);
    }

    if (column.key === 'itemNo') {
      return (
        <>
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            <input
              className="po-grid__input"
              style={{ flex: 1, textAlign: 'left', border: lineErrors.itemNo ? '1px solid #c00' : undefined }}
              name="itemNo"
              data-sap-lookup="item"
              data-sap-row-index={rowIndex}
              onKeyDown={(event) => sapItemTab.handleItemCodeTab(event, rowIndex)}
              value={line.itemNo || ''}
              onChange={(event) => onLineChange(rowIndex, event)}
              placeholder="Item Code"
              disabled={disabled}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onOpenItemModal && onOpenItemModal(rowIndex)}
                style={{ padding: '0 6px', fontSize: 11, border: '1px solid #a0aab4', background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)', minWidth: 24, height: 22, cursor: 'pointer', borderRadius: 2 }}
                title="Select Item"
              >
                ...
              </button>
            )}
          </div>
          {lineErrors.itemNo && <div className="po-error-feedback">{lineErrors.itemNo}</div>}
        </>
      );
    }

    if (column.key === 'itemDescription') {
      return (
        <input
          className="po-grid__input"
          style={{ width: '100%', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          name="itemDescription"
          value={line.itemDescription || ''}
          onChange={(event) => onLineChange(rowIndex, event)}
          title={line.itemDescription || ''}
          disabled={disabled}
        />
      );
    }

    if (column.key === 'hsnCode') {
      return (
        <>
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            <input
              className="po-grid__input"
              style={{ flex: 1, textAlign: 'left', border: lineErrors.hsnCode ? '1px solid #c00' : undefined }}
              name="hsnCode"
              value={line.hsnCode || ''}
              onChange={(event) => onLineChange(rowIndex, event)}
              placeholder="HSN/SAC"
              disabled={disabled}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onOpenHSNModal && onOpenHSNModal(rowIndex, 'hsnCode')}
                style={{ padding: '0 6px', fontSize: 11, border: '1px solid #a0aab4', background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)', minWidth: 24, height: 22, cursor: 'pointer', borderRadius: 2 }}
                title="Select HSN Code"
              >
                ...
              </button>
            )}
          </div>
          {lineErrors.hsnCode && <div className="po-error-feedback">{lineErrors.hsnCode}</div>}
        </>
      );
    }

    if (column.key === 'sac') {
      return (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <input
            className="po-grid__input"
            style={{ flex: 1, textAlign: 'left' }}
            name="sac"
            value={line.sac || ''}
            onChange={(event) => onLineChange(rowIndex, event)}
            placeholder="SAC"
            disabled={disabled}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onOpenHSNModal && onOpenHSNModal(rowIndex, 'sac')}
              style={{ padding: '0 6px', fontSize: 11, border: '1px solid #a0aab4', background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)', minWidth: 24, height: 22, cursor: 'pointer', borderRadius: 2 }}
              title="Select SAC"
            >
              ...
            </button>
          )}
        </div>
      );
    }

    if (column.key === 'uomCode') {
      return (
        <select
          className="po-grid__input"
          style={{ width: '100%', textAlign: 'left', border: lineErrors.uomCode ? '1px solid #c00' : undefined }}
          name="uomCode"
          value={line.uomCode || ''}
          onChange={(event) => onLineChange(rowIndex, event)}
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
      );
    }

    if (column.key === 'taxCode' || column.key === 'freight1TaxCode' || column.key === 'stcode') {
      return (
        <TaxCodeLookup
          className="po-grid__input"
          style={{ width: '100%', textAlign: 'left' }}
          name={column.key}
          value={line[column.key] || ''}
          onChange={(event) => onLineChange(rowIndex, event)}
          taxCodes={effectiveTaxCodes}
          disabled={disabled}
        />
      );
    }

    if (column.key === 'whse') {
      return (
        <>
          <select
            className="po-grid__input"
            style={{ width: '100%', textAlign: 'left', border: lineErrors.whse ? '1px solid #c00' : undefined }}
            name="whse"
            value={line.whse || ''}
            onChange={(event) => onLineChange(rowIndex, event)}
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
          {lineErrors.whse && <div className="po-error-feedback">{lineErrors.whse}</div>}
        </>
      );
    }

    if (column.key === 'wtaxLiable') {
      return (
        <select
          className="po-grid__input"
          name="wtaxLiable"
          value={line.wtaxLiable || ''}
          onChange={(event) => onLineChange(rowIndex, event)}
          disabled={disabled}
        >
          <option value=""></option>
          <option value="Y">Y</option>
          <option value="N">N</option>
        </select>
      );
    }

    if (column.lookup) {
      return renderLineLookupCell(column, line, rowIndex);
    }

    const readOnlyValues = {
      rate: taxRate ? formatNumber(taxRate) : '',
      grossPriceAfterDisc: getGrossPriceAfterDiscount(line),
      taxAmountLC: getTaxAmount(lineTotals, taxRate),
      totalBeforeTax: lineTotals.beforeTax,
      total: lineTotals.total,
    };

    if (Object.prototype.hasOwnProperty.call(readOnlyValues, column.key)) {
      return (
        <input
          className="po-grid__input"
          value={readOnlyValues[column.key] || ''}
          readOnly
          disabled
          style={{ background: '#f5f8fc' }}
        />
      );
    }

    if (column.type === 'select') {
      return (
        <select
          className="po-grid__input"
          name={column.key}
          value={line[column.key] || ''}
          onChange={(event) => onLineChange(rowIndex, event)}
          disabled={disabled}
        >
          <option value=""></option>
          {(column.options || []).map((option) => {
            const normalizedOption = typeof option === 'object' ? option : { value: option, label: option };
            return (
              <option key={normalizedOption.value} value={normalizedOption.value}>
                {normalizedOption.label}
              </option>
            );
          })}
        </select>
      );
    }

    return (
      <>
        <input
          className="po-grid__input"
          style={{ border: lineErrors[column.key] ? '1px solid #c00' : undefined }}
          name={column.key}
          value={line[column.key] || ''}
          onChange={(event) => onLineChange(rowIndex, event)}
          onBlur={NUMERIC_LINE_FIELDS.has(column.key) ? () => onNumBlur(column.key, 'line', rowIndex) : undefined}
          disabled={disabled}
        />
        {lineErrors[column.key] && <div className="po-error-feedback">{lineErrors[column.key]}</div>}
      </>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="po-section-title" style={{ marginBottom: 0 }}>Item Matrix</div>
        <button type="button" className="po-btn po-btn--primary" onClick={onAddLine}>
          + Add Line
        </button>
      </div>
      <div className="po-grid-wrap" style={{ overflowX: 'auto', overflowY: 'visible' }}>
          <table
            className="po-grid"
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
              {lines.map((line, rowIndex) => {
                const uomOpts = getUomOptions(line);
                const lineTotals = getLineTotalsForDisplay(line, effectiveTaxCodes);
                return (
                  <tr key={rowIndex}>
                    <td className="po-grid__cell--muted" style={{ textAlign: 'center', fontSize: 11 }}>{rowIndex + 1}</td>
                    {matrixCols.map((column) => (
                      <td key={column.key}>
                        {renderCell(column, line, rowIndex, lineTotals, uomOpts)}
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="po-btn po-btn--danger"
                        style={{ padding: '2px 8px', fontSize: 14 }}
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
