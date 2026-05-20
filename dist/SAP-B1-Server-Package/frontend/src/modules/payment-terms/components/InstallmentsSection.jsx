import React from "react";

export default function InstallmentsSection({ form, setForm }) {
  const installments = form.PaymentTermsInstallments || [];

  const handleAddRow = () => {
    setForm((prev) => ({
      ...prev,
      PaymentTermsInstallments: [
        ...prev.PaymentTermsInstallments,
        {
          InstallmentNumber: prev.PaymentTermsInstallments.length + 1,
          Percent: 0,
          NumberOfAdditionalMonths: 0,
          NumberOfAdditionalDays: 0,
          BaselineDate: prev.BaselineDate,
          StartFrom: prev.StartFrom,
        },
      ],
    }));
  };

  const handleDeleteRow = (index) => {
    setForm((prev) => ({
      ...prev,
      PaymentTermsInstallments: prev.PaymentTermsInstallments.filter((_, i) => i !== index),
    }));
  };

  const handleCellChange = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      PaymentTermsInstallments: prev.PaymentTermsInstallments.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    }));
  };

  const totalPercent = installments.reduce((sum, row) => sum + (Number(row.Percent) || 0), 0);

  return (
    <div className="pt-section">
      <div className="pt-section__title">Installments</div>
      <div className="pt-section__content">
        <div className="pt-grid-wrap">
          <table className="pt-grid">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>No.</th>
                <th style={{ width: "120px" }}>Percentage %</th>
                <th style={{ width: "120px" }}>Add. Months</th>
                <th style={{ width: "120px" }}>Add. Days</th>
                <th style={{ width: "60px" }}></th>
              </tr>
            </thead>
            <tbody>
              {installments.map((row, index) => (
                <tr key={index}>
                  <td className="pt-grid__cell--center">{index + 1}</td>
                  <td>
                    <input
                      type="number"
                      className="pt-grid__input"
                      value={row.Percent}
                      onChange={(e) => handleCellChange(index, "Percent", e.target.value)}
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="pt-grid__input"
                      value={row.NumberOfAdditionalMonths}
                      onChange={(e) => handleCellChange(index, "NumberOfAdditionalMonths", e.target.value)}
                      min="0"
                      max="36"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="pt-grid__input"
                      value={row.NumberOfAdditionalDays}
                      onChange={(e) => handleCellChange(index, "NumberOfAdditionalDays", e.target.value)}
                      min="-365"
                      max="365"
                    />
                  </td>
                  <td className="pt-grid__cell--center">
                    <button
                      type="button"
                      className="pt-grid__delete-btn"
                      onClick={() => handleDeleteRow(index)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-grid-actions">
          <button type="button" className="pt-btn pt-btn--small" onClick={handleAddRow}>
            Add Row
          </button>
          <span className="pt-grid-total">
            Total: {totalPercent.toFixed(2)}% {totalPercent !== 100 && <span style={{ color: "#c00" }}>(Must equal 100%)</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
