import "../../styles/report-system.css";

export function ReportFieldRow({ label, htmlFor, className = "", children }) {
  return (
    <div className={`report-field-row${className ? ` ${className}` : ""}`}>
      {label ? (
        <label className="report-field-row__label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="report-field-row__label" />
      )}
      <div className="report-field-row__control">{children}</div>
    </div>
  );
}

export function ReportLookupField({
  id,
  value,
  onChange,
  onLookup,
  placeholder,
  disabled,
  readOnly,
  className = "",
  lookupLabel = "Open lookup",
  inputProps = {},
}) {
  return (
    <div className={`report-lookup-field${className ? ` ${className}` : ""}`}>
      <input
        id={id}
        type="text"
        className="report-control"
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        {...inputProps}
      />
      <button
        type="button"
        className="report-lookup-field__btn"
        onClick={onLookup}
        disabled={disabled}
        aria-label={lookupLabel}
      >
        …
      </button>
    </div>
  );
}

export function ReportDateField({
  id,
  value,
  onChange,
  onOpenCalendar,
  placeholder = "dd/mm/yy",
  disabled,
  className = "",
  inputProps = {},
}) {
  return (
    <div className={`report-lookup-field${className ? ` ${className}` : ""}`}>
      <input
        id={id}
        type="text"
        className="report-control"
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        {...inputProps}
      />
      <button
        type="button"
        className="report-lookup-field__btn"
        onClick={onOpenCalendar}
        disabled={disabled}
        aria-label="Open calendar"
      >
        …
      </button>
    </div>
  );
}

export function ReportFromTo({ label, from, to, className = "" }) {
  return (
    <div className={`report-from-to${className ? ` ${className}` : ""}`}>
      <span className="report-from-to__label">{label}</span>
      <span className="report-from-to__tag report-from-to__tag--from">From</span>
      <div className="report-from-to__from">{from}</div>
      <span className="report-from-to__tag report-from-to__tag--to">To</span>
      <div className="report-from-to__to">{to}</div>
    </div>
  );
}

export function ReportSelect({ id, className = "", children, ...props }) {
  return (
    <select id={id} className={`report-control${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </select>
  );
}

export function ReportCheckbox({ label, className = "", ...props }) {
  return (
    <label className={`report-checkbox${className ? ` ${className}` : ""}`}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function ReportRadioGroup({ name, options, value, onChange, columns, className = "" }) {
  const style = columns ? { "--report-radio-columns": columns } : undefined;
  return (
    <div
      className={`report-radio-group${columns ? " report-radio-group--columns" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      role="radiogroup"
    >
      {options.map((option) => (
        <label className="report-radio" key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export function ReportPropertiesField({ label = "Properties", summary = "Ignore", onClick, className = "" }) {
  return (
    <div className={`report-properties-field${className ? ` ${className}` : ""}`}>
      <button type="button" className="report-btn" onClick={onClick}>
        {label}
      </button>
      <input className="report-control" value={summary} readOnly disabled />
    </div>
  );
}

export function ReportDivider({ className = "" }) {
  return <hr className={`report-divider${className ? ` ${className}` : ""}`} />;
}
