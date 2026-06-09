import React, { useRef } from 'react';

const COLUMN_ORDER = [
  'itemCode',
  'itemDescription',
  'fromWarehouse',
  'toWarehouse',
  'location',
  'quantity',
  'excisable',
  'distributionRule',
  'uomCode',
  'uomName',
  'saudaNodeRef',
  'apInvDocKey',
  'apInvDocNum',
  'apInvLineNum',
  'assessableValue',
  'bedRate',
  'bedAmount',
  'rg23dNo',
  'specialRebate',
  'commision',
  'brokPerQty',
  'unitPrice',
  'sellerBrokerage',
  'buyerBrokerage',
  'buyerDelivery',
  'sellerDelivery',
  'buyerTermsOfPayment',
  'sellerTermsOfPayment',
  'buyerQuality',
  'sellerQuality',
  'buyerPrice',
  'sellerPrice',
  'buyerSpecialInstruction',
  'sellerSpecialInstruction',
  'sellerBrokerageAmountPer',
  'sellerBrokeragePercentage',
  'buyerBillDiscount',
  'sellerBillDiscount',
  'stcode',
  'sellerItem',
  'sellerQuantity',
  'freightPurchase',
  'freightSales',
  'freightProvider',
  'freightProviderName',
  'documentCreated',
  'brokerageNumber',
  'sellerTermsOfPaymentDuplicate',
];

const COLUMN_LABELS = {
  itemCode: 'Item No.',
  itemDescription: 'Item Description',
  fromWarehouse: 'From Warehouse',
  toWarehouse: 'To Warehouse',
  location: 'Loc.',
  quantity: 'Quantity',
  excisable: 'Excisable',
  distributionRule: 'Distr. Rule',
  uomCode: 'UoM Code',
  uomName: 'UoM Name',
  saudaNodeRef: 'Sauda Node Ref',
  apInvDocKey: 'AP Inv DocKey',
  apInvDocNum: 'AP Inv DocNum',
  apInvLineNum: 'AP Inv LineNum',
  assessableValue: 'Assessable Value',
  bedRate: 'BED Rate',
  bedAmount: 'BED Amount',
  rg23dNo: 'RG23DNo',
  specialRebate: 'Special Rebate',
  commision: 'Commision',
  brokPerQty: 'BrokPerQty',
  unitPrice: 'Unit Price',
  sellerBrokerage: 'Seller Brokerage',
  buyerBrokerage: 'Buyer Brokerage',
  buyerDelivery: 'Buyer - Delivery',
  sellerDelivery: 'Seller - Delivery',
  buyerTermsOfPayment: 'Buyer - Terms of payment',
  sellerTermsOfPayment: 'Seller - Terms of Payment',
  buyerQuality: 'Buyer - Quality',
  sellerQuality: 'Seller - Quality',
  buyerPrice: 'Buyer - Price',
  sellerPrice: 'Seller - Price',
  buyerSpecialInstruction: 'Buyer - Special Instruction',
  sellerSpecialInstruction: 'Seller - Special Instruction',
  sellerBrokerageAmountPer: 'Seller Brokerage(Amt./Per)',
  sellerBrokeragePercentage: 'Seller Brokerage in Percentage',
  buyerBillDiscount: 'Buyer Bill Discount',
  sellerBillDiscount: 'Seller Bill Discount',
  stcode: 'STCODE',
  sellerItem: 'S_Item',
  sellerQuantity: 'S_Qty',
  freightPurchase: 'Freight Purchase',
  freightSales: 'Freight Sales',
  freightProvider: 'Freight Provider',
  freightProviderName: 'Freight Provider Name',
  documentCreated: 'Document Created',
  brokerageNumber: 'Brokerage Number',
  sellerTermsOfPaymentDuplicate: 'Seller - Terms of Payment',
};

const READ_ONLY_COLUMNS = new Set([
  'itemDescription',
  'location',
  'uomCode',
  'uomName',
  'assessableValue',
  'bedAmount',
  'freightProviderName',
]);

const NUMERIC_COLUMNS = new Set([
  'quantity',
  'assessableValue',
  'bedRate',
  'bedAmount',
  'brokPerQty',
  'unitPrice',
  'sellerBrokerageAmountPer',
  'sellerBrokeragePercentage',
  'buyerBillDiscount',
  'sellerBillDiscount',
  'sellerQuantity',
  'freightPurchase',
  'freightSales',
]);

const LOOKUP_BY_COLUMN = {
  location: 'location',
  distributionRule: 'distRule',
  sellerItem: 'item',
  buyerTermsOfPayment: 'paymentTerm',
  sellerTermsOfPayment: 'paymentTerm',
  freightProvider: 'businessPartner',
  sellerTermsOfPaymentDuplicate: 'paymentTerm',
};

const STANDARD_KEYS = new Set([
  'itemCode',
  'itemDescription',
  'fromWarehouse',
  'toWarehouse',
  'location',
  'quantity',
  'excisable',
  'distributionRule',
  'uomCode',
  'uomName',
]);
const normalizeIdentity = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const fieldIdentities = (field = {}) =>
  [field.key, field.sapField, field.aliasId, field.label, field.description]
    .map(normalizeIdentity)
    .filter(Boolean);
