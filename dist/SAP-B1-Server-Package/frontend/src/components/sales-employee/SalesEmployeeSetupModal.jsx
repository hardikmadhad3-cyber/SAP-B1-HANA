import React from 'react';

export default function SalesEmployeeSetupModal({
  isOpen,
  rows = [],
  saving = false,
  onClose,
  onSave,
  onUpdateRow,
}) {
  if (!isOpen) return null;

  return (
    <div className="sap-setup-overlay" role="dialog" aria-modal="true">
      <div className="sap-setup-window">
        <div className="sap-setup-titlebar">
          <span>Sales Employees/Buyers - Setup</span>
          <div className="sap-setup-window-actions">
            <button type="button" aria-label="Minimize">_</button>
            <button type="button" aria-label="Maximize">□</button>
            <button type="button" aria-label="Close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="sap-setup-body">
          <div className="sap-setup-grid-wrap">
            <table className="sap-setup-grid">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sales Employee Name</th>
                  <th>Commission Group</th>
                  <th>Commission %</th>
                  <th>Remarks</th>
                  <th>Active</th>
                  <th>Employee</th>
                  <th>T...</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.SlpCode || 'new'}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        value={row.SlpName}
                        onChange={(event) => onUpdateRow(index, 'SlpName', event.target.value)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td>
                      <select value="user-defined" disabled={row.SlpCode === -1}>
                        <option value="user-defined">User-Defined Commission</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="sap-setup-num"
                        value={row.Commission}
                        onChange={(event) => onUpdateRow(index, 'Commission', event.target.value)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td>
                      <input
                        value={row.Memo}
                        onChange={(event) => onUpdateRow(index, 'Memo', event.target.value)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.Active}
                        onChange={(event) => onUpdateRow(index, 'Active', event.target.checked)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.Employee}
                        onChange={(event) => onUpdateRow(index, 'Employee', event.target.checked)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sap-setup-footer">
            <div>
              <button type="button" className="sap-setup-primary" onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : 'OK'}
              </button>
              <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            </div>
            <button type="button" disabled>Set as Default</button>
          </div>
        </div>
      </div>
    </div>
  );
}
