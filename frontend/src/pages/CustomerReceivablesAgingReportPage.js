import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCustomerReceivablesAgingLookups, fetchCustomerReceivablesAgingReport } from "../api/customerReceivablesAgingApi";
import GLAccountLookupModal from "../components/reports/GLAccountLookupModal";
import PropertiesSelectionModal from "../components/reports/PropertiesSelectionModal";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { ReportWindowControls, ReportBackButton } from "../components/reports/ReportWindowControls";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import "../styles/customer-receivables-aging-report.css";
import "../styles/inventory-audit-report.css";
import "../styles/sales-analysis-report.css";

const DEFAULT_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({ number: index + 1, name: `Business Partners Property ${index + 1}` }));
const shortDate = (date = new Date()) => `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
const initialCriteria = {
  groupBy: "customer", sumByBlanketAgreement: false, blanketAgreementFrom: "", blanketAgreementTo: "",
  codeFrom: "", codeTo: "", customerGroup: "All",
  propertyFilter: { ignoreProperties: true, linkMode: "and", exactlyMatch: false, selectedPropertyNumbers: [] },
  controlAccountsEnabled: false, selectedAccountCodes: [],
  agingDate: shortDate(), ageBy: "due", intervals: [30, 60, 90, 120],
  postingDateFrom: "", postingDateTo: "", dueDateFrom: "", dueDateTo: "", documentDateFrom: "", documentDateTo: "",
  displayCurrency: "local", translateLeadingCurrency: true, displayZeroBalance: false,
  displayReconciled: false, ignoreFutureRemit: true, considerConnectedVendors: false,
};

const formatAmount = (value) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return shortDate(date);
};

function CustomerReceivablesAgingReportPage() {
  const navigate = useNavigate();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(initialCriteria);
  const [lookups, setLookups] = useState({ customerGroups: [{ code: "All", name: "All" }], controlAccounts: [], properties: DEFAULT_PROPERTIES, currencies: {} });
  const [showProperties, setShowProperties] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [report, setReport] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [findText, setFindText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const criteriaWindow = useFloatingWindow({ isOpen: true, defaultTop: 16, taskId: "customer-receivables-aging-criteria", taskTitle: "Customer Receivables Aging - Selection Criteria", taskPath: "/reports/financial/accounting/aging/customer-receivables", bounds: "parent" });
  const reportWindow = useFloatingWindow({ isOpen: Boolean(report), defaultTop: 10, taskId: "customer-receivables-aging-report", taskTitle: "Customer Receivables Aging", taskPath: "/reports/financial/accounting/aging/customer-receivables", bounds: "parent" });

  useEffect(() => {
    let mounted = true;
    fetchCustomerReceivablesAgingLookups().then((data) => {
      if (!mounted) return;
      setLookups({
        customerGroups: data.customerGroups?.length ? data.customerGroups : [{ code: "All", name: "All" }],
        controlAccounts: data.controlAccounts || [],
        properties: data.properties?.length ? data.properties : DEFAULT_PROPERTIES,
        currencies: data.currencies || {},
      });
    }).catch((error) => {
      if (mounted) setMessage(error?.response?.data?.message || error?.message || "Could not load report lookups.");
    });
    return () => { mounted = false; };
  }, []);

  const setField = (field, value) => setCriteria((current) => ({ ...current, [field]: value }));
  const propertyLabel = criteria.propertyFilter.ignoreProperties ? "Ignore" : `${criteria.propertyFilter.selectedPropertyNumbers.length} Selected`;
  const accountLabel = criteria.selectedAccountCodes.length ? `${criteria.selectedAccountCodes.length} Selected` : "All Customer Control Accounts";

  const groups = useMemo(() => {
    const map = new Map();
    (report?.rows || []).forEach((row) => {
      const key = report.groupBy === "salesEmployee" ? row.salesEmployeeCode : row.customerCode;
      const label = report.groupBy === "salesEmployee" ? row.salesEmployeeName : row.customerName;
      if (!map.has(key)) map.set(key, { key, label, customerCode: row.customerCode, rows: [], balance: 0, buckets: Array((report.intervals?.length || 4) + 1).fill(0) });
      const group = map.get(key);
      group.rows.push(row);
      group.balance += row.balance;
      row.buckets.forEach((value, index) => { group.buckets[index] += value; });
    });
    const search = findText.trim().toLowerCase();
    return [...map.values()].filter((group) => !search || `${group.key} ${group.label} ${group.rows.map((row) => row.documentNumber).join(" ")}`.toLowerCase().includes(search));
  }, [findText, report]);

  const totals = useMemo(() => groups.reduce((result, group) => {
    result.balance += group.balance;
    group.buckets.forEach((value, index) => { result.buckets[index] += value; });
    return result;
  }, { balance: 0, buckets: Array((report?.intervals?.length || 4) + 1).fill(0) }), [groups, report]);

  const handleRun = async () => {
    setLoading(true); setMessage("");
    try {
      const data = await fetchCustomerReceivablesAgingReport(criteria);
      setReport(data); setExpanded(Object.fromEntries((data.rows || []).map((row) => [data.groupBy === "salesEmployee" ? row.salesEmployeeCode : row.customerCode, true])));
    } catch (error) {
      setReport(null); setMessage(error?.response?.data?.message || error?.message || "Could not load Customer Receivables Aging report.");
    } finally { setLoading(false); }
  };

  const closeCriteria = () => { if (!closeActiveAndRestorePrevious()) navigate("/dashboard"); };
  const openCustomer = (code) => code && navigate(`/business-partner?cardCode=${encodeURIComponent(code)}`);
  const openDocument = (row) => {
    const routes = { 13: ["/ar-invoice", "arInvoiceDocEntry"], 14: ["/ar-credit-memo", "arCreditMemoDocEntry"], 24: ["/incoming-payments", "incomingPaymentDocEntry"] };
    const route = routes[row.transType];
    if (!route || !row.sourceDocEntry) {
      navigate("/journal-entry", { state: { journalEntryTransId: row.transId } });
      return;
    }
    navigate(route[0], { state: { [route[1]]: row.sourceDocEntry } });
  };
  const arrow = (title, onClick) => <button type="button" className="cra-arrow" title={title} onClick={onClick}>-&gt;</button>;
  const rangeRow = (label, fromField, toField) => <div className="cra-range-row"><label>{label}</label><span>From</span><input value={criteria[fromField]} onChange={(event) => setField(fromField, event.target.value)} /><span>To</span><input value={criteria[toField]} onChange={(event) => setField(toField, event.target.value)} /></div>;

  const criteriaView = (
    <section className={`cra-window cra-window--criteria sales-analysis-window sap-report-window${criteriaWindow.isMinimized ? " is-minimized" : ""}${criteriaWindow.isMaximized ? " is-maximized" : ""}`} {...criteriaWindow.windowProps}>
      <header className="cra-titlebar sales-analysis-window__titlebar sap-report-titlebar" {...criteriaWindow.titleBarProps}><span className="sap-report-title">Customer Receivables Aging - Selection Criteria</span><ReportWindowControls windowFrame={criteriaWindow} onMinimize={criteriaWindow.toggleMinimize} onClose={closeCriteria} className="cra-controls sales-analysis-window__controls" /></header>
      <div className="sales-analysis-window__accent" />
      {!criteriaWindow.isMinimized ? <div className="cra-body sales-analysis-window__body">
        <div className="cra-group-line"><strong>Group By</strong><label><input type="radio" checked={criteria.groupBy === "customer"} onChange={() => setField("groupBy", "customer")} /> Customer</label><label><input type="radio" checked={criteria.groupBy === "salesEmployee"} onChange={() => setField("groupBy", "salesEmployee")} /> Sales Employee</label></div>
        <label className="cra-check cra-indent"><input type="checkbox" checked={criteria.sumByBlanketAgreement} onChange={(event) => setField("sumByBlanketAgreement", event.target.checked)} /> Blanket Agreement No.</label>
        {rangeRow("Blanket Agreement No.", "blanketAgreementFrom", "blanketAgreementTo")}
        {rangeRow("Code", "codeFrom", "codeTo")}
        <div className="cra-select-row"><label>Customer Group</label><select value={criteria.customerGroup} onChange={(event) => setField("customerGroup", event.target.value)}>{lookups.customerGroups.map((group) => <option key={group.code} value={group.code}>{group.name || group.code}</option>)}</select></div>
        <div className="cra-action-row"><button type="button" className="cra-btn cra-btn--field" onClick={() => setShowProperties(true)}>Properties</button><input value={propertyLabel} readOnly /></div>
        <div className="cra-control-row"><label className="cra-check"><input type="checkbox" checked={criteria.controlAccountsEnabled} onChange={(event) => setField("controlAccountsEnabled", event.target.checked)} /> Control Accts</label><input value={accountLabel} readOnly disabled={!criteria.controlAccountsEnabled} /><button type="button" onClick={() => setShowAccounts(true)}>...</button></div>
        <div className="cra-divider" />
        <div className="cra-aging-row"><strong>Aging Date</strong><input value={criteria.agingDate} onChange={(event) => setField("agingDate", event.target.value)} /></div>
        <div className="cra-interval-row"><strong>Interval</strong><select><option>Days</option></select>{criteria.intervals.map((value, index) => <input key={index} value={value} onChange={(event) => setField("intervals", criteria.intervals.map((entry, entryIndex) => entryIndex === index ? event.target.value : entry))} />)}</div>
        {rangeRow("Posting Date", "postingDateFrom", "postingDateTo")}
        {rangeRow("Due Date", "dueDateFrom", "dueDateTo")}
        {rangeRow("Document Date", "documentDateFrom", "documentDateTo")}
        <div className="cra-options">
          <label className="cra-check"><input type="checkbox" checked={criteria.translateLeadingCurrency} onChange={(event) => setField("translateLeadingCurrency", event.target.checked)} /> Translate Leading Currency at Aging Date</label>
          <label className="cra-check"><input type="checkbox" checked={criteria.displayZeroBalance} onChange={(event) => setField("displayZeroBalance", event.target.checked)} /> Display Customers with Zero Balance</label>
          <label className="cra-check"><input type="checkbox" checked={criteria.displayReconciled} onChange={(event) => setField("displayReconciled", event.target.checked)} /> Display Reconciled Transactions</label>
          <label className="cra-check"><input type="checkbox" checked={criteria.ignoreFutureRemit} onChange={(event) => setField("ignoreFutureRemit", event.target.checked)} /> Ignore Future Remit</label>
          <label className="cra-check cra-connected"><input type="checkbox" checked={criteria.considerConnectedVendors} onChange={(event) => setField("considerConnectedVendors", event.target.checked)} /> Consider Connected Vendors</label>
        </div>
        {message ? <div className="cra-message">{message}</div> : null}
        <footer className="cra-footer"><button type="button" className="cra-btn cra-btn--primary" onClick={handleRun} disabled={loading}>{loading ? "Loading..." : "OK"}</button><button type="button" className="cra-btn" onClick={closeCriteria}>Cancel</button></footer>
      </div> : null}
    </section>
  );

  const bucketLabels = report ? [`0 - ${report.intervals[0]}`, ...report.intervals.slice(1).map((value, index) => `${report.intervals[index] + 1} - ${value}`), `${report.intervals.at(-1) + 1}+`] : [];
  const reportView = report ? (
    <section className={`cra-window cra-window--report sales-analysis-window sales-analysis-window--report sap-report-window${reportWindow.isMinimized ? " is-minimized" : ""}${reportWindow.isMaximized ? " is-maximized" : ""}`} {...reportWindow.windowProps}>
      <header className="cra-titlebar sales-analysis-window__titlebar sap-report-titlebar" {...reportWindow.titleBarProps}><span className="sap-report-title">Customer Receivables Aging</span><ReportWindowControls windowFrame={reportWindow} onMinimize={reportWindow.toggleMinimize} onClose={() => setReport(null)} className="cra-controls sales-analysis-window__controls" /></header>
      <div className="sales-analysis-window__accent" />
      {!reportWindow.isMinimized ? <div className="cra-report-body">
        <div className="cra-report-toolbar"><label>Currency <select value={criteria.displayCurrency} onChange={(event) => setField("displayCurrency", event.target.value)}><option value="local">Local</option><option value="system">System</option><option value="foreign">Foreign</option><option value="businessPartner">Business Partner</option></select></label><label>Find <input value={findText} onChange={(event) => setFindText(event.target.value)} /></label><label>Aging Date <input value={formatDate(report.agingDate)} readOnly /></label><label>Age By <select value={criteria.ageBy} onChange={(event) => setField("ageBy", event.target.value)}><option value="due">Due Date</option><option value="posting">Posting Date</option><option value="document">Document Date</option></select></label></div>
        <div className="cra-grid-wrap"><table className="cra-grid"><thead><tr><th>#</th><th>Customer Code</th><th>Customer Name</th><th>Type</th><th>Doc. No.</th><th>Posting Date</th><th>Due Date</th><th>Number of Days Outstanding</th><th>Balance Due</th>{bucketLabels.map((label) => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{groups.map((group, groupIndex) => <React.Fragment key={group.key}><tr className="cra-group-row"><td>{groupIndex + 1}</td><td><button type="button" className="cra-expand" onClick={() => setExpanded((current) => ({ ...current, [group.key]: !current[group.key] }))}>{expanded[group.key] ? "▼" : "▶"}</button>{report.groupBy === "customer" ? arrow("Open customer", () => openCustomer(group.key)) : null}<strong>{group.key}</strong></td><td><strong>{group.label}</strong></td><td /><td /><td /><td /><td /><td className="is-number"><strong>{formatAmount(group.balance)}</strong></td>{group.buckets.map((value, index) => <td className="is-number" key={index}><strong>{formatAmount(value)}</strong></td>)}</tr>
            {expanded[group.key] ? group.rows.map((row) => <tr key={`${row.transId}-${row.rowNo}`}><td /><td /><td /><td>{arrow(`Open ${row.documentType}`, () => openDocument(row))}{row.documentPrefix}</td><td><button type="button" className="cra-doc-link" onClick={() => openDocument(row)}>{row.documentNumber}</button></td><td>{formatDate(row.postingDate)}</td><td>{formatDate(row.dueDate)}</td><td className="is-number">{row.daysOutstanding}</td><td className="is-number">{formatAmount(row.balance)}</td>{row.buckets.map((value, index) => <td className="is-number" key={index}>{value ? formatAmount(value) : ""}</td>)}</tr>) : null}</React.Fragment>)}</tbody>
          <tfoot><tr><td colSpan="8" /><td className="is-number">{formatAmount(totals.balance)}</td>{totals.buckets.map((value, index) => <td className="is-number" key={index}>{formatAmount(value)}</td>)}</tr></tfoot></table></div>
        <div className="cra-report-footer"><ReportBackButton onClick={() => setReport(null)} className="sales-analysis-report__back-btn" /><div><button type="button" className="cra-btn" onClick={() => setExpanded(Object.fromEntries(groups.map((group) => [group.key, true])))}>Expand All</button><button type="button" className="cra-btn" onClick={() => setExpanded({})}>Collapse All</button></div></div>
      </div> : null}
    </section>
  ) : null;

  return <div className="cra-page sales-analysis-page sap-report-page">{criteriaView}{reportView}
    <PropertiesSelectionModal isOpen={showProperties} title="Properties" propertyLabelPrefix="Business Partners Property" properties={lookups.properties} value={criteria.propertyFilter} onClose={() => setShowProperties(false)} onSave={(value) => setField("propertyFilter", value)} />
    <GLAccountLookupModal isOpen={showAccounts} title="Account Selection" accounts={lookups.controlAccounts} selectedCodes={criteria.selectedAccountCodes} onClose={() => setShowAccounts(false)} onSave={(value) => setField("selectedAccountCodes", value)} />
  </div>;
}

export default CustomerReceivablesAgingReportPage;
