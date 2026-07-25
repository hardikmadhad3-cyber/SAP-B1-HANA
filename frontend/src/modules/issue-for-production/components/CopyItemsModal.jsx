import React, { useMemo, useState } from "react";

const numeric = (value, decimals = 3) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : "";
};

export default function CopyItemsModal({ order, lines = [], onOk, onClose }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(lines.map((line) => line._id)));
  const copyQuantity = (line) => line.copy_qty ?? line.issue_qty ?? line.remaining_qty ?? 0;

  const selectedLines = useMemo(
    () => lines.filter((line) => selectedIds.has(line._id)),
    [lines, selectedIds]
  );

  const toggleLine = (lineId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const choose = () => {
    const chosenLines = selectedLines.length > 0 ? selectedLines : lines;
    onOk(chosenLines.map((line) => ({
      ...line,
      copy_qty: copyQuantity(line),
      issue_qty: copyQuantity(line),
    })));
  };

  return (
    <div className="ifp-po-modal-overlay" onClick={onClose}>
      <div className="ifp-copy-modal ifp-sap-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ifp-sap-modal__titlebar">
          <span>Select Items to Copy</span>
          <div className="ifp-sap-modal__controls">
            <button type="button" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="ifp-sap-modal__body">
          <div className="ifp-copy-title">Select Items to Copy</div>
          <div className="ifp-sap-list-wrap ifp-copy-list-wrap">
            <table className="ifp-sap-list-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th style={{ width: 104 }}>Order Number</th>
                  <th style={{ width: 64 }}>Row No.</th>
                  <th style={{ width: 104 }}>Item Number</th>
                  <th style={{ width: 170 }}>Item Description</th>
                  <th style={{ width: 76 }}>Type</th>
                  <th style={{ width: 72, textAlign: "right" }}>Qty</th>
                  <th style={{ width: 72 }}>Whse</th>
                  <th style={{ width: 100 }}>Start Date</th>
                  <th style={{ width: 100 }}>End Date</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={10} className="ifp-sap-empty-cell">No items available to copy.</td>
                  </tr>
                )}
                {lines.map((line, index) => {
                  const isSelected = selectedIds.has(line._id);
                  return (
                    <tr
                      key={line._id}
                      className={isSelected ? "is-selected" : ""}
                      onClick={() => toggleLine(line._id)}
                      onDoubleClick={choose}
                    >
                      <td>{index + 1}</td>
                      <td>{line.order_no || order?.doc_num}</td>
                      <td>{line.line_num}</td>
                      <td>{line.item_code}</td>
                      <td>{line.item_name}</td>
                      <td>{line.line_type || "Item"}</td>
                      <td style={{ textAlign: "right" }}>{numeric(copyQuantity(line))}</td>
                      <td>{line.warehouse}</td>
                      <td>{order?.start_date}</td>
                      <td>{order?.due_date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ifp-sap-modal__footer">
          <button type="button" className="im-btn im-btn--primary" onClick={choose} disabled={lines.length === 0}>
            OK
          </button>
          <button type="button" className="im-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
