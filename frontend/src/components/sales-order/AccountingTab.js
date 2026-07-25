import React from 'react';
import { ACCOUNTING_COLUMNS } from '../../config/salesOrderMetadata';

function AccountingTab({ lines, taxCodes, onLineChange }) {
  return (
    <div className="so-accounting-tab">
      <div className="so-matrix-wrapper">
        <table className="so-matrix">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              {ACCOUNTING_COLUMNS.map(col => (
                <th key={col.key} style={{ minWidth: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
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

                {/* G/L Account */}
                <td>
                  <select
                    className="so-matrix-input"
                    value={line.glAccount || ''}
                    onChange={(e) => onLineChange(index, 'glAccount', e.target.value)}
                  >
                    <option value="">Select</option>
                  </select>
                </td>

                {/* Tax Code */}
                <td>
                  <select
                    className="so-matrix-input"
                    value={line.taxCode}
                    onChange={(e) => onLineChange(index, 'taxCode', e.target.value)}
                  >
                    <option value="">Select</option>
                    {taxCodes.map(tax => (
                      <option key={tax.Code} value={tax.Code}>
                        {tax.Code} - {tax.Name}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Tax Only */}
                <td className="so-matrix-cell-center">
                  <input
                    type="checkbox"
                    checked={line.taxOnly || false}
                    onChange={(e) => onLineChange(index, 'taxOnly', e.target.checked)}
                  />
                </td>

                {/* W/T Liable */}
                <td className="so-matrix-cell-center">
                  <input
                    type="checkbox"
                    checked={line.wTLiable || false}
                    onChange={(e) => onLineChange(index, 'wTLiable', e.target.checked)}
                  />
                </td>

                {/* Deferred Tax */}
                <td className="so-matrix-cell-center">
                  <input
                    type="checkbox"
                    checked={line.deferredTax || false}
                    onChange={(e) => onLineChange(index, 'deferredTax', e.target.checked)}
                  />
                </td>

                {/* COGS Ocrcode */}
                <td>
                  <select
                    className="so-matrix-input"
                    value={line.cogsOcrCode || ''}
                    onChange={(e) => onLineChange(index, 'cogsOcrCode', e.target.value)}
                  >
                    <option value="">Select</option>
                  </select>
                </td>

                {/* COGS Account Code */}
                <td>
                  <select
                    className="so-matrix-input"
                    value={line.cogsAccountCode || ''}
                    onChange={(e) => onLineChange(index, 'cogsAccountCode', e.target.value)}
                  >
                    <option value="">Select</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AccountingTab;
