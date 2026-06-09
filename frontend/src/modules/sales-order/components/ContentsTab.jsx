import React from 'react';
import TaxCodeLookup from '../../../components/TaxCodeLookup';
import { useSapItemCodeTab } from '../../../utils/sapTabNavigation';
import { filterSalesOrderRowUdfDefinitions } from '../../../config/salesOrderForm';

import { getLineTotalsForDisplay } from '../../../utils/lineTotals';

const TABLE_MIN_WIDTH = 5200;

const MATRIX_COLS = [
  { key: 'itemNo', label: 'Item No.', minWidth: 160 },
  { key: 'itemDescription', label: 'Item Description', minWidth: 240 },
  { key: 'sellerQuality', label: 'Seller - Quality', minWidth: 170 },
  { key: 'buyerQuality', label: 'Buyer - Quality', minWidth: 170 },
  { key: 'quantity', label: 'Quantity', minWidth: 85 },
  { key: 'unitPrice', label: 'Unit Price', minWidth: 110 },
  { key: 'sellerPrice', label: 'Seller - Price', minWidth: 110 },
  { key: 'buyerPrice', label: 'Buyer - Price', minWidth: 110 },
  { key: 'sellerDelivery', label: 'Seller - Delivery', minWidth: 120 },
  { key: 'buyerDelivery', label: 'Buyer - Delivery', minWidth: 120 },
  { key: 'sellerBrokerageAmtPer', label: 'Seller Brokerage(Amt./Per)', minWidth: 155 },
  { key: 'sellerBrokeragePercent', label: 'Seller Brokerage in Percentage', minWidth: 170 },
  { key: 'sellerBrokerage', label: 'Seller Brokerage', minWidth: 120 },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage', minWidth: 120 },
  { key: 'qtySpecialInstruction', label: 'Qty Special Instruction', minWidth: 165 },
  { key: 'deliverySpecialInstruction', label: 'Delivery Special Instruction', minWidth: 185 },
  { key: 'buyerBillDiscount', label: 'Buyer Bill Discount', minWidth: 130 },
  { key: 'sellerBillDiscount', label: 'Seller Bill Discount', minWidth: 130 },
  { key: 'deliveredQty', label: 'Delivered Qty', minWidth: 110 },
  { key: 'stdDiscount', label: 'Discount %', minWidth: 90 },
  { key: 'stcode', label: 'STCODE', minWidth: 110 },
  { key: 'taxCode', label: 'Tax Code', minWidth: 110 },
  { key: 'taxAmount', label: 'Tax Amount (LC)', minWidth: 115 },
  { key: 'totalLC', label: 'Total (LC)', minWidth: 115 },
  { key: 'whse', label: 'Whse', minWidth: 75 },
  { key: 'distRule', label: 'Distr. Rule', minWidth: 105 },
  { key: 'openQty', label: 'Open Qty', minWidth: 85 },
  { key: 'countryOfOrigin', label: 'Country/Region of Origin', minWidth: 175 },
  { key: 'freeText', label: 'Free Text', minWidth: 150 },
  { key: 'uomCode', label: 'UoM Code', minWidth: 105 },
  { key: 'uomName', label: 'UoM Name', minWidth: 120 },
  { key: 'loc', label: 'Loc.', minWidth: 120 },
  { key: 'specialRebate', label: 'Special Rebate', minWidth: 110 },
  { key: 'commission', label: 'Commision', minWidth: 100 },
  { key: 'hsnCode', label: 'HSN', minWidth: 95 },
  { key: 'sacCode', label: 'SAC', minWidth: 90 },
  { key: 'buyerPaymentTerms', label: 'Buyer - Terms of Payment', minWidth: 170 },
  { key: 'sellerPaymentTerms', label: 'Seller - Terms of Payment', minWidth: 170 },
  { key: 'freightPurchase', label: 'Freight Purchase', minWidth: 130 },
  { key: 'freightSales', label: 'Freight Sales', minWidth: 120 },
  { key: 'freightProvider', label: 'Freight Provider', minWidth: 120 },
  { key: 'freightProviderName', label: 'Freight Provider Name', minWidth: 160 },
  { key: 'documentCreated', label: 'Document Created', minWidth: 140 },
  { key: 'brokerageNumber', label: 'Brokerage Number', minWidth: 140 },
];

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateDisplay = (value) => {
  if (!value) return '';
  return String(value).split('T')[0];
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

const DIST_RULE_FIELD_BY_DIMENSION = {
  1: 'distRule',
  2: 'distRule2',
  3: 'distRule3',
  4: 'distRule4',
  5: 'distRule5',
};

const getRuleCode = (rule) => String(rule?.FactorCode || rule?.OcrCode || rule?.code || '').trim();
const getRuleName = (rule) => String(rule?.FactorDescription || rule?.OcrName || rule?.name || '').trim();
const getRuleDimensionCode = (rule) => String(rule?.DimensionCode || rule?.DimCode || rule?.dimensionCode || '1').trim() || '1';
const getDimensionCode = (dimension) => String(dimension?.DimensionCode || dimension?.DimCode || dimension?.code || '1').trim() || '1';
const getDimensionName = (dimension) => String(dimension?.DimensionName || dimension?.DimName || dimension?.DimDesc || dimension?.name || `Dimension ${getDimensionCode(dimension)}`).trim();
const getLineRuleValue = (line, dimensionCode) => line?.[DIST_RULE_FIELD_BY_DIMENSION[Number(dimensionCode)]] || '';

const buildDistributionDimensions = (dimensions = [], rules = []) => {
  const map = new Map();

  dimensions.forEach((dimension) => {
    const code = getDimensionCode(dimension);
    if (Number(code) >= 1 && Number(code) <= 5) {
      map.set(code, { DimensionCode: code, DimensionName: getDimensionName(dimension) });
    }
  });

  rules.forEach((rule) => {
    const code = getRuleDimensionCode(rule);
    if (Number(code) >= 1 && Number(code) <= 5 && !map.has(code)) {
      map.set(code, { DimensionCode: code, DimensionName: rule.DimensionName || `Dimension ${code}` });
    }
  });

  if (!map.size) {
    map.set('1', { DimensionCode: '1', DimensionName: 'Distribution Rule' });
  }

  return [...map.values()].sort((a, b) => Number(a.DimensionCode) - Number(b.DimensionCode));
};

function DistributionRuleAssignmentModal({
  isOpen,
  line,
  rules = [],
  dimensions = [],
  onClose,
  onApply,
}) {
  const dimensionRows = React.useMemo(
    () => buildDistributionDimensions(dimensions, rules),
    [dimensions, rules]
  );
  const [draft, setDraft] = React.useState({});
  const [activeDimensionCode, setActiveDimensionCode] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedRuleIndex, setSelectedRuleIndex] = React.useState(-1);

  React.useEffect(() => {
    if (!isOpen) return;
    const nextDraft = {};
    dimensionRows.forEach((dimension) => {
      const code = getDimensionCode(dimension);
      nextDraft[code] = getLineRuleValue(line, code);
    });
    setDraft(nextDraft);
    setActiveDimensionCode(dimensionRows[0] ? getDimensionCode(dimensionRows[0]) : '1');
    setSearchQuery('');
    setSelectedRuleIndex(-1);
  }, [dimensionRows, isOpen, line]);

  const activeDimension = dimensionRows.find((dimension) => getDimensionCode(dimension) === activeDimensionCode);
  const activeRules = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rules
      .filter((rule) => getRuleDimensionCode(rule) === activeDimensionCode)
      .filter((rule) => {
        if (!query) return true;
        return getRuleCode(rule).toLowerCase().includes(query) || getRuleName(rule).toLowerCase().includes(query);
      });
  }, [activeDimensionCode, rules, searchQuery]);

  React.useEffect(() => {
    setSelectedRuleIndex(-1);
  }, [activeDimensionCode, searchQuery]);

  if (!isOpen) return null;

  const selectRule = (rule) => {
    setDraft((prev) => ({ ...prev, [activeDimensionCode]: getRuleCode(rule) }));
  };

  const chooseSelectedRule = () => {
    if (selectedRuleIndex < 0 || !activeRules[selectedRuleIndex]) return;
    selectRule(activeRules[selectedRuleIndex]);
  };

  const getSelectedRuleName = (dimensionCode) => {
    const selectedCode = draft[dimensionCode];
    if (!selectedCode) return '';
    const selectedRule = rules.find((rule) => getRuleDimensionCode(rule) === dimensionCode && getRuleCode(rule) === selectedCode);
    return selectedRule ? getRuleName(selectedRule) : '';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.34)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: 940, maxWidth: '94vw', maxHeight: '86vh', background: 'var(--sap-surface)', border: '1px solid var(--sap-border-strong)', boxShadow: 'var(--sap-shadow-modal)', display: 'flex', flexDirection: 'column' }} onClick={(event) => event.stopPropagation()}>
        <div style={{ padding: '8px 12px', borderBottom: '3px solid var(--sap-primary)', background: 'var(--sap-toolbar-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Select Distr. Rule</h3>
          <button type="button" onClick={onClose} style={{ border: '1px solid var(--sap-border-strong)', background: '#f5f6f7', width: 24, height: 22, cursor: 'pointer' }}>x</button>
        </div>

        <div style={{ padding: 12, overflow: 'auto', display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(360px, 1fr)', gap: 14 }}>
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--sap-toolbar-bg)' }}>
                  <th style={{ width: 42, padding: '6px', textAlign: 'left', border: '1px solid var(--sap-border)' }}>#</th>
                  <th style={{ padding: '6px', textAlign: 'left', border: '1px solid var(--sap-border)' }}>Dimensions</th>
                  <th style={{ padding: '6px', textAlign: 'left', border: '1px solid var(--sap-border)' }}>Distr. Rule Code</th>
                  <th style={{ padding: '6px', textAlign: 'left', border: '1px solid var(--sap-border)' }}>Distr. Rule Name</th>
                </tr>
              </thead>
              <tbody>
                {dimensionRows.map((dimension, index) => {
                  const dimensionCode = getDimensionCode(dimension);
                  const isActive = dimensionCode === activeDimensionCode;
                  return (
                    <tr
                      key={dimensionCode}
                      onClick={() => setActiveDimensionCode(dimensionCode)}
                      style={{ background: isActive ? '#ffe999' : index % 2 ? 'var(--sap-row-even)' : 'var(--sap-surface)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)' }}>{index + 1}</td>
                      <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)', fontWeight: 600 }}>{getDimensionName(dimension)}</td>
                      <td style={{ padding: 3, border: '1px solid var(--sap-border)' }}>
                        <input
                          readOnly
                          value={draft[dimensionCode] || ''}
                          onFocus={() => setActiveDimensionCode(dimensionCode)}
                          style={{ width: 'calc(100% - 28px)', height: 22, border: '1px solid var(--sap-border-strong)', padding: '2px 5px', background: '#fff7bf' }}
                        />
                        <button type="button" onClick={() => setActiveDimensionCode(dimensionCode)} style={{ ...pickerButtonStyle, marginLeft: 2 }}>...</button>
                      </td>
                      <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)' }}>{getSelectedRuleName(dimensionCode)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ border: '1px solid var(--sap-border-strong)' }}>
            <div style={{ padding: '8px 10px', borderBottom: '3px solid var(--sap-primary)', background: 'var(--sap-toolbar-bg)', fontWeight: 600, fontSize: 13 }}>
              List of Distribution Rules
            </div>
            <div style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, minWidth: 32 }}>Find</label>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} style={{ flex: 1, height: 24, border: '1px solid var(--sap-border-strong)', padding: '2px 6px' }} />
            </div>
            <div style={{ padding: '0 8px 8px', fontSize: 12, color: 'var(--sap-text-muted)' }}>
              {activeDimension ? getDimensionName(activeDimension) : ''}
            </div>
            <div style={{ maxHeight: 300, overflow: 'auto', padding: '0 8px 8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--sap-toolbar-bg)' }}>
                    <th style={{ padding: '6px', textAlign: 'left', border: '1px solid var(--sap-border)' }}>Distribution Rule</th>
                    <th style={{ padding: '6px', textAlign: 'left', border: '1px solid var(--sap-border)' }}>Distribution Rule Name</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRules.length ? activeRules.map((rule, index) => (
                    <tr
                      key={`${getRuleCode(rule)}-${index}`}
                      onClick={() => setSelectedRuleIndex(index)}
                      onDoubleClick={() => selectRule(rule)}
                      style={{ background: selectedRuleIndex === index ? '#ffe999' : index % 2 ? 'var(--sap-row-even)' : 'var(--sap-surface)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)', fontWeight: 600 }}>{getRuleCode(rule)}</td>
                      <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)' }}>{getRuleName(rule)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={2} style={{ padding: 16, textAlign: 'center', color: 'var(--sap-text-muted)' }}>No distribution rules found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: 8, borderTop: '1px solid var(--sap-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={chooseSelectedRule} disabled={selectedRuleIndex < 0} style={{ ...pickerButtonStyle, height: 26, opacity: selectedRuleIndex >= 0 ? 1 : 0.6 }}>Choose</button>
            </div>
          </div>
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--sap-border)', display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
          <button type="button" onClick={() => onApply(draft)} style={{ ...pickerButtonStyle, minWidth: 80, height: 26, background: 'linear-gradient(180deg, var(--sap-primary) 0%, var(--sap-primary-dark) 100%)', color: '#fff' }}>OK</button>
          <button type="button" onClick={onClose} style={{ ...pickerButtonStyle, minWidth: 80, height: 26 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function ContentsTab({
  lines,
  onLineChange,
  onNumBlur,
  lineItemOptions,
  onAddLine,
  onRemoveLine,
  getUomOptions,
  effectiveTaxCodes,
  effectiveWarehouses,
  fmtTaxLabel,
  valErrors,
  distributionRules = [],
  distributionDimensions = [],
  onDistributionRuleChange,
  onOpenHSNModal,
  onOpenItemModal,
  onOpenQualityModal,
  onOpenPaymentTermsModal,
  formSettings = {},
  rowUdfFields = [],
  onRowUdfChange,
}) {
  const sapItemTab = useSapItemCodeTab({ lineItemOptions, onLineChange, onOpenItemModal });
  const [distributionRuleLineIndex, setDistributionRuleLineIndex] = React.useState(-1);
  const getTaxAmountDisplay = (line) => {
    if (String(line.taxAmount ?? '').trim()) return line.taxAmount;
    const totals = getLineTotalsForDisplay(line, effectiveTaxCodes);
    if (!totals.beforeTax || !totals.total) return '';
    return (parseNumber(totals.total) - parseNumber(totals.beforeTax)).toFixed(2);
  };

  // Filter visible columns based on form settings
  const visibleRowUdfFields = filterSalesOrderRowUdfDefinitions(rowUdfFields);

  const matrixColumns = [
    ...MATRIX_COLS,
    ...visibleRowUdfFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      minWidth: field.type === 'textarea' ? 180 : 125,
      isUdf: true,
      field,
    })),
  ];

  const visibleColumns = matrixColumns.filter(col => {
    if (col.isUdf) {
      return formSettings.rowUdfs?.[col.key]?.visible !== false;
    }
    const setting = formSettings.matrixColumns?.[col.key];
    return setting?.visible !== false;
  });

  // Helper to check if a column is visible
  const isColumnVisible = (columnKey) => {
    const setting = formSettings.matrixColumns?.[columnKey];
    return setting?.visible !== false;
  };

  // Create a map of column renderers
  const renderCell = (columnKey, line, i, uomOpts, lineTotals) => {
    const udfColumn = visibleRowUdfFields.find((field) => field.key === columnKey);
    if (udfColumn) {
      const disabled = udfColumn.readOnly || formSettings.rowUdfs?.[udfColumn.key]?.active === false;
      const value = line.udf?.[udfColumn.key] || '';

      return (
        <td key={udfColumn.key}>
          {udfColumn.type === 'select' ? (
            <select
              className="so-grid__input"
              value={value}
              disabled={disabled}
              onChange={(e) => onRowUdfChange && onRowUdfChange(i, udfColumn.key, e.target.value)}
            >
              <option value=""></option>
              {(udfColumn.options || []).map((option) => {
                const normalizedOption = typeof option === 'object' ? option : { value: option, label: option };
                return <option key={normalizedOption.value} value={normalizedOption.value}>{normalizedOption.label}</option>;
              })}
            </select>
          ) : udfColumn.type === 'checkbox' ? (
            <input
              type="checkbox"
              checked={['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase())}
              disabled={disabled}
              onChange={(e) => onRowUdfChange && onRowUdfChange(i, udfColumn.key, e.target.checked ? 'Y' : 'N')}
            />
          ) : (
            <input
              className="so-grid__input"
              type={udfColumn.type === 'date' ? 'date' : udfColumn.type === 'number' ? 'number' : 'text'}
              value={value}
              disabled={disabled}
              onChange={(e) => onRowUdfChange && onRowUdfChange(i, udfColumn.key, e.target.value)}
            />
          )}
        </td>
      );
    }

    if (!isColumnVisible(columnKey)) return null;

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
              value={line.itemNo}
              onChange={(e) => onLineChange(i, e)}
              placeholder="Item Code"
            />
            <button
              type="button"
              onClick={() => onOpenItemModal && onOpenItemModal(i)}
              style={pickerButtonStyle}
              title="Select Item"
            >
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
            style={{ textAlign: 'left' }}
            name="itemDescription"
            value={line.itemDescription}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      sellerQuality: () => (
        <td key="sellerQuality">
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1 }}
              name="sellerQuality"
              value={line.sellerQuality || ''}
              onChange={(e) => onLineChange(i, e)}
            />
            <button
              type="button"
              onClick={() => onOpenQualityModal && onOpenQualityModal('sellerQuality', i)}
              style={pickerButtonStyle}
              title="Select Seller Quality"
            >
              ...
            </button>
          </div>
        </td>
      ),
      buyerQuality: () => (
        <td key="buyerQuality">
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1 }}
              name="buyerQuality"
              value={line.buyerQuality || ''}
              onChange={(e) => onLineChange(i, e)}
            />
            <button
              type="button"
              onClick={() => onOpenQualityModal && onOpenQualityModal('buyerQuality', i)}
              style={pickerButtonStyle}
              title="Select Buyer Quality"
            >
              ...
            </button>
          </div>
        </td>
      ),
      quantity: () => (
        <td key="quantity">
          <input
            className="so-grid__input"
            style={{ border: valErrors.lines[i]?.quantity ? '1px solid #c00' : undefined }}
            name="quantity"
            value={line.quantity}
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
            value={line.unitPrice}
            onChange={(e) => onLineChange(i, e)}
            onBlur={() => onNumBlur('unitPrice', 'line', i)}
          />
          {valErrors.lines[i]?.unitPrice && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].unitPrice}</div>
          )}
        </td>
      ),
      uomCode: () => (
        <td key="uomCode">
          <select
            className="so-grid__input"
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
      sellerPrice: () => (
        <td key="sellerPrice">
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1 }}
              name="sellerPrice"
              value={line.sellerPrice || ''}
              onChange={(e) => onLineChange(i, e)}
            />
            <button
              type="button"
              onClick={() => onOpenQualityModal && onOpenQualityModal('sellerPrice', i)}
              style={pickerButtonStyle}
              title="Select Seller Price"
            >
              ...
            </button>
          </div>
        </td>
      ),
      buyerPrice: () => (
        <td key="buyerPrice">
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1 }}
              name="buyerPrice"
              value={line.buyerPrice || ''}
              onChange={(e) => onLineChange(i, e)}
            />
            <button
              type="button"
              onClick={() => onOpenQualityModal && onOpenQualityModal('buyerPrice', i)}
              style={pickerButtonStyle}
              title="Select Buyer Price"
            >
              ...
            </button>
          </div>
        </td>
      ),
      sellerDelivery: () => (
        <td key="sellerDelivery">
          <input
            className="so-grid__input"
            name="sellerDelivery"
            value={line.sellerDelivery || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      buyerDelivery: () => (
        <td key="buyerDelivery">
          <input
            className="so-grid__input"
            name="buyerDelivery"
            value={line.buyerDelivery || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
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
      sellerBrokeragePercent: () => (
        <td key="sellerBrokeragePercent">
          <input
            className="so-grid__input"
            name="sellerBrokeragePercent"
            value={line.sellerBrokeragePercent || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      sellerBrokerage: () => (
        <td key="sellerBrokerage">
          <input
            className="so-grid__input"
            name="sellerBrokerage"
            value={line.sellerBrokerage || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      buyerBrokerage: () => (
        <td key="buyerBrokerage">
          <input
            className="so-grid__input"
            name="buyerBrokerage"
            value={line.buyerBrokerage || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      qtySpecialInstruction: () => (
        <td key="qtySpecialInstruction">
          <input
            className="so-grid__input"
            name="qtySpecialInstruction"
            value={line.qtySpecialInstruction || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      deliverySpecialInstruction: () => (
        <td key="deliverySpecialInstruction">
          <input
            className="so-grid__input"
            name="deliverySpecialInstruction"
            value={line.deliverySpecialInstruction || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      stdDiscount: () => (
        <td key="stdDiscount">
          <input
            className="so-grid__input"
            name="stdDiscount"
            value={line.stdDiscount}
            onChange={(e) => onLineChange(i, e)}
            onBlur={() => onNumBlur('stdDiscount', 'line', i)}
          />
        </td>
      ),
      stcode: () => (
        <td key="stcode">
          <input
            className="so-grid__input"
            name="stcode"
            value={line.stcode || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      taxCode: () => (
        <td key="taxCode">
          <TaxCodeLookup
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left' }}
            name="taxCode"
            value={line.taxCode || ''}
            onChange={(e) => onLineChange(i, e)}
            taxCodes={effectiveTaxCodes}
          />
        </td>
      ),
      taxAmount: () => (
        <td key="taxAmount">
          <input
            className="so-grid__input"
            value={getTaxAmountDisplay(line)}
            readOnly
            style={{ background: '#f5f8fc' }}
          />
        </td>
      ),
      totalLC: () => (
        <td key="totalLC">
          <input
            className="so-grid__input"
            value={lineTotals.beforeTax}
            readOnly
            style={{ background: '#f5f8fc' }}
          />
        </td>
      ),
      whse: () => (
        <td key="whse">
          <select
            className="so-grid__input"
            style={{ width: '100%', textAlign: 'left', border: valErrors.lines[i]?.whse ? '1px solid #c00' : undefined }}
            name="whse"
            value={line.whse}
            onChange={(e) => onLineChange(i, e)}
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
          {valErrors.lines[i]?.whse && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].whse}</div>
          )}
        </td>
      ),
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
          </select>
        </td>
      ),
      openQty: () => (
        <td key="openQty">
          <input
            className="so-grid__input"
            value={line.openQty || ''}
            readOnly
            style={{ background: '#f5f8fc' }}
          />
        </td>
      ),
      deliveredQty: () => (
        <td key="deliveredQty">
          <input
            className="so-grid__input"
            value={line.deliveredQty || ''}
            readOnly
            style={{ background: '#f5f8fc' }}
          />
        </td>
      ),
      countryOfOrigin: () => (
        <td key="countryOfOrigin">
          <input
            className="so-grid__input"
            name="countryOfOrigin"
            style={{ textTransform: 'uppercase' }}
            value={line.countryOfOrigin || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      freeText: () => (
        <td key="freeText">
          <input
            className="so-grid__input"
            name="freeText"
            value={line.freeText || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      uomName: () => (
        <td key="uomName">
          <input
            className="so-grid__input"
            value={line.uomName || line.uomCode || ''}
            readOnly
            style={{ background: '#f5f8fc' }}
          />
        </td>
      ),
      loc: () => (
        <td key="loc">
          <input
            className="so-grid__input"
            value={line.loc || ''}
            readOnly
            style={{ background: '#f5f8fc' }}
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
              value={line.hsnCode}
              onChange={(e) => onLineChange(i, e)}
              placeholder="HSN"
            />
            <button
              type="button"
              onClick={() => onOpenHSNModal && onOpenHSNModal(i)}
              style={pickerButtonStyle}
              title="Select HSN Code"
            >
              ...
            </button>
          </div>
          {valErrors.lines[i]?.hsnCode && (
            <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.lines[i].hsnCode}</div>
          )}
        </td>
      ),
      sacCode: () => (
        <td key="sacCode">
          <input
            className="so-grid__input"
            name="sacCode"
            value={line.sacCode || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      specialRebate: () => (
        <td key="specialRebate">
          <input
            className="so-grid__input"
            name="specialRebate"
            value={line.specialRebate || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      commission: () => (
        <td key="commission">
          <input
            className="so-grid__input"
            name="commission"
            value={line.commission || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      sellerBrokeragePerQty: () => (
        <td key="sellerBrokeragePerQty">
          <input
            className="so-grid__input"
            name="sellerBrokeragePerQty"
            value={line.sellerBrokeragePerQty || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      buyerPaymentTerms: () => (
        <td key="buyerPaymentTerms">
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1 }}
              name="buyerPaymentTerms"
              value={line.buyerPaymentTerms || ''}
              onChange={(e) => onLineChange(i, e)}
            />
            <button
              type="button"
              onClick={() => onOpenPaymentTermsModal && onOpenPaymentTermsModal('buyerPaymentTerms', i)}
              style={pickerButtonStyle}
              title="Select Buyer Terms of Payment"
            >
              ...
            </button>
          </div>
        </td>
      ),
      sellerPaymentTerms: () => (
        <td key="sellerPaymentTerms">
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              className="so-grid__input"
              style={{ flex: 1 }}
              name="sellerPaymentTerms"
              value={line.sellerPaymentTerms || ''}
              onChange={(e) => onLineChange(i, e)}
            />
            <button
              type="button"
              onClick={() => onOpenPaymentTermsModal && onOpenPaymentTermsModal('sellerPaymentTerms', i)}
              style={pickerButtonStyle}
              title="Select Seller Terms of Payment"
            >
              ...
            </button>
          </div>
        </td>
      ),
      buyerSpecialInstruction: () => (
        <td key="buyerSpecialInstruction">
          <input
            className="so-grid__input"
            name="buyerSpecialInstruction"
            value={line.buyerSpecialInstruction || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      sellerSpecialInstruction: () => (
        <td key="sellerSpecialInstruction">
          <input
            className="so-grid__input"
            name="sellerSpecialInstruction"
            value={line.sellerSpecialInstruction || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      buyerBillDiscount: () => (
        <td key="buyerBillDiscount">
          <input
            className="so-grid__input"
            name="buyerBillDiscount"
            value={line.buyerBillDiscount || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      sellerBillDiscount: () => (
        <td key="sellerBillDiscount">
          <input
            className="so-grid__input"
            name="sellerBillDiscount"
            value={line.sellerBillDiscount || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      sellerItem: () => (
        <td key="sellerItem">
          <input
            className="so-grid__input"
            name="sellerItem"
            value={line.sellerItem || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      sellerQty: () => (
        <td key="sellerQty">
          <input
            className="so-grid__input"
            name="sellerQty"
            value={line.sellerQty || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      freightPurchase: () => (
        <td key="freightPurchase">
          <input
            className="so-grid__input"
            name="freightPurchase"
            value={line.freightPurchase || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      freightSales: () => (
        <td key="freightSales">
          <input
            className="so-grid__input"
            name="freightSales"
            value={line.freightSales || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      freightProvider: () => (
        <td key="freightProvider">
          <input
            className="so-grid__input"
            name="freightProvider"
            value={line.freightProvider || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      freightProviderName: () => (
        <td key="freightProviderName">
          <input
            className="so-grid__input"
            name="freightProviderName"
            value={line.freightProviderName || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
      documentCreated: () => (
        <td key="documentCreated">
          <input
            className="so-grid__input"
            value={formatDateDisplay(line.documentCreated)}
            readOnly
            style={{ background: '#f5f8fc' }}
          />
        </td>
      ),
      brokerageNumber: () => (
        <td key="brokerageNumber">
          <input
            className="so-grid__input"
            name="brokerageNumber"
            value={line.brokerageNumber || ''}
            onChange={(e) => onLineChange(i, e)}
          />
        </td>
      ),
    };

    return cellRenderers[columnKey] ? cellRenderers[columnKey]() : null;
  };

  return (
    <div className="so-tab-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="so-section-title">Document Lines</div>
        <button type="button" className="so-btn so-btn--primary" onClick={onAddLine}>
          + Add Line
        </button>
      </div>

      <div className="so-grid-wrap so-grid-wrap--contents">
        <div
          className="so-grid-wrap__scroller so-grid-wrap__scroller--contents"
        >
          <table
            className="so-grid so-grid--contents"
            style={{
              width: 'max-content',
              minWidth: TABLE_MIN_WIDTH,
            }}
          >
          <colgroup>
            <col style={{ width: 42 }} />
            {visibleColumns.map((column) => (
              <col key={column.key} style={{ width: column.minWidth }} />
            ))}
            <col style={{ width: 48 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ width: 42 }}>#</th>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  style={{ minWidth: column.minWidth }}
                >
                  {column.label}
                </th>
              ))}
              <th style={{ width: 25 }}></th>
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

                  {visibleColumns.map(col => renderCell(col.key, line, i, uomOpts, lineTotals))}

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
