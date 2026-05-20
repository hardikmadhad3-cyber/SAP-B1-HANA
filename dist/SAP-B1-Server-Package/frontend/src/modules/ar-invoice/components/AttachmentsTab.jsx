import React from 'react';

export default function AttachmentsTab({ attachments, onBrowseAttachment, isEditable = true }) {
  return (
    <div className="del-tab-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h6 className="del-section-title" style={{ margin: 0 }}>Attachments</h6>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="del-btn del-btn--primary" type="button" onClick={onBrowseAttachment} disabled={!isEditable}>
            Browse
          </button>
          <button className="del-btn" type="button" disabled>
            Display
          </button>
          <button className="del-btn" type="button" disabled style={{ color: '#d9534f' }}>
            Delete
          </button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="del-grid" style={{ width: '100%' }}>
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
                <td style={{ textAlign: 'center' }}>{r.id}</td>
                <td>{r.targetPath}</td>
                <td>{r.fileName}</td>
                <td>{r.attachmentDate}</td>
                <td>{r.freeText}</td>
                <td style={{ textAlign: 'center' }}>{r.copyToTargetDocument}</td>
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
