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

export default function SalesAnalysisCustomerTab({
  value,
  customerLabel = "Customer",
  groupOptions = [],
  propertySummary,
  onChange,
  onOpenLookup,
  onOpenProperties,
}) {
  return (
    <div className="sar-selection-panel">
      <div className="sar-section-caption">Main Selection</div>

      <div className="sar-form-grid">
        <label className="im-field">
          <span className="im-field__label">{customerLabel} From</span>
          <LookupField
            value={value?.codeFrom}
            onChange={(nextValue) => onChange("codeFrom", nextValue)}
            onLookup={() => onOpenLookup("from")}
          />
        </label>

        <label className="im-field">
          <span className="im-field__label">{customerLabel} To</span>
          <LookupField
            value={value?.codeTo}
            onChange={(nextValue) => onChange("codeTo", nextValue)}
            onLookup={() => onOpenLookup("to")}
          />
        </label>

        <label className="im-field">
          <span className="im-field__label">Group</span>
          <select
            className="im-field__input"
            value={value?.group || "All"}
            onChange={(event) => onChange("group", event.target.value)}
          >
            {(groupOptions || []).map((option) => (
              <option key={`${option.code}-${option.name}`} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="im-field">
          <span className="im-field__label">Properties</span>
          <div className="sar-lookup-field">
            <input className="im-field__input" type="text" value={propertySummary || "Ignore"} readOnly />
            <button type="button" className="sar-cfl-btn" onClick={onOpenProperties}>...</button>
          </div>
        </label>
      </div>
    </div>
  );
}
