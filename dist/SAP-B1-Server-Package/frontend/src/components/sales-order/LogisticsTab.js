import React from 'react';
import { LOGISTICS_COLUMNS } from '../../config/salesOrderMetadata';

function LogisticsTab({ lines, onLineChange }) {
  return (
    <div className="so-logistics-tab">
      <div className="so-matrix-wrapper">
        <table className="so-matrix">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              {LOGISTICS_COLUMNS.map(col => (
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

                {/* Free Text */}
                <td>
                  <input
                    type="text"
                    className="so-matrix-input"
                    value={line.freeText || ''}
                    onChange={(e) => onLineChange(index, 'freeText', e.target.value)}
                  />
                </td>

                {/* UoM Code */}
                <td>
                  <input
                    type="text"
                    className="so-matrix-input"
                    value={line.uomCode || ''}
                    onChange={(e) => onLineChange(index, 'uomCode', e.target.value)}
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

                {/* Distr. Rule */}
                <td>
                  <select
                    className="so-matrix-input"
                    value={line.distRule || ''}
                    onChange={(e) => onLineChange(index, 'distRule', e.target.value)}
                  >
                    <option value="">Select</option>
                  </select>
                </td>

                {/* Branch */}
                <td>
                  <select
                    className="so-matrix-input"
                    value={line.branch || ''}
                    onChange={(e) => onLineChange(index, 'branch', e.target.value)}
                  >
                    <option value="">Select</option>
                  </select>
                </td>

                {/* Backflush Agreement No. */}
                <td>
                  <input
                    type="text"
                    className="so-matrix-input"
                    value={line.backflushAgreementNo || ''}
                    onChange={(e) => onLineChange(index, 'backflushAgreementNo', e.target.value)}
                  />
                </td>

                {/* Allow Backorder Disc */}
                <td className="so-matrix-cell-center">
                  <input
                    type="checkbox"
                    checked={line.allowBackorderDisc || false}
                    onChange={(e) => onLineChange(index, 'allowBackorderDisc', e.target.checked)}
                  />
                </td>

                {/* HSN */}
                <td>
                  <input
                    type="text"
                    className="so-matrix-input"
                    value={line.hsn || ''}
                    onChange={(e) => onLineChange(index, 'hsn', e.target.value)}
                  />
                </td>

                {/* SAC */}
                <td>
                  <input
                    type="text"
                    className="so-matrix-input"
                    value={line.sac || ''}
                    onChange={(e) => onLineChange(index, 'sac', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LogisticsTab;
