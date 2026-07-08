import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchFinancialStatement, fetchFinancialStatementLookups } from "../api/financialStatementsApi";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import "../styles/sales-analysis-report.css";
import "../styles/business-assessment-report.css";

const REPORT_PATH = "/reports/financial/financial/business-assessment-report";

const REPORT_MODES = [
  { code: "budgetComparison", number: 1, name: "Budget Comparison", comparisonLabel: "Budget" },
  { code: "monthlyComparison", number: 2, name: "Monthly Comparison", comparisonLabel: "Previous Month" },
  { code: "yearlyComparison", number: 3, name: "Yearly Comparison", comparisonLabel: "Previous Year" },
];

const TEMPLATE_FALLBACKS = [
  { code: "standard", name: "Standard" },
  { code: "pnl", name: "P & L" },
];

const inputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const generatePeriodFallbacks = () => {
  const today = new Date();
  return Array.from({ length: 18 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const fiscalStart = date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear();
    const fiscalLabel = `FY${String(fiscalStart).slice(2)}${String(fiscalStart + 1).slice(2)}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      periodNumber: 100 - index,
      code: fiscalLabel,
      name: fiscalLabel,
      dateFrom: inputDate(date),
      dateTo: inputDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    };
  });
};

const initialCriteria = () => ({
  periodCode: "",
  dateFrom: "",
  dateTo: "",
  templateCode: "",
  hideGlAccounts: false,
  hideZeroBalance: false,
  reportMode: "budgetComparison",
  displayCurrency: "local",
});

const formatDate = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const formatAmount = (value, currencyCode = "") => {
  const number = Number(value || 0);
  if (Math.abs(number) < 0.005) return "";
  const formatted = number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currencyCode ? `${currencyCode} ${formatted}` : formatted;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
  return `${Number(value).toFixed(2)}%`;
};

const optionLabel = (item) => {
  const code = String(item?.code || "").trim();
  const name = String(item?.name || "").trim();
  if (!code) return name;
  if (!name || name === code) return code;
  return `${code} - ${name}`;
};

const periodLabel = (period) => {
  const number = Number(period?.periodNumber || 0);
  const code = String(period?.code || period?.name || "").trim();
  return number ? `${number} - ${code}` : code;
};

function BusinessAssessmentReportPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(initialCriteria);
  const [periods, setPeriods] = useState(generatePeriodFallbacks);
  const [templates, setTemplates] = useState(TEMPLATE_FALLBACKS);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 24,
    taskId: "business-assessment-criteria",
    taskTitle: "Business Assessment Report - Selection Criteria",
    taskPath: REPORT_PATH,
    bounds: "parent",
  });

  const reportWindow = useFloatingWindow({
    isOpen: Boolean(report),
    defaultTop: 10,
    taskId: "business-assessment-report",
    taskTitle: "Business Assessment Report",
    taskPath: REPORT_PATH,
    bounds: "parent",
  });

  useEffect(() => {
    let mounted = true;
    fetchFinancialStatementLookups()
      .then((lookups) => {
        if (!mounted) return;
        const nextPeriods = Array.isArray(lookups?.postingPeriods) && lookups.postingPeriods.length
          ? lookups.postingPeriods
          : generatePeriodFallbacks();
        const nextTemplates = lookups?.reportTemplates?.["business-assessment-report"]?.length
          ? lookups.reportTemplates["business-assessment-report"]
          : TEMPLATE_FALLBACKS;
        const firstPeriod = nextPeriods[0];
        setPeriods(nextPeriods);
        setTemplates(nextTemplates);
        setCriteria((current) => ({
          ...current,
          periodCode: current.periodCode || firstPeriod?.code || "",
          dateFrom: current.dateFrom || firstPeriod?.dateFrom || "",
          dateTo: current.dateTo || firstPeriod?.dateTo || "",
          templateCode: current.templateCode || nextTemplates[0]?.code || "",
        }));
      })
      .catch((error) => {
        if (mounted) setMessage(error?.response?.data?.message || "Could not load Business Assessment dropdown data.");
      });
    return () => { mounted = false; };
  }, []);

  const selectedMode = useMemo(
    () => REPORT_MODES.find((mode) => mode.code === criteria.reportMode) || REPORT_MODES[0],
    [criteria.reportMode],
  );

  const setField = (field, value) => {
    setCriteria((current) => ({ ...current, [field]: value }));
    setMessage("");
  };

  const setPeriod = (periodCode) => {
    const period = periods.find((item) => item.code === periodCode);
    setCriteria((current) => ({
      ...current,
      periodCode,
      dateFrom: period?.dateFrom || current.dateFrom,
      dateTo: period?.dateTo || current.dateTo,
    }));
    setMessage("");
  };

  const controls = (frame, onClose) => (
    <div className="sales-analysis-window__controls">
      <button type="button" aria-label="Minimize" onClick={() => { frame.toggleMinimize(); navigate("/dashboard"); }}>-</button>
      <button type="button" aria-label="Restore" onClick={frame.toggleMaximize}>[]</button>
      <button type="button" aria-label="Close" onClick={onClose}>x</button>
    </div>
  );

  const closeCriteria = () => {
    if (!closeActiveAndRestorePrevious()) navigate("/dashboard");
  };

  const resetCriteria = () => {
    const firstPeriod = periods[0];
    setCriteria({
      ...initialCriteria(),
      periodCode: firstPeriod?.code || "",
      dateFrom: firstPeriod?.dateFrom || "",
      dateTo: firstPeriod?.dateTo || "",
      templateCode: templates[0]?.code || "",
    });
    setReport(null);
    setMessage("");
  };

  const runReport = async () => {
    if (!criteria.periodCode && (!criteria.dateFrom || !criteria.dateTo)) {
      setMessage("Select a period.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      setReport(await fetchFinancialStatement("business-assessment-report", criteria));
    } catch (error) {
      setReport(null);
      setMessage(error?.response?.data?.message || error?.message || "Could not load Business Assessment Report.");
    } finally {
      setLoading(false);
    }
  };

  const companyName = company?.companyName || company?.dbName || "Company";
  const rows = report?.rows || [];
  const currencyCode = report?.currencyCode || "";

  return (
    <div className="bar-page sales-analysis-page sap-report-page">
      <section
        className={`bar-window bar-window--criteria sales-analysis-window sap-report-window${criteriaWindow.isMinimized ? " is-minimized" : ""}${criteriaWindow.isMaximized ? " is-maximized" : ""}`}
        {...criteriaWindow.windowProps}
      >
        <header className="sales-analysis-window__titlebar sap-report-titlebar" {...criteriaWindow.titleBarProps}>
          <span className="sap-report-title">Business Assessment Report- Selection Criteria</span>
          {controls(criteriaWindow, closeCriteria)}
        </header>
        <div className="sales-analysis-window__accent" />

        {!criteriaWindow.isMinimized ? (
          <>
            <div className="bar-criteria sales-analysis-window__body">
              <div className="bar-field-row">
                <label>Period:</label>
                <select value={criteria.periodCode} onChange={(event) => setPeriod(event.target.value)}>
                  {periods.map((period) => <option key={period.code} value={period.code}>{periodLabel(period)}</option>)}
                </select>
              </div>
              <div className="bar-field-row">
                <label>Financial Template:</label>
                <select value={criteria.templateCode} onChange={(event) => setField("templateCode", event.target.value)}>
                  {templates.map((template) => <option key={template.code} value={template.code}>{optionLabel(template)}</option>)}
                </select>
              </div>
              <label className="bar-check-row">
                <span>Hide G/L Accounts:</span>
                <input type="checkbox" checked={criteria.hideGlAccounts} onChange={(event) => setField("hideGlAccounts", event.target.checked)} />
              </label>
              <label className="bar-check-row">
                <span>Hide G/L Accounts with Zero Balance:</span>
                <input type="checkbox" checked={criteria.hideZeroBalance} onChange={(event) => setField("hideZeroBalance", event.target.checked)} />
              </label>
              <div className="bar-field-row">
                <label>Report Mode:</label>
                <select value={criteria.reportMode} onChange={(event) => setField("reportMode", event.target.value)}>
                  {REPORT_MODES.map((mode) => <option key={mode.code} value={mode.code}>{mode.number} - {mode.name}</option>)}
                </select>
              </div>
              {message ? <div className="bar-message">{message}</div> : null}
            </div>
            <footer className="bar-footer">
              <button type="button" className="sales-analysis__sap-btn" onClick={runReport} disabled={loading}>{loading ? "Loading..." : "OK"}</button>
              <button type="button" className="sales-analysis__sap-btn sales-analysis__sap-btn--secondary" onClick={resetCriteria}>Cancel</button>
            </footer>
          </>
        ) : null}
      </section>

      {report ? (
        <section
          className={`bar-window bar-window--report sales-analysis-window sales-analysis-window--report sap-report-window${reportWindow.isMinimized ? " is-minimized" : ""}${reportWindow.isMaximized ? " is-maximized" : ""}`}
          {...reportWindow.windowProps}
        >
          <header className="sales-analysis-window__titlebar sap-report-titlebar" {...reportWindow.titleBarProps}>
            <span className="sap-report-title">Business Assessment Report</span>
            {controls(reportWindow, () => setReport(null))}
          </header>
          <div className="sales-analysis-window__accent" />
          {!reportWindow.isMinimized ? (
            <div className="bar-report sales-analysis-window__body--report">
              <div className="bar-report-head">
                <span>Company</span>
                <strong>{companyName}</strong>
                <span>Period</span>
                <strong>{report.periodName || report.periodCode || criteria.periodCode}</strong>
                <span>From</span>
                <strong>{formatDate(report.dateFrom)}</strong>
                <span>To</span>
                <strong>{formatDate(report.dateTo)}</strong>
              </div>
              <div className="sales-analysis-report__grid-wrap">
                <table className="bar-grid sales-analysis-report__grid">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Account</th>
                      <th>Account Name</th>
                      <th>Current Period</th>
                      <th>{selectedMode.comparisonLabel}</th>
                      <th>Variance</th>
                      <th>Variance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? rows.map((row) => (
                      <tr key={row.key || row.rowNo} className={row.isGroup ? "is-group" : ""}>
                        <td>{row.rowNo}</td>
                        <td>{row.accountCode}</td>
                        <td style={{ paddingLeft: `${8 + Math.min(Number(row.level || 0), 8) * 15}px` }}>
                          {row.accountName}
                        </td>
                        <td className="is-numeric">{formatAmount(row.currentAmount, currencyCode)}</td>
                        <td className="is-numeric">{formatAmount(row.comparisonAmount, currencyCode)}</td>
                        <td className="is-numeric">{formatAmount(row.variance, currencyCode)}</td>
                        <td className="is-numeric">{formatPercent(row.variancePercent)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="7" className="sales-analysis-report__empty">No G/L account records matched the current selection criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="bar-result-footer">
                <button type="button" className="sales-analysis-report__back-btn" onClick={() => setReport(null)}>{"<"}</button>
                <span>{selectedMode.name}</span>
              </footer>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default BusinessAssessmentReportPage;
