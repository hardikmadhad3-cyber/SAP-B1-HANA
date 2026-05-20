import React from 'react';

export default function AttachmentsTab({ attachments, onBrowseAttachment }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="po-section-title" style={{ marginBottom: 0 }}>Attachments</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="po-btn po-btn--primary" type="button" onClick={onBrowseAttachment}>Browse</button>
          <button className="po-btn" type="button" disabled>Display</button>
          <button className="po-btn po-btn--danger" type="button" disabled>Delete</button>
        </div>
      </div>
      <div className="po-grid-wrap">
        <table className="po-grid">
          <thead>
            <tr>
              <th>#</th>
              <th>Target Path</th>
              <th>File Name</th>
              <th>Attachment Date</th>
              <th>Free Text</th>
              <th>Copy to Target</th>
              <th>Document Type</th>
              <th>Doc Date</th>
              <th>Alert</th>
            </tr>
          </thead>
          <tbody>
            {attachments.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.targetPath}</td>
                <td>{r.fileName}</td>
                <td>{r.attachmentDate}</td>
                <td>{r.freeText}</td>
                <td>{r.copyToTargetDocument}</td>
                <td>{r.documentType}</td>
                <td>{r.atchDocDate}</td>
                <td>{r.alert}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
