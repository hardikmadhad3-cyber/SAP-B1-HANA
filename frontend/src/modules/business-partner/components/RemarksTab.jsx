import React from "react";

export default function RemarksTab({ form, onChange }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <div className="im-section-title">Remarks</div>
      <textarea
        name="Notes"
        value={form.Notes || ""}
        onChange={onChange}
        rows={10}
        className="im-textarea"
        placeholder="Enter remarks / notes..."
        style={{ width: "100%" }}
      />
    </div>
  );
}
