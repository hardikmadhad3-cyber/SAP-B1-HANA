import React, { useState, useCallback, useEffect } from "react";
import "./styles/taxCodeSetup.css";
import TaxComponentsGrid from "./components/TaxComponentsGrid";
import LookupModal from "./components/LookupModal";
import {
  createTaxCode,
  getTaxCode,
  updateTaxCode,
  searchTaxCodes,
} from "../../api/taxCodeApi";
import { validateTaxCodeForm, validateBusinessRules } from "./validation/taxCodeValidation";

// Tax Type Combination options - SAP B1 BoVatCategoryEnum
const TAX_TYPE_COMBINATIONS = [
  { value: "", label: "" },
  { value: "O", label: "Output Tax (Sales)" },
  { value: "I", label: "Input Tax (Purchasing)" },
];

const EMPTY_FORM = {
  Code: "",
  Name: "",
  Rate: "0.00",
  Inactive: false,
  Freight: false,
  TaxTypeCombination: "",
  VatGroups_Lines: [],
};

function buildPayload(form) {
  const payload = {
    Code: form.Code.trim(),
    Name: form.Name.trim(),
  };

  // Add optional fields
  if (form.Inactive) {
    payload.Inactive = "tYES";
  }
  
  // Freight - only set on creation, cannot be changed
  if (form.Freight) {
    payload.TaxType = "vgt_Freight";
  }

  // Category - only set on creation, cannot be changed
  if (form.TaxTypeCombination) {
    payload.Category = form.TaxTypeCombination;
  }

  // Note: VatGroups_Lines and other complex fields not supported
  // SAP B1 manages tax codes as simple entities

  return payload;
}

export default function TaxCodeSetup() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState("add"); // add | update
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showFindModal, setShowFindModal] = useState(false);

  // Debug: Test API on mount
  useEffect(() => {
    console.log('TaxCodeSetup mounted');
    searchTaxCodes('').then(data => {
      console.log('Initial search test - Tax codes available:', data?.length || 0);
    }).catch(err => {
      console.error('Initial search test failed:', err.message);
    });
  }, []);

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setMode("add");
    setAlert(null);
  };

  const handleAdd = async () => {
    // Validations
    const errors = validateTaxCodeForm(form);
    if (errors.length > 0) {
      showAlert("error", errors[0]); // Show first error
      return;
    }

    // Business rule warnings
    const warnings = validateBusinessRules(form);
    if (warnings.length > 0) {
      console.warn("Business rule warnings:", warnings);
    }

    setLoading(true);
    try {
      await createTaxCode(buildPayload(form));
      showAlert("success", `Tax Code "${form.Code}" created successfully.`);
      setMode("update");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to create Tax Code.";
      showAlert("error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!form.Code.trim()) return;

    // Validations
    const errors = validateTaxCodeForm(form);
    if (errors.length > 0) {
      showAlert("error", errors[0]); // Show first error
      return;
    }

    // Business rule warnings
    const warnings = validateBusinessRules(form);
    if (warnings.length > 0) {
      console.warn("Business rule warnings:", warnings);
    }

    setLoading(true);
    try {
      await updateTaxCode(form.Code.trim(), buildPayload(form));
      showAlert("success", `Tax Code "${form.Code}" updated successfully.`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to update Tax Code.";
      showAlert("error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (mode === "add") return handleAdd();
    if (mode === "update") return handleUpdate();
  };

  const handleFind = async (code) => {
    setLoading(true);
    try {
      const data = await getTaxCode(code);
      setForm({
        Code: data.Code || "",
        Name: data.Name || "",
        Rate: data.Rate || "0.00",
        Inactive: data.Inactive === "tYES",
        Freight: data.TaxType === "vgt_Freight",
        TaxTypeCombination: data.Category || "",
        VatGroups_Lines: data.VatGroups_Lines || [],
      });
      setMode("update");
      setShowFindModal(false);
      showAlert("success", `Tax Code "${code}" loaded.`);
    } catch (err) {
      showAlert("error", "Tax Code not found.");
    } finally {
      setLoading(false);
    }
  };

  const handleLinesChange = useCallback((lines) => {
    setForm((prev) => ({ ...prev, VatGroups_Lines: lines }));
  }, []);

  return (
    <div className="tc-page">
      {/* Toolbar */}
      <div className="tc-toolbar">
        <span className="tc-toolbar__title">Tax Codes - Setup</span>
        <button className="tc-btn tc-btn--primary" onClick={handleSave} disabled={loading}>
          {loading ? "..." : mode === "add" ? "Add" : "Update"}
        </button>
        <button className="tc-btn" onClick={resetForm}>
          Cancel
        </button>
        <button className="tc-btn" onClick={() => setShowFindModal(true)}>
          Find
        </button>
      </div>

      {alert && <div className={`tc-alert tc-alert--${alert.type}`}>{alert.msg}</div>}

      {/* Header Section */}
      <div className="tc-header">
        <div className="tc-header-row">
          <div className="tc-field">
            <label className="tc-field__label">Code*</label>
            <input
              className="tc-field__input tc-field__input--code"
              name="Code"
              value={form.Code}
              onChange={handleChange}
              readOnly={mode === "update"}
              maxLength={8}
              autoFocus
            />
          </div>

          <div className="tc-field tc-field--wide">
            <label className="tc-field__label">Description*</label>
            <input
              className="tc-field__input"
              name="Name"
              value={form.Name}
              onChange={handleChange}
              maxLength={100}
            />
          </div>

          <div className="tc-field">
            <label className="tc-field__label">Tax Rate</label>
            <input
              className="tc-field__input tc-field__input--rate tc-field__input--readonly"
              name="Rate"
              type="number"
              step="0.01"
              value={form.Rate}
              readOnly
              title="Tax Rate is calculated automatically from tax components"
            />
          </div>

          <div className="tc-field tc-field--checkbox">
            <input
              type="checkbox"
              id="inactive"
              name="Inactive"
              checked={form.Inactive}
              onChange={handleChange}
            />
            <label htmlFor="inactive">Inactive</label>
          </div>
        </div>

        <div className="tc-header-row">
          <div className="tc-field tc-field--checkbox">
            <input
              type="checkbox"
              id="freight"
              name="Freight"
              checked={form.Freight}
              onChange={handleChange}
              disabled={mode === "update"}
            />
            <label htmlFor="freight" style={{ color: mode === "update" ? "#888" : "#1a1a1a" }}>
              Freight
            </label>
          </div>

          <div className="tc-field tc-field--combination">
            <label className="tc-field__label">Category</label>
            <select
              className="tc-field__select"
              name="TaxTypeCombination"
              value={form.TaxTypeCombination}
              onChange={handleChange}
              disabled={mode === "update"}
            >
              {TAX_TYPE_COMBINATIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tax Components Grid */}
      <TaxComponentsGrid lines={form.VatGroups_Lines} onChange={handleLinesChange} />

      {/* Find Modal */}
      {showFindModal && (
        <LookupModal
          title="Find Tax Code"
          onClose={() => setShowFindModal(false)}
          onSelect={(row) => handleFind(row.Code)}
          fetchOptions={searchTaxCodes}
          columns={[
            { key: "Code", label: "Code" },
            { key: "Name", label: "Description" },
            { key: "Rate", label: "Rate %" },
          ]}
        />
      )}
    </div>
  );
}
