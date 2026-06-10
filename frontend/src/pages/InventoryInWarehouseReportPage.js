import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchItemGroups, fetchItemProperties } from "../api/itemApi";
import { fetchInventoryInWarehouseLookups, fetchInventoryInWarehouseReport } from "../api/inventoryInWarehouseApi";
import BusinessPartnerLookupModal from "../components/reports/BusinessPartnerLookupModal";
import ItemLookupModal from "../components/reports/ItemLookupModal";
import PropertiesSelectionModal from "../components/reports/PropertiesSelectionModal";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import "../styles/inventory-in-warehouse-report.css";
import "../styles/sales-analysis-report.css";

const DEFAULT_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({
  number: index + 1,
  name: `Items Property ${index + 1}`,
}));

const DEFAULT_PRICE_SOURCES = [
  { value: "lastPurchase", label: "Last Purchase Price" },
  { value: "lastEvaluated", label: "Last Evaluated Price" },
];

const initialCriteria = {
  itemFrom: "",
  itemTo: "",
  vendorFrom: "",
  vendorTo: "",
  groupCode: "*",
  hideNoStock: false,
  selectionMode: "warehouse",
  selectedLocationCodes: [],
  includeWarehouses: true,
  includeWarehouseFrom: "",
  includeWarehouseTo: "",
  excludeWarehouses: false,
  excludeWarehouseFrom: "",
  excludeWarehouseTo: "",
  displayMode: "normal",
  priceSource: "lastPurchase",
  propertyFilter: {
    ignoreProperties: true,
    linkMode: "and",
    exactlyMatch: false,
    selectedPropertyNumbers: [],
  },
};

const quantityTabs = [
  { key: "inStock", label: "In Stock" },
  { key: "committed", label: "Committed" },
  { key: "ordered", label: "Ordered" },
];

const formatSapShortDate = (date = new Date()) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const initialOpeningBalances = {
  calculationMethod: "",
  itemNo: "",
  itemDescription: "",
  dateTo: formatSapShortDate(),
  warehouse: "All",
  sortBySystemDate: false,
  displayRevaluationAfterBaseDoc: true,
  includeAllRevaluations: false,
};

const openingBalanceColumns = [
  "#",
  "Date From",
  "Date To",
  "Total In Amount",
  "Total In Quantity",
  "Total Out Quantity",
  "Unit Cost",
  "Previous CB Inc...",
  "Update Date",
];

