import React from "react";

export default function GeneralTab({ form, onChange }) {
  return (
    <div>
      <div className="im-section-title">Due Date Calculation</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Baseline Date</label>
          {/*
            BaselineDate: BoBaselineDate SAP enum
            bld_PostingDate | bld_SystemDate | bld_DueDate
          */}
          <select
            className="im-field__select"
            name="BaselineDate"
            value={form.BaselineDate || "bld_PostingDate"}
            onChange={onChange}
          >
            <option value="bld_PostingDate">Posting Date</option>
            <option value="bld_SystemDate">System Date</option>
            <option value="bld_DueDate">Due Date</option>
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Start From</label>
          {/*
            StartFrom: BoPaymentTermsStartFrom SAP enum
            ptsf_DayOfMonth | ptsf_HalfMonth | ptsf_MonthEnd
          */}
          <select
            className="im-field__select"
            name="StartFrom"
            value={form.StartFrom || "ptsf_DayOfMonth"}
            onChange={onChange}
          >
            <option value="ptsf_DayOfMonth">Day of Month</option>
            <option value="ptsf_HalfMonth">Half Month</option>
            <option value="ptsf_MonthEnd">Month End</option>
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Additional Months</label>
          {/* NumberOfAdditionalMonths: integer */}
          <input
            className="im-field__input"
            name="NumberOfAdditionalMonths"
            type="number"
            min="0"
            value={form.NumberOfAdditionalMonths ?? ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Additional Days</label>
          {/* NumberOfAdditionalDays: integer */}
          <input
            className="im-field__input"
            name="NumberOfAdditionalDays"
            type="number"
            min="0"
            value={form.NumberOfAdditionalDays ?? ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Number of Installments</label>
          {/* NumberOfInstallments: integer */}
          <input
            className="im-field__input"
            name="NumberOfInstallments"
            type="number"
            min="1"
            value={form.NumberOfInstallments ?? ""}
            onChange={onChange}
          />
        </div>

      </div>

      <div className="im-section-title" style={{ marginTop: 14 }}>Cash Discount</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Cash Discount %</label>
          {/* CashDiscountPercent: decimal */}
          <input
            className="im-field__input"
            name="CashDiscountPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.CashDiscountPercent ?? ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Discount Code</label>
          {/* DiscountCode: string — links to CashDiscounts entity */}
          <input
            className="im-field__input"
            name="DiscountCode"
            value={form.DiscountCode || ""}
            onChange={onChange}
          />
        </div>

      </div>

      <div className="im-section-title" style={{ marginTop: 14 }}>Credit</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Credit Limit</label>
          {/* CreditLimit: decimal */}
          <input
            className="im-field__input"
            name="CreditLimit"
            type="number"
            step="0.01"
            min="0"
            value={form.CreditLimit ?? ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Load Limit Credit</label>
          {/* LoadLimitCredit: BoYesNoEnum */}
          <select
            className="im-field__select"
            name="LoadLimitCredit"
            value={form.LoadLimitCredit || "tNO"}
            onChange={onChange}
          >
            <option value="tNO">No</option>
            <option value="tYES">Yes</option>
          </select>
        </div>

      </div>

      <div className="im-section-title" style={{ marginTop: 14 }}>Open Payments</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Open Incoming Pmts by Due Date</label>
          {/* OpenIncomingPaymentsByDueDate: BoYesNoEnum */}
          <select
            className="im-field__select"
            name="OpenIncomingPaymentsByDueDate"
            value={form.OpenIncomingPaymentsByDueDate || "tNO"}
            onChange={onChange}
          >
            <option value="tNO">No</option>
            <option value="tYES">Yes</option>
          </select>
        </div>

      </div>
    </div>
  );
}
