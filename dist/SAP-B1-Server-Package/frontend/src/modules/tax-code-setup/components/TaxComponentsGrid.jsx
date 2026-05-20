import React, { useState } from "react";
import LookupModal from "./LookupModal";
import { searchTaxCodes, fetchTaxGLAccounts } from "../../../api/taxCodeApi";

// Tax Type options
const TAX_TYPES = [
  { value: "", label: "" },
  { value: "sys_SGST", label: "sys_SGST" },
  { value: "sys_CGST", label: "sys_CGST" },
  { value: "sys_IGST", label: "sys_IGST" },
  { value: "sys_CESS", label: "sys_CESS" },
  { value: "sys_VAT", label: "sys_VAT" },
  { value: "sys_CST", label: "sys_CST" },
  { value: "sys_Service", label: "sys_Service" },
  { value: "sys_Excise", label: "sys_Excise" },
  { value: "sys_Custom", label: "sys_Custom" },
];

const EMPTY_ROW = {
  TaxType: "",
  Code: "",
  Description: "",
  SalesTaxAccount: "",
  SalesTaxAccountName: "",
  PurchasingTaxAccount: "",
  PurchasingTaxAccountName: "",
  NonDeductible: "0.00",
  NonDeductibleAccount: "",
  NonDeductibleAccountName: "",
};

// Tax Type to Code/Description mapping (auto-populate when Tax Type is selected)
const TAX_TYPE_MAPPING = {
  "sys_SGST": { code: "SGST", description: "State GST" },
  "sys_CGST": { code: "CGST", description: "Central GST" },
  "sys_IGST": { code: "IGST", description: "Integrated GST" },
  "sys_CESS": { code: "CESS", description: "Cess" },
  "sys_VAT": { code: "VAT", description: "VAT" },
  "sys_CST": { code: "CST", description: "CST" },
  "sys_Service": { code: "SERVICE", description: "Service Tax" },
  "sys_Excise": { code: "EXCISE", description: "Excise Duty" },
  "sys_Custom": { code: "CUSTOM", description: "Custom Duty" },
};

