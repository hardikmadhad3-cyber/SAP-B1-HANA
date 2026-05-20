import React from "react";

const ManageItemBySection = ({ form, onChange, mode }) => {
  const manageItemBy = form.ManageItemBy || "None";

  const handleManageItemByChange = (e) => {
    const newValue = e.target.value;
    
    onChange({
      target: {
        name: "ManageItemBy",
        value: newValue,
      },
    });
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <div className="im-field">
        <label className="im-field__label" style={{ textDecoration: "underline" }}>
          Item Management Method
        </label>
      </div>
      <div className="im-field">
        <label className="im-field__label">
          Manage Item By <span style={{ color: "#d13438" }}>*</span>
        </label>
        <select
          className="im-field__select"
          name="ManageItemBy"
          value={manageItemBy}
          onChange={handleManageItemByChange}
        >
          <option value="None">None</option>
          <option value="Serial">Serial Numbers</option>
          <option value="Batch">Batch Numbers</option>
        </select>
      </div>

      {/* Serial Number Fields */}
      {manageItemBy === "Serial" && (
        <div style={{ marginTop: "10px" }}>
          <div className="im-field">
            <label className="im-field__label">
              Serial Number Generation <span style={{ color: "#d13438" }}>*</span>
            </label>
            <select
              className="im-field__select"
              name="SerialGenerationType"
              value={form.SerialGenerationType || "Manual"}
              onChange={onChange}
            >
              <option value="Manual">Manual</option>
              <option value="Auto">Automatic</option>
            </select>
          </div>

          {form.SerialGenerationType === "Auto" && (
            <>
              <div className="im-field">
                <label className="im-field__label">
                  Serial Number Length <span style={{ color: "#d13438" }}>*</span>
                </label>
                <input
                  type="number"
                  className="im-field__input"
                  name="SerialNumberLength"
                  value={form.SerialNumberLength || ""}
                  onChange={onChange}
                  min="1"
                  max="20"
                  placeholder="e.g., 10"
                />
                <span style={{ fontSize: "11px", color: "#666", fontStyle: "italic", display: "block", marginTop: "4px" }}>
                  Number of digits in serial number
                </span>
              </div>

              <div className="im-field">
                <label className="im-field__label">
                  Starting Serial Number <span style={{ color: "#d13438" }}>*</span>
                </label>
                <input
                  type="text"
                  className="im-field__input"
                  name="StartingSerialNumber"
                  value={form.StartingSerialNumber || ""}
                  onChange={onChange}
                  placeholder="e.g., 1000"
                />
                <span style={{ fontSize: "11px", color: "#666", fontStyle: "italic", display: "block", marginTop: "4px" }}>
                  First serial number to generate
                </span>
              </div>
            </>
          )}

          <div className="im-field">
            <label className="im-field__label">Serial Tracking Method</label>
            <select
              className="im-field__select"
              name="SerialTrackingMethod"
              value={form.SerialTrackingMethod || "OnEveryTransaction"}
              onChange={onChange}
            >
              <option value="OnEveryTransaction">On Every Transaction</option>
              <option value="OnReleaseOnly">On Release Only</option>
            </select>
          </div>

          <div style={{ marginTop: "10px", marginLeft: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <input
                type="checkbox"
                name="ForceSelectionOfSerialNumber"
                checked={form.ForceSelectionOfSerialNumber === "tYES"}
                onChange={onChange}
              />
              Force Selection of Serial Number
            </label>

            {form.SerialTrackingMethod === "OnReleaseOnly" && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <input
                    type="checkbox"
                    name="ManageSerialNumbersOnReleaseOnly"
                    checked={form.ManageSerialNumbersOnReleaseOnly === "tYES"}
                    onChange={onChange}
                  />
                  Manage Serial Numbers on Release Only
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <input
                    type="checkbox"
                    name="AutoCreateSerialNumbersOnRelease"
                    checked={form.AutoCreateSerialNumbersOnRelease === "tYES"}
                    onChange={onChange}
                  />
                  Auto Create Serial Numbers on Release
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {/* Batch Number Fields */}
      {manageItemBy === "Batch" && (
        <div style={{ marginTop: "10px" }}>
          <div className="im-field">
            <label className="im-field__label">
              Batch Number Generation <span style={{ color: "#d13438" }}>*</span>
            </label>
            <select
              className="im-field__select"
              name="BatchGenerationType"
              value={form.BatchGenerationType || "Manual"}
              onChange={onChange}
            >
              <option value="Manual">Manual</option>
              <option value="Auto">Automatic</option>
            </select>
          </div>

          {form.BatchGenerationType === "Auto" && (
            <div className="im-field">
              <label className="im-field__label">
                Batch Number Prefix <span style={{ color: "#d13438" }}>*</span>
              </label>
              <input
                type="text"
                className="im-field__input"
                name="BatchNumberPrefix"
                value={form.BatchNumberPrefix || ""}
                onChange={onChange}
                placeholder="e.g., BATCH"
                maxLength="10"
              />
              <span style={{ fontSize: "11px", color: "#666", fontStyle: "italic", display: "block", marginTop: "4px" }}>
                Prefix for auto-generated batch numbers
              </span>
            </div>
          )}

          <div style={{ marginTop: "10px", marginLeft: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <input
                type="checkbox"
                name="BatchExpiryRequired"
                checked={form.BatchExpiryRequired === "tYES"}
                onChange={onChange}
              />
              Batch Expiry Required
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <input
                type="checkbox"
                name="BatchQuantityValidation"
                checked={form.BatchQuantityValidation === "tYES"}
                onChange={onChange}
              />
              Batch Quantity Validation
            </label>
          </div>

          <div className="im-field">
            <label className="im-field__label">Batch Management Method</label>
            <select
              className="im-field__select"
              name="SRIAndBatchManageMethod"
              value={form.SRIAndBatchManageMethod || "bomm_OnEveryTransaction"}
              onChange={onChange}
            >
              <option value="bomm_OnEveryTransaction">On Every Transaction</option>
              <option value="bomm_OnReleaseOnly">On Release Only</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageItemBySection;
