import React from "react";

/**
 * BackflushPreview
 * Shows the backflush components that will be auto-issued when the receipt is posted.
 * Calculates: component qty = BOM qty × (receipt qty / planned qty)
 * These are read-only — SAP handles them automatically.
 */
export default function BackflushPreview({ lines, receiptQty, plannedQty, warehouses }) {
  const EMPTY_ROWS = 5;
  const factor = plannedQty > 0 ? Number(receiptQty || 0) / plannedQty : 0;

  if (lines.length === 0) return null;

  return (
    <div className="rfp-backflush-panel">
      <div className="rfp-backflush-panel__title">
        Backflush Components
        <span className="rfp-backflush-panel__badge">AUTO-ISSUED ON RECEIPT</span>
        <span className="rfp-backflush-panel__note">
          Quantities calculated: BOM Qty × Receipt Qty ÷ Planned Qty
        </span>
      </div>

      <div className="rfp-grid-scroll">
        <table className="rfp-grid">
          <thead>
            <tr>
              <th className="rfp-th rfp-th--no">Item No.</th>
              <th className="rfp-th rfp-th--desc">Description</th>
              <th className="rfp-th rfp-th--bomqty">BOM Qty</th>
              <th className="rfp-th rfp-th--calcqty">Will Issue</th>
              <th className="rfp-th rfp-th--issued">Already Issued</th>
              <th className="rfp-th rfp-th--uom">UoM</th>
              <th className="rfp-th rfp-th--wh">Warehouse</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const willIssue = parseFloat((line.bom_qty * factor).toFixed(6));
              return (
                <tr key={line._id} className="rfp-grid__row">
                  <td className="rfp-grid__cell rfp-grid__cell--readonly">{line.item_code}</td>
                  <td className="rfp-grid__cell rfp-grid__cell--readonly">{line.item_name}</td>
                  <td className="rfp-grid__cell rfp-grid__cell--num rfp-grid__cell--readonly">
                    {Number(line.bom_qty).toFixed(4)}
                  </td>
                  <td className="rfp-grid__cell rfp-grid__cell--calc">
                    {willIssue > 0 ? willIssue.toFixed(4) : "—"}
                  </td>
                  <td className="rfp-grid__cell rfp-grid__cell--num rfp-grid__cell--readonly">
                    {Number(line.issued_qty || 0).toFixed(2)}
                  </td>
                  <td className="rfp-grid__cell rfp-grid__cell--readonly">{line.uom}</td>
                  <td className="rfp-grid__cell rfp-grid__cell--readonly">{line.warehouse}</td>
                </tr>
              );
            })}

            {lines.length < EMPTY_ROWS &&
              Array.from({ length: EMPTY_ROWS - lines.length }).map((_, i) => (
                <tr key={`e-${i}`} className="rfp-grid__row rfp-grid__row--empty">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="rfp-grid__cell rfp-grid__cell--empty" />
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="rfp-bottom-bar">
        <div className="rfp-bottom-bar__totals">
          <span>
            Backflush components:{" "}
            <span className="rfp-bottom-bar__total-val">{lines.length}</span>
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
          SAP will auto-issue these when the receipt is posted
        </span>
      </div>
    </div>
  );
}
