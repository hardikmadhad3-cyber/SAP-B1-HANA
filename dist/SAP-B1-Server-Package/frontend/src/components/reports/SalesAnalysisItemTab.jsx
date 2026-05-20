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

function SecondaryRange({ label, value, path, onChange }) {
  return (
    <>
      <label className="im-field">
        <span className="im-field__label">{label} From</span>
        <input
          className="im-field__input"
          type="text"
          value={value?.codeFrom || ""}
          onChange={(event) => onChange(`${path}.codeFrom`, event.target.value)}
        />
      </label>
      <label className="im-field">
        <span className="im-field__label">{label} To</span>
        <input
          className="im-field__input"
          type="text"
          value={value?.codeTo || ""}
          onChange={(event) => onChange(`${path}.codeTo`, event.target.value)}
        />
      </label>
    </>
  );
}

export default function SalesAnalysisItemTab({
  value,
  customerLabel = "Customer",
  salesEmployeeLabel = "Sales Employee",
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
          <span className="im-field__label">Item From</span>
          <LookupField
            value={value?.codeFrom}
            onChange={(nextValue) => onChange("codeFrom", nextValue)}
            onLookup={() => onOpenLookup("from")}
          />
        </label>

        <label className="im-field">
          <span className="im-field__label">Item To</span>
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

      <label className="im-checkbox-label sar-secondary-toggle">
        <input
          type="checkbox"
          checked={Boolean(value?.secondarySelection)}
          onChange={(event) => onChange("secondarySelection", event.target.checked)}
        />
        Secondary Selection
      </label>

      {value?.secondarySelection ? (
        <div className="sar-selection-panel sar-selection-panel--nested">
          <div className="sar-section-caption">Secondary Filters</div>
          <div className="sar-form-grid">
            <SecondaryRange
              label={customerLabel}
              value={value?.secondaryFilters?.customer}
              path="secondaryFilters.customer"
              onChange={onChange}
            />
            <SecondaryRange
              label={salesEmployeeLabel}
              value={value?.secondaryFilters?.salesEmployee}
              path="secondaryFilters.salesEmployee"
              onChange={onChange}
            />
            <SecondaryRange
              label="Warehouse"
              value={value?.secondaryFilters?.warehouse}
              path="secondaryFilters.warehouse"
              onChange={onChange}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