const getBoundUdf = (columnKey, rowUdfFields = []) => {
  if (typeof columnKey === 'object' && columnKey?.udfField) return columnKey.udfField;
  const key = typeof columnKey === 'object' ? columnKey.key : columnKey;
  const label = typeof columnKey === 'object' ? columnKey.label : COLUMN_LABELS[key];
  if (STANDARD_KEYS.has(key)) return null;
  const identities = [key, label].map(normalizeIdentity);
  return rowUdfFields.find((field) =>
    fieldIdentities(field).some((identity) => identities.includes(identity))
  ) || null;
};

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
  onRowUdfChange,
  rowUdfFields = [],
  formSettings = {},
  onOpenLineLookup,
  onAddLine,
  onRemoveLine,
  errors,
}) {
  const inputRefs = useRef({});
  const boundUdfKeys = new Set(
    COLUMN_ORDER.map((columnKey) => getBoundUdf(columnKey, rowUdfFields)?.key).filter(Boolean)
  );
  const baseVisibleColumnOrder = COLUMN_ORDER.filter((columnKey) => {
    const udfField = getBoundUdf(columnKey, rowUdfFields);
    if (STANDARD_KEYS.has(columnKey)) {
      return formSettings.matrixColumns?.[columnKey]?.visible !== false;
    }
    if (udfField) {
      return formSettings.rowUdfs?.[udfField.key]?.visible !== false;
    }
    return formSettings.matrixColumns?.[columnKey]?.visible !== false;
  });
  const dynamicUdfColumns = rowUdfFields
    .filter((field) => !boundUdfKeys.has(field.key))
    .filter((field) => formSettings.rowUdfs?.[field.key]?.visible !== false)
    .map((field) => ({
      key: `udf:${field.key}`,
      label: field.label || field.key,
      udfField: field,
    }));
  const visibleColumnOrder = [...baseVisibleColumnOrder, ...dynamicUdfColumns];
  const showItemCodeColumn = visibleColumnOrder.includes('itemCode');

  const focusCell = (rowIndex, columnKey) => {
    const target = inputRefs.current[`${rowIndex}:${columnKey}`];
    if (target) {
      target.focus();
      target.select?.();
    }
  };

  const handleCellKeyDown = (event, rowIndex, columnKey) => {
    const columnIndex = visibleColumnOrder.findIndex((column) => (column.key || column) === columnKey);
    if (columnIndex === -1) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextColumn = visibleColumnOrder[columnIndex + 1];
      if (nextColumn) {
        focusCell(rowIndex, nextColumn.key || nextColumn);
        return;
      }
      if (lines[rowIndex + 1]) {
        focusCell(rowIndex + 1, visibleColumnOrder[0]?.key || visibleColumnOrder[0]);
        return;
      }
      onAddLine();
      requestAnimationFrame(() => focusCell(rowIndex + 1, visibleColumnOrder[0]?.key || visibleColumnOrder[0]));
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const previousColumn = visibleColumnOrder[columnIndex - 1];
      if (previousColumn) {
        focusCell(rowIndex, previousColumn.key || previousColumn);
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
              {visibleColumnOrder.map((column) => {
                const columnKey = column.key || column;
                return <th key={columnKey}>{column.label || COLUMN_LABELS[columnKey]}</th>;
              })}
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

                  {showItemCodeColumn && <td>
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
                  </td>}

                  {visibleColumnOrder.filter((column) => (column.key || column) !== 'itemCode').map((column) => {
                    const columnKey = column.key || column;
                    const columnLabel = column.label || COLUMN_LABELS[columnKey];
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
                    const lookup = LOOKUP_BY_COLUMN[columnKey];
                    const udfField = getBoundUdf(column, rowUdfFields);
                    const isUdf = Boolean(udfField);
                    const fieldInactive = isUdf
                      ? formSettings.rowUdfs?.[udfField.key]?.active === false
                      : formSettings.matrixColumns?.[columnKey]?.active === false;
                    const displayValue = isUdf
                      ? line.udf?.[udfField.key] || ''
                      : line[columnKey] ?? '';
                    const handleValueChange = (nextValue) => {
                      if (isUdf) onRowUdfChange?.(rowIndex, udfField.key, nextValue);
                      else onFieldChange(rowIndex, columnKey, nextValue);
                    };

                    return (
                      <td key={columnKey}>
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <input
                            ref={(node) => {
                              inputRefs.current[`${rowIndex}:${columnKey}`] = node;
                            }}
                            className={`po-grid__input ${
                              NUMERIC_COLUMNS.has(columnKey) ? '' : 'po-grid__input--text'
                            } ${rowErrors[columnKey] ? 'itr-transfer-request__input--error' : ''}`}
                            value={displayValue}
                            readOnly={readOnly || fieldInactive}
                            onFocus={() => onFocusRow(rowIndex)}
                            onChange={(event) => handleValueChange(event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(event, rowIndex, columnKey)}
                          />
                          {lookup && !fieldInactive && onOpenLineLookup && (
                            <button
                              type="button"
                              className="gr-goods-receipt__lookup-btn"
                              onClick={() =>
                                onOpenLineLookup(
                                  { key: columnKey, label: columnLabel, lookup },
                                  rowIndex,
                                  udfField
                                )
                              }
                              title={`Select ${columnLabel}`}
                            >
                              ...
                            </button>
                          )}
                        </div>
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
