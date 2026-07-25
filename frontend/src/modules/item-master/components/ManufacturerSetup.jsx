import React, { useState } from "react";
import { createManufacturer } from "../../../api/itemApi";

export default function ManufacturerSetup({ onClose, onSave, showAlert }) {
  const [manufacturerName, setManufacturerName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!manufacturerName.trim()) {
      showAlert("error", "Manufacturer Name is required.");
      return;
    }

    setLoading(true);
    try {
      const result = await createManufacturer({ ManufacturerName: manufacturerName.trim() });
      showAlert("success", `Manufacturer "${result.name}" created.`);
      onSave(result);
      onClose();
    } catch (err) {
      console.error('[Setup] Error creating manufacturer:', err);
      // Try to get the error message from various possible response structures
      const errorMsg = err.response?.data?.message 
        || err.response?.data?.error?.message?.value 
        || (typeof err.response?.data === 'string' ? err.response.data : null)
        || err.message 
        || "Failed to create Manufacturer.";
      showAlert("error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="im-modal-overlay" onClick={onClose}>
      <div className="im-modal im-modal--setup" onClick={(e) => e.stopPropagation()}>
        <div className="im-modal__header">
          <span>Manufacturers - Setup</span>
          <button className="im-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="im-modal__body">
          <table className="im-grid" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Manufacturer Name</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>- No Manufacturer -</td>
              </tr>
              <tr>
                <td>2</td>
                <td>
                  <input
                    className="im-field__input"
                    style={{ width: "100%", background: "#FFFFCC" }}
                    value={manufacturerName}
                    onChange={(e) => setManufacturerName(e.target.value)}
                    autoFocus
                    placeholder="Enter new manufacturer name"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="im-modal__footer" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="im-btn" onClick={onClose}>Cancel</button>
          <button className="im-btn im-btn--primary" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
