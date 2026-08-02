import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useSapWindowTaskbarActions } from "../components/SapWindowTaskbarContext";
import useFloatingWindow from "../components/reports/useFloatingWindow";
import { fetchProductionOpenItemsReport } from "../api/productionOpenItemsReportApi";
import { matchesSapSearchText } from "../utils/sapSearch";
import "../styles/item-list-report.css";
import "../styles/production-open-items-report.css";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "planned", label: "Planned" },
  { value: "released", label: "Released" },
  { value: "all", label: "All" },
];

const formatQuantity = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB");
};

function ProductionOpenItemsReportPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState({ status: "open", query: "" });
  const [report, setReport] = useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const reportWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 12,
    taskId: "production-open-items-list",
    taskTitle: "Open Items List",
    taskPath: "/reports/production/open-items-list",
    bounds: "parent",
  });

  const loadReport = async (nextCriteria = criteria) => {
    setLoading(true);
    setStatusMessage("");
    try {
      const data = await fetchProductionOpenItemsReport(nextCriteria);
      setReport(data);
      setSelectedRowIndex(0);
    } catch (error) {
      setReport(null);
      setStatusMessage(error?.response?.data?.message || error?.message || "Could not load Open Items List.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const rows = report?.rows || [];
    const query = criteria.query.trim();
    if (!query) return rows;

    return rows.filter((row) =>
      [row.docNo, row.docSeries, row.type, row.status, row.productNo, row.productDescription]
        .some((value) => matchesSapSearchText(value, query)),
    );
  }, [criteria.query, report?.rows]);

  const setField = (field, value) => {
    const nextCriteria = { ...criteria, [field]: value };
    setCriteria(nextCriteria);
    if (field === "status") {
      loadReport(nextCriteria);
    }
  };

  const openProductionOrder = (row) => {
    if (!row?.docEntry) return;
    navigate(`/production-order?docEntry=${encodeURIComponent(row.docEntry)}`, {
      state: { productionOrderDocEntry: row.docEntry },
    });
  };

  const openBillOfMaterials = (row) => {
    const productNo = String(row?.productNo || "").trim();
    if (!productNo) return;
    navigate(`/bom?treeCode=${encodeURIComponent(productNo)}`, {
      state: { bomTreeCode: productNo },
    });
  };

  const handleClose = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate("/dashboard");
  };

  const handleMinimize = () => {
    reportWindow.toggleMinimize();
    navigate("/dashboard");
  };

  const renderWindowControls = () => (
    <div className="item-list-window__controls">
      <button type="button" aria-label={reportWindow.isMinimized ? "Restore" : "Minimize"} onClick={handleMinimize}>
        {reportWindow.isMinimized ? "[]" : "-"}
      </button>
      <button
        type="button"
        aria-label={reportWindow.isMaximized ? "Restore" : "Maximize"}
        title={reportWindow.isMaximized ? "Restore" : "Maximize"}
        onClick={reportWindow.toggleMaximize}
      >
        []
      </button>
      <button type="button" aria-label="Close" onClick={handleClose}>x</button>
    </div>
  );

  return (
    <div className="item-list-page sap-report-page production-open-items-page">
      <div
        className={`item-list-window item-list-window--report production-open-items-window sap-report-window${reportWindow.isMinimized ? " is-minimized" : ""}${reportWindow.isMaximized ? " is-maximized" : ""}`}
        {...reportWindow.windowProps}
      >
        <div className="item-list-window__titlebar sap-report-titlebar" {...reportWindow.titleBarProps}>
          <div className="item-list-window__title sap-report-title">Open Items List</div>
          {renderWindowControls()}
        </div>
        <div className="item-list-window__accent" />

        {!reportWindow.isMinimized ? (
          <div className="item-list-window__body item-list-window__body--report production-open-items-body">
            <div className="production-open-items-toolbar">
              <label htmlFor="production-open-items-filter">Filter</label>
              <select
                id="production-open-items-filter"
                value={criteria.status}
                onChange={(event) => setField("status", event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <label htmlFor="production-open-items-documents">Open Documents</label>
              <select id="production-open-items-documents" value="production_orders" onChange={() => {}}>
                <option value="production_orders">Production Orders</option>
              </select>
            </div>

            <div className="production-open-items-search">
              <label htmlFor="production-open-items-find">Find</label>
              <input
                id="production-open-items-find"
                value={criteria.query}
                onChange={(event) => setField("query", event.target.value)}
              />
              <button type="button" className="item-list-btn" onClick={() => loadReport(criteria)}>Refresh</button>
              <span>{loading ? "Loading..." : `${filteredRows.length} of ${report?.totalRows || 0}`}</span>
            </div>

            {statusMessage ? <div className="item-list-status">{statusMessage}</div> : null}

            <div className="production-open-items-grid-wrap">
              <table className="production-open-items-grid">
                <thead>
                  <tr>
                    <th className="poi-doc">Doc. No.</th>
                    <th className="poi-select">Select</th>
                    <th className="poi-series">Doc. Series</th>
                    <th className="poi-type">Type</th>
                    <th className="poi-status">Status</th>
                    <th className="poi-product">Product No.</th>
                    <th className="poi-description">Product Description</th>
                    <th className="poi-qty">Planned Quantity</th>
                    <th className="poi-date">Order Date</th>
                    <th className="poi-date">Start Date</th>
                    <th className="poi-date">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {!filteredRows.length ? (
                    <tr>
                      <td colSpan={11} className="item-list-report__state-cell">No production orders found.</td>
                    </tr>
                  ) : (
                    filteredRows.map((row, index) => (
                      <tr
                        key={`${row.docEntry || row.docNo}-${index}`}
                        className={selectedRowIndex === index ? "is-selected" : ""}
                        onClick={() => setSelectedRowIndex(index)}
                      >
                        <td className="poi-doc">
                          <button
                            type="button"
                            className="item-list-report__link-arrow"
                            aria-label={`Open Production Order ${row.docNo}`}
                            title="Open Production Order"
                            onClick={(event) => {
                              event.stopPropagation();
                              openProductionOrder(row);
                            }}
                          >
                            &rarr;
                          </button>
                          <button
                            type="button"
                            className="item-list-report__item-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              openProductionOrder(row);
                            }}
                          >
                            {row.docNo}
                          </button>
                        </td>
                        <td className="poi-select"><input type="checkbox" readOnly checked={Boolean(row.selected)} /></td>
                        <td className="poi-series">{row.docSeries}</td>
                        <td className="poi-type">{row.type}</td>
                        <td className="poi-status">{row.status}</td>
                        <td className="poi-product">
                          <button
                            type="button"
                            className="item-list-report__link-arrow"
                            aria-label={`Open Bill of Materials ${row.productNo}`}
                            title="Open Bill of Materials"
                            onClick={(event) => {
                              event.stopPropagation();
                              openBillOfMaterials(row);
                            }}
                          >
                            &rarr;
                          </button>
                          <button
                            type="button"
                            className="item-list-report__item-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              openBillOfMaterials(row);
                            }}
                          >
                            {row.productNo}
                          </button>
                        </td>
                        <td className="poi-description">{row.productDescription}</td>
                        <td className="poi-qty">{formatQuantity(row.plannedQuantity)}</td>
                        <td className="poi-date">{formatDate(row.orderDate)}</td>
                        <td className="poi-date">{formatDate(row.startDate)}</td>
                        <td className="poi-date">{formatDate(row.dueDate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="production-open-items-footer">
              <button type="button" className="item-list-btn" onClick={handleClose}>OK</button>
              <button type="button" className="item-list-btn" disabled>Change To</button>
              <span>{company?.companyName || company?.dbName || "SAP Business One"}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ProductionOpenItemsReportPage;
