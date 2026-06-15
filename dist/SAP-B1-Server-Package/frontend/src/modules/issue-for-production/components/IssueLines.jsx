import React, { useState } from "react";
import BatchSerialModal from "./BatchSerialModal";

const numeric = (value, decimals = 2) => {
  if (value === "" || value == null) return "";
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : "";
};

export default function IssueLines({
  lines, warehouses, distRules,
  readOnly, onChange, onOrderLookup, onItemLookup,
}) {
  const [batchSerialModal, setBatchSerialModal] = useState(null);
  const [warehouseLookup, setWarehouseLookup] = useState(null);
  const EMPTY_ROWS = 12;
  const COLUMN_COUNT = 21;

  const handleBatchSerialSave = (lineId, data) => {
    onChange(lineId, "batch_numbers", data.batch_numbers);
    onChange(lineId, "serial_numbers", data.serial_numbers);
    setBatchSerialModal(null);
  };

  return (
    <>
      {batchSerialModal && (
        <BatchSerialModal
          line={batchSerialModal}
          onSave={(data) => handleBatchSerialSave(batchSerialModal._id, data)}
          onClose={() => setBatchSerialModal(null)}
        />
      )}
      {warehouseLookup && (
        <WarehouseLookupModal
          warehouses={warehouses}
          selected={warehouseLookup.line.warehouse}
          onSelect={(warehouseCode) => {
            onChange(warehouseLookup.line._id, "warehouse", warehouseCode);
            setWarehouseLookup(null);
          }}
          onClose={() => setWarehouseLookup(null)}
        />
      )}

      <div className="ifp-lines-wrap">
        <div className="ifp-grid-scroll">
          <table className="ifp-grid">
            <thead>
              <tr>
                <th className="ifp-th ifp-th--idx">#</th>
                <th className="ifp-th ifp-th--order">Order No.</th>
                <th className="ifp-th ifp-th--series-no">Series No.</th>
                <th className="ifp-th ifp-th--row">Row No.</th>
                <th className="ifp-th ifp-th--type">Type</th>
                <th className="ifp-th ifp-th--item">Item No.</th>
                <th className="ifp-th ifp-th--desc">Item Description</th>
                <th className="ifp-th ifp-th--qty">Quantity</th>
                <th className="ifp-th ifp-th--wh">Whse</th>
                <th className="ifp-th ifp-th--cost">Item Cost</th>
                <th className="ifp-th ifp-th--planned">Planned</th>
                <th className="ifp-th ifp-th--issued">Issued</th>
                <th className="ifp-th ifp-th--avail">Avail</th>
                <th className="ifp-th ifp-th--uom">UoM Code</th>
                <th className="ifp-th ifp-th--uom-name">UoM Name</th>
                <th className="ifp-th ifp-th--dr">Distr. Rule</th>
                <th className="ifp-th ifp-th--rg">RG23A Part I No.</th>
                <th className="ifp-th ifp-th--rg">RG23C Part I No.</th>
                <th className="ifp-th ifp-th--loc">Location</th>
                <th className="ifp-th ifp-th--ref">Sauda Node Ref</th>
                <th className="ifp-th ifp-th--ap">AP Inv DocKey</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const remaining = Number(line.remaining_qty ?? line.issue_qty ?? 0);
                const fullyIssued = remaining <= 0 && !readOnly;
                const hasAllocation = (line.batch_numbers || []).length > 0 || (line.serial_numbers || []).length > 0;

                return (
                  <tr
                    key={line._id}
                    className={`ifp-grid__row${fullyIssued ? " ifp-grid__row--fully-issued" : ""}`}
                  >
                    <td className="ifp-grid__cell ifp-grid__cell--num">{index + 1}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--lookup">
                      <span>{line.order_no}</span>
                      {!readOnly && (
                        <button type="button" className="ifp-cell-lookup-btn" onClick={onOrderLookup} title="List of Production Orders">
                          ...
                        </button>
                      )}
                    </td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly">{line.series_no}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly ifp-grid__cell--num">{line.line_num}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly">{line.line_type || "Item"}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--lookup">
                      <span>{line.item_code}</span>
                      {!readOnly && (
                        <button type="button" className="ifp-cell-lookup-btn" onClick={onItemLookup} title="Select Items to Copy">
                          ...
                        </button>
                      )}
                    </td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly">{line.item_name}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--issue">
                      <div className="ifp-qty-cell">
                        <input
                          className="ifp-issue-input"
                          type="number"
                          min="0"
                          step="any"
                          value={line.issue_qty}
                          disabled={readOnly || fullyIssued}
                          onChange={(event) => onChange(line._id, "issue_qty", event.target.value)}
                        />
                        {(line.manage_batch || line.manage_serial) && (
                          <button
                            className={`ifp-allocation-btn${hasAllocation ? " is-selected" : ""}`}
                            disabled={readOnly || fullyIssued || !line.warehouse || Number(line.issue_qty) <= 0}
                            onClick={() => setBatchSerialModal(line)}
                            title={line.manage_batch ? "Select Batch Numbers" : "Select Serial Numbers"}
                          >
                            ...
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="ifp-grid__cell ifp-grid__cell--lookup">
                      <span>{line.warehouse}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          className="ifp-cell-lookup-btn"
                          onClick={() => setWarehouseLookup({ line })}
                          title="List of Warehouses"
                        >
                          ...
                        </button>
                      )}
                    </td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly ifp-grid__cell--num">{numeric(line.item_cost)}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly ifp-grid__cell--num">{numeric(line.planned_qty)}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly ifp-grid__cell--num">{numeric(line.issued_qty)}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly ifp-grid__cell--num">{numeric(line.available_qty)}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly">{line.uom}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly">{line.uom_name}</td>
                    <td className="ifp-grid__cell">
                      <select
                        className="ifp-cell-select"
                        value={line.distribution_rule}
                        disabled={readOnly}
                        onChange={(event) => onChange(line._id, "distribution_rule", event.target.value)}
                      >
                        <option value=""></option>
                        {distRules.map((rule) => (
                          <option key={rule.FactorCode} value={rule.FactorCode}>
                            {rule.FactorCode}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly"></td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly"></td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly">{line.location}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly">{line.sauda_node_ref}</td>
                    <td className="ifp-grid__cell ifp-grid__cell--readonly">{line.ap_inv_doc_key}</td>
                  </tr>
                );
              })}

              {lines.length < EMPTY_ROWS &&
                Array.from({ length: EMPTY_ROWS - lines.length }).map((_, rowIndex) => (
                  <tr key={`empty-${rowIndex}`} className="ifp-grid__row ifp-grid__row--empty">
                    {Array.from({ length: COLUMN_COUNT }).map((__, columnIndex) => (
                      <td key={columnIndex} className="ifp-grid__cell ifp-grid__cell--empty" />
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function WarehouseLookupModal({ warehouses, selected, onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, warehouses.findIndex((warehouse) => warehouse.WarehouseCode === selected))
  );
  const filtered = warehouses.filter((warehouse) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return String(warehouse.WarehouseCode || "").toLowerCase().includes(q) ||
      String(warehouse.WarehouseName || "").toLowerCase().includes(q);
  });
  const active = filtered[activeIndex] || filtered[0] || null;

  const choose = () => {
    if (active) onSelect(active.WarehouseCode);
  };

  return (
    <div className="ifp-po-modal-overlay" onClick={onClose}>
      <div className="ifp-whs-modal ifp-sap-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ifp-sap-modal__titlebar">
          <span>List of Warehouses</span>
          <div className="ifp-sap-modal__controls">
            <button type="button" disabled>-</button>
            <button type="button" disabled>[]</button>
            <button type="button" onClick={onClose}>x</button>
          </div>
        </div>
        <div className="ifp-sap-modal__body">
          <div className="ifp-sap-find-row">
            <label>Find</label>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} />
          </div>
          <div className="ifp-sap-list-wrap">
            <table className="ifp-sap-list-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th style={{ width: 100 }}>Whse</th>
                  <th style={{ width: 260 }}>Warehouse Name</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((warehouse, index) => (
                  <tr
                    key={warehouse.WarehouseCode}
                    className={index === activeIndex ? "is-selected" : ""}
                    onClick={() => setActiveIndex(index)}
                    onDoubleClick={() => onSelect(warehouse.WarehouseCode)}
                  >
                    <td>{index + 1}</td>
                    <td>{warehouse.WarehouseCode}</td>
                    <td>{warehouse.WarehouseName}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="ifp-sap-empty-cell">No warehouses found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="ifp-sap-modal__footer">
          <button type="button" className="im-btn im-btn--primary" onClick={choose} disabled={!active}>Choose</button>
          <button type="button" className="im-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
