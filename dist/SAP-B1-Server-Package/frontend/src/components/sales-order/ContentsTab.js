import React from 'react';
import { MATRIX_COLUMNS, DECIMAL_CONFIG } from '../../config/salesOrderMetadata';
import { formatDecimal, sanitizeNumber } from '../../utils/numberUtils';

function ContentsTab({
  lines,
  items,
  warehouses,
  taxCodes,
  validationErrors,
  onLineChange,
  onAddLine,
  onRemoveLine,
  getUomOptions,
}) {
  const formatTaxLabel = (taxCode) => {
    const code = taxCode.Code || '';
    const name = taxCode.Name || '';
    const rate = taxCode.Rate != null ? `${taxCode.Rate}%` : '';
    return `${code} - ${name} ${rate}`.trim();
  };

  return (
    <div className="so-contents-tab">
      <div className="so-matrix-header">
        <h3>Document Lines</h3>
        <button type="button" className="so-btn so-btn-sm" onClick={onAddLine}>
          + Add Line
        </button>
      </div>

      <div className="so-matrix-wrapper">
        <table className="so-matrix">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              {MATRIX_COLUMNS.map(col => (
                <th key={col.key} style={{ minWidth: col.width }}>
                  {col.label}
                  {col.required && <span className="so-required">*</span>}
                </th>
              ))}
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const uomOptions = getUomOptions(line);
              const lineErrors = validationErrors[index] || {};

              return (
                <tr key={index}>
                  <td className="so-matrix-cell-center">{index + 1}</td>

                  {/* Item/Service Type */}
                  <td>
                    <select
                      className="so-matrix-input"
                      value={line.itemServiceType}
                      onChange={(e) => onLineChange(index, 'itemServiceType', e.target.value)}
                    >
                      <option value="Item">Item</option>
                      <option value="Service">Service</option>
                    </select>
                  </td>

                  {/* Item No */}
                  <td>
                    <select
                      className={`so-matrix-input ${lineErrors.itemNo ? 'so-input-error' : ''}`}
                      value={line.itemNo}
                      onChange={(e) => onLineChange(index, 'itemNo', e.target.value)}
                    >
                      <option value="">Select Item</option>
                      {items.map(item => (
                        <option key={item.ItemCode} value={item.ItemCode}>
                          {item.ItemCode}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Item Description */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input"
                      value={line.itemDescription}
                      onChange={(e) => onLineChange(index, 'itemDescription', e.target.value)}
                    />
                  </td>

                  {/* Quantity */}
                  <td>
                    <input
                      type="text"
                      className={`so-matrix-input so-matrix-input-right ${lineErrors.quantity ? 'so-input-error' : ''}`}
                      value={line.quantity}
                      onChange={(e) => onLineChange(index, 'quantity', sanitizeNumber(e.target.value, DECIMAL_CONFIG.quantity))}
                      onBlur={(e) => onLineChange(index, 'quantity', formatDecimal(e.target.value, DECIMAL_CONFIG.quantity))}
                    />
                  </td>

                  {/* Unit Price */}
                  <td>
                    <input
                      type="text"
                      className={`so-matrix-input so-matrix-input-right ${lineErrors.unitPrice ? 'so-input-error' : ''}`}
                      value={line.unitPrice}
                      onChange={(e) => onLineChange(index, 'unitPrice', sanitizeNumber(e.target.value, DECIMAL_CONFIG.unitPrice))}
                      onBlur={(e) => onLineChange(index, 'unitPrice', formatDecimal(e.target.value, DECIMAL_CONFIG.unitPrice))}
                    />
                  </td>

                  {/* Discount % */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-right"
                      value={line.discountPercent}
                      onChange={(e) => onLineChange(index, 'discountPercent', sanitizeNumber(e.target.value, DECIMAL_CONFIG.discount))}
                      onBlur={(e) => onLineChange(index, 'discountPercent', formatDecimal(e.target.value, DECIMAL_CONFIG.discount))}
                    />
                  </td>

                  {/* Price After Discount */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-right so-matrix-input-readonly"
                      value={line.priceAfterDiscount}
                      readOnly
                    />
                  </td>

                  {/* Tax Code */}
                  <td>
                    <select
                      className={`so-matrix-input ${lineErrors.taxCode ? 'so-input-error' : ''}`}
                      value={line.taxCode}
                      onChange={(e) => onLineChange(index, 'taxCode', e.target.value)}
                    >
                      <option value="">Select Tax</option>
                      {taxCodes.map(tax => (
                        <option key={tax.Code} value={tax.Code}>
                          {formatTaxLabel(tax)}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Total (LC) */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-right so-matrix-input-readonly"
                      value={line.totalLC}
                      readOnly
                    />
                  </td>

                  {/* Warehouse */}
                  <td>
                    <select
                      className={`so-matrix-input ${lineErrors.warehouse ? 'so-input-error' : ''}`}
                      value={line.warehouse}
                      onChange={(e) => onLineChange(index, 'warehouse', e.target.value)}
                    >
                      <option value="">Select</option>
                      {warehouses.map(wh => (
                        <option key={wh.WhsCode} value={wh.WhsCode}>
                          {wh.WhsCode}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Distr. Rule */}
                  <td>
                    <select
                      className="so-matrix-input"
                      value={line.distRule}
                      onChange={(e) => onLineChange(index, 'distRule', e.target.value)}
                    >
                      <option value="">Select</option>
                    </select>
                  </td>

                  {/* Remove Button */}
                  <td className="so-matrix-cell-center">
                    <button
                      type="button"
                      className="so-btn-icon so-btn-danger"
                      onClick={() => onRemoveLine(index)}
                      title="Remove line"
                    >
                      ×
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
