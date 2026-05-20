import React, { useRef } from "react";

// Matches SAP B1 Attachments tab exactly:
// # | Target Path | File Name | File Extension | File Size | Attachment Date | Attached By | Free Text
// Buttons: Browse | Display | Delete (right side)

export default function BOMAttachments({ attachments, onChange }) {
  const fileRef = useRef(null);

  const handleBrowse = (e) => {
    const files = Array.from(e.target.files || []);
    const newRows = files.map((f) => ({
      id:         Date.now() + Math.random(),
      targetPath: "",
      fileName:   f.name.replace(/\.[^.]+$/, ""),
      fileExt:    f.name.includes(".") ? f.name.split(".").pop().toUpperCase() : "",
      fileSize:   f.size,
      date:       new Date().toISOString().slice(0, 10),
      attachedBy: "",
      freeText:   "",
      _file:      f,
    }));
    onChange((prev) => [...prev, ...newRows]);
    e.target.value = "";
  };

  const handleDelete = (id) => onChange((prev) => prev.filter((a) => a.id !== id));

  const handleField = (id, field, val) =>
    onChange((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: val } : a)));

  return (
    <div className="bom-attach-wrap">
      <div className="bom-attach-main">
        <div className="bom-grid-scroll">
          <table className="bom-grid">
            <thead>
              <tr>
                <th className="bom-th" style={{ width: 32 }}>#</th>
                <th className="bom-th" style={{ width: 160 }}>Target Path</th>
                <th className="bom-th" style={{ width: 160 }}>File Name</th>
                <th className="bom-th" style={{ width: 90 }}>File Extension</th>
                <th className="bom-th" style={{ width: 90 }}>File Size</th>
                <th className="bom-th" style={{ width: 110 }}>Attachment Date</th>
                <th className="bom-th" style={{ width: 110 }}>Attached By</th>
                <th className="bom-th" style={{ width: 200 }}>Free Text</th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((a, idx) => (
                <tr key={a.id} className="bom-grid__row">
                  <td className="bom-grid__cell bom-grid__cell--num bom-grid__cell--muted">{idx + 1}</td>
                  <td className="bom-grid__cell">
                    <input className="bom-cell-input" value={a.targetPath}
                      onChange={(e) => handleField(a.id, "targetPath", e.target.value)} />
                  </td>
                  <td className="bom-grid__cell">
                    <input className="bom-cell-input" value={a.fileName}
                      onChange={(e) => handleField(a.id, "fileName", e.target.value)} />
                  </td>
                  <td className="bom-grid__cell">
                    <input className="bom-cell-input" value={a.fileExt}
                      onChange={(e) => handleField(a.id, "fileExt", e.target.value)} />
                  </td>
                  <td className="bom-grid__cell bom-grid__cell--num bom-grid__cell--readonly">
                    {a.fileSize ? a.fileSize.toLocaleString() : ""}
                  </td>
                  <td className="bom-grid__cell bom-grid__cell--readonly">{a.date}</td>
                  <td className="bom-grid__cell">
                    <input className="bom-cell-input" value={a.attachedBy}
                      onChange={(e) => handleField(a.id, "attachedBy", e.target.value)} />
                  </td>
                  <td className="bom-grid__cell">
                    <input className="bom-cell-input" value={a.freeText}
                      onChange={(e) => handleField(a.id, "freeText", e.target.value)} />
                  </td>
                </tr>
              ))}
              {/* Empty filler rows */}
              {attachments.length < 10 && Array.from({ length: 10 - attachments.length }).map((_, i) => (
                <tr key={`e-${i}`} className="bom-grid__row bom-grid__row--empty">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="bom-grid__cell bom-grid__cell--empty" />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right-side buttons — exactly like SAP B1 screenshot */}
      <div className="bom-attach-btns">
        <button type="button" className="bom-attach-btn" onClick={() => fileRef.current?.click()}>Browse</button>
        <button type="button" className="bom-attach-btn">Display</button>
        <button type="button" className="bom-attach-btn bom-attach-btn--del"
          onClick={() => { const sel = attachments[attachments.length - 1]; if (sel) handleDelete(sel.id); }}>
          Delete
        </button>
        <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={handleBrowse} />
      </div>
    </div>
  );
}
