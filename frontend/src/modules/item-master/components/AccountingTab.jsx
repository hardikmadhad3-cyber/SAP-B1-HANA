import React from "react";
import LookupField from "./LookupField";

// Item-level GL accounts — confirmed from SAP B1 v2 /Items entity
const ITEM_GL_ACCOUNTS = [
  { name: "IncomeAccount",          label: "Income Account" },
  { name: "ExemptIncomeAccount",    label: "Exempt Income Acct" },
  { name: "ExpanseAccount",         label: "Expense Account" },
  { name: "ForeignRevenuesAccount", label: "Foreign Revenue Acct" },
  { name: "ECRevenuesAccount",      label: "EC Revenue Acct" },
  { name: "ForeignExpensesAccount", label: "Foreign Expense Acct" },
  { name: "ECExpensesAccount",      label: "EC Expense Acct" },
];

export default function AccountingTab({ form, onChange, fetchGLAccounts }) {
  const handleSelect = (fieldName) => (row) =>
    onChange({ target: { name: fieldName, value: row.code } });

  return (
    <div>
      <div className="im-section-title">Item-Level G/L Accounts</div>
      <div className="im-field-grid">
        {ITEM_GL_ACCOUNTS.map(({ name, label }) => (
          <div className="im-field" key={name}>
            <label className="im-field__label">{label}</label>
            <LookupField
              name={name}
              value={form[name] || ""}
              onChange={onChange}
              onSelect={handleSelect(name)}
              fetchOptions={fetchGLAccounts}
              placeholder={label}
            />
          </div>
        ))}
      </div>

      <div className="im-section-title" style={{ marginTop: 14 }}>G/L Method &amp; Tax</div>
      <div className="im-field-grid">
        <div className="im-field">
          <label className="im-field__label">Set G/L Accts By</label>
          <select className="im-field__select" name="GLMethod"
            value={form.GLMethod || "glm_WH"} onChange={onChange}>
            <option value="glm_ItemClass">Item Class</option>
            <option value="glm_ItemLevel">Item Level</option>
            <option value="glm_WH">Warehouse Level</option>
          </select>
        </div>
        <div className="im-field">
          <label className="im-field__label">Tax Type</label>
          <select className="im-field__select" name="TaxType"
            value={form.TaxType || "tt_Yes"} onChange={onChange}>
            <option value="tt_No">None</option>
            <option value="tt_Yes">Taxable</option>
            <option value="tt_Exempt">Exempt</option>
          </select>
        </div>
        <div className="im-field">
          <label className="im-field__label">Sales VAT Group</label>
          <input className="im-field__input" name="SalesVATGroup"
            value={form.SalesVATGroup || ""} onChange={onChange} />
        </div>
        <div className="im-field">
          <label className="im-field__label">Purchase VAT Group</label>
          <input className="im-field__input" name="PurchaseVATGroup"
            value={form.PurchaseVATGroup || ""} onChange={onChange} />
        </div>
        <div className="im-field">
          <label className="im-field__label">AR Tax Code</label>
          <input className="im-field__input" name="ArTaxCode"
            value={form.ArTaxCode || ""} onChange={onChange} />
        </div>
        <div className="im-field">
          <label className="im-field__label">AP Tax Code</label>
          <input className="im-field__input" name="ApTaxCode"
            value={form.ApTaxCode || ""} onChange={onChange} />
        </div>
        <div className="im-field">
          <label className="im-field__label">VAT Liable</label>
          <select className="im-field__select" name="VatLiable"
            value={form.VatLiable || "tYES"} onChange={onChange}>
            <option value="tYES">Yes</option>
            <option value="tNO">No</option>
          </select>
        </div>
        <div className="im-field">
          <label className="im-field__label">WT Liable</label>
          <select className="im-field__select" name="WTLiable"
            value={form.WTLiable || "tYES"} onChange={onChange}>
            <option value="tYES">Yes</option>
            <option value="tNO">No</option>
          </select>
        </div>
        <div className="im-field">
          <label className="im-field__label">Indirect Tax</label>
          <select className="im-field__select" name="IndirectTax"
            value={form.IndirectTax || "tNO"} onChange={onChange}>
            <option value="tNO">No</option>
            <option value="tYES">Yes</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#888" }}>
        Per-warehouse G/L accounts are managed in the "Warehouse Stock" tab → expand a warehouse row → G/L button.
      </div>
    </div>
  );
}
