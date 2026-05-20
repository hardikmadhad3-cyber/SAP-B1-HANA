import React from "react";
import LookupField from "../../item-master/components/LookupField";

export default function AccountingTab({ form, onChange, setForm, fetchTaxGLAccounts }) {
  return (
    <div>
      <div className="im-section-title">G/L Account Assignments</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Tax Account</label>
          <LookupField
            name="TaxAccount"
            value={form.TaxAccount || ""}
            displayValue={form.TaxAccountName || ""}
            onChange={onChange}
            onSelect={(row) =>
              setForm((p) => ({ ...p, TaxAccount: row.code, TaxAccountName: row.name }))
            }
            fetchOptions={fetchTaxGLAccounts}
            placeholder="G/L Account"
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Non-Deductible Acct</label>
          <LookupField
            name="NonDeductibleAccount"
            value={form.NonDeductibleAccount || ""}
            displayValue={form.NonDeductibleAccountName || ""}
            onChange={onChange}
            onSelect={(row) =>
              setForm((p) => ({ ...p, NonDeductibleAccount: row.code, NonDeductibleAccountName: row.name }))
            }
            fetchOptions={fetchTaxGLAccounts}
            placeholder="G/L Account"
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Acquisition Tax Acct</label>
          {/* AcquisitionTaxAccount: G/L for EU acquisition tax */}
          <LookupField
            name="AcquisitionTaxAccount"
            value={form.AcquisitionTaxAccount || ""}
            displayValue={form.AcquisitionTaxAccountName || ""}
            onChange={onChange}
            onSelect={(row) =>
              setForm((p) => ({ ...p, AcquisitionTaxAccount: row.code, AcquisitionTaxAccountName: row.name }))
            }
            fetchOptions={fetchTaxGLAccounts}
            placeholder="G/L Account"
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Deferred Tax Acct</label>
          {/* DeferredTaxAccount: G/L for deferred tax */}
          <LookupField
            name="DeferredTaxAccount"
            value={form.DeferredTaxAccount || ""}
            displayValue={form.DeferredTaxAccountName || ""}
            onChange={onChange}
            onSelect={(row) =>
              setForm((p) => ({ ...p, DeferredTaxAccount: row.code, DeferredTaxAccountName: row.name }))
            }
            fetchOptions={fetchTaxGLAccounts}
            placeholder="G/L Account"
          />
        </div>

      </div>

      <div className="im-section-title" style={{ marginTop: 14 }}>EU / Acquisition Tax</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">EU Code</label>
          {/* EUCode: string — EU tax code for intra-community transactions */}
          <input
            className="im-field__input"
            name="EUCode"
            value={form.EUCode || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Acquisition Tax</label>
          {/* AcquisitionTax: BoYesNoEnum */}
          <select
            className="im-field__select"
            name="AcquisitionTax"
            value={form.AcquisitionTax || "tNO"}
            onChange={onChange}
          >
            <option value="tNO">No</option>
            <option value="tYES">Yes</option>
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Acq. Tax Rate %</label>
          <input
            className="im-field__input"
            name="AcquisitionTaxRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.AcquisitionTaxRate ?? ""}
            onChange={onChange}
          />
        </div>

      </div>
    </div>
  );
}
