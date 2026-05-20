import React from "react";
import LookupField from "./LookupField";

const fmt = (v) =>
  v == null || v === ""
    ? ""
    : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InventoryTab({ form, onChange, stock = [], onWarehouseChange, fetchWarehouses }) {
  return (
    <div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Set G/L Accounts By</label>
          <select className="im-field__select" name="GLMethod" value={form.GLMethod || "glm_WH"} onChange={onChange}>
            <option value="glm_ItemClass">Item Class</option>
            <option value="glm_ItemLevel">Item Level</option>
            <option value="glm_WH">Item Group</option>
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">UoM Name</label>
          <input className="im-field__input" name="InventoryUOM" value={form.InventoryUOM || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Weight</label>
          <input className="im-field__input" name="InventoryWeight" type="number" value={form.InventoryWeight || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Valuation Method</label>
          <select className="im-field__select" name="CostAccountingMethod" value={form.CostAccountingMethod || ""} onChange={onChange}>
            <option value="">Use Item Group Default</option>
            <option value="bis_MovingAverage">Moving Average</option>
            <option value="bis_Standard">Standard</option>
            <option value="bis_FIFO">FIFO</option>
            <option value="bis_SNB">Serial / Batch</option>
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Item Cost</label>
          <input className="im-field__input" name="AvgStdPrice" type="number" value={form.AvgStdPrice || ""} readOnly
            style={{ background: "#f0f2f5", color: "#555" }} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Default Warehouse <span style={{ color: "#d13438" }}>*</span></label>
          <LookupField
            name="DefaultWarehouse"
            value={form.DefaultWarehouse || ""}
            onChange={onChange}
            onSelect={(row) => {
              onChange({ target: { name: "DefaultWarehouse", value: row.code } });
            }}
            fetchOptions={fetchWarehouses}
            placeholder="Click ... to select warehouse"
          />
        </div>

      </div>

      {/* Inventory Level + Manage by Warehouse */}
      <div style={{ display: "flex", gap: 32, marginTop: 14, alignItems: "flex-start" }}>
        <div>
          <label className="im-checkbox-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              name="ManageStockByWarehouse"
              checked={form.ManageStockByWarehouse === "tYES"}
              onChange={onChange}
            />
            Manage Inventory by Warehouse
          </label>
        </div>
        <div>
          <div className="im-section-title" style={{ marginBottom: 6 }}>Inventory Level</div>
          <div className="im-field-grid">
            <div className="im-field">
              <label className="im-field__label">Required (Purchasing UoM)</label>
              <input className="im-field__input" name="DesiredInventory" type="number" value={form.DesiredInventory || ""} onChange={onChange} />
            </div>
            <div className="im-field">
              <label className="im-field__label">Minimum</label>
              <input className="im-field__input" name="MinInventory" type="number" value={form.MinInventory || ""} onChange={onChange} />
            </div>
            <div className="im-field">
              <label className="im-field__label">Maximum</label>
              <input className="im-field__input" name="MaxInventory" type="number" value={form.MaxInventory || ""} onChange={onChange} />
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse table */}
      <div className="im-section-title" style={{ marginTop: 14 }}>Warehouse Stock</div>
      <div className="im-grid-wrap">
        <table className="im-grid">
          <thead>
            <tr>
              <th>#</th>
              <th>Whse Code</th>
              <th>Whse Name</th>
              <th>Branch</th>
              <th>Locked</th>
              <th className="im-grid__cell--num">In Stock</th>
              <th className="im-grid__cell--num">Committed</th>
              <th className="im-grid__cell--num">Ordered</th>
              <th className="im-grid__cell--num">Available</th>
              <th className="im-grid__cell--num">Min. Inventory</th>
              <th className="im-grid__cell--num">Max. Inventory</th>
              <th className="im-grid__cell--num">Req. Inv. Level</th>
              <th className="im-grid__cell--num">Item Cost</th>
            </tr>
          </thead>
          <tbody>
            {stock.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: "center", color: "#aaa", padding: 16 }}>
                  No warehouse data
                </td>
              </tr>
            ) : (
              stock.map((row, i) => {
                const available = (Number(row.InStock || 0) - Number(row.Committed || 0) + Number(row.Ordered || 0));
                return (
                  <tr key={row.WarehouseCode || i}>
                    <td>{i + 1}</td>
                    <td><strong>{row.WarehouseCode}</strong></td>
                    <td>{row.WarehouseName || ""}</td>
                    <td>{row.Branch || ""}</td>
                    <td>
                      <select style={{ fontSize: 11, height: 20 }} value={row.Locked || "tNO"}
                        onChange={(e) => onWarehouseChange && onWarehouseChange(i, "Locked", e.target.value)}>
                        <option value="tNO">No</option>
                        <option value="tYES">Yes</option>
                      </select>
                    </td>
                    <td className="im-grid__cell--num">{fmt(row.InStock)}</td>
                    <td className="im-grid__cell--num">{fmt(row.Committed)}</td>
                    <td className="im-grid__cell--num">{fmt(row.Ordered)}</td>
                    <td className="im-grid__cell--num">{fmt(available)}</td>
                    <td className="im-grid__cell--num">
                      <input className="im-grid__input" type="number" value={row.MinimalStock ?? ""}
                        onChange={(e) => onWarehouseChange && onWarehouseChange(i, "MinimalStock", e.target.value)} />
                    </td>
                    <td className="im-grid__cell--num">
                      <input className="im-grid__input" type="number" value={row.MaximalStock ?? ""}
                        onChange={(e) => onWarehouseChange && onWarehouseChange(i, "MaximalStock", e.target.value)} />
                    </td>
                    <td className="im-grid__cell--num">
                      <input className="im-grid__input" type="number" value={row.MinimalOrder ?? ""}
                        onChange={(e) => onWarehouseChange && onWarehouseChange(i, "MinimalOrder", e.target.value)} />
                    </td>
                    <td className="im-grid__cell--num">{fmt(row.StandardAveragePrice)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, textAlign: "right" }}>
        <button type="button" className="im-btn">Set Default Whse</button>
      </div>
    </div>
  );
}
