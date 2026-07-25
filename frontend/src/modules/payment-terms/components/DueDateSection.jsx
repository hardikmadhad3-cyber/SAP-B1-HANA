import React from "react";

const DUE_DATE_OPTIONS = [
  { value: "bld_PostingDate", label: "Posting Date" },
  { value: "bld_SystemDate", label: "System Date" },
  { value: "bld_DueDate", label: "Document Date" },
];

const START_FROM_OPTIONS = [
  { value: "ptsf_DayOfMonth", label: "None" },
  { value: "ptsf_HalfMonth", label: "Middle of Month" },
  { value: "ptsf_MonthEnd", label: "End of Month" },
];

export default function DueDateSection({ form, onChange, onFieldChange }) {
  return (
    <div className="pt-section">
      <div className="pt-section__title">Due Date Configuration</div>
      <div className="pt-section__content">
        <div className="pt-field-row">
          <div className="pt-field">
            <label className="pt-field__label">Due Date Based On</label>
            <select
              className="pt-field__select"
              name="BaselineDate"
              value={form.BaselineDate}
              onChange={onChange}
            >
              {DUE_DATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-field">
            <label className="pt-field__label">Start From</label>
            <select
              className="pt-field__select"
              name="StartFrom"
              value={form.StartFrom}
              onChange={onChange}
            >
              {START_FROM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-field-row">
          <div className="pt-field">
            <label className="pt-field__label">Additional Months</label>
            <input
              type="number"
              className="pt-field__input"
              name="NumberOfAdditionalMonths"
              value={form.NumberOfAdditionalMonths}
              onChange={onChange}
              min="0"
              max="36"
            />
          </div>

          <div className="pt-field">
            <label className="pt-field__label">Additional Days</label>
            <input
              type="number"
              className="pt-field__input"
              name="NumberOfAdditionalDays"
              value={form.NumberOfAdditionalDays}
              onChange={onChange}
              min="-365"
              max="365"
            />
          </div>

          <div className="pt-field">
            <label className="pt-field__label">Tolerance Days</label>
            <input
              type="number"
              className="pt-field__input"
              name="ToleranceDays"
              value={form.ToleranceDays || 0}
              onChange={onChange}
              min="0"
              max="999"
            />
          </div>

          <div className="pt-field">
            <label className="pt-field__label">Number of Periods</label>
            <input
              type="number"
              className="pt-field__input"
              name="NumberOfInstallments"
              value={form.NumberOfInstallments}
              onChange={onChange}
              min="1"
              max="36"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
