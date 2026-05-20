import React from "react";

/**
 * DetailsTab — read-only summary of the price list configuration.
 * In SAP B1, individual item prices within a price list are managed
 * via the Items entity (ItemPrices collection), not directly on PriceLists.
 * This tab surfaces the key computed/display fields returned by SAP.
 */
export default function DetailsTab({ form }) {
  const roField = (label, value) => (
    <div className="im-field" key={label}>
      <label className="im-field__label">{label}</label>
      <input
        className="im-field__input"
        value={value ?? ""}
        readOnly
        tabIndex={-1}
        style={{ background: "#f0f2f5", color: "#555" }}
      />
    </div>
  );

  return (
    <div>
      <div className="im-section-title">Price List Summary</div>
      <div className="im-field-grid">
        {roField("Price List No.",  form.PriceListNo)}
        {roField("Price List Name", form.PriceListName)}
        {roField("Currency",        form.PriceListCurrency)}
        {roField("Base Price List", form.BasePriceListName || form.BasePriceList)}
        {roField("Factor",          form.Factor)}
        {roField("Rounding Method", form.RoundingMethod)}
        {roField("Gross Price",     form.IsGrossPrice === "tYES" ? "Yes" : "No")}
        {roField("Active",          form.Active === "tYES" ? "Yes" : "No")}
        {roField("Valid From",      form.ValidFrom)}
        {roField("Valid To",        form.ValidTo)}
      </div>

      <div className="im-section-title" style={{ marginTop: 14 }}>Note</div>
      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
        Item-level prices for this price list are managed through the Item Master Data
        (Purchasing / Sales tabs → Price List). Use the Item Master to set or update
        individual item prices per price list.
      </div>
    </div>
  );
}
