import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ItemLookupModal from "../components/reports/ItemLookupModal";
import PropertiesSelectionModal from "../components/reports/PropertiesSelectionModal";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import { fetchItemGroups, fetchItemProperties } from "../api/itemApi";
import { fetchBillOfMaterialsReport } from "../api/billOfMaterialsReportApi";
import "../styles/sales-analysis-report.css";
import "../styles/bill-of-materials-report.css";

const DEFAULT_ITEM_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({
  number: index + 1,
  name: `Items Property ${index + 1}`,
}));

const BOM_TYPE_OPTIONS = [
  { value: "All", label: "All" },
  { value: "iAssemblyTree", label: "Assembly" },
  { value: "iProductionTree", label: "Production" },
  { value: "iSalesTree", label: "Sales" },
  { value: "iTemplateTree", label: "Template" },
];

const createInitialState = () => ({
  itemFrom: "",
  itemTo: "",
  groupCode: "All",
  propertyFilter: {
    ignoreProperties: true,
    linkMode: "and",
    exactlyMatch: false,
    selectedPropertyNumbers: [],
  },
  bomType: "All",
});

const formatQuantity = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });

const formatPrice = (value, currency) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) < 0.005) return "";
  const formatted = amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
};

function BillOfMaterialsReportPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [formState, setFormState] = useState(createInitialState);
  const [itemGroups, setItemGroups] = useState([{ code: "All", name: "All" }, { code: "*", name: "*" }]);
  const [itemProperties, setItemProperties] = useState(DEFAULT_ITEM_PROPERTIES);
  const [reportResult, setReportResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [lookupTarget, setLookupTarget] = useState("");
  const [showProperties, setShowProperties] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [findText, setFindText] = useState("");

  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 24,
    taskId: "bom-report-criteria",
    taskTitle: "Bill of Materials Report - Selection Criteria",
    taskPath: "/reports/production/bill-of-materials",
    bounds: "parent",
  });

  const reportWindow = useFloatingWindow({
    isOpen: Boolean(reportResult),
    defaultTop: 8,
    taskId: "bom-report-result",
    taskTitle: "Bill of Materials Report",
    taskPath: "/reports/production/bill-of-materials",
    bounds: "parent",
  });

  useEffect(() => {
    let isMounted = true;
    Promise.all([fetchItemGroups(""), fetchItemProperties()])
      .then(([groups, properties]) => {
        if (!isMounted) return;
        const normalizedGroups = [
          { code: "All", name: "All" },
          { code: "*", name: "*" },
          ...(Array.isArray(groups) ? groups : []),
        ];
        const seen = new Set();
        setItemGroups(
          normalizedGroups.filter((group) => {
            const key = String(group.code ?? group.name ?? "");
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        );
        setItemProperties(Array.isArray(properties) && properties.length ? properties : DEFAULT_ITEM_PROPERTIES);
      })
      .catch((error) => {
        if (!isMounted) return;
        setStatusMessage(error?.response?.data?.message || error?.message || "Could not load BOM report lookups.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const rows = reportResult?.rows || [];
    const query = findText.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      [
        row.itemCode,
        row.itemDescription,
        row.uom,
        row.whse,
        row.warehouseName,
        row.bomType,
        row.routeSequence,
        row.routeStage,
        row.stageDescription,
      ].some((value) => String(value || "").toLowerCase().includes(query)),
    );
  }, [findText, reportResult?.rows]);

  const propertyModeLabel = formState.propertyFilter.ignoreProperties
    ? "Ignore"
    : `${formState.propertyFilter.selectedPropertyNumbers.length} Selected`;

  const setField = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleOk = async () => {
    setIsLoadingReport(true);
    setStatusMessage("");
    try {
      const response = await fetchBillOfMaterialsReport(formState);
      setReportResult(response);
      setFindText("");
      setSelectedRowIndex(0);
    } catch (error) {
      setReportResult(null);
      setStatusMessage(error?.response?.data?.message || error?.message || "Could not load Bill of Materials report.");
    } finally {
      setIsLoadingReport(false);
    }
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

  const handleItemSelect = (item) => {
    if (!lookupTarget) return;
    setField(lookupTarget, item.ItemCode || "");
    setLookupTarget("");
  };

  const handleSelectAll = () => {
    setFormState(createInitialState());
  };

  const openLinkedBOM = (row) => {
    const itemCode = String(row?.itemCode || "").trim();
    if (!itemCode) return;
    navigate(`/bom?treeCode=${encodeURIComponent(itemCode)}`, {
      state: { bomTreeCode: itemCode },
    });
  };

  const openLinkedWarehouse = (row) => {
    const whsCode = String(row?.whse || "").trim();
    if (!whsCode) return;
    navigate(`/warehouse?whsCode=${encodeURIComponent(whsCode)}`, {
      state: { whsCode },
    });
  };

  const renderWindowControls = (windowFrame, onMinimize, onClose) => (
    <div className="bom-report-window__controls">
      <button
        type="button"
        aria-label={windowFrame.isMinimized ? "Restore" : "Minimize"}
        onClick={onMinimize}
      >
        {windowFrame.isMinimized ? "[]" : "-"}
      </button>
      <button
        type="button"
        aria-label={windowFrame.isMaximized ? "Restore" : "Maximize"}
        title={windowFrame.isMaximized ? "Restore" : "Maximize"}
        onClick={windowFrame.toggleMaximize}
      >
        []
      </button>
      <button type="button" aria-label="Close" onClick={onClose}>x</button>
    </div>
  );

  const renderReportWindow = () => (
    <div
      className={`bom-report-window bom-report-window--result sap-report-window${reportWindow.isMinimized ? " is-minimized" : ""}${reportWindow.isMaximized ? " is-maximized" : ""}`}
      {...reportWindow.windowProps}
      style={{
        ...(reportWindow.windowProps?.style || {}),
      }}
    >
      <div className="bom-report-window__titlebar sap-report-titlebar" {...reportWindow.titleBarProps}>
        <div className="bom-report-window__title sap-report-title">{reportResult?.reportTitle || "Bill of Materials Report"}</div>
        {renderWindowControls(reportWindow, handleMinimizeReportWindow, handleCloseReportWindow)}
      </div>
      <div className="bom-report-window__accent" />

      {!reportWindow.isMinimized ? (
        <div className="bom-report-window__body bom-report-window__body--result">
          <div className="bom-report-toolbar">
            <label htmlFor="bom-report-find">Find</label>
            <input
              id="bom-report-find"
              type="text"
              value={findText}
              onChange={(event) => setFindText(event.target.value)}
            />
            <button type="button" className="bom-report-btn">Text Search</button>
            <span className="bom-report-toolbar__count">
              {filteredRows.length} of {reportResult?.totalRows || 0}
            </span>
          </div>

          <div className="bom-report-grid-wrap">
            <table className="bom-report-grid">
              <thead>
                <tr>
                  <th className="is-row-indicator">&nbsp;</th>
                  <th className="is-item">Item</th>
                  <th className="is-description">Item Description</th>
                  <th className="is-uom">UoM</th>
                  <th className="is-quantity">Quantity</th>
                  <th className="is-whse">Whse</th>
                  <th className="is-price">Price</th>
                  <th className="is-depth">Depth</th>
                  <th className="is-bom-type">BOM Type</th>
                  <th className="is-route-sequence">Route Sequence</th>
                  <th className="is-route-stage">Route Stage</th>
                  <th className="is-stage-description">Stage Description</th>
                </tr>
              </thead>
              <tbody>
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={12} className="bom-report-grid__state-cell">No Bill of Materials rows found.</td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr
                      key={`${row.itemCode || "bom"}-${index}`}
                      className={selectedRowIndex === index ? "is-selected" : ""}
                      onClick={() => setSelectedRowIndex(index)}
                    >
                      <td className="is-row-indicator">&gt;</td>
                      <td className="is-item">
                        <button
                          type="button"
                          className="bom-report-link-arrow"
                          aria-label={`Open Bill of Materials for ${row.itemCode}`}
                          title="Open Bill of Materials"
                          onClick={(event) => {
                            event.stopPropagation();
                            openLinkedBOM(row);
                          }}
                        >
                          &gt;
                        </button>
                        <button
                          type="button"
                          className="bom-report-cell-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            openLinkedBOM(row);
                          }}
                        >
                          {row.itemCode}
                        </button>
                      </td>
                      <td className="is-description">{row.itemDescription}</td>
                      <td className="is-uom">{row.uom}</td>
                      <td className="is-quantity">{formatQuantity(row.quantity)}</td>
                      <td className="is-whse">
                        {row.whse ? (
                          <>
                            <button
                              type="button"
                              className="bom-report-link-arrow"
                              aria-label={`Open Warehouse ${row.whse}`}
                              title="Open Warehouse"
                              onClick={(event) => {
                                event.stopPropagation();
                                openLinkedWarehouse(row);
                              }}
                            >
                              &gt;
                            </button>
                            <button
                              type="button"
                              className="bom-report-cell-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                openLinkedWarehouse(row);
                              }}
                            >
                              {row.whse}
                            </button>
                          </>
                        ) : null}
                      </td>
                      <td className="is-price">{formatPrice(row.price, row.currency)}</td>
                      <td className="is-depth">{row.depth || ""}</td>
                      <td className="is-bom-type">{row.bomType}</td>
                      <td className="is-route-sequence">{row.routeSequence}</td>
                      <td className="is-route-stage">{row.routeStage}</td>
                      <td className="is-stage-description">{row.stageDescription}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bom-report-footer">
            <button
              type="button"
              className="bom-report-back-btn"
              aria-label="Back to selection criteria"
              onClick={handleCloseReportWindow}
            >
              &lt;
            </button>
            <span>{company?.companyName || company?.dbName || "SAP Business One"}</span>
            <div className="bom-report-footer__actions">
              <button type="button" className="bom-report-btn" onClick={() => {}}>Expand</button>
              <button type="button" className="bom-report-btn" onClick={() => {}}>Collapse</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="bom-report-page sap-report-page">
      <div
        className={`bom-report-window bom-report-window--criteria sap-report-window${criteriaWindow.isMinimized ? " is-minimized" : ""}${criteriaWindow.isMaximized ? " is-maximized" : ""}`}
        {...criteriaWindow.windowProps}
        style={{
          ...(criteriaWindow.windowProps?.style || {}),
        }}
      >
        <div className="bom-report-window__titlebar sap-report-titlebar" {...criteriaWindow.titleBarProps}>
          <div className="bom-report-window__title sap-report-title">Bill of Materials Report - Selection Criteria</div>
          {renderWindowControls(criteriaWindow, handleMinimizeCriteriaWindow, handleCloseCriteriaWindow)}
        </div>
        <div className="bom-report-window__accent" />

        {!criteriaWindow.isMinimized ? (
          <div className="bom-report-window__body">
            <div className="bom-report-criteria">
              <div className="bom-report-criteria__code-row">
                <label>Code</label>
                <span>From</span>
                <div className="bom-report-criteria__lookup-wrap">
                  <input
                    type="text"
                    value={formState.itemFrom}
                    onChange={(event) => setField("itemFrom", event.target.value)}
                  />
                  <button type="button" aria-label="Select item from" onClick={() => setLookupTarget("itemFrom")}>...</button>
                </div>
                <span>To</span>
                <div className="bom-report-criteria__lookup-wrap">
                  <input
                    type="text"
                    value={formState.itemTo}
                    onChange={(event) => setField("itemTo", event.target.value)}
                  />
                  <button type="button" aria-label="Select item to" onClick={() => setLookupTarget("itemTo")}>...</button>
                </div>
              </div>

              <div className="bom-report-criteria__select-row">
                <label>Group</label>
                <select value={formState.groupCode} onChange={(event) => setField("groupCode", event.target.value)}>
                  {itemGroups.map((group) => (
                    <option key={`${group.code}-${group.name}`} value={group.code}>
                      {group.code === "*" || group.name === "*" ? "*" : group.name || group.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bom-report-criteria__property-row">
                <button type="button" className="bom-report-btn bom-report-btn--wide" onClick={() => setShowProperties(true)}>
                  Properties
                </button>
                <input type="text" value={propertyModeLabel} readOnly />
              </div>

              <div className="bom-report-criteria__select-row">
                <label>BOM Type</label>
                <select value={formState.bomType} onChange={(event) => setField("bomType", event.target.value)}>
                  {BOM_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {isLoadingReport ? <div className="bom-report-status">Loading Bill of Materials report...</div> : null}
              {statusMessage ? <div className="bom-report-status">{statusMessage}</div> : null}
            </div>

            <div className="bom-report-window__footer">
              <div className="bom-report-window__footer-left">
                <button type="button" className="bom-report-btn" onClick={handleOk} disabled={isLoadingReport}>
                  OK
                </button>
                <button type="button" className="bom-report-btn" onClick={handleCloseCriteriaWindow}>Cancel</button>
              </div>
              <button type="button" className="bom-report-btn bom-report-btn--wide" onClick={handleSelectAll}>
                Select All
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {reportResult ? renderReportWindow() : null}

      <ItemLookupModal
        isOpen={Boolean(lookupTarget)}
        onClose={() => setLookupTarget("")}
        onSelect={handleItemSelect}
      />

      <PropertiesSelectionModal
        isOpen={showProperties}
        title="Properties"
        propertyLabelPrefix="Items Property"
        properties={itemProperties}
        value={formState.propertyFilter}
        onClose={() => setShowProperties(false)}
        onSave={(nextFilter) => setField("propertyFilter", nextFilter)}
      />
    </div>
  );
}

export default BillOfMaterialsReportPage;
