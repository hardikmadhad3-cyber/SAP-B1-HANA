import React, { useRef } from 'react';

const COLUMNS = [
  { key: 'itemCode', label: 'Item No.', minWidth: 155 },
  { key: 'itemDescription', label: 'Item Description', minWidth: 210, readOnly: true },
  { key: 'quantity', label: 'Quantity', minWidth: 90, numeric: true },
  { key: 'unitPrice', label: 'Unit Price', minWidth: 105, numeric: true },
  { key: 'total', label: 'Total', minWidth: 110, numeric: true, readOnly: true },
  { key: 'warehouse', label: 'Whse', minWidth: 100 },
  { key: 'accountCode', label: 'Account Code', minWidth: 135, lookup: 'account' },
  { key: 'itemCost', label: 'Item Cost', minWidth: 110, numeric: true, readOnly: true },
  { key: 'inventoryUOM', label: 'Inventory UoM', minWidth: 130, readOnly: true },
  { key: 'uomCode', label: 'UoM Code', minWidth: 105, readOnly: true },
  { key: 'uomName', label: 'UoM Name', minWidth: 120, readOnly: true },
  { key: 'distributionRule', label: 'Distr. Rule', minWidth: 115, lookup: 'distRule' },
  { key: 'rg23aPartINo', label: 'RG23A Part I No.', minWidth: 145, udfLabels: ['RG23A Part I No.', 'RG23A Part I No', 'U_RG23APartI'] },
  { key: 'rg23cPartINo', label: 'RG23C Part I No.', minWidth: 145, udfLabels: ['RG23C Part I No.', 'RG23C Part I No', 'U_RG23CPartI'] },
  { key: 'location', label: 'Location', minWidth: 120, lookup: 'location' },
  { key: 'saudaNodeRef', label: 'Sauda Node Ref', minWidth: 145, udfLabels: ['Sauda Nodh Ref', 'Sauda Nodh No', 'U_SaudaNodeRef', 'U_SaudaNodhRef'] },
  { key: 'apInvDocKey', label: 'AP Inv DocKey', minWidth: 135, udfLabels: ['U_APInvDocKey', 'U_APInvDocEntry'] },
  { key: 'apInvDocNum', label: 'AP Inv DocNum', minWidth: 140, udfLabels: ['U_APInvDocNum'] },
  { key: 'apInvLineNum', label: 'AP Inv LineNum', minWidth: 145, udfLabels: ['U_APInvLineNum'] },
  { key: 'assessableValue', label: 'Assessable Value', minWidth: 145, udfLabels: ['U_AssessableValue'] },
  { key: 'bedRate', label: 'BED Rate', minWidth: 105, udfLabels: ['BEDRATE', 'U_BEDRate'] },
  { key: 'bedAmount', label: 'BED Amount', minWidth: 120, udfLabels: ['BEDAMOUNT', 'U_BEDAmount'] },
  { key: 'rg23dNo', label: 'RG23DNo', minWidth: 115, udfLabels: ['RG23DNO', 'U_RG23DNo', 'U_RG23DNO'] },
  { key: 'specialRebate', label: 'Special Rebate', minWidth: 135, udfLabels: ['U_SPLRBT', 'U_SpecialRebate'] },
  { key: 'commision', label: 'Commision', minWidth: 115, udfLabels: ['Commission', 'U_COMPRC', 'U_Commision', 'U_Commission'] },
  { key: 'sellerItem', label: 'S_Item', minWidth: 115, lookup: 'item', udfLabels: ['U_S_Item', 'U_SItem'] },
  { key: 'sellerUnitPrice', label: 'Unit Price', minWidth: 105, udfLabels: ['Seller Unit Price', 'S Unit Price', 'U_Unit_Price'] },
  { key: 'sellerQuantity', label: 'S_Qty', minWidth: 95, udfLabels: ['U_S_Qty', 'U_SQty'] },
  { key: 'brokPerQty', label: 'BrokPerQty', minWidth: 120, udfLabels: ['U_S_BrokPerQty', 'U_BrokPerQty'] },
  { key: 'sellerBrokerage', label: 'Seller Brokerage', minWidth: 150, udfLabels: ['U_Brok_Seller', 'U_SellerBrokerage'] },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage', minWidth: 145, udfLabels: ['U_Brok_Buyer', 'U_BuyerBrokerage'] },
  { key: 'buyerDelivery', label: 'Buyer - Delivery', minWidth: 145, udfLabels: ['U_Buyer_Delivery', 'U_BuyerDelivery'] },
  { key: 'buyerTermsOfPayment', label: 'Buyer - Terms of payment', minWidth: 200, lookup: 'paymentTerm', udfLabels: ['Buyer - Terms of Payment', 'U_Buyer_Payment_Terms', 'U_BuyerTermsOfPayment', 'U_BuyerPayTerms'] },
  { key: 'sellerDelivery', label: 'Seller - Delivery', minWidth: 145, udfLabels: ['U_Seller_Delivery', 'U_SellerDelivery'] },
  { key: 'sellerTermsOfPayment', label: 'Seller - Terms of Payment', minWidth: 205, lookup: 'paymentTerm', udfLabels: ['U_Seller_Payment_Terms', 'U_SellerTermsOfPayment', 'U_SellerPayTerms'] },
  { key: 'buyerQuality', label: 'Buyer - Quality', minWidth: 140, udfLabels: ['U_Buyer_Quality', 'U_BuyerQuality'] },
  { key: 'sellerQuality', label: 'Seller - Quality', minWidth: 145, udfLabels: ['U_Seller_Quality', 'U_SellerQuality'] },
  { key: 'buyerPrice', label: 'Buyer - Price', minWidth: 130, udfLabels: ['U_Buyer_Price', 'U_BuyerPrice'] },
  { key: 'sellerPrice', label: 'Seller - Price', minWidth: 130, udfLabels: ['U_Seller_Price', 'U_SellerPrice'] },
  { key: 'buyerSpecialInstruction', label: 'Buyer - Special Instruction', minWidth: 210, udfLabels: ['U_Buyer_SPINS', 'U_BuyerSpecialInstruction', 'U_BuyerSplInst'] },
  { key: 'sellerSpecialInstruction', label: 'Seller - Special Instruction', minWidth: 210, udfLabels: ['U_Seller_SPINS', 'U_SellerSpecialInstruction', 'U_SellerSplInst'] },
  { key: 'sellerBrokerageAmountPer', label: 'Seller Brokerage(Amt./Per)', minWidth: 210, udfLabels: ['Seller Brokerage Amt Per', 'U_Sel_Brok_AP', 'U_SellerBrokerageAmtPer', 'U_SellBrkAmtPer'] },
  { key: 'sellerBrokeragePercentage', label: 'Seller Brokerage in Percentage', minWidth: 225, udfLabels: ['U_Seller_Brok_Per', 'U_SellerBrokeragePercentage', 'U_SellerBrkPct'] },
  { key: 'buyerBillDiscount', label: 'Buyer Bill Discount', minWidth: 165, udfLabels: ['U_Buyer_Bill_Disc', 'U_BuyerBillDiscount'] },
  { key: 'sellerBillDiscount', label: 'Seller Bill Discount', minWidth: 170, udfLabels: ['U_Seller_Bill_Disc', 'U_SellerBillDiscount'] },
  { key: 'stcode', label: 'STCODE', minWidth: 115, udfLabels: ['STCode', 'U_SELLTCODE', 'U_STCODE'] },
  { key: 'freightPurchase', label: 'Freight Purchase', minWidth: 150, udfLabels: ['U_Freight_pur', 'U_FreightPurchase'] },
  { key: 'freightSales', label: 'Freight Sales', minWidth: 130, udfLabels: ['U_Freight_sales', 'U_FreightSales'] },
  { key: 'freightProvider', label: 'Freight Provider', minWidth: 155, lookup: 'businessPartner', udfLabels: ['U_Fr_trans', 'U_FreightProvider'] },
  { key: 'freightProviderName', label: 'Freight Provider Name', minWidth: 180, udfLabels: ['U_Fr_trans_name', 'U_FreightProviderName'] },
  { key: 'documentCreated', label: 'Document Created', minWidth: 160, udfLabels: ['U_DocumentCreated'] },
  { key: 'brokerageNumber', label: 'Brokerage Number', minWidth: 160, udfLabels: ['Brokerage No', 'U_BDNum', 'U_BrokerageNumber', 'U_BrokerageNo'] },
  { key: 'sellerTermsOfPaymentDuplicate', label: 'Seller - Terms of Payment', minWidth: 205, lookup: 'paymentTerm', udfLabels: ['Seller - Terms of Payment', 'U_Seller_Payment_Terms', 'U_SellerTermsOfPayment', 'U_SellerPayTerms'] },
];

