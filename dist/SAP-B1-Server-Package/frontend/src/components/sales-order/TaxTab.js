import React from 'react';
import { TAX_COLUMNS, DECIMAL_CONFIG } from '../../config/salesOrderMetadata';
import { formatDecimal } from '../../utils/numberUtils';

function TaxTab({ lines, taxCodes, totals }) {
  return (
    <div className="so-tax-tab">
      <div className="so-matrix-wrapper">
        <table className="so-matrix">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              {TAX_COLUMNS.map(col => (
                <th key={col.key} style={{ minWidth: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const taxCode = taxCodes.find(t => t.Code === line.taxCode);
              const taxRate = taxCode ? taxCode.Rate : 0;
              
              // Find tax breakdown for this line
              const taxBreakdown = totals.taxBreakdown.find(t => t.taxCode === line.taxCode);
              const taxableAmount = taxBreakdown ? taxBreakdown.taxableAmount : 0;
              const taxAmount = taxBreakdown ? taxBreakdown.taxAmount : 0;
              const totalAmount = taxableAmount + taxAmount;

              return (
                <tr key={index}>
                  <td className="so-matrix-cell-center">{index + 1}</td>

                  {/* Item/Service Type */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-readonly"
                      value={line.itemServiceType}
                      readOnly
                    />
                  </td>

                  {/* Item No */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-readonly"
                      value={line.itemNo}
                      readOnly
                    />
                  </td>

                  {/* Tax Code */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-readonly"
                      value={line.taxCode}
                      readOnly
                    />
                  </td>

                  {/* Tax Rate */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-right so-matrix-input-readonly"
                      value={formatDecimal(taxRate, 2)}
                      readOnly
                    />
                  </td>

                  {/* Taxable Amount */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-right so-matrix-input-readonly"
                      value={formatDecimal(taxableAmount, DECIMAL_CONFIG.total)}
                      readOnly
                    />
                  </td>

                  {/* Tax Amount */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-right so-matrix-input-readonly"
                      value={formatDecimal(taxAmount, DECIMAL_CONFIG.tax)}
                      readOnly
                    />
                  </td>

                  {/* Total Amount */}
                  <td>
                    <input
                      type="text"
                      className="so-matrix-input so-matrix-input-right so-matrix-input-readonly"
                      value={formatDecimal(totalAmount, DECIMAL_CONFIG.total)}
                      readOnly
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tax Summary */}
      {totals.taxBreakdown.length > 0 && (
        <div className="so-tax-summary-section">
          <h4>Tax Summary</h4>
          <table className="so-tax-summary-table">
            <thead>
              <tr>
                <th>Tax Code</th>
                <th>Tax Rate</th>
                <th>Taxable Amount</th>
                <th>Tax Amount</th>
              </tr>
            </thead>
            <tbody>
              {totals.taxBreakdown.map(tax => (
                <tr key={tax.taxCode}>
                  <td>{tax.taxCode}</td>
                  <td className="so-text-right">{formatDecimal(tax.taxRate, 2)}%</td>
                  <td className="so-text-right">{formatDecimal(tax.taxableAmount, DECIMAL_CONFIG.total)}</td>
                  <td className="so-text-right">{formatDecimal(tax.taxAmount, DECIMAL_CONFIG.tax)}</td>
                </tr>
              ))}
              <tr className="so-tax-summary-total">
                <td colSpan="3">Total Tax</td>
                <td className="so-text-right">{formatDecimal(totals.taxAmount, DECIMAL_CONFIG.tax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TaxTab;
