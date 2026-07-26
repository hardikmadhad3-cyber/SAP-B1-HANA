import { Children, isValidElement } from "react";
import { ReportWindowControls } from "./ReportWindowControls";
import { ReportActionBar } from "./ReportActionBar";
import "../../styles/report-system.css";

const SIZES = ["compact", "medium", "large", "wide"];

/**
 * Shared SAP-style floating report window. Wraps a `useFloatingWindow()`
 * result, renders one consistent titlebar/accent/body/footer, and caps its
 * own height against the viewport (see --report-shell-offset in
 * report-system.css) so a tall criteria form scrolls internally instead of
 * extending past the visible page.
 *
 * A trailing <ReportActionBar> child is detected and pinned to the bottom
 * as a fixed footer; everything else renders in the scrollable body.
 */
function ReportWindow({
  windowFrame,
  onMinimize,
  onClose,
  title,
  size = "medium",
  className = "",
  bodyClassName = "",
  children,
}) {
  const sizeClass = SIZES.includes(size) ? ` report-window--${size}` : "";
  const stateClass = `${windowFrame.isMinimized ? " is-minimized" : ""}${windowFrame.isMaximized ? " is-maximized" : ""}`;

  const childArray = Children.toArray(children);
  const footerChildren = childArray.filter(
    (child) => isValidElement(child) && child.type === ReportActionBar,
  );
  const bodyChildren = childArray.filter((child) => !footerChildren.includes(child));

  return (
    <div
      className={`report-window sap-report-window${sizeClass}${stateClass}${className ? ` ${className}` : ""}`}
      {...windowFrame.windowProps}
    >
      {!windowFrame.isMinimized ? (
        <>
          <div className="report-window__titlebar sap-report-titlebar" {...windowFrame.titleBarProps}>
            <span className="report-window__title sap-report-title">{title}</span>
            <ReportWindowControls windowFrame={windowFrame} onMinimize={onMinimize} onClose={onClose} />
          </div>
          <div className="report-window__accent sap-report-accent" />
          <div className={`report-window__body sap-report-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>
            {bodyChildren}
          </div>
          {footerChildren}
        </>
      ) : null}
    </div>
  );
}

export default ReportWindow;
