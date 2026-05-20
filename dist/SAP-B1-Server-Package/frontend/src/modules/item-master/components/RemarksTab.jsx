import React from "react";

export default function RemarksTab({ form, onChange }) {
  return (
    <div>
      <div className="im-section-title">User Text</div>
      <div className="im-field" style={{ marginBottom: 12 }}>
        <label className="im-field__label">User Text</label>
        <input
          className="im-field__input"
          name="User_Text"
          value={form.User_Text || ""}
          onChange={onChange}
          placeholder="Short user text (appears on documents)"
          style={{ flex: 1 }}
        />
      </div>

      <div className="im-section-title">Remarks</div>
      <textarea
        name="Remarks"
        value={form.Remarks || ""}
        onChange={onChange}
        rows={7}
        className="im-textarea"
        placeholder="Enter remarks..."
      />
    </div>
  );
}
