import React, { useState } from "react";
import PriceListLookupModal from "./PriceListLookupModal";

export default function RatesSection({ form, onChange, onFieldChange }) {
  const [showPriceListModal, setShowPriceListModal] = useState(false);

  const handlePriceListSelect = (priceList) => {
    onFieldChange("PriceListId", priceList.PriceListNo);
    onFieldChange("PriceListName", priceList.PriceListName);
    setShowPriceListModal(false);
  };

  return (
    <div className="pt-section">
      <div className="pt-section__title">Rates</div>
      <div className="pt-section__content">
        <div className="pt-field-row">
          <div className="pt-field">
            <label className="pt-field__label">Total Discount %</label>
            <input
              type="number"
              className="pt-field__input"
              name="TotalDiscountPercent"
              value={form.TotalDiscountPercent || 0}
              onChange={onChange}
              min="0"
              max="100"
              step="0.01"
            />
          </div>

          <div className="pt-field">
            <label className="pt-field__label">Interest % on Receivables</label>
            <input
              type="number"
              className="pt-field__input"
              name="InterestPercentReceivables"
              value={form.InterestPercentReceivables || 0}
              onChange={onChange}
              min="0"
              max="100"
              step="0.01"
            />
          </div>
        </div>

        <div className="pt-field-row">
          <div className="pt-field pt-field--lookup">
            <label className="pt-field__label">Price List</label>
            <div className="pt-field__lookup-group">
              <input
                className="pt-field__input"
                value={form.PriceListName || ""}
                readOnly
                placeholder="Select Price List"
              />
              <button
                type="button"
                className="pt-field__lookup-btn"
                onClick={() => setShowPriceListModal(true)}
              >
                ...
              </button>
            </div>
          </div>

          <div className="pt-field">
            <label className="pt-field__label">Max. Credit</label>
            <input
              type="number"
              className="pt-field__input"
              name="CreditLimit"
              value={form.CreditLimit || 0}
              onChange={onChange}
              min="0"
              step="0.01"
            />
          </div>

          <div className="pt-field">
            <label className="pt-field__label">Commitment Unit</label>
            <input
              type="number"
              className="pt-field__input"
              name="CommitmentUnit"
              value={form.CommitmentUnit || 0}
              onChange={onChange}
              min="0"
              step="0.01"
            />
          </div>
        </div>
      </div>

      {showPriceListModal && (
        <PriceListLookupModal
          onClose={() => setShowPriceListModal(false)}
          onSelect={handlePriceListSelect}
        />
      )}
    </div>
  );
}
