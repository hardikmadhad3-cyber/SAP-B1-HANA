import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';
import { useSapItemCodeTab } from '../../../utils/sapTabNavigation';
import { BASE_MATRIX_COLUMNS } from '../../../config/salesQuotationForm';
import { getLineTotalsForDisplay } from '../../../utils/lineTotals';

const COLUMN_WIDTHS = {
  itemNo: 160,
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
  onOpenHSNModal,
  onOpenItemModal,
  onOpenQualityModal,
  onOpenPaymentTermsModal,
  getBranchName,
  formSettings = {},
  rowUdfFields = [],
  onRowUdfChange,
}) {
  const sapItemTab = useSapItemCodeTab({ lineItemOptions, onLineChange, onOpenItemModal });
  const fixedColumnLabels = new Set(BASE_MATRIX_COLUMNS.map((column) => compactLabel(column.label || column.key)));
  const visibleRowUdfFields = rowUdfFields.filter((field) => !fixedColumnLabels.has(compactLabel(field.label || field.key)));
  const matrixColumns = [
    ...BASE_MATRIX_COLUMNS.map((column) => ({
      ...column,
      minWidth: COLUMN_WIDTHS[column.key] || 125,
    })),
    ...visibleRowUdfFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      minWidth: field.type === 'textarea' ? 180 : 125,
      isUdf: true,
      field,
    })),
  ];

  const visibleColumns = matrixColumns.filter((column) => {
    if (column.isUdf) return formSettings.rowUdfs?.[column.key]?.visible !== false;
    return formSettings.matrixColumns?.[column.key]?.visible !== false;
  });

  const tableMinWidth =
    INDEX_COL_WIDTH +
    ACTION_COL_WIDTH +
    visibleColumns.reduce((total, column) => total + column.minWidth, 0);

  const renderUdfCell = (field, line, i) => {
    const disabled = field.readOnly || formSettings.rowUdfs?.[field.key]?.active === false;
    const value = line.udf?.[field.key] || '';

    if (field.type === 'select') {
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
    if (column.isUdf) return renderUdfCell(column.field, line, i);

    const textInput = (key, options = {}) => (
      <td key={key}>
        <input
          className="so-grid__input"
          name={key}
          value={line[key] || ''}
          onChange={(e) => onLineChange(i, e)}
          onBlur={options.numeric ? () => onNumBlur(key, 'line', i) : undefined}
          type={options.type || 'text'}
          style={options.style}
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
          />
          <button type="button" onClick={openLookup} style={pickerButtonStyle} title={title}>
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
              value={line.itemNo || ''}
              onChange={(e) => onLineChange(i, e)}
              placeholder="Item Code"
            />
            <button type="button" onClick={() => onOpenItemModal && onOpenItemModal(i)} style={pickerButtonStyle} title="Select Item">
              ...
            </button>
          </div>
          {valErrors.lines[i]?.itemNo && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].itemNo}</div>
          )}
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
          />
          {valErrors.lines[i]?.unitPrice && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].unitPrice}</div>
          )}
        </td>
      ),
      stdDiscount: () => textInput('stdDiscount', { numeric: true }),
      distRule: () => (
        <td key="distRule">
          <select
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left' }}
            name="distRule"
            value={line.distRule || ''}
            onChange={(e) => onLineChange(i, e)}
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
        <td key="taxCode">
          <TaxCodeLookup
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left', border: valErrors.lines[i]?.taxCode ? '1px solid #c00' : undefined }}
            name="taxCode"
            value={line.taxCode || ''}
            onChange={(e) => onLineChange(i, e)}
            taxCodes={effectiveTaxCodes}
            error={Boolean(valErrors.lines[i]?.taxCode)}
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
      loc: () => readonlyInput('loc', getBranchName ? getBranchName(line.branch) : line.loc),
      allowProcurementDoc: () => (
        <td key="allowProcurementDoc" style={{ textAlign: 'center' }}>
          <input
            type="checkbox"
            name="allowProcurementDoc"
            checked={Boolean(line.allowProcurementDoc)}
            onChange={(e) => onLineChange(i, { target: { name: 'allowProcurementDoc', value: e.target.checked, type: 'checkbox' } })}
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
            />
            <button type="button" onClick={() => onOpenHSNModal && onOpenHSNModal(i)} style={pickerButtonStyle} title="Select HSN Code">
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

    return cellRenderers[column.key]
      ? cellRenderers[column.key]()
      : textInput(column.key, { numeric: numericFields.has(column.key) });
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
