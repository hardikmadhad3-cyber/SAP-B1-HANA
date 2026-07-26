import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import BusinessPartnerLookupModal from "../components/reports/BusinessPartnerLookupModal";
import ItemLookupModal from "../components/reports/ItemLookupModal";
import PropertiesSelectionModal from "../components/reports/PropertiesSelectionModal";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { ReportWindowControls, ReportBackButton } from "../components/reports/ReportWindowControls";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import { fetchCampaignsListLookups, fetchCampaignsListReport } from "../api/campaignsListReportApi";
import "../styles/campaigns-list-report.css";
import "../styles/sales-analysis-report.css";

const DEFAULT_ITEM_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({
  number: index + 1,
  name: `Items Property ${index + 1}`,
}));

const DEFAULT_BP_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({
  number: index + 1,
  name: `Business Partners Property ${index + 1}`,
}));

const DEFAULT_RESPONSE_TYPES = [
  { value: "Interested", label: "Interested in Campaign" },
  { value: "Not Interested", label: "Not Interested in Campaign" },
];

const DEFAULT_DOCUMENT_TYPES = [
  { key: "opportunities", label: "Sales Opportunities" },
  { key: "quotations", label: "Sales Quotations" },
  { key: "orders", label: "Sales Orders" },
  { key: "deliveries", label: "Deliveries" },
  { key: "arInvoices", label: "A/R Invoices" },
  { key: "withoutLinkedDocument", label: "Without Linked Document" },
];

const initialPropertyFilter = () => ({
  ignoreProperties: true,
  linkMode: "and",
  exactlyMatch: false,
  selectedPropertyNumbers: [],
});

const createInitialState = () => ({
  itemCodeFrom: "",
  itemCodeTo: "",
  itemGroup: "All",
  itemPropertyFilter: initialPropertyFilter(),
  targetGroupType: "customer",
  bpCodeFrom: "",
  bpCodeTo: "",
  bpGroup: "All",
  bpPropertyFilter: initialPropertyFilter(),
  campaignNoFrom: "",
  campaignNoTo: "",
  campaignType: "All",
  owner: "All",
  status: "All",
  targetGroup: "All",
  responseTypeEnabled: false,
  responseTypes: [],
  documentsEnabled: false,
  documents: {},
  startDateFrom: "",
  startDateTo: "",
  endDateFrom: "",
  endDateTo: "",
});

const normalizeOptions = (rows = [], fallback = [{ value: "All", label: "All" }]) => {
  const normalized = rows
    .map((row) => ({
      value: String(row.value ?? row.code ?? row.GroupCode ?? row.ItmsGrpCod ?? "").trim(),
      label: String(row.label ?? row.name ?? row.GroupName ?? row.ItmsGrpNam ?? "").trim(),
    }))
    .filter((row) => row.value || row.label);

  return normalized.length ? normalized : fallback;
};

const propertyLabel = (filter) =>
  filter?.ignoreProperties ? "Ignore" : `${filter?.selectedPropertyNumbers?.length || 0} Selected`;

