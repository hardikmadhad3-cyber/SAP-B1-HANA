import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';
import { useSapItemCodeTab } from '../../../utils/sapTabNavigation';
import { BASE_MATRIX_COLUMNS } from '../../../config/salesQuotationForm';
import { getLineTotalsForDisplay } from '../../../utils/lineTotals';

const COLUMN_WIDTHS = {
  itemNo: 160,
  requiredDate: 125,
  quotedDate: 125,
  requiredQty: 110,
  quantity: 95,
  unitPrice: 110,
  stdDiscount: 90,
  taxCode: 115,
  totalLC: 115,
  distRule: 105,
  uomCode: 105,
  cogsDistRule: 125,
  countryOfOrigin: 180,
  loc: 115,
  blanketAgreementNo: 150,
  allowProcurementDoc: 140,
  unitPriceUdf: 110,
  sellerBrokerageAmtPer: 160,
  sellerBrokeragePercent: 175,
  buyerPaymentTerms: 175,
  sellerPaymentTerms: 175,
  buyerSpecialInstruction: 185,
  sellerSpecialInstruction: 185,
  freightProviderName: 165,
  documentCreated: 140,
  brokerageNumber: 145,
};

const INDEX_COL_WIDTH = 42;
const ACTION_COL_WIDTH = 48;
const MIN_DATA_COL_WIDTH = 72;

const getReadableColumnWidth = (column = {}) => {
  const labelWidth = Math.ceil(String(column.label || column.key || '').length * 7.2 + 28);
  return Math.max(MIN_DATA_COL_WIDTH, Number(column.minWidth || column.width || 0), labelWidth);
};

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

const formatDateDisplay = (value) => {
  if (!value) return '';
  return String(value).split('T')[0];
};

const compactLabel = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const hasDisplayValue = (value) => value !== undefined && value !== null && String(value) !== '';

const UDF_LINE_FIELD_FALLBACKS = {
  USITEM: ['sellerItem', 'SellerItem'],
  SITEM: ['sellerItem', 'SellerItem'],
  USQTY: ['sellerQty', 'SellerQty'],
  SQTY: ['sellerQty', 'SellerQty'],
  USPLRBT: ['specialRebate', 'SpecialRebate'],
  SPECIALREBATE: ['specialRebate', 'SpecialRebate'],
  UCOMPRC: ['commission', 'Commission'],
  COMMISSION: ['commission', 'Commission'],
  COMMISION: ['commission', 'Commission'],
  USBROKPERQTY: ['sellerBrokeragePerQty', 'SellerBrokeragePerQty'],
  UBROKSELLER: ['sellerBrokerage', 'SellerBrokerage'],
  UBROKBUYER: ['buyerBrokerage', 'BuyerBrokerage'],
  UBUYERDELIVERY: ['buyerDelivery', 'BuyerDelivery'],
  USELLERDELIVERY: ['sellerDelivery', 'SellerDelivery'],
  UBUYERPAYMENTTERMS: ['buyerPaymentTerms', 'BuyerPaymentTerms'],
  USELLERPAYMENTTERM: ['sellerPaymentTerms', 'SellerPaymentTerms', 'SellerPaymentTerm'],
  USELLERPAYMENTTERMS: ['sellerPaymentTerms', 'SellerPaymentTerms', 'SellerPaymentTerm'],
  UBUYERQUALITY: ['buyerQuality', 'BuyerQuality'],
  USELLERQUALITY: ['sellerQuality', 'SellerQuality'],
  UBUYERPRICE: ['buyerPrice', 'BuyerPrice'],
  USELLERPRICE: ['sellerPrice', 'SellerPrice'],
  UBUYERSPINS: ['buyerSpecialInstruction', 'BuyerSpecialInstruction'],
  BUYERSPECIALINSTRUCTION: ['buyerSpecialInstruction', 'BuyerSpecialInstruction'],
  USELLERSPINS: ['sellerSpecialInstruction', 'SellerSpecialInstruction'],
  SELLERSPECIALINSTRUCTION: ['sellerSpecialInstruction', 'SellerSpecialInstruction'],
  USELBROKAP: ['sellerBrokerageAmtPer', 'SellerBrokerageAmtPer'],
  USELLERBROKPER: ['sellerBrokeragePercent', 'SellerBrokeragePercent'],
  USELLTCODE: ['stcode', 'STCODE'],
  UPACKINGTYPE: ['packingType', 'PackingType', 'U_PackingType'],
};

