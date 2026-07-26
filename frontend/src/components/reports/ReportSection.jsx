import "../../styles/report-system.css";

function ReportSection({ title, bordered = true, compact = false, className = "", children }) {
  return (
    <fieldset
      className={`report-section${bordered ? " report-section--bordered" : ""}${compact ? " report-section--compact" : ""}${className ? ` ${className}` : ""}`}
    >
      {title ? <legend className="report-section__title">{title}</legend> : null}
      <div className="report-section__body">{children}</div>
    </fieldset>
  );
}

export default ReportSection;