const formatQuantity = (value) =>
  Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function InventoryInWarehouseReportPage() {
  const navigate = useNavigate();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(initialCriteria);
  const [lookups, setLookups] = useState({ warehouses: [], locations: [], priceSources: DEFAULT_PRICE_SOURCES });
  const [groups, setGroups] = useState([{ code: "*", name: "All" }]);
  const [properties, setProperties] = useState(DEFAULT_PROPERTIES);
  const [lookupTarget, setLookupTarget] = useState("");
  const [showProperties, setShowProperties] = useState(false);
  const [showOpeningBalances, setShowOpeningBalances] = useState(false);
  const [openingBalances, setOpeningBalances] = useState(initialOpeningBalances);
  const [report, setReport] = useState(null);
  const [activeQuantity, setActiveQuantity] = useState("inStock");
  const [findText, setFindText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 18,
    taskId: "inventory-in-warehouse-criteria",
    taskTitle: "Inventory in Warehouse Report - Selection Criteria",
    taskPath: "/reports/inventory/in-warehouse",
    bounds: "parent",
  });
  const reportWindow = useFloatingWindow({
    isOpen: Boolean(report),
    defaultTop: 10,
    taskId: "inventory-in-warehouse-report",
    taskTitle: "Inventory in Warehouse Report",
    taskPath: "/reports/inventory/in-warehouse",
    bounds: "parent",
  });
  const openingBalancesWindow = useFloatingWindow({
    isOpen: showOpeningBalances,
    defaultTop: 420,
    taskId: "inventory-valuation-opening-balances",
    taskTitle: "Inventory Valuation Report - Opening Balances",
    taskPath: "/reports/inventory/in-warehouse",
    bounds: "parent",
  });

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      fetchInventoryInWarehouseLookups(),
      fetchItemGroups(""),
      fetchItemProperties(),
    ]).then(([reportLookupResult, itemGroupResult, itemPropertyResult]) => {
      if (!mounted) return;

      if (reportLookupResult.status === "fulfilled") {
        const reportLookups = reportLookupResult.value || {};
        setLookups({
          warehouses: Array.isArray(reportLookups.warehouses) ? reportLookups.warehouses : [],
          locations: Array.isArray(reportLookups.locations) ? reportLookups.locations : [],
          priceSources: Array.isArray(reportLookups.priceSources) && reportLookups.priceSources.length
            ? reportLookups.priceSources
            : DEFAULT_PRICE_SOURCES,
        });
      } else {
        const error = reportLookupResult.reason;
        setMessage(error?.response?.status === 404
          ? "Report API was not found. Restart the backend service and refresh this page."
          : error?.response?.data?.message || error?.message || "Could not load warehouse report lookups.");
      }

      if (itemGroupResult.status === "fulfilled") {
        const itemGroups = itemGroupResult.value;
        setGroups(Array.isArray(itemGroups) && itemGroups.length ? itemGroups : [{ code: "*", name: "All" }]);
      }

      if (itemPropertyResult.status === "fulfilled") {
        const itemProperties = itemPropertyResult.value;
        setProperties(Array.isArray(itemProperties) && itemProperties.length ? itemProperties : DEFAULT_PROPERTIES);
      }
    });
    return () => { mounted = false; };
  }, []);

  const setField = (field, value) => setCriteria((current) => ({ ...current, [field]: value }));

  const propertyLabel = criteria.propertyFilter.ignoreProperties
    ? "Ignore"
    : `${criteria.propertyFilter.selectedPropertyNumbers.length} Selected`;

  const filteredRows = useMemo(() => {
    const rows = report?.rows || [];
    const search = findText.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) => `${row.itemCode} ${row.itemName} ${row.uom}`.toLowerCase().includes(search));
  }, [findText, report?.rows]);

  const selectedLocationSet = useMemo(() => new Set(criteria.selectedLocationCodes), [criteria.selectedLocationCodes]);

  const toggleLocation = (code) => {
    setCriteria((current) => ({
      ...current,
      selectedLocationCodes: current.selectedLocationCodes.includes(code)
        ? current.selectedLocationCodes.filter((value) => value !== code)
        : [...current.selectedLocationCodes, code],
    }));
  };

  const handleRun = async () => {
    setLoading(true);
    setMessage("");
    try {
      setReport(await fetchInventoryInWarehouseReport(criteria));
      setFindText("");
      setActiveQuantity("inStock");
    } catch (error) {
      setReport(null);
      setMessage(error?.response?.data?.message || error.message || "Could not load Inventory in Warehouse report.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCriteria = () => {
    if (!closeActiveAndRestorePrevious()) navigate("/dashboard");
  };

  const handleSelectLookup = (row) => {
    if (lookupTarget === "openingBalanceItem") {
      setOpeningBalances((current) => ({
        ...current,
        itemNo: row.ItemCode || "",
        itemDescription: row.ItemName || "",
      }));
      setLookupTarget("");
      return;
    }
    if (lookupTarget.startsWith("item")) setField(lookupTarget, row.ItemCode || "");
    if (lookupTarget.startsWith("vendor")) setField(lookupTarget, row.CardCode || "");
    setLookupTarget("");
  };

  const setOpeningBalanceField = (field, value) =>
    setOpeningBalances((current) => ({ ...current, [field]: value }));

  const renderControls = (windowFrame, onClose) => (
    <div className="iwh-window__controls sales-analysis-window__controls">
      <button type="button" aria-label={windowFrame.isMinimized ? "Restore" : "Minimize"} onClick={windowFrame.toggleMinimize}>
        {windowFrame.isMinimized ? "[]" : "-"}
      </button>
      <button type="button" aria-label={windowFrame.isMaximized ? "Restore Down" : "Maximize"} title={windowFrame.isMaximized ? "Restore" : "Maximize"} onClick={windowFrame.toggleMaximize}>[]</button>
      <button type="button" aria-label="Close" onClick={onClose}>x</button>
    </div>
  );

  const renderRangeRow = (label, fromField, toField, lookupType) => (
    <div className="iwh-range-row">
      <label>{label}</label>
      <span>From</span>
      <div className="iwh-lookup">
        <input value={criteria[fromField]} onChange={(event) => setField(fromField, event.target.value)} />
        {lookupType ? <button type="button" onClick={() => setLookupTarget(fromField)}>...</button> : null}
      </div>
      <span>To</span>
      <div className="iwh-lookup">
        <input value={criteria[toField]} onChange={(event) => setField(toField, event.target.value)} />
        {lookupType ? <button type="button" onClick={() => setLookupTarget(toField)}>...</button> : null}
      </div>
    </div>
  );

  const renderWarehouseSelector = () => (
    <div className="iwh-selector">
      <div className="iwh-selector__tabs">
        <button type="button" className={criteria.selectionMode === "location" ? "is-active" : ""} onClick={() => setField("selectionMode", "location")}>By Location</button>
        <button type="button" className={criteria.selectionMode === "warehouse" ? "is-active" : ""} onClick={() => setField("selectionMode", "warehouse")}>By Warehouse</button>
      </div>
      {criteria.selectionMode === "location" ? (
        <div className="iwh-location-grid">
          <div className="iwh-location-grid__header"><span>Use</span><span>Location</span><span>Whse Code</span><span>Whse Name</span></div>
          {lookups.locations.map((location) => {
            const locationWarehouses = lookups.warehouses.filter((warehouse) => warehouse.locationCode === location.code);
            return (
              <React.Fragment key={location.code}>
                <label className="iwh-location-grid__row is-location">
                  <input type="checkbox" checked={selectedLocationSet.has(location.code)} onChange={() => toggleLocation(location.code)} />
                  <strong>{location.name || location.code}</strong><span /><span />
                </label>
                {locationWarehouses.map((warehouse) => (
                  <div className="iwh-location-grid__row" key={warehouse.code}>
                    <span /><span /><span>{warehouse.code}</span><span>{warehouse.name}</span>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="iwh-warehouse-ranges">
          <label><input type="checkbox" checked={criteria.includeWarehouses} onChange={(event) => setField("includeWarehouses", event.target.checked)} />Including</label>
          <span>From</span><input value={criteria.includeWarehouseFrom} onChange={(event) => setField("includeWarehouseFrom", event.target.value)} />
          <span>To</span><input value={criteria.includeWarehouseTo} onChange={(event) => setField("includeWarehouseTo", event.target.value)} />
          <label><input type="checkbox" checked={criteria.excludeWarehouses} onChange={(event) => setField("excludeWarehouses", event.target.checked)} />Excluding</label>
          <span>From</span><input value={criteria.excludeWarehouseFrom} disabled={!criteria.excludeWarehouses} onChange={(event) => setField("excludeWarehouseFrom", event.target.value)} />
          <span>To</span><input value={criteria.excludeWarehouseTo} disabled={!criteria.excludeWarehouses} onChange={(event) => setField("excludeWarehouseTo", event.target.value)} />
        </div>
      )}
    </div>
  );

  const renderOpeningBalancesModal = () => (
    <section className={`iwh-window iwh-window--opening-balances sales-analysis-window sap-report-window${openingBalancesWindow.isMinimized ? " is-minimized" : ""}${openingBalancesWindow.isMaximized ? " is-maximized" : ""}`} {...openingBalancesWindow.windowProps}>
      <header className="iwh-window__titlebar sales-analysis-window__titlebar sap-report-titlebar" {...openingBalancesWindow.titleBarProps}>
        <span className="sales-analysis-window__title sap-report-title">Inventory Valuation Report - Opening Balances</span>
        {renderControls(openingBalancesWindow, () => setShowOpeningBalances(false))}
      </header>
      <div className="iwh-window__accent sales-analysis-window__accent" />
      {!openingBalancesWindow.isMinimized ? (
        <div className="iwh-opening-body">
          <div className="iwh-opening-fields">
            <div className="iwh-opening-left">
              <label><span>Calculation Method</span><input value={openingBalances.calculationMethod} readOnly /></label>
              <label><span>Item No.</span><div className="iwh-lookup"><input value={openingBalances.itemNo} onChange={(event) => setOpeningBalanceField("itemNo", event.target.value)} /><button type="button" onClick={() => setLookupTarget("openingBalanceItem")}>...</button></div></label>
              <label><span>Item Description</span><input value={openingBalances.itemDescription} readOnly /></label>
            </div>
            <div className="iwh-opening-middle">
              <label><span>Date To</span><input value={openingBalances.dateTo} onChange={(event) => setOpeningBalanceField("dateTo", event.target.value)} /></label>
              <label><span>Warehouse</span><select value={openingBalances.warehouse} onChange={(event) => setOpeningBalanceField("warehouse", event.target.value)}><option value="All">All</option>{lookups.warehouses.map((warehouse) => <option key={warehouse.code} value={warehouse.code}>{warehouse.code}</option>)}</select></label>
            </div>
            <div className="iwh-opening-options">
              <label><input type="checkbox" checked={openingBalances.sortBySystemDate} onChange={(event) => setOpeningBalanceField("sortBySystemDate", event.target.checked)} />Sort by System Date</label>
              <label><input type="checkbox" checked={openingBalances.displayRevaluationAfterBaseDoc} onChange={(event) => setOpeningBalanceField("displayRevaluationAfterBaseDoc", event.target.checked)} />Display Inv. Reval. After Base Doc. if Post. Date Is Earlier</label>
              <label><input type="checkbox" checked={openingBalances.includeAllRevaluations} onChange={(event) => setOpeningBalanceField("includeAllRevaluations", event.target.checked)} />Include all revaluations</label>
            </div>
          </div>
          <div className="iwh-opening-grid-wrap">
            <table className="iwh-opening-grid">
              <thead><tr>{openingBalanceColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{Array.from({ length: 11 }, (_, index) => <tr key={index}>{openingBalanceColumns.map((column) => <td key={column}>{column === "#" && index === 0 ? "" : "\u00a0"}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <footer className="iwh-opening-footer">
            <button type="button" className="iwh-btn sales-analysis__sap-btn" onClick={() => setShowOpeningBalances(false)}>OK</button>
            <button type="button" className="iwh-btn iwh-btn--muted sales-analysis__sap-btn sales-analysis__sap-btn--secondary" disabled>Remove</button>
          </footer>
        </div>
      ) : null}
    </section>
  );

  return (
    <div className="iwh-page sales-analysis-page sap-report-page">
      <section className={`iwh-window sales-analysis-window sap-report-window${criteriaWindow.isMinimized ? " is-minimized" : ""}${criteriaWindow.isMaximized ? " is-maximized" : ""}`} {...criteriaWindow.windowProps}>
        <header className="iwh-window__titlebar sales-analysis-window__titlebar sap-report-titlebar" {...criteriaWindow.titleBarProps}>
          <span className="sales-analysis-window__title sap-report-title">Inventory in Warehouse Report - Selection Criteria</span>
          {renderControls(criteriaWindow, handleCloseCriteria)}
        </header>
        <div className="iwh-window__accent sales-analysis-window__accent" />
        {!criteriaWindow.isMinimized ? (
          <div className="iwh-window__body sales-analysis-window__body">
            <div className="iwh-criteria-layout sales-analysis-panel">
              <div className="iwh-criteria-left">
                {renderRangeRow("Code", "itemFrom", "itemTo", "item")}
                {renderRangeRow("Vendor", "vendorFrom", "vendorTo", "vendor")}
                <div className="iwh-group-row">
                  <label>Item Group</label>
                  <select value={criteria.groupCode} onChange={(event) => setField("groupCode", event.target.value)}>
                    <option value="*">All</option>
                    {groups.filter((group) => group.code !== "*").map((group) => <option key={group.code} value={group.code}>{group.name || group.code}</option>)}
                  </select>
                </div>
                <div className="iwh-property-row">
                  <button type="button" className="iwh-btn sales-analysis__sap-btn sales-analysis__sap-btn--field" onClick={() => setShowProperties(true)}>Properties</button>
                  <input value={propertyLabel} readOnly />
                </div>
                <label className="iwh-checkbox"><input type="checkbox" checked={criteria.hideNoStock} onChange={(event) => setField("hideNoStock", event.target.checked)} />Hide Items with No Quantity in Stock</label>
                {renderWarehouseSelector()}
              </div>
              <div className="iwh-criteria-right">
                <div className="iwh-display">
                  <span>Display</span>
                  <label><input type="radio" name="displayMode" checked={criteria.displayMode === "normal"} onChange={() => setField("displayMode", "normal")} />Normal</label>
                  <label><input type="radio" name="displayMode" checked={criteria.displayMode === "detailed"} onChange={() => setField("displayMode", "detailed")} />Detailed Report</label>
                </div>
                {criteria.displayMode === "detailed" ? (
                  <label className="iwh-price-source"><span>Price Source</span><select value={criteria.priceSource} onChange={(event) => setField("priceSource", event.target.value)}>{lookups.priceSources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}</select></label>
                ) : null}
              </div>
            </div>
            <button type="button" className="iwh-opening-trigger" aria-label="Open inventory valuation opening balances" title="Inventory Valuation Report - Opening Balances" onClick={() => setShowOpeningBalances(true)}>...</button>
            {message ? <div className="iwh-status">{message}</div> : null}
            <footer className="iwh-footer sales-analysis-window__footer"><button type="button" className="iwh-btn sales-analysis__sap-btn" disabled={loading} onClick={handleRun}>{loading ? "Loading..." : "OK"}</button><button type="button" className="iwh-btn sales-analysis__sap-btn sales-analysis__sap-btn--secondary" onClick={handleCloseCriteria}>Cancel</button></footer>
          </div>
        ) : null}
      </section>

      {showOpeningBalances ? renderOpeningBalancesModal() : null}

      {report ? (
        <section className={`iwh-window iwh-window--report sales-analysis-window sales-analysis-window--report sap-report-window${reportWindow.isMinimized ? " is-minimized" : ""}${reportWindow.isMaximized ? " is-maximized" : ""}`} {...reportWindow.windowProps}>
          <header className="iwh-window__titlebar sales-analysis-window__titlebar sap-report-titlebar" {...reportWindow.titleBarProps}><span className="sales-analysis-window__title sap-report-title">Inventory in Warehouse Report</span>{renderControls(reportWindow, () => setReport(null))}</header>
          <div className="iwh-window__accent sales-analysis-window__accent" />
          {!reportWindow.isMinimized ? <div className="iwh-report-body sales-analysis-window__body sales-analysis-window__body--report">
            <label className="iwh-find">Find <input value={findText} onChange={(event) => setFindText(event.target.value)} /></label>
            <div className="iwh-report-tabs sales-analysis-tabs">{quantityTabs.map((tab) => <button type="button" key={tab.key} className={`sales-analysis-tabs__tab${activeQuantity === tab.key ? " is-active" : ""}`} onClick={() => setActiveQuantity(tab.key)}>{tab.label}</button>)}</div>
            <div className="iwh-report-grid-wrap sales-analysis-report__grid-wrap"><table className="iwh-report-grid sales-analysis-report__grid"><thead><tr><th>#</th><th>Item Number</th><th>Item Description</th><th>UoM</th><th>Whse Total</th>{report.displayMode === "detailed" ? <th>Price</th> : null}{report.warehouses.map((warehouse) => <th key={warehouse.code} title={warehouse.name}>{warehouse.code}</th>)}</tr></thead>
              <tbody>{filteredRows.length ? filteredRows.map((row, index) => <tr key={row.itemCode}><td className="is-row-number">{index + 1}</td><td><button type="button" className="iwh-item-link sales-analysis-report__link-cell" onClick={() => navigate(`/item-master?itemCode=${encodeURIComponent(row.itemCode)}`)}><span className="sales-analysis-report__link-icon" aria-hidden="true">{"->"}</span><span>{row.itemCode}</span></button></td><td>{row.itemName}</td><td>{row.uom}</td><td className="is-number is-numeric">{formatQuantity(row.totals[activeQuantity])}</td>{report.displayMode === "detailed" ? <td className="is-number is-numeric">{formatQuantity(row.price)}</td> : null}{report.warehouses.map((warehouse) => <td className="is-number is-numeric" key={warehouse.code}>{formatQuantity(row[activeQuantity]?.[warehouse.code])}</td>)}</tr>) : <tr><td className="sales-analysis-report__empty" colSpan={6 + report.warehouses.length}>No items found.</td></tr>}</tbody>
            </table></div>
            <div className="sales-analysis-report__footer"><button type="button" className="iwh-back sales-analysis-report__back-btn" aria-label="Back to selection criteria" onClick={() => setReport(null)}>{"<"}</button></div>
          </div> : null}
        </section>
      ) : null}

      <ItemLookupModal isOpen={lookupTarget.startsWith("item") || lookupTarget === "openingBalanceItem"} onClose={() => setLookupTarget("")} onSelect={handleSelectLookup} />
      <BusinessPartnerLookupModal isOpen={lookupTarget.startsWith("vendor")} type="cSupplier" onClose={() => setLookupTarget("")} onSelect={handleSelectLookup} />
      <PropertiesSelectionModal isOpen={showProperties} title="Properties" propertyLabelPrefix="Items Property" properties={properties} value={criteria.propertyFilter} onClose={() => setShowProperties(false)} onSave={(value) => setField("propertyFilter", value)} />
    </div>
  );
}

export default InventoryInWarehouseReportPage;
