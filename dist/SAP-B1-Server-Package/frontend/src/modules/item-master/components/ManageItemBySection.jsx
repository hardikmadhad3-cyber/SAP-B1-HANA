import React from "react";

const ManageItemBySection = ({ form, onChange }) => {
  const manageItemBy = form.ManageItemBy || "None";

  const handleManageItemByChange = (e) => {
    const newValue = e.target.value;

    onChange({ target: { name: "ManageItemBy", value: newValue } });
    onChange({
      target: {
        name: "ManageSerialNumbers",
        value: newValue === "Serial" ? "tYES" : "tNO",
      },
    });
    onChange({
      target: {
        name: "ManageBatchNumbers",
        value: newValue === "Batch" ? "tYES" : "tNO",
      },
    });
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <div className="im-field">
        <label className="im-field__label" style={{ textDecoration: "underline" }}>
          Serial and Batch Numbers
        </label>
      </div>
      <div className="im-field">
        <label className="im-field__label">Manage Item by</label>
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

      {manageItemBy !== "None" && (
        <div className="im-field">
          <label className="im-field__label">Management Method</label>
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
      )}

      {manageItemBy === "Batch" && (
        <>
          <div style={{ marginTop: "130px" }}>
            <label className="im-checkbox-label">
              <input
                type="checkbox"
                name="BlockMultipleReceiptsForSameBatch"
                checked={form.BlockMultipleReceiptsForSameBatch === "tYES"}
                onChange={onChange}
              />
              Block Multiple Receipts for Same Batch
            </label>
          </div>

          <div className="im-field">
            <label className="im-field__label">Issue Primarily By</label>
            <select
              className="im-field__select"
              name="IssuePrimarilyBy"
              value={form.IssuePrimarilyBy || "ipbSerialAndBatchNumbers"}
              onChange={onChange}
            >
              <option value="ipbSerialAndBatchNumbers">Serial and Batch Numbers</option>
              <option value="ipbBinLocations">Bin Locations</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
};

export default ManageItemBySection;