export default function TaxComponentsGrid({ lines = [], onChange }) {
  const [lookupModal, setLookupModal] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editingField, setEditingField] = useState(null);

  // Ensure minimum 2 rows for display
  const displayRows = [...lines];
  while (displayRows.length < 2) {
    displayRows.push({ ...EMPTY_ROW });
  }

  const handleCellChange = (rowIndex, field, value) => {
    const newLines = [...displayRows];
    newLines[rowIndex] = { ...newLines[rowIndex], [field]: value };
    
    // Auto-populate Code and Description when Tax Type changes
    if (field === "TaxType" && value) {
      const mapping = TAX_TYPE_MAPPING[value];
      if (mapping) {
        newLines[rowIndex].Code = mapping.code;
        newLines[rowIndex].Description = mapping.description;
      }
    }
    
    onChange(newLines);
  };

  const handleAddRow = () => {
    onChange([...displayRows, { ...EMPTY_ROW }]);
  };

  const handleDeleteRow = (rowIndex) => {
    const newLines = displayRows.filter((_, idx) => idx !== rowIndex);
    onChange(newLines);
  };

  const openLookup = (rowIndex, field) => {
    setEditingRow(rowIndex);
    setEditingField(field);
    setLookupModal(field);
  };

  const handleAccountSelect = (row) => {
    if (editingRow !== null && editingField) {
      const newLines = [...displayRows];
      newLines[editingRow] = {
        ...newLines[editingRow],
        [editingField]: row.code,
        [`${editingField}Name`]: row.name,
      };
      onChange(newLines);
    }
    setLookupModal(null);
    setEditingRow(null);
    setEditingField(null);
  };

  const handleCodeSelect = (row) => {
    if (editingRow !== null) {
      const newLines = [...displayRows];
      newLines[editingRow] = {
        ...newLines[editingRow],
        Code: row.Code,
        Description: row.Name,
      };
      onChange(newLines);
    }
    setLookupModal(null);
    setEditingRow(null);
    setEditingField(null);
  };

  return (
    <div className="tc-grid-section">
      <div className="tc-grid-wrap">
        <table className="tc-grid">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>#</th>
              <th style={{ width: "150px" }}>Tax Type</th>
              <th style={{ width: "100px" }}>Code</th>
              <th style={{ width: "180px" }}>Description</th>
              <th style={{ width: "160px" }}>Sales Tax Account</th>
              <th style={{ width: "160px" }}>Purchasing Tax Account</th>
              <th style={{ width: "100px" }}>Non-Deductible</th>
              <th style={{ width: "160px" }}>Non-Deductible Account</th>
              <th style={{ width: "60px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => (
              <tr key={idx}>
                <td className="tc-grid__cell--center">{idx + 1}</td>
                
                {/* Tax Type Dropdown */}
                <td>
                  <select
                    className="tc-grid__select"
                    value={row.TaxType || ""}
                    onChange={(e) => handleCellChange(idx, "TaxType", e.target.value)}
                  >
                    {TAX_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Code - Auto-populated but editable with lookup */}
                <td>
                  <div className="tc-grid__lookup">
                    <input
                      className="tc-grid__input"
                      value={row.Code || ""}
                      onChange={(e) => handleCellChange(idx, "Code", e.target.value)}
                      placeholder="Code"
                      maxLength={8}
                    />
                    <button
                      className="tc-grid__lookup-btn"
                      onClick={() => openLookup(idx, "Code")}
                      title="Lookup Code"
                    >
                      🔍
                    </button>
                  </div>
                </td>

                {/* Description - Auto-populated but editable */}
                <td>
                  <input
                    className="tc-grid__input"
                    value={row.Description || ""}
                    onChange={(e) => handleCellChange(idx, "Description", e.target.value)}
                    placeholder="Description"
                  />
                </td>

                {/* Sales Tax Account */}
                <td>
                  <div className="tc-grid__lookup">
                    <input
                      className="tc-grid__input"
                      value={row.SalesTaxAccount || ""}
                      onChange={(e) => handleCellChange(idx, "SalesTaxAccount", e.target.value)}
                      placeholder="Account"
                      title={row.SalesTaxAccountName || ""}
                    />
                    <button
                      className="tc-grid__lookup-btn"
                      onClick={() => openLookup(idx, "SalesTaxAccount")}
                      title="Lookup Account"
                    >
                      🔍
                    </button>
                  </div>
                </td>

                {/* Purchasing Tax Account */}
                <td>
                  <div className="tc-grid__lookup">
                    <input
                      className="tc-grid__input"
                      value={row.PurchasingTaxAccount || ""}
                      onChange={(e) => handleCellChange(idx, "PurchasingTaxAccount", e.target.value)}
                      placeholder="Account"
                      title={row.PurchasingTaxAccountName || ""}
                    />
                    <button
                      className="tc-grid__lookup-btn"
                      onClick={() => openLookup(idx, "PurchasingTaxAccount")}
                      title="Lookup Account"
                    >
                      🔍
                    </button>
                  </div>
                </td>

                {/* Non-Deductible % */}
                <td>
                  <input
                    className="tc-grid__input tc-grid__input--number"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={row.NonDeductible || "0.00"}
                    onChange={(e) => handleCellChange(idx, "NonDeductible", e.target.value)}
                  />
                </td>

                {/* Non-Deductible Account */}
                <td>
                  <div className="tc-grid__lookup">
                    <input
                      className="tc-grid__input"
                      value={row.NonDeductibleAccount || ""}
                      onChange={(e) => handleCellChange(idx, "NonDeductibleAccount", e.target.value)}
                      placeholder="Account"
                      title={row.NonDeductibleAccountName || ""}
                    />
                    <button
                      className="tc-grid__lookup-btn"
                      onClick={() => openLookup(idx, "NonDeductibleAccount")}
                      title="Lookup Account"
                    >
                      🔍
                    </button>
                  </div>
                </td>

                {/* Actions */}
                <td className="tc-grid__cell--center">
                  <button
                    className="tc-grid__delete-btn"
                    onClick={() => handleDeleteRow(idx)}
                    title="Delete Row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tc-grid-actions">
        <button className="tc-btn tc-btn--small" onClick={handleAddRow}>
          + Add Row
        </button>
      </div>

      {/* Lookup Modals */}
      {lookupModal === "Code" && (
        <LookupModal
          title="Select Tax Code"
          onClose={() => {
            setLookupModal(null);
            setEditingRow(null);
            setEditingField(null);
          }}
          onSelect={handleCodeSelect}
          fetchOptions={searchTaxCodes}
          columns={[
            { key: "Code", label: "Code" },
            { key: "Name", label: "Description" },
          ]}
        />
      )}
      
      {lookupModal && lookupModal !== "Code" && (
        <LookupModal
          title={`Select ${editingField?.replace(/([A-Z])/g, ' $1').trim()}`}
          onClose={() => {
            setLookupModal(null);
            setEditingRow(null);
            setEditingField(null);
          }}
          onSelect={handleAccountSelect}
          fetchOptions={fetchTaxGLAccounts}
          columns={[
            { key: "code", label: "Code" },
            { key: "name", label: "Name" },
          ]}
        />
      )}
    </div>
  );
}
