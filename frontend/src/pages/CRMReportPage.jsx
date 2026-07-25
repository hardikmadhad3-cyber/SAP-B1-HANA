import React, { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { normalizePath } from "../auth/routeUtils";
import "../styles/crm-report.css";
import "../styles/sales-analysis-report.css";

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
  const userName = user?.username || user?.fullName || "manager";
  const emptyRows = Array.from({ length: 32 }, (_, index) => index);

  return (
    <div className="sales-analysis-page crm-activities-page">
      <section className="sales-analysis-window sales-analysis-window--report sap-report-window crm-activities-window">
        <header className="sales-analysis-window__titlebar sap-report-titlebar">
          <span className="sales-analysis-window__title sap-report-title">My Activities - {userName}</span>
          <div className="sales-analysis-window__controls">
            <button type="button" aria-label="Minimize" onClick={() => navigate("/dashboard")}>-</button>
            <button type="button" aria-label="Restore">[]</button>
            <button type="button" aria-label="Close" onClick={() => navigate("/dashboard")}>x</button>
          </div>
        </header>
        <div className="sales-analysis-window__accent sap-report-accent" />

        <div className="sales-analysis-window__body sales-analysis-window__body--report crm-activities-body">
          <div className="crm-activities-options">
            <label className="sales-analysis__checkbox-line crm-activities-option">
              <input type="checkbox" checked readOnly />
              <span>Display Only Open Activities</span>
            </label>
            <label className="sales-analysis__checkbox-line crm-activities-option">
              <input type="checkbox" readOnly />
              <span>Display Scheduled Service Calls</span>
            </label>
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

          <footer className="crm-activities-footer">
            <button type="button" className="sales-analysis__sap-btn" onClick={() => navigate("/dashboard")}>OK</button>
            <button type="button" className="sales-analysis__sap-btn crm-activities-activity-btn">Activity</button>
          </footer>
        </div>
      </section>
    </div>
  );
}

function CRMReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { menus } = useAuth();
  const currentPath = normalizePath(location.pathname);

  const currentMenu = useMemo(
    () => flattenMenus(menus).find((menu) => normalizePath(menu.menuPath) === currentPath),
    [currentPath, menus],
  );

  const title = currentMenu?.menuName || fallbackTitleFromKey(params["*"] || currentPath);

  if (currentPath === MY_ACTIVITIES_PATH) {
    return <MyActivitiesReport />;
  }

  return (
    <div className="sales-analysis-page">
      <div className="sales-analysis-window sales-analysis-window--criteria">
        <div className="sales-analysis-window__titlebar">
          <span>{title} - Selection Criteria</span>
          <div className="sales-analysis-window__controls">
            <button type="button" aria-label="Minimize" onClick={() => navigate("/dashboard")}>-</button>
            <button type="button" aria-label="Restore">[]</button>
            <button type="button" aria-label="Close" onClick={() => navigate("/dashboard")}>x</button>
          </div>
        </div>
        <div className="sales-analysis-window__body">
          <div className="sales-analysis-criteria">
            <div className="sales-analysis-empty">
              <h3>{title}</h3>
              <p>This CRM report menu is available. Connect a report source in Report Layout Manager to run it from here.</p>
            </div>
          </div>
        </div>
        <div className="sales-analysis-window__footer">
          <button type="button" className="sales-analysis__sap-btn">OK</button>
          <button type="button" className="sales-analysis__sap-btn sales-analysis__sap-btn--secondary" onClick={() => navigate("/dashboard")}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default CRMReportPage;