const getUdfFieldValue = (line = {}, field = {}) => {
  const fieldKeys = [field.key, field.sapField, field.aliasId, field.label].filter(Boolean);
  for (const key of fieldKeys) {
    const direct = line.udf?.[key];
    if (hasDisplayValue(direct)) return direct;
  }

  const udfEntries = Object.entries(line.udf || {});
  for (const key of fieldKeys) {
    const token = compactLabel(key);
    const match = udfEntries.find(([entryKey, value]) => compactLabel(entryKey) === token && hasDisplayValue(value));
    if (match) return match[1];
  }

  const fallbackKeys = fieldKeys.flatMap((key) => UDF_LINE_FIELD_FALLBACKS[compactLabel(key)] || []);
  for (const key of fallbackKeys) {
    const value = line[key];
    if (hasDisplayValue(value)) return value;
  }

  return '';
};

const getLineFieldValue = (line = {}, key = '') => {
  if (key === 'itemNo') {
    return line.itemNo || line.ItemCode || line.itemCode || '';
  }
  if (key === 'itemDescription') {
    return line.itemDescription || line.ItemDescription || line.Dscription || line.description || line.itemName || '';
  }
  if (key === 'uomName') {
    return line.uomName || line.UomName || line.UoMName || line.unitMsr || line.uomCode || line.UomCode || line.UoMCode || '';
  }
  return hasDisplayValue(line[key]) ? line[key] : '';
};

const getLineTaxCodeValue = (line = {}) => (
  getLineFieldValue(line, 'taxCode') ||
  getLineFieldValue(line, 'taxCodeRepeat') ||
  getLineFieldValue(line, 'TaxCode') ||
  getLineFieldValue(line, 'VatGroup') ||
  getLineFieldValue(line, 'SavedTaxCode')
);

const getColumnValueKey = (column = {}) => column.valueKey || column.rendererKey || column.key || '';

const getColumnIdentity = (column = {}) => {
  const valueKey = getColumnValueKey(column);
  return compactLabel(valueKey || column.label || column.key);
};

