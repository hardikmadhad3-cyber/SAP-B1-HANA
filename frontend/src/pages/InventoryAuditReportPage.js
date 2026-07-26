import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchItemGroups, fetchItemProperties } from "../api/itemApi";
import { fetchInventoryAuditLookups, fetchInventoryAuditReport } from "../api/inventoryAuditApi";
import GLAccountLookupModal from "../components/reports/GLAccountLookupModal";
import ItemLookupModal from "../components/reports/ItemLookupModal";
import PropertiesSelectionModal from "../components/reports/PropertiesSelectionModal";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { ReportBackButton } from "../components/reports/ReportWindowControls";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import ReportPageShell from "../components/reports/ReportPageShell";
import ReportWindow from "../components/reports/ReportWindow";
import { ReportActionBar, ReportButton } from "../components/reports/ReportActionBar";
import "../styles/inventory-audit-report.css";
import "../styles/sales-analysis-report.css";
import "../styles/inventory-report-common.css";

const DEFAULT_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({
  number: index + 1,
  name: `Items Property ${index + 1}`,
}));

const formatSapShortDate = (date = new Date()) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const getFiscalYearStartDate = () => {
  const today = new Date();
  const fiscalYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return new Date(fiscalYear, 3, 1);
};

const initialCriteria = {
  dateType: "system",
  dateFrom: formatSapShortDate(getFiscalYearStartDate()),
  dateTo: formatSapShortDate(),
  itemFrom: "",
  itemTo: "",
  groupCode: "*",
  propertyFilter: {
    ignoreProperties: true,
    linkMode: "or",
    exactlyMatch: false,
    selectedPropertyNumbers: [],
  },
  glAccountsEnabled: false,
  selectedAccountCodes: [],
  selectedWarehouseCodes: [],
  displayMode: "byItems",
  groupByWarehouses: false,
  displayOpeningBalances: false,
  hideItemsWithCumulativeQuantityZero: false,
  hideSerialBatchForNonSerialBatch: false,
};

const normalizeWarehouse = (warehouse) => ({
  code: warehouse.code || warehouse.WhsCode || "",
  name: warehouse.name || warehouse.WhsName || "",
  locationCode: String(warehouse.locationCode || warehouse.LocationCode || warehouse.Location || "0"),
  locationName: warehouse.locationName || warehouse.LocationName || warehouse.Location || "General",
});

const formatQuantity = (value) =>
  Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const formatAmount = (value) =>
  Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatReportDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}/${month}/${year.slice(-2)}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatSapShortDate(date);
};

