import React from "react";

function LookupField({ value, onChange, onLookup }) {
  return (
    <div className="sar-lookup-field">
      <input
        className="im-field__input"
        type="text"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" className="sar-cfl-btn" onClick={onLookup}>...</button>
    </div>
  );
}

export default function SalesAnalysisSalesEmployeeTab({
  value,
  salesEmployeeLabel = "Sales Employee",
  onChange,
  onOpenLookup,
}) {
  return (
    <div className="sar-selection-panel">
      <div className="sar-section-caption">Main Selection</div>

      <div className="sar-form-grid">
        <label className="im-field">
          <span className="im-field__label">{salesEmployeeLabel} From</span>
          <LookupField
            value={value?.codeFrom}
            onChange={(nextValue) => onChange("codeFrom", nextValue)}
            onLookup={() => onOpenLookup("from")}
          />
        </label>

        <label className="im-field">
          <span className="im-field__label">{salesEmployeeLabel} To</span>
          <LookupField
            value={value?.codeTo}
            onChange={(nextValue) => onChange("codeTo", nextValue)}
            onLookup={() => onOpenLookup("to")}
          />
        </label>
      </div>

      <label className="im-checkbox-label sar-secondary-toggle">
        <input
          type="checkbox"
          checked={Boolean(value?.includeInactive)}
          onChange={(event) => onChange("includeInactive", event.target.checked)}
        />
        Include Inactive Sales Employees
      </label>
    </div>
  );
}
