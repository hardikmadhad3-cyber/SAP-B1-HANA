import React from "react";

const ISSUE_METHODS = [
  { value: "im_Manual", label: "Manual" },
  { value: "im_Backflush", label: "Backflush" },
];

const COMPONENT_TYPES = [
  { value: "pit_Item", label: "Item" },
  { value: "pit_Resource", label: "Resource" },
  { value: "pit_Text", label: "Text" },
];

export default function ProductionOrderLines({
  lines, warehouses, distRules, projects, routeStages,
  readOnly, onChange, onAdd, onDelete, onItemSearch,
}) {
  const EMPTY_ROWS = 8;

  return (
    <div className="po-lines-wrap">
      <div className="po-grid-scroll">
        <table className="po-grid">
          <thead>
            <tr>
              <th className="po-th po-th--rownum">#</th>
              <th className="po-th po-th--type">Type</th>
              <th className="po-th po-th--no">No.</th>
              <th className="po-th po-th--desc">Description</th>
              <th className="po-th po-th--baseqty">Base Qty</th>
              <th className="po-th po-th--baseratio">Base Ratio</th>
              <th className="po-th po-th--planqty">Planned Qty</th>
              <th className="po-th po-th--issued">Issued</th>
              <th className="po-th po-th--available">Available</th>
              <th className="po-th po-th--uom">UoM Code</th>
              <th className="po-th po-th--uomname">UoM Name</th>
              <th className="po-th po-th--wh">Warehouse</th>
              <th className="po-th po-th--issue">Issue Method</th>
              <th className="po-th po-th--wip">WIP Account</th>
              <th className="po-th po-th--dr">Distr. Rule</th>
              <th className="po-th po-th--location">Location</th>
              <th className="po-th po-th--proj">Project</th>
              <th className="po-th po-th--addqty">Add. Qty</th>
              <th className="po-th po-th--route">Route Sequence</th>
              <th className="po-th po-th--procure">Procurement</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const isText = line.component_type === "pit_Text";
              const isResource = line.component_type === "pit_Resource";

              return (
                <tr key={line._id} className="po-grid__row">
                  <td className="po-grid__cell po-grid__cell--readonly po-grid__cell--num">{idx + 1}</td>

                  <td className="po-grid__cell">
                    <select
                      className="po-cell-select"
                      value={line.component_type}
                      disabled={readOnly}
                      onChange={(e) => onChange(line._id, "component_type", e.target.value)}
                    >
                      {COMPONENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </td>

                  <td className="po-grid__cell">
                    {isText ? (
                      <input className="po-cell-input" value="" readOnly placeholder="Text row" />
                    ) : (
                      <div className="po-cell-lookup">
                        <input
                          className="po-cell-input"
                          value={line.item_code}
                          readOnly={readOnly}
                          onChange={(e) => onChange(line._id, "item_code", e.target.value)}
                          placeholder={isResource ? "Resource Code" : "Item Code"}
                        />
                        {!readOnly && (
                          <button
                            type="button"
                            className="im-lookup-btn"
                            tabIndex={-1}
                            onClick={() => onItemSearch(line._id)}
                          >
                            …
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input"
                      value={isText ? (line.line_text || line.item_name) : line.item_name}
                      readOnly={readOnly}
                      onChange={(e) => onChange(line._id, isText ? "line_text" : "item_name", e.target.value)}
                      placeholder={isText ? "Enter text" : ""}
                    />
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input po-cell-input--num"
                      type="number"
                      min="0"
                      step="any"
                      value={line.base_qty}
                      readOnly={readOnly}
                      onChange={(e) => onChange(line._id, "base_qty", e.target.value)}
                    />
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input po-cell-input--num"
                      type="number"
                      min="0"
                      step="any"
                      value={line.base_ratio ?? line.base_qty ?? 1}
                      readOnly={readOnly}
                      onChange={(e) => onChange(line._id, "base_ratio", e.target.value)}
                    />
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input po-cell-input--num"
                      type="number"
                      min="0"
                      step="any"
                      value={line.planned_qty}
                      readOnly={readOnly}
                      onChange={(e) => onChange(line._id, "planned_qty", e.target.value)}
                    />
                  </td>

                  <td className="po-grid__cell po-grid__cell--readonly po-grid__cell--num">
                    {Number(line.issued_qty || 0).toFixed(2)}
                  </td>

                  <td className="po-grid__cell po-grid__cell--readonly po-grid__cell--num">
                    {Number(line.available_qty || 0).toFixed(2)}
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input"
                      value={line.uom_code || line.uom || ""}
                      readOnly={readOnly || isText}
                      onChange={(e) => {
                        onChange(line._id, "uom_code", e.target.value);
                        onChange(line._id, "uom", e.target.value);
                      }}
                    />
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input"
                      value={line.uom_name || line.uom || ""}
                      readOnly={readOnly || isText}
                      onChange={(e) => onChange(line._id, "uom_name", e.target.value)}
                    />
                  </td>

                  <td className="po-grid__cell">
                    <select
                      className="po-cell-select"
                      value={line.warehouse}
                      disabled={readOnly || isText}
                      onChange={(e) => onChange(line._id, "warehouse", e.target.value)}
                    >
                      <option value="">--</option>
                      {warehouses.map((w) => (
                        <option key={w.WarehouseCode} value={w.WarehouseCode}>{w.WarehouseCode}</option>
                      ))}
                    </select>
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input"
                      value={line.wip_account || ""}
                      readOnly={readOnly || isText}
                      onChange={(e) => onChange(line._id, "wip_account", e.target.value)}
                    />
                  </td>

                  <td className="po-grid__cell">
                    <select
                      className="po-cell-select"
                      value={line.issue_method}
                      disabled={readOnly || isText}
                      onChange={(e) => onChange(line._id, "issue_method", e.target.value)}
                    >
                      {ISSUE_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input"
                      value={line.location || ""}
                      readOnly={readOnly || isText}
                      onChange={(e) => onChange(line._id, "location", e.target.value)}
                    />
                  </td>

                  <td className="po-grid__cell">
                    <select
                      className="po-cell-select"
                      value={line.distribution_rule}
                      disabled={readOnly || isText}
                      onChange={(e) => onChange(line._id, "distribution_rule", e.target.value)}
                    >
                      <option value="">--</option>
                      {distRules.map((d) => (
                        <option key={d.FactorCode} value={d.FactorCode}>{d.FactorCode}</option>
                      ))}
                    </select>
                  </td>

                  <td className="po-grid__cell">
                    <select
                      className="po-cell-select"
                      value={line.project}
                      disabled={readOnly || isText}
                      onChange={(e) => onChange(line._id, "project", e.target.value)}
                    >
                      <option value="">--</option>
                      {projects.map((p) => (
                        <option key={p.Code} value={p.Code}>{p.Code}</option>
                      ))}
                    </select>
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input po-cell-input--num"
                      type="number"
                      min="0"
                      step="any"
                      value={line.additional_qty}
                      readOnly={readOnly}
                      onChange={(e) => onChange(line._id, "additional_qty", e.target.value)}
                    />
                  </td>

                  <td className="po-grid__cell">
                    <select
                      className="po-cell-select"
                      value={line.route_sequence || line.stage_id || ""}
                      disabled={readOnly}
                      onChange={(e) => {
                        onChange(line._id, "route_sequence", e.target.value);
                        onChange(line._id, "stage_id", e.target.value);
                      }}
                    >
                      <option value="">--</option>
                      {routeStages.map((stage) => (
                        <option key={stage.InternalNumber} value={stage.InternalNumber}>
                          {stage.Code} - {stage.Description}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="po-grid__cell">
                    <input
                      className="po-cell-input"
                      value={line.procurement_method || ""}
                      readOnly={readOnly || isText}
                      onChange={(e) => onChange(line._id, "procurement_method", e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}

            {lines.length < EMPTY_ROWS && Array.from({ length: EMPTY_ROWS - lines.length }).map((_, i) => (
              <tr key={`e-${i}`} className="po-grid__row po-grid__row--empty">
                {Array.from({ length: 20 }).map((__, j) => (
                  <td key={j} className="po-grid__cell po-grid__cell--empty" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="po-row-btns">
          <button type="button" className="po-row-btn" onClick={onAdd} title="Add row">+</button>
          <button
            type="button"
            className="po-row-btn po-row-btn--del"
            onClick={() => { const last = lines[lines.length - 1]; if (last) onDelete(last._id); }}
            title="Remove last row"
          >
            −
          </button>
        </div>
      )}
    </div>
  );
}
