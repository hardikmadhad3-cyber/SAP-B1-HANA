import React from "react";

/**
 * InstallmentsTab — manages the PaymentTermsInstallments collection.
 *
 * SAP B1 PaymentTermsTypes installment line fields (exact Service Layer names):
 *   InstallmentNumber  — integer (1-based, read-only display)
 *   Percent            — decimal — % of total due on this installment
 *   NumberOfAdditionalMonths — integer
 *   NumberOfAdditionalDays   — integer
 *   BaselineDate       — BoBaselineDate enum
 *   StartFrom          — BoPaymentTermsStartFrom enum
 */

const EMPTY_LINE = {
  Percent:                  "",
  NumberOfAdditionalMonths: "0",
  NumberOfAdditionalDays:   "0",
  BaselineDate:             "bld_PostingDate",
  StartFrom:                "ptsf_DayOfMonth",
};

export default function InstallmentsTab({ form, setForm }) {
  const lines = form.PaymentTermsInstallments || [];

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      PaymentTermsInstallments: [...lines, { ...EMPTY_LINE }],
    }));
  };

  const removeLine = (idx) => {
    setForm((prev) => ({
      ...prev,
      PaymentTermsInstallments: lines.filter((_, i) => i !== idx),
    }));
  };

  const updateLine = (idx, field, value) => {
    setForm((prev) => ({
      ...prev,
      PaymentTermsInstallments: prev.PaymentTermsInstallments.map((l, i) =>
        i === idx ? { ...l, [field]: value } : l
      ),
    }));
  };

  // Running total of percentages
  const totalPct = lines.reduce((sum, l) => sum + (Number(l.Percent) || 0), 0);

  return (
    <div>
      <div className="im-section-title">
        Installments
        <button
          type="button"
          className="im-btn"
          style={{ marginLeft: 12, padding: "2px 10px", fontSize: 11 }}
          onClick={addLine}
        >
          + Add Row
        </button>
      </div>

      {lines.length === 0 ? (
        <div className="im-tab-placeholder">
          No installments defined. Click "+ Add Row" to add one.
        </div>
      ) : (
        <div className="im-grid-wrap">
          <table className="im-grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Percent %</th>
                <th>Add. Months</th>
                <th>Add. Days</th>
                <th>Baseline Date</th>
                <th>Start From</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="im-grid__cell--muted" style={{ width: 32, textAlign: "center" }}>
                    {idx + 1}
                  </td>

                  {/* Percent */}
                  <td style={{ width: 100 }}>
                    <input
                      className="im-grid__input"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={line.Percent}
                      onChange={(e) => updateLine(idx, "Percent", e.target.value)}
                    />
                  </td>

                  {/* NumberOfAdditionalMonths */}
                  <td style={{ width: 90 }}>
                    <input
                      className="im-grid__input"
                      type="number"
                      min="0"
                      value={line.NumberOfAdditionalMonths}
                      onChange={(e) => updateLine(idx, "NumberOfAdditionalMonths", e.target.value)}
                    />
                  </td>

                  {/* NumberOfAdditionalDays */}
                  <td style={{ width: 90 }}>
                    <input
                      className="im-grid__input"
                      type="number"
                      min="0"
                      value={line.NumberOfAdditionalDays}
                      onChange={(e) => updateLine(idx, "NumberOfAdditionalDays", e.target.value)}
                    />
                  </td>

                  {/* BaselineDate: BoBaselineDate */}
                  <td style={{ minWidth: 130 }}>
                    <select
                      className="im-field__select"
                      style={{ width: "100%", height: 22 }}
                      value={line.BaselineDate || "bld_PostingDate"}
                      onChange={(e) => updateLine(idx, "BaselineDate", e.target.value)}
                    >
                      <option value="bld_PostingDate">Posting Date</option>
                      <option value="bld_SystemDate">System Date</option>
                      <option value="bld_DueDate">Due Date</option>
                    </select>
                  </td>

                  {/* StartFrom: BoPaymentTermsStartFrom */}
                  <td style={{ minWidth: 130 }}>
                    <select
                      className="im-field__select"
                      style={{ width: "100%", height: 22 }}
                      value={line.StartFrom || "ptsf_DayOfMonth"}
                      onChange={(e) => updateLine(idx, "StartFrom", e.target.value)}
                    >
                      <option value="ptsf_DayOfMonth">Day of Month</option>
                      <option value="ptsf_HalfMonth">Half Month</option>
                      <option value="ptsf_MonthEnd">Month End</option>
                    </select>
                  </td>

                  <td style={{ width: 32, textAlign: "center" }}>
                    <button
                      type="button"
                      className="im-btn im-btn--danger"
                      style={{ padding: "1px 7px", fontSize: 11 }}
                      onClick={() => removeLine(idx)}
                      title="Remove row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="im-grid__total">
                <td colSpan={2} className={`im-grid__cell--num ${totalPct === 100 ? "im-grid__cell--pos" : "im-grid__cell--neg"}`}>
                  Total: {totalPct.toFixed(2)}%
                  {totalPct !== 100 && totalPct > 0 && (
                    <span style={{ marginLeft: 8, fontWeight: "normal", fontSize: 11 }}>
                      (must equal 100%)
                    </span>
                  )}
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
