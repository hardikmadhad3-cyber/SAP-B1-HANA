import React, { useState, useEffect } from "react";
import { fetchCashDiscounts } from "../../../api/paymentTermsApi";

export default function PaymentConditionsSection({ form, onChange, onFieldChange }) {
  const [cashDiscounts, setCashDiscounts] = useState([]);

  useEffect(() => {
    loadCashDiscounts();
  }, []);

  const loadCashDiscounts = async () => {
    try {
      const data = await fetchCashDiscounts();
      setCashDiscounts(data);
    } catch (err) {
      console.error("Failed to load cash discounts:", err);
    }
  };

  return (
    <div className="pt-section">
      <div className="pt-section__title">Payment Conditions</div>
      <div className="pt-section__content">
        <div className="pt-field-row">
          <div className="pt-field pt-field--checkbox">
            <input
              type="checkbox"
              id="openIncomingPayment"
              name="OpenIncomingPaymentsByDueDate"
              checked={form.OpenIncomingPaymentsByDueDate === "tYES"}
              onChange={onChange}
            />
            <label htmlFor="openIncomingPayment">Open Incoming Payment</label>
          </div>
        </div>

        <div className="pt-field-row">
          <div className="pt-field">
            <label className="pt-field__label">Cash Discount</label>
            <select
              className="pt-field__select"
              name="DiscountCode"
              value={form.DiscountCode}
              onChange={onChange}
            >
              <option value="">-- Select --</option>
              {cashDiscounts.map((cd) => (
                <option key={cd.code} value={cd.code}>
                  {cd.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-field">
            <label className="pt-field__label">Cash Discount %</label>
            <input
              type="number"
              className="pt-field__input"
              name="CashDiscountPercent"
              value={form.CashDiscountPercent}
              onChange={onChange}
              min="0"
              max="100"
              step="0.01"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
