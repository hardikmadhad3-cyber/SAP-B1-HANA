import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BusinessPartnerLookupModal from "../components/reports/BusinessPartnerLookupModal";
import PropertiesSelectionModal from "../components/reports/PropertiesSelectionModal";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import {
  fetchInactiveCustomersLookups,
  fetchInactiveCustomersReport,
} from "../api/inactiveCustomersApi";
import "../styles/sales-analysis-report.css";
import "../styles/inactive-customers-report.css";

const DEFAULT_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({
  number: index + 1,
  name: `Business Partners Property ${index + 1}`,
}));

const DOCUMENT_OPTIONS = [
  { key: "salesQuotations", label: "Sales Quotations" },
  { key: "deliveryNotes", label: "Delivery Notes" },
  { key: "orders", label: "Orders" },
  { key: "arInvoices", label: "A/R Invoices" },
];

const createInitialCriteria = () => ({
  codeFrom: "",
  codeTo: "",
  dateFrom: "03/03/23",
  customerGroup: "All",
  propertyFilter: {
    ignoreProperties: true,
    linkMode: "and",
    exactlyMatch: false,
    selectedPropertyNumbers: [],
  },
  documentTypes: {
    salesQuotations: true,
    deliveryNotes: true,
    orders: true,
    arInvoices: true,
  },
});

