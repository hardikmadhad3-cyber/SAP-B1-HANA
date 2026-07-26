export function ReportWindowControls({ windowFrame, onMinimize, onClose, className = "" }) {
  return (
    <div className={`sap-report-window-controls${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="sap-report-window-control"
        aria-label={windowFrame.isMinimized ? "Restore" : "Minimize"}
        onClick={onMinimize}
      >
        {windowFrame.isMinimized ? "Restore" : "Minimize"}
      </button>
      <button
        type="button"
        className="sap-report-window-control"
        aria-label={windowFrame.isMaximized ? "Restore" : "Maximize"}
        onClick={windowFrame.toggleMaximize}
      >
        {windowFrame.isMaximized ? "Restore" : "Maximize"}
      </button>
      <button type="button" className="sap-report-window-control" aria-label="Close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

export function ReportBackButton({ onClick, className = "", label = "Back to selection criteria" }) {
  return (
    <button
      type="button"
      className={`sap-report-back-btn${className ? ` ${className}` : ""}`}
      aria-label={label}
      onClick={onClick}
    >
      &#8249;
    </button>
  );
}

export default ReportWindowControls;
