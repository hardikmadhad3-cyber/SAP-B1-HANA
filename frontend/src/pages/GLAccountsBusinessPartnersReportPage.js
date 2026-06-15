import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BusinessPartnerLookupModal from "../components/reports/BusinessPartnerLookupModal";
import PropertiesSelectionModal from "../components/reports/PropertiesSelectionModal";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import {
  fetchGLAccountsBusinessPartnersLookups,
  fetchGLAccountsBusinessPartnersReport,
} from "../api/glAccountsBusinessPartnersReportApi";
import "../styles/sales-analysis-report.css";
import "../styles/gl-accounts-business-partners-report.css";

const REPORT_PATH = "/reports/financial/accounting/gl-accounts-business-partners";

const DEFAULT_ACCOUNT_GROUPS = [
  { groupMask: 1, code: "1", name: "Asset" },
  { groupMask: 2, code: "2", name: "Liability" },
  { groupMask: 3, code: "3", name: "Equity" },
  { groupMask: 4, code: "4", name: "Revenue" },
  { groupMask: 5, code: "5", name: "Expenditure" },
];

const DEFAULT_BP_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({
  number: index + 1,
  name: `Business Partners Property ${index + 1}`,
}));

const DISPLAY_CURRENCY_OPTIONS = [
  { value: "local", label: "Local Currency" },
  { value: "system", label: "System Currency" },
  { value: "foreign", label: "Foreign Currency" },
];

const createInitialState = () => ({
  includeBusinessPartners: true,
  displayLeads: false,
  includeGlAccounts: true,
  bpCodeFrom: "",
  bpCodeTo: "",
  customerGroup: "All",
  vendorGroup: "All",
  propertyMode: "Ignore",
  propertyFilter: {
    ignoreProperties: true,
    linkMode: "and",
    exactlyMatch: false,
    selectedPropertyNumbers: [],
  },
  selectedAccountGroupMasks: DEFAULT_ACCOUNT_GROUPS.map((group) => group.groupMask),
  accountFindGroup: "1",
});

const normalizeOptions = (rows = [], fallback = [{ code: "All", name: "All" }]) => {
  const normalized = Array.isArray(rows)
    ? rows
      .filter((row) => String(row?.name || row?.code || "").trim())
      .map((row) => ({
        code: String(row.code || row.name || "").trim(),
        name: String(row.name || row.code || "").trim(),
      }))
    : [];

  return normalized.length ? normalized : fallback;
};

const getPropertySummary = (filter = {}) => {
  if (filter.ignoreProperties !== false) return "Ignore";
  const count = Array.isArray(filter.selectedPropertyNumbers) ? filter.selectedPropertyNumbers.length : 0;
  if (!count) return "None";
  return `${count} Selected (${filter.linkMode === "or" ? "Or" : "And"})`;
};

const renderWindowControls = (windowFrame, onMinimize, onClose) => (
  <div className="sales-analysis-window__controls">
    <button
      type="button"
      aria-label={windowFrame.isMinimized ? "Restore" : "Minimize"}
      onClick={onMinimize}
    >
      -
    </button>
    <button
      type="button"
      aria-label={windowFrame.isMaximized ? "Restore Down" : "Restore"}
      onClick={windowFrame.toggleMaximize}
    >
      []
    </button>
    <button type="button" aria-label="Close" onClick={onClose}>x</button>
  </div>
);

