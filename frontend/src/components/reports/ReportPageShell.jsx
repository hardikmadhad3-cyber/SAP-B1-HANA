import "../../styles/report-system.css";

function ReportPageShell({ children, className = "" }) {
  return (
    <div className={`report-page-shell sap-report-page${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

export default ReportPageShell;
