import React, { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { normalizePath } from "../auth/routeUtils";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import ReportPageShell from "../components/reports/ReportPageShell";
import ReportWindow from "../components/reports/ReportWindow";
import { ReportActionBar, ReportButton } from "../components/reports/ReportActionBar";
import { ReportCheckbox } from "../components/reports/ReportFormControls";
import "../styles/crm-report.css";

const MY_ACTIVITIES_PATH = "/reports/crm/my-activities";

const MY_ACTIVITY_COLUMNS = [
  { key: "number", label: "Number", width: "82px" },
  { key: "startDate", label: "Start Date", width: "122px" },
  { key: "startTime", label: "Start Time", width: "98px" },
  { key: "handledBy", label: "Handled By", width: "110px" },
  { key: "activity", label: "Activity", width: "104px" },
  { key: "recurrence", label: "Recurrence", width: "108px" },
  { key: "bpName", label: "BP Name", width: "334px" },
  { key: "contactPerson", label: "Contact Person", width: "142px" },
  { key: "status", label: "Status", width: "66px" },
  { key: "remarks", label: "Remarks", width: "86px" },
  { key: "assignedBy", label: "Assigned By", width: "122px" },
];

const MY_ACTIVITY_ROWS = [
  {
    number: "11",
    startDate: "16/06/26",
    startTime: "11:26AM",
    handledBy: "manager",
    activity: "Phone Call",
    recurrence: "None",
    bpName: "CARGILL INDIA PRIVATE LIMITED",
    contactPerson: "Sachin Ji",
    status: "",
    remarks: "",
    assignedBy: "manager",
  },
  {
    number: "12",
    startDate: "16/06/26",
    startTime: "11:27AM",
    handledBy: "manager",
    activity: "Phone Call",
    recurrence: "None",
    bpName: "Dhara Agro Industries",
    contactPerson: "",
    status: "",
    remarks: "",
    assignedBy: "manager",
  },
];

const flattenMenus = (menus = []) =>
  menus.flatMap((menu) => [
    menu,
    ...flattenMenus(menu.children || []),
  ]);

const fallbackTitleFromKey = (value = "") =>
  String(value || "")
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "CRM Report";

function MyActivitiesReport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const userName = user?.username || user?.fullName || "manager";
  const emptyRows = Array.from({ length: 32 }, (_, index) => index);

  const handleClose = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate("/dashboard");
  };

  const reportWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 12,
    taskId: "crm-my-activities",
    taskTitle: `My Activities - ${userName}`,
    taskPath: MY_ACTIVITIES_PATH,
    bounds: "parent",
  });

  return (
    <ReportPageShell className="crm-activities-page">
      <ReportWindow
        windowFrame={reportWindow}
        onMinimize={reportWindow.toggleMinimize}
        onClose={handleClose}
        title={`My Activities - ${userName}`}
        size="wide"
      >
        <div className="crm-activities-options">
          <ReportCheckbox label="Display Only Open Activities" checked readOnly />
          <ReportCheckbox label="Display Scheduled Service Calls" readOnly />
        </div>

        <div className="crm-activities-grid-wrap">
          <table className="crm-activities-grid">
            <colgroup>
              {MY_ACTIVITY_COLUMNS.map((column) => (
                <col key={column.key} style={{ width: column.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {MY_ACTIVITY_COLUMNS.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MY_ACTIVITY_ROWS.map((row) => (
                <tr key={row.number}>
                  {MY_ACTIVITY_COLUMNS.map((column) => {
                    const isLinkedCell = ["number", "bpName", "contactPerson"].includes(column.key) && row[column.key];
                    return (
                      <td key={column.key}>
                        {isLinkedCell ? (
                          <button type="button" className="crm-activities-link-cell">
                            <span className="crm-activities-link-icon">-&gt;</span>
                            <span>{row[column.key]}</span>
                          </button>
                        ) : row[column.key]}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {emptyRows.map((rowIndex) => (
                <tr key={`empty-${rowIndex}`} aria-hidden="true">
                  {MY_ACTIVITY_COLUMNS.map((column) => (
                    <td key={column.key}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ReportActionBar>
          <ReportButton variant="primary" onClick={handleClose}>OK</ReportButton>
        </ReportActionBar>
      </ReportWindow>
    </ReportPageShell>
  );
}

function CRMReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { menus } = useAuth();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const currentPath = normalizePath(location.pathname);

  const currentMenu = useMemo(
    () => flattenMenus(menus).find((menu) => normalizePath(menu.menuPath) === currentPath),
    [currentPath, menus],
  );

  const title = currentMenu?.menuName || fallbackTitleFromKey(params["*"] || currentPath);

  const handleClose = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate("/dashboard");
  };

  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 24,
    taskId: `crm-placeholder-${currentPath}`,
    taskTitle: `${title} - Selection Criteria`,
    taskPath: currentPath,
    bounds: "parent",
  });

  if (currentPath === MY_ACTIVITIES_PATH) {
    return <MyActivitiesReport />;
  }

  return (
    <ReportPageShell>
      <ReportWindow
        windowFrame={criteriaWindow}
        onMinimize={criteriaWindow.toggleMinimize}
        onClose={handleClose}
        title={`${title} - Selection Criteria`}
        size="medium"
      >
        <div className="sales-analysis-empty">
          <h3>{title}</h3>
          <p>This CRM report menu is available. Connect a report source in Report Layout Manager to run it from here.</p>
        </div>

        <ReportActionBar>
          <ReportButton variant="primary" onClick={handleClose}>OK</ReportButton>
          <ReportButton onClick={handleClose}>Cancel</ReportButton>
        </ReportActionBar>
      </ReportWindow>
    </ReportPageShell>
  );
}

export default CRMReportPage;