const parseSapDateToIso = (value) => {
  const raw = String(value || "").trim();
  if (!raw || /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return raw;

  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
};

function WindowControls({ frame, onClose }) {
  return (
    <div className="sales-analysis-window__controls">
      <button type="button" aria-label={frame.isMinimized ? "Restore" : "Minimize"} onClick={frame.toggleMinimize}>
        {frame.isMinimized ? "[]" : "-"}
      </button>
      <button
        type="button"
        aria-label={frame.isMaximized ? "Restore Down" : "Restore"}
        onClick={frame.isMaximized ? frame.restoreWindow : frame.toggleMaximize}
      >
        []
      </button>
      <button type="button" aria-label="Close" onClick={onClose}>x</button>
    </div>
  );
}

function InactiveCustomersReportPage() {
  const navigate = useNavigate();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(createInitialCriteria);
  const [lookups, setLookups] = useState({
    customerGroups: [{ code: "All", name: "All" }],
    properties: DEFAULT_PROPERTIES,
  });
  const [lookupTarget, setLookupTarget] = useState("");
  const [showProperties, setShowProperties] = useState(false);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 24,
    taskId: "inactive-customers-criteria",
    taskTitle: "Inactive Customers - Selection Criteria",
    taskPath: "/reports/crm/inactive-customers",
    bounds: "parent",
  });

  const reportWindow = useFloatingWindow({
    isOpen: Boolean(report),
    defaultTop: 10,
    taskId: "inactive-customers-report",
    taskTitle: "Inactive Customers",
    taskPath: "/reports/crm/inactive-customers",
    bounds: "parent",
  });

  useEffect(() => {
    let ignore = false;

    const loadLookups = async () => {
      try {
        const response = await fetchInactiveCustomersLookups();
        if (ignore) return;

        const customerGroups = Array.isArray(response?.customerGroups) && response.customerGroups.length
          ? response.customerGroups.map((group) => ({
            code: String(group.code ?? "All").trim() || "All",
            name: String(group.name ?? group.code ?? "All").trim() || "All",
          }))
          : [{ code: "All", name: "All" }];

        const properties = Array.isArray(response?.properties) && response.properties.length
          ? response.properties.map((property, index) => ({
            number: Number(property.number || index + 1),
            name: property.name || `Business Partners Property ${index + 1}`,
          }))
          : DEFAULT_PROPERTIES;

        setLookups({ customerGroups, properties });

        setCriteria((current) => {
          if (current.customerGroup !== "All") return current;
          const defaultGroup = customerGroups.find((group) => group.name.toLowerCase() === "customers");
          return defaultGroup ? { ...current, customerGroup: defaultGroup.code } : current;
        });
      } catch (error) {
        if (!ignore) {
          setLookups({ customerGroups: [{ code: "All", name: "All" }], properties: DEFAULT_PROPERTIES });
          setStatusMessage(error?.response?.data?.message || "Could not load Inactive Customers lookups.");
        }
      }
    };

    loadLookups();
    return () => {
      ignore = true;
    };
  }, []);

  const customerGroups = useMemo(() => {
    const seen = new Set();
    return lookups.customerGroups.filter((group) => {
      const key = String(group.code || group.name).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [lookups.customerGroups]);

  const propertyLabel = criteria.propertyFilter.ignoreProperties
    ? "Ignore"
    : `${criteria.propertyFilter.selectedPropertyNumbers.length} Selected`;

  const setField = (field, value) => {
    setCriteria((current) => ({ ...current, [field]: value }));
  };

  const handleSelectAll = () => {
    setCriteria({
      ...createInitialCriteria(),
      dateFrom: criteria.dateFrom,
      customerGroup: "All",
    });
    setStatusMessage("");
  };

  const handleCloseCriteria = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate("/dashboard");
  };

  const handleOk = async () => {
    setLoading(true);
    setStatusMessage("");

    try {
      const payload = {
        ...criteria,
        dateFrom: parseSapDateToIso(criteria.dateFrom),
      };
      const response = await fetchInactiveCustomersReport(payload);
      setReport(response);
    } catch (error) {
      setStatusMessage(error?.response?.data?.message || "Could not load Inactive Customers report.");
    } finally {
      setLoading(false);
    }
  };

  const handleBpSelect = (row) => {
    if (!lookupTarget) return;
    setField(lookupTarget, row.CardCode || "");
  };

  const renderCriteriaWindow = () => (
    <section
      className={`icr-window icr-window--criteria sales-analysis-window sap-report-window${criteriaWindow.isMinimized ? " is-minimized" : ""}${criteriaWindow.isMaximized ? " is-maximized" : ""}`}
      {...criteriaWindow.windowProps}
    >
      <header className="sales-analysis-window__titlebar sap-report-titlebar" {...criteriaWindow.titleBarProps}>
        <span className="sales-analysis-window__title sap-report-title">Inactive Customers - Selection Criteria</span>
        <WindowControls frame={criteriaWindow} onClose={handleCloseCriteria} />
      </header>
      <div className="sales-analysis-window__accent sap-report-accent" />

      {!criteriaWindow.isMinimized ? (
        <div className="icr-body sales-analysis-window__body">
          <div className="icr-criteria-panel sales-analysis-panel">
            <div className="icr-code-row">
              <label className="icr-label">Code</label>
              <span className="icr-small-label">From</span>
              <div className="sales-analysis__lookup-wrap">
                <input value={criteria.codeFrom} onChange={(event) => setField("codeFrom", event.target.value)} />
                <button type="button" className="sales-analysis__lookup-btn" onClick={() => setLookupTarget("codeFrom")}>...</button>
              </div>
              <span className="icr-small-label">To</span>
              <div className="sales-analysis__lookup-wrap">
                <input value={criteria.codeTo} onChange={(event) => setField("codeTo", event.target.value)} />
                <button type="button" className="sales-analysis__lookup-btn" onClick={() => setLookupTarget("codeTo")}>...</button>
              </div>
            </div>

            <div className="icr-form-row">
              <label className="icr-label" htmlFor="inactive-date-from">Date From</label>
              <input
                id="inactive-date-from"
                value={criteria.dateFrom}
                onChange={(event) => setField("dateFrom", event.target.value)}
              />
            </div>

            <div className="icr-form-row">
              <label className="icr-label" htmlFor="inactive-customer-group">Customer Group</label>
              <select
                id="inactive-customer-group"
                value={criteria.customerGroup}
                onChange={(event) => setField("customerGroup", event.target.value)}
              >
                {customerGroups.map((group) => (
                  <option key={`${group.code}-${group.name}`} value={group.code}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="icr-form-row icr-property-row">
              <button type="button" className="sales-analysis__sap-btn sales-analysis__sap-btn--field" onClick={() => setShowProperties(true)}>
                Properties
              </button>
              <input value={propertyLabel} readOnly />
            </div>

            <footer className="icr-criteria-footer sales-analysis-window__footer">
              <button type="button" className="sales-analysis__sap-btn sap-report-btn--primary" onClick={handleOk} disabled={loading}>
                {loading ? "Loading..." : "OK"}
              </button>
              <button type="button" className="sales-analysis__sap-btn sales-analysis__sap-btn--secondary" onClick={handleCloseCriteria}>
                Cancel
              </button>
              <button type="button" className="sales-analysis__sap-btn icr-select-all-btn" onClick={handleSelectAll}>
                Select All
              </button>
            </footer>
          </div>

          {statusMessage ? <div className="sales-analysis__status">{statusMessage}</div> : null}
        </div>
      ) : null}
    </section>
  );

  const renderDocumentChecks = () => (
    <div className="icr-document-strip">
      {DOCUMENT_OPTIONS.map((option) => (
        <label key={option.key} className="sales-analysis__checkbox-line icr-document-option">
          <input
            type="checkbox"
            checked={Boolean(criteria.documentTypes[option.key])}
            readOnly
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );

  const reportRows = Array.isArray(report?.rows) ? report.rows : [];

  const renderReportWindow = () => {
    if (!report) return null;

    return (
      <section
        className={`icr-window icr-window--report sales-analysis-window sales-analysis-window--report sap-report-window${reportWindow.isMinimized ? " is-minimized" : ""}${reportWindow.isMaximized ? " is-maximized" : ""}`}
        {...reportWindow.windowProps}
      >
        <header className="sales-analysis-window__titlebar sap-report-titlebar" {...reportWindow.titleBarProps}>
          <span className="sales-analysis-window__title sap-report-title">Inactive Customers</span>
          <WindowControls frame={reportWindow} onClose={() => setReport(null)} />
        </header>
        <div className="sales-analysis-window__accent sap-report-accent" />

        {!reportWindow.isMinimized ? (
          <div className="icr-report-body sales-analysis-window__body sales-analysis-window__body--report">
            {renderDocumentChecks()}
            <div className="sales-analysis-report__grid-wrap">
              <table className="icr-grid sales-analysis-report__grid">
                <thead>
                  <tr>
                    <th className="is-row-number">#</th>
                    <th>Customer Code</th>
                    <th>BP Name</th>
                    <th>Telephone 1</th>
                    <th>Telephone 2</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.length ? reportRows.map((row, index) => (
                    <tr key={`${row.customerCode}-${index}`}>
                      <td className="is-row-number">{index + 1}</td>
                      <td>
                        <button
                          type="button"
                          className="sales-analysis-report__link-cell"
                          onClick={() => navigate(`/business-partner?cardCode=${encodeURIComponent(row.customerCode)}`)}
                        >
                          <span className="sales-analysis-report__link-icon" aria-hidden="true">-&gt;</span>
                          <span>{row.customerCode}</span>
                        </button>
                      </td>
                      <td>{row.bpName}</td>
                      <td>{row.telephone1}</td>
                      <td>{row.telephone2}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="sales-analysis-report__empty" colSpan={5}>
                        No inactive customers matched the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="sales-analysis-report__footer">
              <button type="button" className="sales-analysis-report__back-btn" onClick={() => setReport(null)} aria-label="Back to selection criteria">
                {"<"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  return (
    <div className="icr-page sales-analysis-page sap-report-page">
      {renderCriteriaWindow()}
      {renderReportWindow()}
      <BusinessPartnerLookupModal
        isOpen={Boolean(lookupTarget)}
        onClose={() => setLookupTarget("")}
        onSelect={handleBpSelect}
        type="cCustomer"
      />
      <PropertiesSelectionModal
        isOpen={showProperties}
        title="Properties"
        propertyLabelPrefix="Business Partners Property"
        properties={lookups.properties}
        value={criteria.propertyFilter}
        onClose={() => setShowProperties(false)}
        onSave={(value) => setField("propertyFilter", value)}
      />
    </div>
  );
}

export default InactiveCustomersReportPage;
