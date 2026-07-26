import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ItemLookupModal from "../components/reports/ItemLookupModal";
import PropertiesSelectionModal from "../components/reports/PropertiesSelectionModal";
import { ReportBackButton } from "../components/reports/ReportWindowControls";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import ReportPageShell from "../components/reports/ReportPageShell";
import ReportWindow from "../components/reports/ReportWindow";
import { ReportActionBar, ReportButton } from "../components/reports/ReportActionBar";
import { ReportFieldRow, ReportLookupField, ReportSelect, ReportCheckbox, ReportPropertiesField } from "../components/reports/ReportFormControls";
import { fetchItemGroups, fetchItemProperties } from "../api/itemApi";
import { fetchItemListReport } from "../api/itemListReportApi";
import "../styles/item-list-report.css";

const DEFAULT_ITEM_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({
  number: index + 1,
  name: `Items Property ${index + 1}`,
}));

const EXPANDED_FIELD_OPTIONS = [
  { value: "", label: "" },
  { value: "preferredVendor", label: "Preferred Vendor" },
  { value: "tolerance", label: "Tollerence" },
  { value: "productGroup", label: "Product Group" },
  { value: "webUserCode", label: "WEBUSERCODE" },
  { value: "webUser", label: "WEBUSER" },
];

const createExpandedRows = () =>
  Array.from({ length: 5 }, (_, index) => ({
    field: index === 0 ? "tolerance" : "",
    from: "",
    to: "",
  }));

const createInitialState = () => ({
  itemFrom: "",
  itemTo: "",
  groupCode: "*",
  hideNoStock: false,
  expandedSelection: false,
  propertyFilter: {
    ignoreProperties: true,
    linkMode: "and",
    exactlyMatch: false,
    selectedPropertyNumbers: [],
  },
  expandedCriteria: createExpandedRows(),
});

const formatQuantity = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

function NumericPad({ value, onChange, onClose }) {
  const append = (token) => onChange(`${value || ""}${token}`);
  const clear = () => onChange("");
  const backspace = () => onChange(String(value || "").slice(0, -1));

  const toggleSign = () => {
    const text = String(value || "");
    onChange(text.startsWith("-") ? text.slice(1) : `-${text}`);
  };

  return (
    <div className="item-list-calculator">
      <div className="item-list-calculator__display">{value || "0"}</div>
      <div className="item-list-calculator__wide-row">
        <button type="button" onClick={backspace}>Backspace</button>
        <button type="button" onClick={clear}>CE</button>
        <button type="button" onClick={clear}>C</button>
      </div>
      <div className="item-list-calculator__grid">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((token) => (
          <button key={token} type="button" onClick={() => append(token)}>{token}</button>
        ))}
        <button type="button" onClick={toggleSign}>+/-</button>
        <button type="button" onClick={() => append("0")}>0</button>
        <button type="button" onClick={() => append(".")}>.</button>
      </div>
      <div className="item-list-calculator__footer">
        <button type="button" onClick={onClose}>Close</button>
        <button type="button" onClick={onClose}>Copy to Field</button>
      </div>
    </div>
  );
}

function ItemListReportPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [formState, setFormState] = useState(createInitialState);
  const [itemGroups, setItemGroups] = useState([{ code: "*", name: "*" }]);
  const [itemProperties, setItemProperties] = useState(DEFAULT_ITEM_PROPERTIES);
  const [reportResult, setReportResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [lookupTarget, setLookupTarget] = useState("");
  const [showProperties, setShowProperties] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [findText, setFindText] = useState("");
  const [calculatorTarget, setCalculatorTarget] = useState(null);

  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 24,
    taskId: "item-list-criteria",
    taskTitle: "Items List - Selection Criteria",
    taskPath: "/reports/item-list",
    bounds: "parent",
  });

  const reportWindow = useFloatingWindow({
    isOpen: Boolean(reportResult),
    defaultTop: 12,
    taskId: "item-list-report",
    taskTitle: reportResult?.reportTitle || "List of Items",
    taskPath: "/reports/item-list",
    bounds: "parent",
  });

  useEffect(() => {
    let isMounted = true;
    Promise.all([fetchItemGroups(""), fetchItemProperties()])
      .then(([groups, properties]) => {
        if (!isMounted) return;
        setItemGroups(Array.isArray(groups) && groups.length ? groups : [{ code: "*", name: "*" }]);
        setItemProperties(Array.isArray(properties) && properties.length ? properties : DEFAULT_ITEM_PROPERTIES);
      })
      .catch((error) => {
        if (!isMounted) return;
        setStatusMessage(error?.response?.data?.message || error?.message || "Could not load item selection lookups.");
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
        row.itemName,
        row.barCode,
        row.groupName,
        row.manufacturerName,
        row.preferredVendor,
        row.webUserCode,
        row.webUser,
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

  const updateExpandedRow = (index, patch) => {
    setFormState((current) => ({
      ...current,
      expandedCriteria: current.expandedCriteria.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }));
  };

  const handleOk = async () => {
    setIsLoadingReport(true);
    setStatusMessage("");
    try {
      const response = await fetchItemListReport(formState);
      setReportResult(response);
      setFindText("");
      setSelectedRowIndex(0);
    } catch (error) {
      setReportResult(null);
      setStatusMessage(error?.response?.data?.message || error?.message || "Could not load Item List report.");
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

  const handleOpenLinkedItem = (row) => {
    const itemCode = String(row?.itemCode || "").trim();
    if (!itemCode) return;

    if (row.hasBOM) {
      navigate(`/bom?treeCode=${encodeURIComponent(itemCode)}`, {
        state: { bomTreeCode: itemCode },
      });
      return;
    }

    navigate(`/item-master?itemCode=${encodeURIComponent(itemCode)}`);
  };

  const renderExpandedRow = (row, index) => {
    const calculatorKey = `${index}:from`;
    const canUseCalculator = row.field === "tolerance";

    return (
      <div className="item-list-criteria__expanded-row" key={index}>
        <select
          value={row.field}
          disabled={!formState.expandedSelection}
          onChange={(event) => updateExpandedRow(index, { field: event.target.value, from: "", to: "" })}
        >
          {EXPANDED_FIELD_OPTIONS.map((option) => (
            <option key={option.value || "blank"} value={option.value}>{option.label}</option>
          ))}
        </select>
        <div className="item-list-criteria__calculator-anchor">
          <input
            type="text"
            value={row.from}
            disabled={!formState.expandedSelection || !row.field}
            onChange={(event) => updateExpandedRow(index, { from: event.target.value })}
          />
          {canUseCalculator ? (
            <button
              type="button"
              className="item-list-criteria__field-helper"
              aria-label="Open calculator"
              onClick={() => setCalculatorTarget(calculatorTarget === calculatorKey ? null : calculatorKey)}
            >
              =
            </button>
          ) : null}
          {calculatorTarget === calculatorKey ? (
            <NumericPad
              value={row.from}
              onChange={(value) => updateExpandedRow(index, { from: value })}
              onClose={() => setCalculatorTarget(null)}
            />
          ) : null}
        </div>
        <input
          type="text"
          value={row.to}
          disabled={!formState.expandedSelection || !row.field}
          onChange={(event) => updateExpandedRow(index, { to: event.target.value })}
        />
      </div>
    );
  };

  return (
    <ReportPageShell>
      <ReportWindow
        windowFrame={criteriaWindow}
        onMinimize={handleMinimizeCriteriaWindow}
        onClose={handleCloseCriteriaWindow}
        title="Items List - Selection Criteria"
        size="compact"
      >
        <div className="item-list-criteria">
          <ReportFieldRow label="Item No.">
            <div className="item-list-criteria__item-row">
              <span className="item-list-criteria__from-label">From</span>
              <ReportLookupField
                value={formState.itemFrom}
                onChange={(event) => setField("itemFrom", event.target.value)}
                onLookup={() => setLookupTarget("itemFrom")}
                lookupLabel="Choose item from"
              />
              <span>To</span>
              <ReportLookupField
                value={formState.itemTo}
                onChange={(event) => setField("itemTo", event.target.value)}
                onLookup={() => setLookupTarget("itemTo")}
                lookupLabel="Choose item to"
              />
            </div>
          </ReportFieldRow>

          <ReportFieldRow label="Group">
            <ReportSelect value={formState.groupCode} onChange={(event) => setField("groupCode", event.target.value)}>
              {itemGroups.map((group) => (
                <option key={`${group.code}-${group.name}`} value={group.code}>
                  {group.code === "*" || group.name === "*" ? "All" : group.name || group.code}
                </option>
              ))}
            </ReportSelect>
          </ReportFieldRow>

          <ReportPropertiesField label="Item Properties" summary={propertyModeLabel} onClick={() => setShowProperties(true)} />

          <ReportCheckbox
            label="Hide Items with No Quantity in Stock"
            checked={formState.hideNoStock}
            onChange={(event) => setField("hideNoStock", event.target.checked)}
          />

          <ReportCheckbox
            label="Expanded Selection Criteria"
            checked={formState.expandedSelection}
            onChange={(event) => setField("expandedSelection", event.target.checked)}
          />

          <div className="item-list-criteria__expanded-grid">
            {formState.expandedCriteria.map(renderExpandedRow)}
          </div>

          {isLoadingReport ? <div className="item-list-status">Loading Item List report...</div> : null}
          {statusMessage ? <div className="item-list-status">{statusMessage}</div> : null}
        </div>

        <ReportActionBar>
          <ReportButton variant="primary" onClick={handleOk}>OK</ReportButton>
          <ReportButton onClick={handleCloseCriteriaWindow}>Cancel</ReportButton>
        </ReportActionBar>
      </ReportWindow>

      {reportResult ? (
        <ReportWindow
          windowFrame={reportWindow}
          onMinimize={handleMinimizeReportWindow}
          onClose={handleCloseReportWindow}
          title={reportResult?.reportTitle || "List of Items"}
          size="large"
        >
          <div className="item-list-report__toolbar">
            <label htmlFor="item-list-find">Find</label>
            <input
              id="item-list-find"
              type="text"
              value={findText}
              onChange={(event) => setFindText(event.target.value)}
            />
            <span className="item-list-report__count">
              {filteredRows.length} of {reportResult?.totalRows || 0}
            </span>
          </div>

          <div className="item-list-report__grid-wrap">
            <table className="item-list-report__grid">
              <thead>
                <tr>
                  <th className="is-index">#</th>
                  <th className="is-code">Item No.</th>
                  <th className="is-name">Item Description</th>
                  <th className="is-stock">In Stock</th>
                  <th className="is-barcode">Bar Code</th>
                  <th className="is-group">Item Group</th>
                  <th className="is-manufacturer">Manufacturer</th>
                </tr>
              </thead>
              <tbody>
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={7} className="item-list-report__state-cell">No items found.</td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr
                      key={`${row.itemCode || "item"}-${index}`}
                      className={selectedRowIndex === index ? "is-selected" : ""}
                      onClick={() => setSelectedRowIndex(index)}
                    >
                      <td className="is-index">{index + 1}</td>
                      <td className="is-code">
                        <button
                          type="button"
                          className="item-list-report__link-arrow"
                          aria-label={`Open ${row.hasBOM ? "Bill of Materials" : "Item Master"} for ${row.itemCode}`}
                          title={row.hasBOM ? "Open Bill of Materials" : "Open Item Master Data"}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenLinkedItem(row);
                          }}
                        >
                          →
                        </button>
                        <button
                          type="button"
                          className="item-list-report__item-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenLinkedItem(row);
                          }}
                        >
                          {row.itemCode}
                        </button>
                      </td>
                      <td className="is-name">{row.itemName}</td>
                      <td className="is-stock">{formatQuantity(row.inStock)}</td>
                      <td className="is-barcode">{row.barCode}</td>
                      <td className="is-group">{row.groupName}</td>
                      <td className="is-manufacturer">{row.manufacturerName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="item-list-report__footer">
            <div className="item-list-report__footer-left">
              <ReportBackButton onClick={handleCloseReportWindow} />
            </div>
            <span className="item-list-report__print-note">*You can only select one price list for printing</span>
            <span>{company?.companyName || company?.dbName || "SAP Business One"}</span>
          </div>
        </ReportWindow>
      ) : null}

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
    </ReportPageShell>
  );
}

export default ItemListReportPage;