function InventoryAuditReportPage() {
  const navigate = useNavigate();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(initialCriteria);
  const [lookups, setLookups] = useState({ warehouses: [], locations: [], accounts: [], itemGroups: [{ code: "*", name: "All" }] });
  const [groups, setGroups] = useState([{ code: "*", name: "All" }]);
  const [properties, setProperties] = useState(DEFAULT_PROPERTIES);
  const [expandedLocations, setExpandedLocations] = useState({});
  const [lookupTarget, setLookupTarget] = useState("");
  const [showProperties, setShowProperties] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [report, setReport] = useState(null);
  const [findText, setFindText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 16,
    taskId: "inventory-audit-criteria",
    taskTitle: "Inventory Audit Report - Selection Criteria",
    taskPath: "/reports/inventory/audit",
    bounds: "parent",
  });
  const reportWindow = useFloatingWindow({
    isOpen: Boolean(report),
    defaultTop: 12,
    taskId: "inventory-audit-report",
    taskTitle: "Inventory Audit Report",
    taskPath: "/reports/inventory/audit",
    bounds: "parent",
  });

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      fetchInventoryAuditLookups(),
      fetchItemGroups(""),
      fetchItemProperties(),
    ]).then(([auditLookupResult, itemGroupResult, itemPropertyResult]) => {
      if (!mounted) return;

      if (auditLookupResult.status === "fulfilled") {
        const data = auditLookupResult.value || {};
        const warehouses = Array.isArray(data.warehouses) ? data.warehouses.map(normalizeWarehouse) : [];
        const locations = Array.isArray(data.locations) ? data.locations : [];
        const itemGroups = Array.isArray(data.itemGroups) && data.itemGroups.length ? data.itemGroups : [{ code: "*", name: "All" }];

        setLookups({
          warehouses,
          locations,
          accounts: Array.isArray(data.accounts) ? data.accounts : [],
          itemGroups,
        });
        setGroups(itemGroups);
        setCriteria((current) => ({
          ...current,
          selectedWarehouseCodes: current.selectedWarehouseCodes.length
            ? current.selectedWarehouseCodes
            : warehouses.map((warehouse) => warehouse.code).filter(Boolean),
        }));
        setExpandedLocations(Object.fromEntries(locations.map((location) => [String(location.code || ""), true])));
      } else {
        const error = auditLookupResult.reason;
        setMessage(error?.response?.status === 404
          ? "Report API was not found. Restart the backend service and refresh this page."
          : error?.response?.data?.message || error?.message || "Could not load Inventory Audit lookups.");
      }

      if (itemGroupResult.status === "fulfilled") {
        const itemGroups = itemGroupResult.value;
        if (Array.isArray(itemGroups) && itemGroups.length) {
          setGroups(itemGroups);
        }
      }

      if (itemPropertyResult.status === "fulfilled") {
        const itemProperties = itemPropertyResult.value;
        setProperties(Array.isArray(itemProperties) && itemProperties.length ? itemProperties : DEFAULT_PROPERTIES);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setField = (field, value) => {
    setCriteria((current) => ({ ...current, [field]: value }));
  };

  const setDisplayMode = (displayMode) => {
    setCriteria((current) => ({
      ...current,
      displayMode,
      groupByWarehouses: displayMode === "byItems" ? current.groupByWarehouses : false,
      hideItemsWithCumulativeQuantityZero: displayMode === "byItems" ? current.hideItemsWithCumulativeQuantityZero : false,
    }));
  };

  const propertyLabel = criteria.propertyFilter.ignoreProperties
    ? "Ignore"
    : `${criteria.propertyFilter.selectedPropertyNumbers.length} Selected`;

  const accountLabel = !criteria.glAccountsEnabled
    ? ""
    : criteria.selectedAccountCodes.length
      ? `${criteria.selectedAccountCodes.length} Selected`
      : "All";

  const selectedWarehouseSet = useMemo(
    () => new Set(criteria.selectedWarehouseCodes),
    [criteria.selectedWarehouseCodes],
  );

  const groupedWarehouses = useMemo(() => {
    const locationMap = new Map();
    lookups.locations.forEach((location) => {
      const code = String(location.code || location.LocationCode || "");
      if (!code) return;
      locationMap.set(code, {
        code,
        name: location.name || location.LocationName || code,
        warehouses: [],
      });
    });

    lookups.warehouses.forEach((warehouse) => {
      const locationCode = String(warehouse.locationCode || "0");
      if (!locationMap.has(locationCode)) {
        locationMap.set(locationCode, {
          code: locationCode,
          name: warehouse.locationName || (locationCode === "0" ? "General" : locationCode),
          warehouses: [],
        });
      }
      locationMap.get(locationCode).warehouses.push(warehouse);
    });

    return [...locationMap.values()]
      .filter((location) => location.warehouses.length)
      .sort((left, right) => String(left.name).localeCompare(String(right.name)));
  }, [lookups.locations, lookups.warehouses]);

  const filteredReportRows = useMemo(() => {
    const rows = report?.rows || [];
    const search = findText.trim().toLowerCase();
    if (!search || report?.criteria?.displayMode === "byAccount") return rows;
    return rows.filter((row) =>
      `${row.itemCode} ${row.itemName} ${row.whsCode} ${row.document} ${row.accountFormatCode} ${row.accountName}`.toLowerCase().includes(search),
    );
  }, [findText, report]);

  const filteredAccountRows = useMemo(() => {
    const rows = report?.accountRows || [];
    const search = findText.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) =>
      `${row.accountCode} ${row.formatCode} ${row.accountName}`.toLowerCase().includes(search),
    );
  }, [findText, report]);

  const toggleWarehouse = (code) => {
    setCriteria((current) => ({
      ...current,
      selectedWarehouseCodes: current.selectedWarehouseCodes.includes(code)
        ? current.selectedWarehouseCodes.filter((value) => value !== code)
        : [...current.selectedWarehouseCodes, code],
    }));
  };

  const toggleLocation = (location) => {
    const locationCodes = location.warehouses.map((warehouse) => warehouse.code).filter(Boolean);
    const allSelected = locationCodes.every((code) => selectedWarehouseSet.has(code));

    setCriteria((current) => ({
      ...current,
      selectedWarehouseCodes: allSelected
        ? current.selectedWarehouseCodes.filter((code) => !locationCodes.includes(code))
        : [...new Set([...current.selectedWarehouseCodes, ...locationCodes])],
    }));
  };

  const expandAll = (isExpanded) => {
    setExpandedLocations(Object.fromEntries(groupedWarehouses.map((location) => [location.code, isExpanded])));
  };

  const handleRun = async () => {
    if (!criteria.selectedWarehouseCodes.length) {
      setMessage("Select at least one warehouse.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      setReport(await fetchInventoryAuditReport(criteria));
      setFindText("");
    } catch (error) {
      setReport(null);
      setMessage(error?.response?.data?.message || error?.message || "Could not load Inventory Audit report.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCriteria = () => {
    if (!closeActiveAndRestorePrevious()) navigate("/dashboard");
  };

  const handleSelectItem = (row) => {
    if (lookupTarget === "itemFrom" || lookupTarget === "itemTo") {
      setField(lookupTarget, row.ItemCode || "");
    }
    setLookupTarget("");
  };

  const renderWarehouseGrid = () => (
    <section className="ia-section">
      <div className="ia-section__title">Warehouses</div>
      <div className="ia-warehouse-box">
        <div className="ia-warehouse-grid">
          <div className="ia-warehouse-grid__header">
            <span>&nbsp;</span>
            <span>Location</span>
            <span>Whse Code</span>
            <span>Whse Name</span>
          </div>
          {groupedWarehouses.map((location) => {
            const isExpanded = expandedLocations[location.code] !== false;
            const locationCodes = location.warehouses.map((warehouse) => warehouse.code).filter(Boolean);
            const allSelected = locationCodes.length > 0 && locationCodes.every((code) => selectedWarehouseSet.has(code));

            return (
              <React.Fragment key={location.code}>
                <div className="ia-warehouse-grid__row is-location">
                  <label className="ia-warehouse-grid__check">
                    <input type="checkbox" checked={allSelected} onChange={() => toggleLocation(location)} />
                  </label>
                  <button
                    type="button"
                    className="ia-warehouse-grid__location"
                    onClick={() => setExpandedLocations((current) => ({ ...current, [location.code]: !isExpanded }))}
                  >
                    <span aria-hidden="true">{isExpanded ? "v" : ">"}</span>
                    {location.name || location.code}
                  </button>
                  <span>&nbsp;</span>
                  <span>&nbsp;</span>
                </div>
                {isExpanded ? location.warehouses.map((warehouse) => (
                  <div className="ia-warehouse-grid__row" key={warehouse.code}>
                    <label className="ia-warehouse-grid__check">
                      <input type="checkbox" checked={selectedWarehouseSet.has(warehouse.code)} onChange={() => toggleWarehouse(warehouse.code)} />
                    </label>
                    <span>&nbsp;</span>
                    <span><span className="ia-link-arrow" aria-hidden="true">-></span>{warehouse.code}</span>
                    <span>{warehouse.name}</span>
                  </div>
                )) : null}
              </React.Fragment>
            );
          })}
        </div>
        <div className="ia-warehouse-actions">
          <button type="button" className="ia-btn" onClick={() => expandAll(true)}>Expand</button>
          <button type="button" className="ia-btn" onClick={() => expandAll(false)}>Collapse</button>
        </div>
      </div>
    </section>
  );

  const renderCriteriaWindow = () => (
    <ReportWindow
      windowFrame={criteriaWindow}
      onMinimize={criteriaWindow.toggleMinimize}
      onClose={handleCloseCriteria}
      title="Inventory Audit Report - Selection Criteria"
      size="medium"
    >
      <div className="ia-criteria-columns">
      <div className="ia-criteria-left-col">
      <div className="ia-date-row">
        <select value={criteria.dateType} onChange={(event) => setField("dateType", event.target.value)}>
          <option value="system">System Date</option>
          <option value="posting">Posting Date</option>
        </select>
        <span>From</span>
        <input value={criteria.dateFrom} onChange={(event) => setField("dateFrom", event.target.value)} />
        <span>To</span>
        <input value={criteria.dateTo} onChange={(event) => setField("dateTo", event.target.value)} />
      </div>

      <section className="ia-section">
        <div className="ia-section__title">Items</div>
        <div className="ia-items-box">
          <div className="ia-range-row">
            <label>Code</label>
            <span>From</span>
            <div className="ia-lookup">
              <input value={criteria.itemFrom} onChange={(event) => setField("itemFrom", event.target.value)} />
              <button type="button" onClick={() => setLookupTarget("itemFrom")}>...</button>
            </div>
            <span>To</span>
            <div className="ia-lookup">
              <input value={criteria.itemTo} onChange={(event) => setField("itemTo", event.target.value)} />
              <button type="button" onClick={() => setLookupTarget("itemTo")}>...</button>
            </div>
          </div>
          <div className="ia-group-row">
            <label>Item Group</label>
            <select value={criteria.groupCode} onChange={(event) => setField("groupCode", event.target.value)}>
              <option value="*">*</option>
              {groups.filter((group) => group.code !== "*").map((group) => (
                <option key={group.code} value={group.code}>{group.name || group.code}</option>
              ))}
              <option value="all">All</option>
            </select>
          </div>
          <div className="ia-property-row">
            <button type="button" className="ia-btn ia-btn--field sap-report-btn sap-report-property-btn" onClick={() => setShowProperties(true)}>Properties</button>
            <input value={propertyLabel} readOnly />
          </div>
        </div>
      </section>

      <div className="ia-gl-row">
        <label><input type="checkbox" checked={criteria.glAccountsEnabled} onChange={(event) => setField("glAccountsEnabled", event.target.checked)} /> G/L Accounts</label>
        <button type="button" className="ia-small-btn" disabled={!criteria.glAccountsEnabled} onClick={() => setShowAccounts(true)}>...</button>
        <input value={accountLabel} readOnly disabled={!criteria.glAccountsEnabled} />
      </div>

      {renderWarehouseGrid()}
      </div>

      <div className="ia-criteria-right-col">
      <div className="ia-display">
        <div className="ia-display__title">Display</div>
        <label><input type="radio" name="inventoryAuditDisplay" checked={criteria.displayMode === "byItems"} onChange={() => setDisplayMode("byItems")} /> By Items</label>
        <label><input type="radio" name="inventoryAuditDisplay" checked={criteria.displayMode === "byAccount"} onChange={() => setDisplayMode("byAccount")} /> Summarize by Accounts</label>
      </div>

      <div className="ia-options">
        <label className={criteria.displayMode === "byAccount" ? "is-disabled" : ""}>
          <input type="checkbox" checked={criteria.groupByWarehouses} disabled={criteria.displayMode === "byAccount"} onChange={(event) => setField("groupByWarehouses", event.target.checked)} />
          Group by Warehouses
        </label>
        <label>
          <input type="checkbox" checked={criteria.displayOpeningBalances} onChange={(event) => setField("displayOpeningBalances", event.target.checked)} />
          Display OB for Items/Accounts with no Transactions
        </label>
        <label className={criteria.displayMode === "byAccount" ? "is-disabled" : ""}>
          <input type="checkbox" checked={criteria.hideItemsWithCumulativeQuantityZero} disabled={criteria.displayMode === "byAccount"} onChange={(event) => setField("hideItemsWithCumulativeQuantityZero", event.target.checked)} />
          Hide Items with Cumulative Quantity Zero
        </label>
        <label>
          <input type="checkbox" checked={criteria.hideSerialBatchForNonSerialBatch} onChange={(event) => setField("hideSerialBatchForNonSerialBatch", event.target.checked)} />
          Hide Serial/Batch Transactions If Current Item Valuation Method Is Not Serial/Batch
        </label>
      </div>

      {message ? <div className="ia-status">{message}</div> : null}
      </div>
      </div>

      <ReportActionBar>
        <ReportButton variant="primary" disabled={loading} onClick={handleRun}>{loading ? "Loading..." : "OK"}</ReportButton>
        <ReportButton onClick={handleCloseCriteria}>Cancel</ReportButton>
      </ReportActionBar>
    </ReportWindow>
  );

  const renderItemReport = () => (
    <div className="ia-report-grid-wrap sales-analysis-report__grid-wrap">
      <table className="ia-report-grid sales-analysis-report__grid">
        <thead>
          <tr>
            <th>#</th>
            <th>Item No.</th>
            <th>Item Description</th>
            <th>{report?.criteria?.dateType === "posting" ? "Posting Date" : "System Date"}</th>
            <th>Document</th>
            <th>Whse</th>
            <th>G/L Account</th>
            <th>Receipt Qty</th>
            <th>Issue Qty</th>
            <th>Cumulative Qty</th>
            <th>Trans. Value</th>
            <th>Cumulative Value</th>
            <th>Unit Cost</th>
          </tr>
        </thead>
        <tbody>
          {filteredReportRows.length ? filteredReportRows.map((row, index) => (
            <tr key={`${row.rowKind}-${row.itemCode}-${row.whsCode}-${row.transSeq}-${index}`} className={row.rowKind === "opening" ? "is-opening" : ""}>
              <td className="is-row-number">{index + 1}</td>
              <td>
                <button type="button" className="ia-item-link sales-analysis-report__link-cell" onClick={() => navigate(`/item-master?itemCode=${encodeURIComponent(row.itemCode)}`)}>
                  <span className="sales-analysis-report__link-icon" aria-hidden="true">-></span>
                  <span>{row.itemCode}</span>
                </button>
              </td>
              <td>{row.itemName}</td>
              <td>{formatReportDate(report?.criteria?.dateType === "posting" ? row.postingDate : row.systemDate)}</td>
              <td title={row.documentType}>{row.document}</td>
              <td title={row.whsName}>{row.whsCode}</td>
              <td title={row.accountName}>{row.accountFormatCode || row.accountCode}</td>
              <td className="is-number">{formatQuantity(row.inQty)}</td>
              <td className="is-number">{formatQuantity(row.outQty)}</td>
              <td className="is-number">{formatQuantity(row.cumulativeQuantity)}</td>
              <td className="is-number">{formatAmount(row.transValue)}</td>
              <td className="is-number">{formatAmount(row.cumulativeValue)}</td>
              <td className="is-number">{formatAmount(row.unitCost)}</td>
            </tr>
          )) : (
            <tr>
              <td className="sales-analysis-report__empty" colSpan={13}>No inventory audit rows found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderAccountReport = () => (
    <div className="ia-report-grid-wrap sales-analysis-report__grid-wrap">
      <table className="ia-report-grid ia-report-grid--accounts sales-analysis-report__grid">
        <thead>
          <tr>
            <th>#</th>
            <th>G/L Account</th>
            <th>Account Name</th>
            <th>Opening Qty</th>
            <th>Receipt Qty</th>
            <th>Issue Qty</th>
            <th>Closing Qty</th>
            <th>Opening Value</th>
            <th>Trans. Value</th>
            <th>Closing Value</th>
          </tr>
        </thead>
        <tbody>
          {filteredAccountRows.length ? filteredAccountRows.map((row, index) => (
            <tr key={`${row.accountCode}-${index}`}>
              <td className="is-row-number">{index + 1}</td>
              <td>{row.formatCode || row.accountCode}</td>
              <td>{row.accountName}</td>
              <td className="is-number">{formatQuantity(row.openingQuantity)}</td>
              <td className="is-number">{formatQuantity(row.inQuantity)}</td>
              <td className="is-number">{formatQuantity(row.outQuantity)}</td>
              <td className="is-number">{formatQuantity(row.closingQuantity)}</td>
              <td className="is-number">{formatAmount(row.openingValue)}</td>
              <td className="is-number">{formatAmount(row.transactionValue)}</td>
              <td className="is-number">{formatAmount(row.closingValue)}</td>
            </tr>
          )) : (
            <tr>
              <td className="sales-analysis-report__empty" colSpan={10}>No account summary rows found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderReportWindow = () => report ? (
    <ReportWindow
      windowFrame={reportWindow}
      onMinimize={reportWindow.toggleMinimize}
      onClose={() => setReport(null)}
      title="Inventory Audit Report"
      size="wide"
    >
      <div className="ia-report-toolbar">
        <label>Find <input value={findText} onChange={(event) => setFindText(event.target.value)} /></label>
        <span>{report.sourceTable ? `Source: ${report.sourceTable}` : ""}</span>
      </div>
      {report.criteria?.displayMode === "byAccount" ? renderAccountReport() : renderItemReport()}
      <ReportActionBar>
        <ReportBackButton onClick={() => setReport(null)} />
      </ReportActionBar>
    </ReportWindow>
  ) : null;

  return (
    <ReportPageShell className="ia-page">
      {renderCriteriaWindow()}
      {renderReportWindow()}

      <ItemLookupModal
        isOpen={lookupTarget === "itemFrom" || lookupTarget === "itemTo"}
        onClose={() => setLookupTarget("")}
        onSelect={handleSelectItem}
      />
      <PropertiesSelectionModal
        isOpen={showProperties}
        title="Properties"
        propertyLabelPrefix="Items Property"
        properties={properties}
        value={criteria.propertyFilter}
        onClose={() => setShowProperties(false)}
        onSave={(value) => setField("propertyFilter", value)}
      />
      <GLAccountLookupModal
        isOpen={showAccounts}
        accounts={lookups.accounts}
        selectedCodes={criteria.selectedAccountCodes}
        onClose={() => setShowAccounts(false)}
        onSave={(codes) => setField("selectedAccountCodes", codes)}
      />
    </ReportPageShell>
  );
}

export default InventoryAuditReportPage;