function GLAccountsBusinessPartnersReportPage() {
  const navigate = useNavigate();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [formState, setFormState] = useState(createInitialState);
  const [customerGroups, setCustomerGroups] = useState([{ code: "All", name: "All" }]);
  const [vendorGroups, setVendorGroups] = useState([{ code: "All", name: "All" }]);
  const [accountGroups, setAccountGroups] = useState(DEFAULT_ACCOUNT_GROUPS);
  const [lookupTarget, setLookupTarget] = useState("");
  const [showProperties, setShowProperties] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportResult, setReportResult] = useState(null);
  const [resultOptions, setResultOptions] = useState({
    showGlAccounts: false,
    showBusinessPartners: true,
    showCombined: false,
    displayCurrency: "local",
  });
  const [focusedAccountGroup, setFocusedAccountGroup] = useState(1);

  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 22,
    taskId: "glbp-criteria",
    taskTitle: "G/L Accounts and Business Partners - Selection Criteria",
    taskPath: REPORT_PATH,
    bounds: "parent",
  });

  const reportWindow = useFloatingWindow({
    isOpen: Boolean(reportResult),
    defaultTop: 12,
    taskId: "glbp-report",
    taskTitle: reportResult?.reportTitle || "G/L Accounts and Business Partners",
    taskPath: REPORT_PATH,
    bounds: "parent",
  });

  useEffect(() => {
    let ignore = false;

    const loadLookups = async () => {
      try {
        const response = await fetchGLAccountsBusinessPartnersLookups();
        if (ignore) return;

        const nextAccountGroups = Array.isArray(response?.accountGroups) && response.accountGroups.length
          ? response.accountGroups.map((group) => ({
            groupMask: Number(group.groupMask || 0),
            code: String(group.code || group.groupMask || "").trim(),
            name: String(group.name || "").trim(),
          })).filter((group) => group.groupMask)
          : DEFAULT_ACCOUNT_GROUPS;

        setCustomerGroups(normalizeOptions(response?.customerGroups));
        setVendorGroups(normalizeOptions(response?.vendorGroups));
        setAccountGroups(nextAccountGroups.length ? nextAccountGroups : DEFAULT_ACCOUNT_GROUPS);
        setFormState((current) => ({
          ...current,
          selectedAccountGroupMasks: nextAccountGroups.length
            ? nextAccountGroups.map((group) => group.groupMask)
            : DEFAULT_ACCOUNT_GROUPS.map((group) => group.groupMask),
          accountFindGroup: String(nextAccountGroups[0]?.groupMask || 1),
        }));
      } catch (error) {
        if (!ignore) {
          setStatusMessage(error?.response?.data?.message || "Could not load report lookups.");
        }
      }
    };

    loadLookups();
    return () => {
      ignore = true;
    };
  }, []);

  const selectedAccountSet = useMemo(
    () => new Set((formState.selectedAccountGroupMasks || []).map((value) => Number(value))),
    [formState.selectedAccountGroupMasks],
  );

  const hasBusinessPartners = Boolean(reportResult?.businessPartners?.length);
  const hasGlAccounts = Boolean(reportResult?.glAccounts?.length);
  const hasCombinedRows = Boolean(reportResult?.combinedRows?.length);

  const setField = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleBpSelect = (businessPartner) => {
    if (!lookupTarget) return;
    setField(lookupTarget, String(businessPartner?.CardCode || ""));
    setLookupTarget("");
  };

  const handleAccountToggle = (groupMask) => {
    const numericMask = Number(groupMask);
    if (!numericMask || !formState.includeGlAccounts) return;

    setFormState((current) => {
      const currentSet = new Set((current.selectedAccountGroupMasks || []).map((value) => Number(value)));
      if (currentSet.has(numericMask)) {
        currentSet.delete(numericMask);
      } else {
        currentSet.add(numericMask);
      }

      return {
        ...current,
        selectedAccountGroupMasks: [...currentSet].sort((left, right) => left - right),
      };
    });
  };

  const handleFindAccountGroup = () => {
    const groupMask = Number(formState.accountFindGroup || 0);
    if (!groupMask) return;
    setFocusedAccountGroup(groupMask);
    setFormState((current) => {
      const currentSet = new Set((current.selectedAccountGroupMasks || []).map((value) => Number(value)));
      currentSet.add(groupMask);
      return {
        ...current,
        selectedAccountGroupMasks: [...currentSet].sort((left, right) => left - right),
      };
    });
  };

  const handleSelectAllAccounts = () => {
    setFormState((current) => ({
      ...current,
      selectedAccountGroupMasks: accountGroups.map((group) => Number(group.groupMask)).filter(Boolean),
    }));
  };

  const handlePropertiesSave = (propertyFilter) => {
    const propertyMode = propertyFilter.ignoreProperties ? "Ignore" : getPropertySummary(propertyFilter);
    setFormState((current) => ({
      ...current,
      propertyMode,
      propertyFilter,
    }));
  };

  const handleOk = async () => {
    if (!formState.includeBusinessPartners && !formState.includeGlAccounts) {
      setStatusMessage("Select BP or G/L Accounts to run the report.");
      return;
    }

    setIsLoadingReport(true);
    setStatusMessage("");

    try {
      const response = await fetchGLAccountsBusinessPartnersReport({
        includeBusinessPartners: formState.includeBusinessPartners,
        displayLeads: formState.displayLeads,
        includeGlAccounts: formState.includeGlAccounts,
        bpCodeFrom: formState.bpCodeFrom,
        bpCodeTo: formState.bpCodeTo,
        customerGroup: formState.customerGroup,
        vendorGroup: formState.vendorGroup,
        propertyFilter: formState.propertyFilter,
        selectedAccountGroupMasks: formState.selectedAccountGroupMasks,
      });

      const businessPartnerCount = response?.businessPartners?.length || 0;
      const accountCount = response?.glAccounts?.length || 0;

      setReportResult(response);
      setResultOptions({
        showGlAccounts: accountCount > 0 && businessPartnerCount === 0,
        showBusinessPartners: businessPartnerCount > 0,
        showCombined: businessPartnerCount > 0 && accountCount > 0,
        displayCurrency: "local",
      });
    } catch (error) {
      setReportResult(null);
      setStatusMessage(error?.response?.data?.message || error?.message || "Could not load the report.");
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleCancel = () => {
    setFormState(createInitialState());
    setReportResult(null);
    setStatusMessage("Selection criteria reset.");
  };

  const handleCloseCriteriaWindow = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate("/dashboard");
  };

  const handleMinimizeCriteriaWindow = () => {
    criteriaWindow.toggleMinimize();
    navigate("/dashboard");
  };

  const handleCloseReportWindow = () => {
    setReportResult(null);
  };

  const handleMinimizeReportWindow = () => {
    reportWindow.toggleMinimize();
    navigate("/dashboard");
  };

  const openBusinessPartner = (cardCode) => {
    const normalizedCode = String(cardCode || "").trim();
    if (!normalizedCode) return;
    navigate(`/business-partner?cardCode=${encodeURIComponent(normalizedCode)}`);
  };

  const openAccount = (accountCode) => {
    const normalizedCode = String(accountCode || "").trim();
    if (!normalizedCode) return;
    navigate(`/chart-of-accounts?accountCode=${encodeURIComponent(normalizedCode)}`);
  };

  const renderDrillCode = ({ code, sourceType = "bp" }) => (
    <span className="glbp-code-cell">
      <button
        type="button"
        className="glbp-drill-btn"
        title={sourceType === "account" ? "Open G/L Account" : "Open Business Partner"}
        onClick={() => (sourceType === "account" ? openAccount(code) : openBusinessPartner(code))}
      >
        -&gt;
      </button>
      <span>{code}</span>
    </span>
  );

  const renderBusinessPartnerGrid = () => {
    const rows = reportResult?.businessPartners || [];

    return (
      <div className="glbp-result-section glbp-result-section--bp">
        <div className="glbp-result-grid-wrap sap-report-grid-wrap">
          <table className="glbp-result-grid sap-report-grid">
            <thead>
              <tr>
                <th className="is-index">#</th>
                <th className="is-code">BP</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan="3" className="glbp-empty-cell">No business partners found.</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.bpCode || row.rowNo}>
                  <td className="is-index">{row.rowNo}</td>
                  <td className="is-code">{renderDrillCode({ code: row.bpCode, sourceType: "bp" })}</td>
                  <td>{row.bpName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAccountGrid = () => {
    const rows = reportResult?.glAccounts || [];

    return (
      <div className="glbp-result-section">
        <div className="glbp-result-grid-wrap sap-report-grid-wrap">
          <table className="glbp-result-grid sap-report-grid">
            <thead>
              <tr>
                <th className="is-index">#</th>
                <th className="is-code">G/L Account</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan="3" className="glbp-empty-cell">No G/L accounts found.</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.accountCode || row.rowNo}>
                  <td className="is-index">{row.rowNo}</td>
                  <td className="is-code">{renderDrillCode({ code: row.accountCode, sourceType: "account" })}</td>
                  <td>{row.accountName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCombinedGrid = () => {
    const rows = reportResult?.combinedRows || [];

    return (
      <div className="glbp-result-section">
        <div className="glbp-result-grid-wrap sap-report-grid-wrap">
          <table className="glbp-result-grid sap-report-grid">
            <thead>
              <tr>
                <th className="is-index">#</th>
                <th className="is-code">G/L Account/BP</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan="3" className="glbp-empty-cell">No G/L account or BP rows found.</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={`${row.sourceType}-${row.code}-${row.rowNo}`}>
                  <td className="is-index">{row.rowNo}</td>
                  <td className="is-code">{renderDrillCode({ code: row.code, sourceType: row.sourceType })}</td>
                  <td>{row.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderReportWindow = () => {
    if (!reportResult) return null;

    const shouldShowEmptyState =
      !resultOptions.showBusinessPartners &&
      !resultOptions.showGlAccounts &&
      !resultOptions.showCombined;

    return (
      <div
        className={`glbp-window glbp-window--report sap-report-window${reportWindow.isMinimized ? " is-minimized" : ""}${reportWindow.isMaximized ? " is-maximized" : ""}`}
        {...reportWindow.windowProps}
      >
        <div className="sales-analysis-window__titlebar sap-report-titlebar" {...reportWindow.titleBarProps}>
          <div className="sales-analysis-window__title sap-report-title">G/L Accounts and Business Partners</div>
          {renderWindowControls(reportWindow, handleMinimizeReportWindow, handleCloseReportWindow)}
        </div>
        <div className="sales-analysis-window__accent sap-report-accent" />
        {!reportWindow.isMinimized ? (
          <>
            <div className="glbp-result-body sales-analysis-window__body sales-analysis-window__body--report">
              {shouldShowEmptyState ? (
                <div className="glbp-empty-state">Select a result section below.</div>
              ) : null}
              {resultOptions.showBusinessPartners ? renderBusinessPartnerGrid() : null}
              {resultOptions.showGlAccounts ? renderAccountGrid() : null}
              {resultOptions.showCombined ? renderCombinedGrid() : null}
            </div>
            <div className="glbp-report-footer">
              <button
                type="button"
                className="sales-analysis-report__back-btn"
                aria-label="Back to selection criteria"
                onClick={handleCloseReportWindow}
              >
                &lt;
              </button>
              <div className="glbp-report-options">
                <label className={`glbp-checkbox-line${!hasGlAccounts ? " is-disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={resultOptions.showGlAccounts}
                    disabled={!hasGlAccounts}
                    onChange={(event) => setResultOptions((current) => ({
                      ...current,
                      showGlAccounts: event.target.checked,
                    }))}
                  />
                  <span>G/L Accounts</span>
                </label>
                <label className={`glbp-checkbox-line${!hasBusinessPartners ? " is-disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={resultOptions.showBusinessPartners}
                    disabled={!hasBusinessPartners}
                    onChange={(event) => setResultOptions((current) => ({
                      ...current,
                      showBusinessPartners: event.target.checked,
                    }))}
                  />
                  <span>Business Partner</span>
                </label>
                <label className={`glbp-checkbox-line${!hasCombinedRows ? " is-disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={resultOptions.showCombined}
                    disabled={!hasCombinedRows}
                    onChange={(event) => setResultOptions((current) => ({
                      ...current,
                      showCombined: event.target.checked,
                    }))}
                  />
                  <span>G/L Accounts/BP</span>
                </label>
              </div>
              <div className="glbp-currency-control">
                <label htmlFor="glbp-display-currency">Display Currency</label>
                <select
                  id="glbp-display-currency"
                  className="sap-report-input"
                  value={resultOptions.displayCurrency}
                  onChange={(event) => setResultOptions((current) => ({
                    ...current,
                    displayCurrency: event.target.value,
                  }))}
                >
                  {DISPLAY_CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="glbp-page sap-report-page">
      <div
        className={`glbp-window glbp-window--criteria sap-report-window${criteriaWindow.isMinimized ? " is-minimized" : ""}${criteriaWindow.isMaximized ? " is-maximized" : ""}`}
        {...criteriaWindow.windowProps}
      >
        <div className="sales-analysis-window__titlebar sap-report-titlebar" {...criteriaWindow.titleBarProps}>
          <div className="sales-analysis-window__title sap-report-title">G/L Accounts and Business Partners - Selection Criteria</div>
          {renderWindowControls(criteriaWindow, handleMinimizeCriteriaWindow, handleCloseCriteriaWindow)}
        </div>
        <div className="sales-analysis-window__accent sap-report-accent" />
        {!criteriaWindow.isMinimized ? (
          <>
            <div className="glbp-criteria-body sales-analysis-window__body">
              <div className="glbp-criteria-grid">
                <div className="glbp-left-panel">
                  <div className="glbp-top-options">
                    <label className="glbp-checkbox-line">
                      <input
                        type="checkbox"
                        checked={formState.includeBusinessPartners}
                        onChange={(event) => setField("includeBusinessPartners", event.target.checked)}
                      />
                      <span>BP</span>
                    </label>
                    <label className="glbp-checkbox-line">
                      <input
                        type="checkbox"
                        checked={formState.displayLeads}
                        disabled={!formState.includeBusinessPartners}
                        onChange={(event) => setField("displayLeads", event.target.checked)}
                      />
                      <span>Display Leads</span>
                    </label>
                  </div>

                  <div className={`glbp-code-row${!formState.includeBusinessPartners ? " is-disabled" : ""}`}>
                    <button type="button" className="glbp-link-label" disabled={!formState.includeBusinessPartners}>Code</button>
                    <span>From</span>
                    <div className="glbp-lookup-field">
                      <input
                        className="sap-report-input"
                        value={formState.bpCodeFrom}
                        disabled={!formState.includeBusinessPartners}
                        onChange={(event) => setField("bpCodeFrom", event.target.value)}
                      />
                      <button
                        type="button"
                        className="glbp-lookup-btn"
                        disabled={!formState.includeBusinessPartners}
                        title="List of Business Partners"
                        onClick={() => setLookupTarget("bpCodeFrom")}
                      >
                        ...
                      </button>
                    </div>
                    <span>To</span>
                    <div className="glbp-lookup-field">
                      <input
                        className="sap-report-input"
                        value={formState.bpCodeTo}
                        disabled={!formState.includeBusinessPartners}
                        onChange={(event) => setField("bpCodeTo", event.target.value)}
                      />
                      <button
                        type="button"
                        className="glbp-lookup-btn"
                        disabled={!formState.includeBusinessPartners}
                        title="List of Business Partners"
                        onClick={() => setLookupTarget("bpCodeTo")}
                      >
                        ...
                      </button>
                    </div>
                  </div>

                  <div className={`glbp-group-row${!formState.includeBusinessPartners ? " is-disabled" : ""}`}>
                    <label htmlFor="glbp-customer-group">Customer Group</label>
                    <select
                      id="glbp-customer-group"
                      className="sap-report-input"
                      value={formState.customerGroup}
                      disabled={!formState.includeBusinessPartners}
                      onChange={(event) => setField("customerGroup", event.target.value)}
                    >
                      {customerGroups.map((group) => (
                        <option key={`customer-${group.code}`} value={group.code}>{group.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={`glbp-group-row${!formState.includeBusinessPartners ? " is-disabled" : ""}`}>
                    <label htmlFor="glbp-vendor-group">Vendor Group</label>
                    <select
                      id="glbp-vendor-group"
                      className="sap-report-input"
                      value={formState.vendorGroup}
                      disabled={!formState.includeBusinessPartners}
                      onChange={(event) => setField("vendorGroup", event.target.value)}
                    >
                      {vendorGroups.map((group) => (
                        <option key={`vendor-${group.code}`} value={group.code}>{group.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={`glbp-properties-row${!formState.includeBusinessPartners ? " is-disabled" : ""}`}>
                    <button
                      type="button"
                      className="sap-report-btn glbp-properties-btn"
                      disabled={!formState.includeBusinessPartners}
                      onClick={() => setShowProperties(true)}
                    >
                      Properties
                    </button>
                    <input className="sap-report-input" value={formState.propertyMode} readOnly />
                  </div>
                </div>

                <div className="glbp-right-panel">
                  <div className="glbp-account-toolbar">
                    <label className="glbp-checkbox-line">
                      <input
                        type="checkbox"
                        checked={formState.includeGlAccounts}
                        onChange={(event) => setField("includeGlAccounts", event.target.checked)}
                      />
                      <span>G/L Accounts</span>
                    </label>
                    <button type="button" className="sap-report-btn glbp-find-btn" onClick={handleFindAccountGroup}>
                      Find
                    </button>
                    <select
                      className="sap-report-input"
                      value={formState.accountFindGroup}
                      disabled={!formState.includeGlAccounts}
                      onChange={(event) => setField("accountFindGroup", event.target.value)}
                    >
                      {accountGroups.map((group) => (
                        <option key={`find-${group.groupMask}`} value={group.groupMask}>{group.code}</option>
                      ))}
                    </select>
                  </div>

                  <div className={`glbp-account-grid-wrap${!formState.includeGlAccounts ? " is-disabled" : ""}`}>
                    <table className="glbp-account-grid">
                      <thead>
                        <tr>
                          <th className="is-index">#</th>
                          <th className="is-check">x</th>
                          <th>Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountGroups.map((group) => {
                          const isSelected = selectedAccountSet.has(Number(group.groupMask));
                          const isFocused = Number(focusedAccountGroup) === Number(group.groupMask);
                          return (
                            <tr
                              key={group.groupMask}
                              className={`${isSelected ? "is-selected" : ""}${isFocused ? " is-focused" : ""}`}
                              onClick={() => handleAccountToggle(group.groupMask)}
                            >
                              <td className="is-index">{group.code}</td>
                              <td className="is-check">{isSelected ? "x" : ""}</td>
                              <td>
                                <span className="glbp-account-label">
                                  <span className="glbp-account-arrow" aria-hidden="true">-&gt;</span>
                                  {group.name}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {isLoadingReport ? <div className="glbp-status">Loading G/L Accounts and Business Partners report...</div> : null}
              {statusMessage ? <div className="glbp-status">{statusMessage}</div> : null}
            </div>
            <div className="glbp-criteria-footer">
              <div className="glbp-primary-actions">
                <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={handleOk} disabled={isLoadingReport}>
                  OK
                </button>
                <button type="button" className="sap-report-btn" onClick={handleCancel} disabled={isLoadingReport}>
                  Cancel
                </button>
              </div>
              <button type="button" className="sap-report-btn glbp-select-all-btn" onClick={handleSelectAllAccounts} disabled={!formState.includeGlAccounts}>
                Select All
              </button>
            </div>
          </>
        ) : null}
      </div>

      {renderReportWindow()}

      <BusinessPartnerLookupModal
        isOpen={Boolean(lookupTarget)}
        onClose={() => setLookupTarget("")}
        onSelect={handleBpSelect}
        type=""
      />

      <PropertiesSelectionModal
        isOpen={showProperties}
        onClose={() => setShowProperties(false)}
        onSave={handlePropertiesSave}
        title="Properties"
        propertyLabelPrefix="Business Partners Property"
        properties={DEFAULT_BP_PROPERTIES}
        value={formState.propertyFilter}
      />
    </div>
  );
}

export default GLAccountsBusinessPartnersReportPage;
