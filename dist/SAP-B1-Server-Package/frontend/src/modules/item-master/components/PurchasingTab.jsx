import React from "react";
import LookupField from "./LookupField";

const LENGTH_UNITS = [
  { value: "1", label: "mm" },
  { value: "2", label: "cm" },
  { value: "3", label: "m" },
  { value: "4", label: "in" },
  { value: "5", label: "ft" },
];

const VOLUME_UNITS = [
  { value: "1", label: "mL" },
  { value: "2", label: "cL" },
  { value: "3", label: "dL" },
  { value: "4", label: "L" },
  { value: "5", label: "m³" },
  { value: "6", label: "ft³" },
];

const WEIGHT_UNITS = [
  { value: "1", label: "g" },
  { value: "2", label: "kg" },
  { value: "3", label: "t" },
  { value: "4", label: "oz" },
  { value: "5", label: "lb" },
];

export default function PurchasingTab({ form, onChange, fetchVendors }) {
  const handleVendorSelect = (row) => {
    onChange({ target: { name: "Mainsupplier",      value: row.code } });
    onChange({ target: { name: "DefaultVendorName", value: row.name } });
  };

  return (
    <div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Preferred Vendor</label>
          <LookupField
            name="Mainsupplier"
            value={form.Mainsupplier || ""}
            displayValue={form.DefaultVendorName || ""}
            onChange={onChange}
            onSelect={handleVendorSelect}
            fetchOptions={fetchVendors}
            placeholder="Vendor"
          />
        </div>

        <div className="im-field">
          <label className="im-field__label">Mfr Catalog No.</label>
          <input className="im-field__input" name="SupplierCatalogNo" value={form.SupplierCatalogNo || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Purchasing UoM Name</label>
          <input className="im-field__input" name="PurchaseUnit" value={form.PurchaseUnit || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Items per Purchasing Unit</label>
          <input className="im-field__input" name="PurchaseItemsPerUnit" type="number" value={form.PurchaseItemsPerUnit || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Packaging UoM Name</label>
          <input className="im-field__input" name="PurchasePackagingUnit" value={form.PurchasePackagingUnit || ""} onChange={onChange} />
        </div>

        <div className="im-field">
          <label className="im-field__label">Quantity per Package</label>
          <input className="im-field__input" name="PurchaseQtyPerPackUnit" type="number" value={form.PurchaseQtyPerPackUnit || ""} onChange={onChange} />
        </div>

      </div>

      {/* Dimensions */}
      <div className="im-section-title" style={{ marginTop: 14 }}>Dimensions</div>
      <div className="im-field-grid">

        <div className="im-field">
          <label className="im-field__label">Length</label>
          <input className="im-field__input" name="PurchaseUnitLength" type="number" value={form.PurchaseUnitLength || ""} onChange={onChange} style={{ flex: "0 0 80px" }} />
          <select className="im-field__select" name="PurchaseLengthUnit" value={form.PurchaseLengthUnit || "3"} onChange={onChange} style={{ flex: "0 0 60px" }}>
            {LENGTH_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Width</label>
          <input className="im-field__input" name="PurchaseUnitWidth" type="number" value={form.PurchaseUnitWidth || ""} onChange={onChange} style={{ flex: "0 0 80px" }} />
          <select className="im-field__select" name="PurchaseWidthUnit" value={form.PurchaseWidthUnit || "3"} onChange={onChange} style={{ flex: "0 0 60px" }}>
            {LENGTH_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Height</label>
          <input className="im-field__input" name="PurchaseUnitHeight" type="number" value={form.PurchaseUnitHeight || ""} onChange={onChange} style={{ flex: "0 0 80px" }} />
          <select className="im-field__select" name="PurchaseHeightUnit" value={form.PurchaseHeightUnit || "3"} onChange={onChange} style={{ flex: "0 0 60px" }}>
            {LENGTH_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Volume</label>
          <input className="im-field__input" name="PurchaseUnitVolume" type="number" value={form.PurchaseUnitVolume || ""} onChange={onChange} style={{ flex: "0 0 80px" }} />
          <select className="im-field__select" name="PurchaseVolumeUnit" value={form.PurchaseVolumeUnit || "4"} onChange={onChange} style={{ flex: "0 0 60px" }}>
            {VOLUME_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>

        <div className="im-field">
          <label className="im-field__label">Weight</label>
          <input className="im-field__input" name="PurchaseUnitWeight" type="number" value={form.PurchaseUnitWeight || ""} onChange={onChange} style={{ flex: "0 0 80px" }} />
          <select className="im-field__select" name="PurchaseWeightUnit" value={form.PurchaseWeightUnit || "2"} onChange={onChange} style={{ flex: "0 0 60px" }}>
            {WEIGHT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>

      </div>

      {/* Factors */}
      <div className="im-section-title" style={{ marginTop: 14 }}>Unit Conversion Factors</div>
      <div className="im-field-grid">
        {[1, 2, 3, 4].map((n) => (
          <div className="im-field" key={n}>
            <label className="im-field__label">Factor {n}</label>
            <input className="im-field__input" name={`PurchaseFactor${n}`} type="number" value={form[`PurchaseFactor${n}`] || ""} onChange={onChange} />
          </div>
        ))}
      </div>

      {/* Customs */}
      <div className="im-section-title" style={{ marginTop: 14 }}>Customs</div>
      <div className="im-field-grid">
        <div className="im-field">
          <label className="im-field__label">Customs Group</label>
          <input className="im-field__input" name="CustomsGroupCode" value={form.CustomsGroupCode || ""} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
