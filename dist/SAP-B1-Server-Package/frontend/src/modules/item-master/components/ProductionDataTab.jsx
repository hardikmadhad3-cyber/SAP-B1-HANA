import React from "react";

export default function ProductionDataTab({ form, onChange }) {
  return (
    <div>
      <div className="im-field-grid im-field-grid--narrow">

        <div className="im-field">
          <label className="im-field__label">BOM Type</label>
          <select className="im-field__select" name="TreeType" value={form.TreeType || "iNotATree"} onChange={onChange}>
            <option value="iNotATree">No BOM</option>
            <option value="iAssemblyTree">Assembly</option>
            <option value="iProductionTree">Production</option>
            <option value="iSalesTree">Sales</option>
            <option value="iTemplateTree">Template</option>
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">No. of Item Components</label>
          <input
            className="im-field__input im-field__input--readonly"
            value={form.NoOfItemComponents ?? 0}
            readOnly
            tabIndex={-1}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">No. of Resource Components</label>
          <input
            className="im-field__input im-field__input--readonly"
            value={form.NoOfResourceComponents ?? 0}
            readOnly
            tabIndex={-1}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">No. of Route Stages</label>
          <input
            className="im-field__input im-field__input--readonly"
            value={form.NoOfRouteStages ?? 0}
            readOnly
            tabIndex={-1}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Production Std Cost</label>
          <input
            className="im-field__input"
            name="ProdStdCost"
            type="number"
            value={form.ProdStdCost || ""}
            onChange={onChange}
          />
        </div>

        <div className="im-field">
          <label className="im-field__label" style={{ flex: "0 0 200px" }}>
            Include in Production Std Cost Rollup
          </label>
          <input
            type="checkbox"
            name="InCostRollup"
            checked={form.InCostRollup === "tYES"}
            onChange={onChange}
            style={{ marginTop: 2 }}
          />
        </div>

      </div>
    </div>
  );
}
