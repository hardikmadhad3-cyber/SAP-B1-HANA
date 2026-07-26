import "../../styles/report-system.css";

export function ReportButton({ variant, className = "", children, ...props }) {
  return (
    <button
      type="button"
      className={`report-btn${variant === "primary" ? " report-btn--primary" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ReportActionBar({ children, split = false, className = "" }) {
  return (
    <div className={`report-action-bar${split ? " report-action-bar--split" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

export default ReportActionBar;