const formatAmount = (value) =>
  `INR ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatPercent = (value) => Number(value || 0).toFixed(2);

function SelectionDialog({
  isOpen,
  title,
  rows,
  selectedValues,
  valueKey = "value",
  labelKey = "label",
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState([]);
  const windowFrame = useFloatingWindow({ isOpen, defaultTop: 74, bounds: "parent" });

  useEffect(() => {
    if (isOpen) setDraft(Array.isArray(selectedValues) ? selectedValues : []);
  }, [isOpen, selectedValues]);

  const selectedSet = useMemo(() => new Set(draft), [draft]);

  const toggle = (value) => {
    setDraft((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value],
    );
  };

  if (!isOpen) return null;

  return (
    <div className="campaign-lookup__backdrop" onClick={onClose}>
      <div
        className="campaign-lookup"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        {...windowFrame.windowProps}
      >
        <div className="campaign-lookup__titlebar" {...windowFrame.titleBarProps}>
          <span>{title}</span>
          <div className="campaign-lookup__controls sales-analysis-window__controls">
            <button type="button" aria-label={windowFrame.isMinimized ? "Restore" : "Minimize"} onClick={windowFrame.toggleMinimize}>
              {windowFrame.isMinimized ? "[]" : "-"}
            </button>
            <button type="button" aria-label="Restore" onClick={windowFrame.restoreWindow}>[]</button>
            <button type="button" aria-label="Close" onClick={onClose}>x</button>
          </div>
        </div>
        <div className="campaign-lookup__accent" />

        {!windowFrame.isMinimized ? (
          <div className="campaign-lookup__body">
            <div className="campaign-lookup__grid-wrap">
              <table className="campaign-lookup__grid">
                <thead>
                  <tr>
                    <th className="is-index">#</th>
                    <th>{title === "Document Types" ? "Document Type" : "Response Type"}</th>
                    {title !== "Document Types" ? <th>Response Description</th> : null}
                    <th className="is-choose">Choose</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const value = String(row[valueKey] || "");
                    const label = String(row[labelKey] || value);
                    return (
                      <tr
                        key={value || index}
                        className={selectedSet.has(value) ? "is-selected" : ""}
                        onClick={() => toggle(value)}
                      >
                        <td className="is-index">{index + 1}</td>
                        <td>{title === "Document Types" ? label : value}</td>
                        {title !== "Document Types" ? <td>{label}</td> : null}
                        <td className="is-choose">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(value)}
                            onChange={() => toggle(value)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 10 - rows.length) }, (_, index) => (
                    <tr key={`empty-${index}`} aria-hidden="true">
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      {title !== "Document Types" ? <td>&nbsp;</td> : null}
                      <td>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="campaign-lookup__footer">
              <button type="button" className="campaign-btn campaign-btn--primary" onClick={() => { onSave(draft); onClose(); }}>OK</button>
              <button type="button" className="campaign-btn" onClick={onClose}>Cancel</button>
              {title !== "Document Types" ? (
                <>
                  <button type="button" className="campaign-btn campaign-btn--wide" onClick={() => setDraft(rows.map((row) => String(row[valueKey] || "")))}>
                    Select All
                  </button>
                  <button type="button" className="campaign-btn campaign-btn--wide" onClick={() => setDraft([])}>
                    Clear All
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CampaignsListReportPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [formState, setFormState] = useState(createInitialState);
  const [lookups, setLookups] = useState({
    itemGroups: [{ value: "All", label: "All" }],
    customerGroups: [{ value: "All", label: "All" }],
    vendorGroups: [{ value: "All", label: "All" }],
    campaignTypes: [{ value: "All", label: "All" }],
    statuses: [{ value: "All", label: "All" }],
    owners: [{ value: "All", label: "All" }],
    targetGroups: [{ value: "All", label: "All" }],
    responseTypes: DEFAULT_RESPONSE_TYPES,
    documentTypes: DEFAULT_DOCUMENT_TYPES,
    itemProperties: DEFAULT_ITEM_PROPERTIES,
    bpProperties: DEFAULT_BP_PROPERTIES,
  });
  const [reportResult, setReportResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [itemLookupTarget, setItemLookupTarget] = useState("");
  const [bpLookupTarget, setBpLookupTarget] = useState("");
  const [propertiesTarget, setPropertiesTarget] = useState("");
  const [showResponseLookup, setShowResponseLookup] = useState(false);
  const [showDocumentLookup, setShowDocumentLookup] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [expanded, setExpanded] = useState(true);

  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 24,
    taskId: "campaigns-list-criteria",
    taskTitle: "Campaigns List - Selection Criteria",
    taskPath: "/reports/crm/campaigns-list",
    bounds: "parent",
  });

  const reportWindow = useFloatingWindow({
    isOpen: Boolean(reportResult),
    defaultTop: 12,
    taskId: "campaigns-list-report",
    taskTitle: "Campaigns List Report",
    taskPath: "/reports/crm/campaigns-list",
    bounds: "parent",
  });

  useEffect(() => {
    let active = true;
    fetchCampaignsListLookups()
      .then((data) => {
        if (!active) return;
        setLookups({
          itemGroups: normalizeOptions(data.itemGroups),
          customerGroups: normalizeOptions(data.customerGroups),
          vendorGroups: normalizeOptions(data.vendorGroups),
          campaignTypes: normalizeOptions(data.campaignTypes),
          statuses: normalizeOptions(data.statuses),
          owners: normalizeOptions(data.owners),
          targetGroups: normalizeOptions(data.targetGroups),
          responseTypes: Array.isArray(data.responseTypes) && data.responseTypes.length ? data.responseTypes : DEFAULT_RESPONSE_TYPES,
          documentTypes: Array.isArray(data.documentTypes) && data.documentTypes.length ? data.documentTypes : DEFAULT_DOCUMENT_TYPES,
          itemProperties: Array.isArray(data.itemProperties) && data.itemProperties.length ? data.itemProperties : DEFAULT_ITEM_PROPERTIES,
          bpProperties: Array.isArray(data.bpProperties) && data.bpProperties.length ? data.bpProperties : DEFAULT_BP_PROPERTIES,
        });
      })
      .catch((error) => {
        if (!active) return;
        setStatusMessage(error?.response?.data?.message || error?.message || "Could not load campaign list lookups.");
      });

    return () => {
      active = false;
    };
  }, []);

  const bpGroups = formState.targetGroupType === "vendor" ? lookups.vendorGroups : lookups.customerGroups;
  const selectedDocuments = lookups.documentTypes.filter((option) => formState.documents?.[option.key]).map((option) => option.key);

  const setField = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const setPropertyFilter = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const updateDocumentSelection = (selectedKeys) => {
    const selectedSet = new Set(selectedKeys);
    setField(
      "documents",
      Object.fromEntries(lookups.documentTypes.map((option) => [option.key, selectedSet.has(option.key)])),
    );
  };

  const handleOk = async () => {
    setIsLoadingReport(true);
    setStatusMessage("");
    try {
      const response = await fetchCampaignsListReport(formState);
      setReportResult(response);
      setSelectedRowIndex(0);
      setExpanded(true);
      if (response?.warning) setStatusMessage(response.warning);
    } catch (error) {
      setReportResult(null);
      setStatusMessage(error?.response?.data?.message || error?.message || "Could not load Campaigns List report.");
    } finally {
      setIsLoadingReport(false);
    }
  };

  const closeCriteriaWindow = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate("/dashboard");
  };

  const minimizeCriteriaWindow = () => {
    criteriaWindow.toggleMinimize();
    navigate("/dashboard");
  };

  const minimizeReportWindow = () => {
    reportWindow.toggleMinimize();
    navigate("/dashboard");
  };

  const renderOption = (option) => (
    <option key={`${option.value}-${option.label}`} value={option.value}>
      {option.label || option.value}
    </option>
  );

  const renderRangeLookup = (fromField, toField, type) => (
    <>
      <span className="campaign-criteria__from-label">From</span>
      <div className="campaign-criteria__lookup-wrap">
        <input type="text" value={formState[fromField]} onChange={(event) => setField(fromField, event.target.value)} />
        <button type="button" onClick={() => (type === "item" ? setItemLookupTarget(fromField) : setBpLookupTarget(fromField))}>...</button>
      </div>
      <span>To</span>
      <div className="campaign-criteria__lookup-wrap">
        <input type="text" value={formState[toField]} onChange={(event) => setField(toField, event.target.value)} />
        <button type="button" onClick={() => (type === "item" ? setItemLookupTarget(toField) : setBpLookupTarget(toField))}>...</button>
      </div>
    </>
  );

  const reportRows = reportResult?.rows || [];
  const emptyRows = Array.from({ length: Math.max(0, 28 - reportRows.length) }, (_, index) => index);
  const visibleColumns = expanded
    ? [
      ["document", "Document"],
      ["businessPartnersResponded", "Number of Business Partners Responded"],
      ["salesAmount", "Sales Amount"],
      ["responsePercent", "Response %"],
      ["grossProfit", "Gross Profit"],
      ["leadsGenerated", "Number of Leads Generated"],
      ["grossProfitPercent", "Gross Profit %"],
      ["opportunities", "Number of Opportunities"],
      ["opportunitiesWinRate", "Opportunities Win Rate %"],
      ["opportunitiesWon", "Number of Opportunities Won"],
      ["totalSalesAmount", "Total Sales Amount"],
      ["totalGrossProfit", "Total Gross Profit"],
      ["totalGrossProfitPercent", "Total Gross Profit %"],
    ]
    : [
      ["campaignNo", "Campaign No."],
      ["campaignName", "Campaign Name"],
      ["status", "Status"],
      ["type", "Type"],
      ["owner", "Owner"],
      ["targetGroup", "Target Group"],
      ["startDate", "Start Date"],
      ["endDate", "End Date"],
      ["bpCode", "BP Code"],
      ["businessPartnersContacted", "Number of Business Partners Contacted"],
      ["document", "Document"],
      ["businessPartnersResponded", "Number of Business Partners Responded"],
      ["salesAmount", "Sales Amount"],
      ["responsePercent", "Response %"],
      ["grossProfit", "Gross Profit"],
      ["leadsGenerated", "Number of Leads Generated"],
      ["grossProfitPercent", "Gross Profit %"],
    ];

  const renderCellValue = (row, key) => {
    if (["salesAmount", "grossProfit", "totalSalesAmount", "totalGrossProfit"].includes(key)) return formatAmount(row[key]);
    if (["responsePercent", "grossProfitPercent", "opportunitiesWinRate", "totalGrossProfitPercent"].includes(key)) return formatPercent(row[key]);
    return row[key] ?? "";
  };

  const renderReportWindow = () => (
    <section
      className={`campaign-window campaign-window--report sales-analysis-window sales-analysis-window--report sap-report-window${reportWindow.isMinimized ? " is-minimized" : ""}${reportWindow.isMaximized ? " is-maximized" : ""}`}
      {...reportWindow.windowProps}
      style={{ ...(reportWindow.windowProps?.style || {}) }}
    >
      <header className="campaign-window__titlebar sales-analysis-window__titlebar sap-report-titlebar" {...reportWindow.titleBarProps}>
        <span className="sap-report-title">Campaigns List Report</span>
        <ReportWindowControls
          windowFrame={reportWindow}
          onMinimize={minimizeReportWindow}
          onClose={() => setReportResult(null)}
          className="campaign-window__controls sales-analysis-window__controls"
        />
      </header>
      <div className="campaign-window__accent sales-analysis-window__accent" />
      {!reportWindow.isMinimized ? (
        <div className="campaign-window__body campaign-window__body--report sales-analysis-window__body--report">
          <div className="campaign-report__grid-wrap">
            <table className="campaign-report__grid">
              <thead>
                <tr>
                  <th className="is-index">#</th>
                  {visibleColumns.map(([, label]) => <th key={label}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, index) => (
                  <tr
                    key={`${row.campaignNo || "campaign"}-${index}`}
                    className={selectedRowIndex === index ? "is-selected" : ""}
                    onClick={() => setSelectedRowIndex(index)}
                  >
                    <td className="is-index">{index + 1}</td>
                    {visibleColumns.map(([key]) => (
                      <td key={key} className={["salesAmount", "grossProfit", "totalSalesAmount", "totalGrossProfit"].includes(key) ? "is-numeric" : ""}>
                        {renderCellValue(row, key)}
                      </td>
                    ))}
                  </tr>
                ))}
                {emptyRows.map((index) => (
                  <tr key={`empty-${index}`} aria-hidden="true">
                    <td className="is-index">&nbsp;</td>
                    {visibleColumns.map(([key]) => <td key={key}>&nbsp;</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>&nbsp;</td>
                  {visibleColumns.map(([key]) => (
                    <td key={key} className={["salesAmount", "grossProfit", "totalSalesAmount", "totalGrossProfit"].includes(key) ? "is-numeric" : ""}>
                      {key === "businessPartnersResponded" ? Number(reportResult?.totals?.businessPartnersResponded || 0) : ""}
                      {key === "leadsGenerated" ? Number(reportResult?.totals?.leadsGenerated || 0) : ""}
                      {key === "opportunities" ? Number(reportResult?.totals?.opportunities || 0) : ""}
                      {key === "opportunitiesWon" ? Number(reportResult?.totals?.opportunitiesWon || 0) : ""}
                      {key === "salesAmount" ? formatAmount(reportResult?.totals?.salesAmount || 0) : ""}
                      {key === "grossProfit" ? formatAmount(reportResult?.totals?.grossProfit || 0) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <footer className="campaign-report__footer">
            <div className="campaign-report__footer-left">
              <ReportBackButton onClick={() => setReportResult(null)} className="campaign-report__back-btn" />
            </div>
            <span>{company?.companyName || company?.dbName || "SAP Business One"}</span>
            <div className="campaign-report__footer-actions">
              <button type="button" className="campaign-btn" onClick={() => setExpanded(true)}>Expand</button>
              <button type="button" className="campaign-btn" onClick={() => setExpanded(false)}>Collapse</button>
            </div>
          </footer>
        </div>
      ) : null}
    </section>
  );

  return (
    <div className="campaign-page sap-report-page">
      <section
        className={`campaign-window campaign-window--criteria sales-analysis-window sap-report-window${criteriaWindow.isMinimized ? " is-minimized" : ""}${criteriaWindow.isMaximized ? " is-maximized" : ""}`}
        {...criteriaWindow.windowProps}
        style={{ ...(criteriaWindow.windowProps?.style || {}) }}
      >
        <header className="campaign-window__titlebar sales-analysis-window__titlebar sap-report-titlebar" {...criteriaWindow.titleBarProps}>
          <span className="sap-report-title">Campaigns List - Selection Criteria</span>
          <ReportWindowControls
            windowFrame={criteriaWindow}
            onMinimize={minimizeCriteriaWindow}
            onClose={closeCriteriaWindow}
            className="campaign-window__controls sales-analysis-window__controls"
          />
        </header>
        <div className="campaign-window__accent sales-analysis-window__accent" />

        {!criteriaWindow.isMinimized ? (
          <div className="campaign-window__body">
            <fieldset className="campaign-criteria__box">
              <legend>Items</legend>
              <div className="campaign-criteria__range-row">
                <label>Code</label>
                {renderRangeLookup("itemCodeFrom", "itemCodeTo", "item")}
              </div>
              <div className="campaign-criteria__select-row">
                <label>Item Group</label>
                <select value={formState.itemGroup} onChange={(event) => setField("itemGroup", event.target.value)}>
                  {lookups.itemGroups.map(renderOption)}
                </select>
              </div>
              <div className="campaign-criteria__property-row">
                <button type="button" className="campaign-btn campaign-btn--property" onClick={() => setPropertiesTarget("itemPropertyFilter")}>
                  Properties
                </button>
                <input type="text" value={propertyLabel(formState.itemPropertyFilter)} readOnly />
              </div>
            </fieldset>

            <fieldset className="campaign-criteria__box">
              <legend>Business Partner</legend>
              <div className="campaign-criteria__bp-type-row">
                <label>Target Group Type</label>
                <label><input type="radio" checked={formState.targetGroupType === "customer"} onChange={() => setField("targetGroupType", "customer")} /> Customer</label>
                <label><input type="radio" checked={formState.targetGroupType === "vendor"} onChange={() => setField("targetGroupType", "vendor")} /> Vendor</label>
              </div>
              <div className="campaign-criteria__range-row">
                <label>Code</label>
                {renderRangeLookup("bpCodeFrom", "bpCodeTo", "bp")}
              </div>
              <div className="campaign-criteria__select-row">
                <label>Business Partner Group</label>
                <select value={formState.bpGroup} onChange={(event) => setField("bpGroup", event.target.value)}>
                  {bpGroups.map(renderOption)}
                </select>
              </div>
              <div className="campaign-criteria__property-row">
                <button type="button" className="campaign-btn campaign-btn--property" onClick={() => setPropertiesTarget("bpPropertyFilter")}>
                  Properties
                </button>
                <input type="text" value={propertyLabel(formState.bpPropertyFilter)} readOnly />
              </div>
            </fieldset>

            <div className="campaign-criteria__lower-grid">
              <label>Campaign No.</label>
              <span>From</span>
              <input type="text" value={formState.campaignNoFrom} onChange={(event) => setField("campaignNoFrom", event.target.value)} />
              <span>To</span>
              <input type="text" value={formState.campaignNoTo} onChange={(event) => setField("campaignNoTo", event.target.value)} />

              <label>Campaign Type</label>
              <select value={formState.campaignType} onChange={(event) => setField("campaignType", event.target.value)}>
                {lookups.campaignTypes.map(renderOption)}
              </select>
              <label className="campaign-criteria__right-label">Owner</label>
              <select value={formState.owner} onChange={(event) => setField("owner", event.target.value)}>
                {lookups.owners.map(renderOption)}
              </select>

              <label>Status</label>
              <select value={formState.status} onChange={(event) => setField("status", event.target.value)}>
                {lookups.statuses.map(renderOption)}
              </select>
              <label className="campaign-criteria__right-label">Target Group</label>
              <select value={formState.targetGroup} onChange={(event) => setField("targetGroup", event.target.value)}>
                {lookups.targetGroups.map(renderOption)}
              </select>
            </div>

            <div className="campaign-criteria__lookup-toggles">
              <label>
                <input
                  type="checkbox"
                  checked={formState.responseTypeEnabled}
                  onChange={(event) => {
                    setField("responseTypeEnabled", event.target.checked);
                    if (!event.target.checked) setShowResponseLookup(false);
                  }}
                />
                Response Type
              </label>
              <button type="button" disabled={!formState.responseTypeEnabled} onClick={() => setShowResponseLookup(true)}>...</button>

              <label>
                <input
                  type="checkbox"
                  checked={formState.documentsEnabled}
                  onChange={(event) => {
                    setField("documentsEnabled", event.target.checked);
                    if (!event.target.checked) setShowDocumentLookup(false);
                  }}
                />
                Documents
              </label>
              <button type="button" disabled={!formState.documentsEnabled} onClick={() => setShowDocumentLookup(true)}>...</button>
            </div>

            <div className="campaign-criteria__date-grid">
              <label>Start Date</label>
              <span>From</span>
              <input type="text" value={formState.startDateFrom} onChange={(event) => setField("startDateFrom", event.target.value)} />
              <span>To</span>
              <input type="text" value={formState.startDateTo} onChange={(event) => setField("startDateTo", event.target.value)} />
              <label>End Date</label>
              <span>From</span>
              <input type="text" value={formState.endDateFrom} onChange={(event) => setField("endDateFrom", event.target.value)} />
              <span>To</span>
              <input type="text" value={formState.endDateTo} onChange={(event) => setField("endDateTo", event.target.value)} />
            </div>

            {isLoadingReport ? <div className="campaign-status">Loading Campaigns List report...</div> : null}
            {statusMessage ? <div className="campaign-status">{statusMessage}</div> : null}

            <footer className="campaign-window__footer">
              <button type="button" className="campaign-btn campaign-btn--primary" onClick={handleOk} disabled={isLoadingReport}>OK</button>
              <button type="button" className="campaign-btn" onClick={closeCriteriaWindow}>Cancel</button>
            </footer>
          </div>
        ) : null}
      </section>

      {reportResult ? renderReportWindow() : null}

      <ItemLookupModal
        isOpen={Boolean(itemLookupTarget)}
        onClose={() => setItemLookupTarget("")}
        onSelect={(item) => {
          if (itemLookupTarget) setField(itemLookupTarget, item.ItemCode || "");
          setItemLookupTarget("");
        }}
      />

      <BusinessPartnerLookupModal
        isOpen={Boolean(bpLookupTarget)}
        type={formState.targetGroupType === "vendor" ? "cSupplier" : "cCustomer"}
        onClose={() => setBpLookupTarget("")}
        onSelect={(bp) => {
          if (bpLookupTarget) setField(bpLookupTarget, bp.CardCode || "");
          setBpLookupTarget("");
        }}
      />

      <PropertiesSelectionModal
        isOpen={Boolean(propertiesTarget)}
        title="Properties"
        propertyLabelPrefix={propertiesTarget === "bpPropertyFilter" ? "Business Partners Property" : "Items Property"}
        properties={propertiesTarget === "bpPropertyFilter" ? lookups.bpProperties : lookups.itemProperties}
        value={propertiesTarget === "bpPropertyFilter" ? formState.bpPropertyFilter : formState.itemPropertyFilter}
        onClose={() => setPropertiesTarget("")}
        onSave={(nextFilter) => {
          if (propertiesTarget) setPropertyFilter(propertiesTarget, nextFilter);
        }}
      />

      <SelectionDialog
        isOpen={showResponseLookup && formState.responseTypeEnabled}
        title="Response Type"
        rows={lookups.responseTypes}
        selectedValues={formState.responseTypes}
        onClose={() => setShowResponseLookup(false)}
        onSave={(values) => setField("responseTypes", values)}
      />

      <SelectionDialog
        isOpen={showDocumentLookup && formState.documentsEnabled}
        title="Document Types"
        rows={lookups.documentTypes}
        valueKey="key"
        labelKey="label"
        selectedValues={selectedDocuments}
        onClose={() => setShowDocumentLookup(false)}
        onSave={updateDocumentSelection}
      />
    </div>
  );
}

export default CampaignsListReportPage;