const dedupeColumns = (columns = []) => {
  const seen = new Set();
  return columns.filter((column) => {
    if (!column?.key) return false;
    const identity = getColumnIdentity(column);
    if (!identity) return false;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

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
  distributionRules = [],
  countries = [],
  onOpenHSNModal,
  onOpenItemModal,
  onOpenQualityModal,
  onOpenPaymentTermsModal,
  getBranchName,
  formSettings = {},
  matrixFields = BASE_MATRIX_COLUMNS,
  rowUdfFields = [],
  onRowUdfChange,
}) {
  const sapItemTab = useSapItemCodeTab({ lineItemOptions, onLineChange, onOpenItemModal });
  const validMatrixFields = Array.isArray(matrixFields) ? matrixFields.filter((field) => field && field.key) : [];
  const safeRowUdfFields = Array.isArray(rowUdfFields) ? rowUdfFields.filter((field) => field && field.key) : [];
  const sourceMatrixFields = validMatrixFields.length ? validMatrixFields : BASE_MATRIX_COLUMNS;
  const usesMetadataDrivenMatrix = sourceMatrixFields.some((field) => field?.sapControlled || field?.importedLayout);
  const fixedColumnLabels = new Set(BASE_MATRIX_COLUMNS.map((column) => compactLabel(column.label || column.key)));
  const visibleRowUdfFields = usesMetadataDrivenMatrix
    ? []
    : safeRowUdfFields.filter((field) => !fixedColumnLabels.has(compactLabel(field.label || field.key)));
  const rowUdfByKey = new Map(safeRowUdfFields.map((field) => [field.key, field]));
  const rowUdfByCompactKey = new Map();
  safeRowUdfFields.forEach((field) => {
    [field.key, field.sapField, field.aliasId, field.label]
      .map(compactLabel)
      .filter(Boolean)
      .forEach((key) => {
        if (!rowUdfByCompactKey.has(key)) rowUdfByCompactKey.set(key, field);
      });
  });
  const getGenericUdfField = (column = {}) => {
    const key = column.valueKey || column.rendererKey || column.key;
    if (!String(key || '').startsWith('U_')) return column.field;
    return rowUdfByCompactKey.get(compactLabel(key)) || column.field || {
      key,
      label: column.label || key,
      type: column.type || (column.numeric ? 'number' : 'text'),
      options: column.options || [],
      readOnly: column.readOnly,
    };
  };
  const matrixColumns = [
    ...sourceMatrixFields.map((column, index) => ({
      ...(BASE_MATRIX_COLUMNS.find((base) => base.key === (column.rendererKey || column.valueKey || column.key)) || {}),
      ...column,
      key: column.key,
      rendererKey: column.rendererKey || column.valueKey || column.key,
      valueKey: column.valueKey || column.rendererKey || column.key,
      minWidth: getReadableColumnWidth({
        ...column,
        minWidth: column.minWidth || column.width || COLUMN_WIDTHS[column.rendererKey || column.valueKey || column.key] || 125,
      }),
      order: Number(column.order ?? column.columnOrder ?? index + 1),
      field: column.isUdf
        ? (rowUdfByKey.get(column.valueKey || column.key) || rowUdfByKey.get(column.key) || getGenericUdfField(column))
        : column.field,
    })),
    ...visibleRowUdfFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      minWidth: getReadableColumnWidth({
        key: field.key,
        label: field.label || field.key,
        minWidth: field.type === 'textarea' ? 180 : 125,
      }),
      isUdf: true,
      field,
    })),
  ];

  const getColumnSetting = (column = {}) => (
    formSettings.matrixColumns?.[column.key]
    || (column.isUdf ? formSettings.rowUdfs?.[column.key] : undefined)
    || {}
  );
  const resolveVisible = (field = {}, setting = {}) => (
    setting?.visible !== undefined ? setting.visible !== false : field.visible !== false
  );
  const resolveActive = (field = {}, setting = {}) => (
    setting?.active !== undefined ? setting.active !== false : field.active !== false
  );

  const visibleColumns = dedupeColumns(matrixColumns).filter((column) => (
    resolveVisible(column, getColumnSetting(column))
  )).sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

  const tableMinWidth =
    INDEX_COL_WIDTH +
    ACTION_COL_WIDTH +
    visibleColumns.reduce((total, column) => total + column.minWidth, 0);

  const renderUdfCell = (field, line, i) => {
    if (!field?.key) {
      return (
        <td>
          <input className="so-grid__input" value="" readOnly />
        </td>
      );
    }
    const disabled = field.readOnly || !resolveActive(field, formSettings.rowUdfs?.[field.key] || {});
    const value = getUdfFieldValue(line, field);

    if (field.type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
      return (
        <td key={field.key}>
          <select
            className="so-grid__input"
            value={value}
            disabled={disabled}
            onChange={(e) => onRowUdfChange && onRowUdfChange(i, field.key, e.target.value)}
          >
            <option value=""></option>
            {(field.options || []).map((option) => {
              const normalizedOption = typeof option === 'object' ? option : { value: option, label: option };
              return <option key={normalizedOption.value} value={normalizedOption.value}>{normalizedOption.label}</option>;
            })}
          </select>
        </td>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <td key={field.key}>
          <input
            type="checkbox"
            checked={['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase())}
            disabled={disabled}
            onChange={(e) => onRowUdfChange && onRowUdfChange(i, field.key, e.target.checked ? 'Y' : 'N')}
          />
        </td>
      );
    }

    return (
      <td key={field.key}>
        <input
          className="so-grid__input"
          type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
          value={value}
          disabled={disabled}
          onChange={(e) => onRowUdfChange && onRowUdfChange(i, field.key, e.target.value)}
        />
      </td>
    );
  };

  const renderCell = (column, line, i, uomOpts, lineTotals) => {
    const rendererKey = column.rendererKey || column.valueKey || column.key;
    const valueKey = column.valueKey || rendererKey;
    const setting = getColumnSetting(column);
    const disabled = Boolean(
      column.readOnly ||
      column.active === false ||
      setting?.active === false
    );

    const textInput = (key, options = {}) => (
      <td key={column.key || key}>
        <input
          className="so-grid__input"
          name={key}
          value={getLineFieldValue(line, key)}
          onChange={(e) => onLineChange(i, e)}
          onBlur={options.numeric ? () => onNumBlur(key, 'line', i) : undefined}
          type={options.type || 'text'}
          style={options.style}
          disabled={disabled}
        />
      </td>
    );

    const readonlyInput = (key, value) => (
      <td key={key}>
        <input className="so-grid__input" value={value || ''} readOnly style={{ background: '#f5f8fc' }} />
      </td>
    );

    const lookupInput = (key, title, openLookup) => (
      <td key={key}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <input
            className="so-grid__input"
            style={{ flex: 1 }}
          name={key}
          value={line[key] || ''}
          onChange={(e) => onLineChange(i, e)}
          disabled={disabled}
        />
          <button type="button" onClick={openLookup} style={pickerButtonStyle} title={title} disabled={disabled}>
            ...
          </button>
        </div>
      </td>
    );

    const cellRenderers = {
      itemNo: () => (
        <td key="itemNo">
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1, textAlign: 'left', border: valErrors.lines[i]?.itemNo ? '1px solid #c00' : undefined }}
              name="itemNo"
              data-sap-lookup="item"
              data-sap-row-index={i}
              onKeyDown={(e) => sapItemTab.handleItemCodeTab(e, i)}
              value={getLineFieldValue(line, 'itemNo')}
              onChange={(e) => onLineChange(i, e)}
              placeholder="Item Code"
              disabled={disabled}
            />
            <button type="button" onClick={() => onOpenItemModal && onOpenItemModal(i)} style={pickerButtonStyle} title="Select Item" disabled={disabled}>
              ...
            </button>
          </div>
          {valErrors.lines[i]?.itemNo && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].itemNo}</div>
          )}
        </td>
      ),
      itemDescription: () => (
        <td key="itemDescription">
          <input
            className="so-grid__input"
            style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            name="itemDescription"
            type="text"
            value={getLineFieldValue(line, 'itemDescription')}
            onChange={(e) => onLineChange(i, e)}
            title={getLineFieldValue(line, 'itemDescription')}
            disabled={disabled}
          />
        </td>
      ),
      quantity: () => (
        <td key="quantity">
          <input
            className="so-grid__input"
            style={{ border: valErrors.lines[i]?.quantity ? '1px solid #c00' : undefined }}
            name="quantity"
            value={line.quantity || ''}
            onChange={(e) => onLineChange(i, e)}
            onBlur={() => onNumBlur('quantity', 'line', i)}
            disabled={disabled}
          />
          {valErrors.lines[i]?.quantity && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].quantity}</div>
          )}
        </td>
      ),
      unitPrice: () => (
        <td key="unitPrice">
          <input
            className="so-grid__input"
            style={{ border: valErrors.lines[i]?.unitPrice ? '1px solid #c00' : undefined }}
            name="unitPrice"
            value={line.unitPrice || ''}
            onChange={(e) => onLineChange(i, e)}
            onBlur={() => onNumBlur('unitPrice', 'line', i)}
            disabled={disabled}
          />
          {valErrors.lines[i]?.unitPrice && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].unitPrice}</div>
          )}
        </td>
      ),
      stdDiscount: () => textInput('stdDiscount', { numeric: true }),
      requiredDate: () => textInput('requiredDate', { type: 'date' }),
      quotedDate: () => textInput('quotedDate', { type: 'date' }),
      requiredQty: () => textInput('requiredQty', { numeric: true }),
      unitPriceUdf: () => textInput('unitPriceUdf', { numeric: true }),
      distRule: () => (
        <td key="distRule">
          <select
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left' }}
            name="distRule"
            value={line.distRule || ''}
            onChange={(e) => onLineChange(i, e)}
            disabled={disabled}
          >
            <option value="">Select</option>
            {distributionRules.map((rule) => (
              <option key={rule.FactorCode} value={rule.FactorCode}>
                {rule.FactorCode}{rule.FactorDescription ? ` - ${rule.FactorDescription}` : ''}
              </option>
            ))}
            {line.distRule && !distributionRules.some((rule) => String(rule.FactorCode) === String(line.distRule)) && (
              <option value={line.distRule}>{line.distRule}</option>
            )}
          </select>
        </td>
      ),
      taxCode: () => (
        <td key={column.key}>
          <TaxCodeLookup
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left', border: valErrors.lines[i]?.taxCode ? '1px solid #c00' : undefined }}
            name="taxCode"
            value={getLineTaxCodeValue(line)}
            onChange={(e) => onLineChange(i, e)}
            taxCodes={effectiveTaxCodes}
            error={Boolean(valErrors.lines[i]?.taxCode)}
            disabled={disabled}
          />
          {valErrors.lines[i]?.taxCode && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].taxCode}</div>
          )}
        </td>
      ),
      totalLC: () => readonlyInput('totalLC', lineTotals.beforeTax),
      uomCode: () => (
        <td key="uomCode">
          <select
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left', border: valErrors.lines[i]?.uomCode ? '1px solid #c00' : undefined }}
            name="uomCode"
            value={line.uomCode || ''}
            onChange={(e) => onLineChange(i, e)}
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
      ),
      uomName: () => readonlyInput('uomName', getLineFieldValue(line, 'uomName')),
      countryOfOrigin: () => (
        <td key="countryOfOrigin">
          <select
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left' }}
            name="countryOfOrigin"
            value={line.countryOfOrigin || ''}
            onChange={(e) => onLineChange(i, e)}
            disabled={disabled}
          >
            <option value=""></option>
            {countries.map((country) => (
              <option key={country.Code} value={country.Code}>
                {country.Code}{country.Name ? ` - ${country.Name}` : ''}
              </option>
            ))}
            {line.countryOfOrigin && !countries.some((country) => String(country.Code) === String(line.countryOfOrigin)) && (
              <option value={line.countryOfOrigin}>{line.countryOfOrigin}</option>
            )}
          </select>
        </td>
      ),
      loc: () => readonlyInput('loc', getBranchName ? getBranchName(line.branch) : line.loc),
      allowProcurementDoc: () => (
        <td key="allowProcurementDoc" style={{ textAlign: 'center' }}>
          <input
            type="checkbox"
            name="allowProcurementDoc"
            checked={Boolean(line.allowProcurementDoc)}
            onChange={(e) => onLineChange(i, { target: { name: 'allowProcurementDoc', value: e.target.checked, type: 'checkbox' } })}
            disabled={disabled}
          />
        </td>
      ),
      hsnCode: () => (
        <td key="hsnCode">
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1, textAlign: 'left', border: valErrors.lines[i]?.hsnCode ? '1px solid #c00' : undefined }}
              name="hsnCode"
              value={line.hsnCode || ''}
              onChange={(e) => onLineChange(i, e)}
              placeholder="HSN"
              disabled={disabled}
            />
            <button type="button" onClick={() => onOpenHSNModal && onOpenHSNModal(i)} style={pickerButtonStyle} title="Select HSN Code" disabled={disabled}>
              ...
            </button>
          </div>
          {valErrors.lines[i]?.hsnCode && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].hsnCode}</div>
          )}
        </td>
      ),
      buyerQuality: () => lookupInput('buyerQuality', 'Select Buyer Quality', () => onOpenQualityModal && onOpenQualityModal('buyerQuality', i)),
      sellerQuality: () => lookupInput('sellerQuality', 'Select Seller Quality', () => onOpenQualityModal && onOpenQualityModal('sellerQuality', i)),
      buyerPrice: () => lookupInput('buyerPrice', 'Select Buyer Price', () => onOpenQualityModal && onOpenQualityModal('buyerPrice', i)),
      sellerPrice: () => lookupInput('sellerPrice', 'Select Seller Price', () => onOpenQualityModal && onOpenQualityModal('sellerPrice', i)),
      buyerPaymentTerms: () => lookupInput('buyerPaymentTerms', 'Select Buyer Terms of Payment', () => onOpenPaymentTermsModal && onOpenPaymentTermsModal('buyerPaymentTerms', i)),
      sellerPaymentTerms: () => lookupInput('sellerPaymentTerms', 'Select Seller Terms of Payment', () => onOpenPaymentTermsModal && onOpenPaymentTermsModal('sellerPaymentTerms', i)),
      sellerBrokerageAmtPer: () => (
        <td key="sellerBrokerageAmtPer">
          <select
            className="so-grid__input"
            name="sellerBrokerageAmtPer"
            value={line.sellerBrokerageAmtPer || ''}
            onChange={(e) => onLineChange(i, e)}
            disabled={disabled}
          >
            <option value=""></option>
            <option value="Amount">Amount</option>
            <option value="Percentage">Percentage</option>
          </select>
        </td>
      ),
      documentCreated: () => readonlyInput('documentCreated', formatDateDisplay(line.documentCreated)),
    };

    const numericFields = new Set([
      'requiredQty',
      'unitPriceUdf',
      'sellerQty',
      'sellerBrokeragePerQty',
      'assessableValue',
      'bedRate',
      'bedAmount',
      'specialRebate',
      'commission',
      'sellerBrokerage',
      'buyerBrokerage',
      'sellerBrokeragePercent',
      'buyerBillDiscount',
      'sellerBillDiscount',
      'freightPurchase',
      'freightSales',
    ]);

    if (cellRenderers[rendererKey]) return cellRenderers[rendererKey]();
    if (column.isUdf && column.field) return renderUdfCell(column.field, line, i);
    return textInput(valueKey, { numeric: numericFields.has(valueKey) });
  };

  return (
    <div className="so-tab-panel" style={{ overflow: 'visible', minWidth: 0, maxWidth: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="so-section-title">Document Lines</div>
        <button type="button" className="so-btn so-btn--primary" onClick={onAddLine}>
          + Add Line
        </button>
      </div>
      <div className="so-grid-wrap so-grid-wrap--contents">
        <div className="so-grid-wrap__scroller so-grid-wrap__scroller--contents">
          <table
            className="so-grid so-grid--contents"
            style={{ width: 'max-content', minWidth: tableMinWidth, tableLayout: 'auto' }}
          >
            <colgroup>
              <col style={{ width: INDEX_COL_WIDTH }} />
              {visibleColumns.map((column) => (
                <col key={column.key} style={{ width: column.minWidth }} />
              ))}
              <col style={{ width: ACTION_COL_WIDTH }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: INDEX_COL_WIDTH }}>#</th>
                {visibleColumns.map((column) => (
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
                    <td className="so-grid__cell--muted" style={{ textAlign: 'center', fontSize: 11 }}>
                      {i + 1}
                    </td>
                    {visibleColumns.map((column) => renderCell(column, line, i, uomOpts, lineTotals))}
                    <td>
                      <button
                        type="button"
                        className="so-btn so-btn--danger"
                        style={{ padding: '2px 8px', fontSize: 14 }}
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
