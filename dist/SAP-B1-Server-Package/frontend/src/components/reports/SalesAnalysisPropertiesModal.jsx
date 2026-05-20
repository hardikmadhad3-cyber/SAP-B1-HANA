import React from "react";
import "../../modules/item-master/styles/itemMaster.css";

export default function SalesAnalysisPropertiesModal({
  open,
  title,
  mode,
  properties,
  options,
  onModeChange,
  onToggleProperty,
  onClose,
  onApply,
}) {
  if (!open) return null;

  return (
    <div className="im-modal-overlay" onClick={onClose}>
      <div className="im-modal" style={{ width: "min(680px, calc(100vw - 40px))" }} onClick={(event) => event.stopPropagation()}>
        <div className="im-modal__header">
          <span>{title}</span>
          <button type="button" className="im-modal__close" onClick={onClose}>x</button>
        </div>
        <div className="im-modal__body">
          <div className="sar-radio-stack">
            {["Ignore", "Include selected", "Exclude selected"].map((option) => (
              <label key={option} className="im-checkbox-label">
                <input
                  type="radio"
                  name="propertiesMode"
                  checked={mode === option}
                  onChange={() => onModeChange(option)}
                />
                {option}
              </label>
            ))}
          </div>

          <div className="sar-properties-grid">
            {options.map((option) => (
              <label key={option.number} className="im-checkbox-label">
                <input
                  type="checkbox"
                  checked={properties.includes(option.number)}
                  disabled={mode === "Ignore"}
                  onChange={() => onToggleProperty(option.number)}
                />
                {option.name}
              </label>
            ))}
          </div>
        </div>
        <div className="im-modal__footer">
          <button type="button" className="im-btn im-btn--primary" onClick={onApply}>OK</button>
          <button type="button" className="im-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