const STANDARD_KEYS = new Set([
  'itemCode',
  'itemDescription',
  'quantity',
  'unitPrice',
  'total',
  'warehouse',
  'accountCode',
  'itemCost',
  'inventoryUOM',
  'uomCode',
  'uomName',
  'distributionRule',
  'location',
]);
const normalizeIdentity = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const fieldIdentities = (field = {}) => [field.key, field.sapField, field.aliasId, field.label, field.description].map(normalizeIdentity).filter(Boolean);
const getBoundUdf = (column, fields) => {
  if (column.udfField) return column.udfField;
  if (STANDARD_KEYS.has(column.key)) return null;
  const identities = [column.key, column.label, ...(column.udfLabels || [])].map(normalizeIdentity);
  return fields.find((field) => fieldIdentities(field).some((identity) => identities.includes(identity))) || null;
};

function ContentsTab({
  lines,
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
  onOpenBatchModal,
  onAddLine,
  onRemoveLine,
  errors,
}) {
  const inputRefs = useRef({});
  const boundUdfKeys = new Set(
    COLUMNS.map((column) => getBoundUdf(column, rowUdfFields)?.key).filter(Boolean)
  );
  const baseVisibleColumns = COLUMNS.filter((column) => {
    const udfField = getBoundUdf(column, rowUdfFields);
    if (STANDARD_KEYS.has(column.key)) {
      return formSettings.matrixColumns?.[column.key]?.visible !== false;
    }
    if (udfField) {
      return formSettings.rowUdfs?.[udfField.key]?.visible !== false;
    }
    return formSettings.matrixColumns?.[column.key]?.visible !== false;
  });
  const dynamicUdfColumns = rowUdfFields
    .filter((field) => !boundUdfKeys.has(field.key))
    .filter((field) => formSettings.rowUdfs?.[field.key]?.visible !== false)
    .map((field) => ({
      key: `udf:${field.key}`,
      label: field.label || field.key,
      minWidth: Math.max(140, Math.min(240, String(field.label || field.key).length * 9)),
      udfField: field,
    }));
  const visibleColumns = [...baseVisibleColumns, ...dynamicUdfColumns];
  const showBatchesColumn = formSettings.matrixColumns?.batches?.visible !== false;

  const focusCell = (rowIndex, columnKey) => {
    const target = inputRefs.current[`${rowIndex}:${columnKey}`];
    target?.focus();
    target?.select?.();
  };

  const handleCellKeyDown = (event, rowIndex, columnKey) => {
    const columnIndex = visibleColumns.findIndex((column) => column.key === columnKey);
    if (columnIndex < 0) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = visibleColumns[columnIndex + 1];
      if (next) focusCell(rowIndex, next.key);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const previous = visibleColumns[columnIndex - 1];
      if (previous) focusCell(rowIndex, previous.key);
    } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      if (lines[rowIndex + 1]) focusCell(rowIndex + 1, columnKey);
      else {
        onAddLine();
        requestAnimationFrame(() => focusCell(rowIndex + 1, columnKey));
      }
    } else if (event.key === 'ArrowUp' && rowIndex > 0) {
      event.preventDefault();
      focusCell(rowIndex - 1, columnKey);
    }
  };

  const renderCell = (column, line, rowIndex, isCopiedRow, rowErrors) => {
    const udfField = getBoundUdf(column, rowUdfFields);
    const isUdf = !STANDARD_KEYS.has(column.key);
    const value = isUdf ? (udfField ? line.udf?.[udfField.key] || '' : '') : line[column.key] ?? '';
    const fieldInactive = isUdf && udfField
      ? formSettings.rowUdfs?.[udfField.key]?.active === false
      : formSettings.matrixColumns?.[column.key]?.active === false;
    const disabled = isUdf ? !udfField || udfField.readOnly || fieldInactive : Boolean(fieldInactive || column.readOnly || (isCopiedRow && ['quantity', 'unitPrice', 'accountCode', 'location'].includes(column.key)));
    const changeValue = (nextValue) => {
      if (isUdf && udfField) onRowUdfChange(rowIndex, udfField.key, nextValue);
      else onFieldChange(rowIndex, column.key, nextValue);
    };

    if (column.key === 'distributionRule') {
      const displayValue = [
        line.distributionRule,
        line.distributionRule2,
        line.distributionRule3,
        line.distributionRule4,
        line.distributionRule5,
      ].filter(Boolean).join(' / ');

      return (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <input ref={(node) => { inputRefs.current[`${rowIndex}:${column.key}`] = node; }} className={`po-grid__input po-grid__input--text ${rowErrors[column.key] ? 'gr-goods-receipt__input--error' : ''}`} value={displayValue} readOnly title={displayValue} onFocus={() => onFocusRow(rowIndex)} onKeyDown={(event) => handleCellKeyDown(event, rowIndex, column.key)} />
          {!disabled && onOpenLineLookup && <button type="button" className="gr-goods-receipt__lookup-btn" onClick={() => onOpenLineLookup(column, rowIndex, udfField)} title={`Select ${column.label}`}>...</button>}
        </div>
      );
    }

    if (column.key === 'itemCode') {
      return (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <input ref={(node) => { inputRefs.current[`${rowIndex}:itemCode`] = node; }} className={`po-grid__input po-grid__input--text ${rowErrors.itemCode ? 'gr-goods-receipt__input--error' : ''}`} value={line.itemCode} readOnly={isCopiedRow} onFocus={() => onFocusRow(rowIndex)} onChange={(event) => onItemCodeChange(rowIndex, event.target.value)} onBlur={() => onItemCommit(rowIndex)} onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 'itemCode')} />
          {!isCopiedRow && <button type="button" className="gr-goods-receipt__lookup-btn" onClick={() => onOpenItemModal(rowIndex)} title="Select Item">...</button>}
        </div>
      );
    }

    if (column.key === 'warehouse') {
      return (
        <select ref={(node) => { inputRefs.current[`${rowIndex}:${column.key}`] = node; }} className={`po-grid__input po-grid__input--text ${rowErrors.warehouse ? 'gr-goods-receipt__input--error' : ''}`} value={line.warehouse} disabled={isCopiedRow} onFocus={() => onFocusRow(rowIndex)} onChange={(event) => changeValue(event.target.value)} onKeyDown={(event) => handleCellKeyDown(event, rowIndex, column.key)}>
          <option value="">Select</option>
          {warehouses.map((warehouse) => <option key={warehouse.whsCode} value={warehouse.whsCode}>{warehouse.whsCode} - {warehouse.whsName}</option>)}
        </select>
      );
    }

    if (udfField?.type === 'select') {
      return (
        <select className="po-grid__input" value={value} disabled={disabled} onChange={(event) => changeValue(event.target.value)}>
          <option value=""></option>
          {(udfField.options || []).map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}
        </select>
      );
    }

    if (udfField?.type === 'checkbox') {
      return <input type="checkbox" checked={['Y', 'YES', 'TRUE', '1'].includes(String(value).toUpperCase())} disabled={disabled} onChange={(event) => changeValue(event.target.checked ? 'Y' : 'N')} />;
    }

    return (
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <input ref={(node) => { inputRefs.current[`${rowIndex}:${column.key}`] = node; }} className={`po-grid__input ${column.numeric ? '' : 'po-grid__input--text'} ${rowErrors[column.key] ? 'gr-goods-receipt__input--error' : ''}`} type={udfField?.type === 'date' ? 'date' : udfField?.type === 'number' ? 'number' : 'text'} value={value} readOnly={disabled} disabled={isUdf && !udfField} title={isUdf && !udfField ? 'Field is not configured on SAP IGN1' : String(value || '')} onFocus={() => onFocusRow(rowIndex)} onChange={(event) => changeValue(event.target.value)} onKeyDown={(event) => handleCellKeyDown(event, rowIndex, column.key)} />
        {column.lookup && !disabled && onOpenLineLookup && <button type="button" className="gr-goods-receipt__lookup-btn" onClick={() => onOpenLineLookup(column, rowIndex, udfField)} title={`Select ${column.label}`}>...</button>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="po-section-title" style={{ marginBottom: 0 }}>Item Matrix</div>
        <button type="button" className="po-btn po-btn--primary" onClick={onAddLine}>+ Add Line</button>
      </div>
      <div className="po-grid-wrap gr-goods-receipt__grid-wrap">
        <table className="po-grid gr-goods-receipt__grid" style={{ width: 'max-content', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 38 }} />
            {visibleColumns.map((column) => <col key={column.key} style={{ width: column.minWidth }} />)}
            {showBatchesColumn && <col style={{ width: 110 }} />}
            <col style={{ width: 38 }} />
          </colgroup>
          <thead><tr><th>#</th>{visibleColumns.map((column) => <th key={column.key}>{column.label}</th>)}{showBatchesColumn && <th>Batches</th>}<th></th></tr></thead>
          <tbody>
            {lines.map((line, rowIndex) => {
              const rowErrors = errors[rowIndex] || {};
              const isCopiedRow = line.baseEntry != null || line.lockedByCopy;
              return (
                <tr key={`${rowIndex}-${line.itemCode || 'blank'}`} className={activeRow === rowIndex ? 'gr-goods-receipt__row--active' : ''}>
                  <td className="po-grid__cell--muted" style={{ textAlign: 'center' }}>{rowIndex + 1}</td>
                  {visibleColumns.map((column) => <td key={column.key}>{renderCell(column, line, rowIndex, isCopiedRow, rowErrors)}{rowErrors[column.key] && <div className="po-error-feedback">{rowErrors[column.key]}</div>}</td>)}
                  {showBatchesColumn && <td>{line.batchManaged && onOpenBatchModal ? <button type="button" className="po-btn po-btn--primary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => onOpenBatchModal(rowIndex)}>{line.batches?.length ? `${line.batches.length} Assigned` : 'Assign Batch'}</button> : <span className="po-grid__cell--muted" style={{ fontSize: 11 }}>{line.serialManaged ? 'Serial Item' : 'Not Batch Item'}</span>}</td>}
                  <td><button type="button" className="po-btn po-btn--danger" style={{ padding: '1px 7px' }} onClick={() => onRemoveLine(rowIndex)}>x</button></td>
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
