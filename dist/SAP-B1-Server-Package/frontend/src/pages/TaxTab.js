import React from "react";

function TaxTab({ form, setForm }) {

  return (
    <div>
      <h3>GST Details</h3>

      <select
        onChange={(e) =>
          setForm({
            ...form,
            TaxExtension: {
              ...form.TaxExtension,
              GSTTransactionType: e.target.value
            }
          })
        }
      >
        <option value="">Select GST Type</option>
        <option value="gstRegular">Regular</option>
        <option value="gstExport">Export</option>
      </select>

      <input
        placeholder="GSTIN"
        onChange={(e) =>
          setForm({
            ...form,
            TaxExtension: {
              ...form.TaxExtension,
              GSTIN: e.target.value
            }
          })
        }
      />
    </div>
  );
}

export default TaxTab;