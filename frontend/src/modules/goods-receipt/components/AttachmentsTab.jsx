import React from 'react';

function AttachmentsTab({
  attachments,
  selectedAttachmentId,
  onSelectAttachment,
  onBrowseAttachment,
  onDisplayAttachment,
  onDeleteAttachment,
  onFreeTextChange,
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div className="po-section-title" style={{ marginBottom: 0 }}>
          Attachments
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="po-btn po-btn--primary" onClick={onBrowseAttachment}>
            Browse
          </button>
          <button
            type="button"
            className="po-btn"
            disabled={!selectedAttachmentId}
            onClick={onDisplayAttachment}
          >
            Display
          </button>
          <button
            type="button"
            className="po-btn po-btn--danger"
            disabled={!selectedAttachmentId}
            onClick={onDeleteAttachment}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="po-grid-wrap gr-goods-receipt__grid-wrap">
        <table className="po-grid gr-goods-receipt__grid">
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Target Path</th>
              <th>File Name</th>
              <th>Attachment Date</th>
              <th>Free Text</th>
            </tr>
          </thead>
          <tbody>
            {attachments.length === 0 ? (
              <tr>
                <td colSpan="5" className="po-grid__cell--muted" style={{ textAlign: 'center', padding: 20 }}>
                  No attachments added yet.
                </td>
              </tr>
            ) : (
              attachments.map((attachment, index) => (
                <tr
                  key={attachment.id}
                  className={selectedAttachmentId === attachment.id ? 'gr-goods-receipt__row--active' : ''}
                  onClick={() => onSelectAttachment(attachment.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ textAlign: 'center' }}>{index + 1}</td>
                  <td>{attachment.targetPath}</td>
                  <td>{attachment.fileName}</td>
                  <td>{attachment.attachmentDate}</td>
                  <td>
                    <input
                      className="po-grid__input po-grid__input--text"
                      value={attachment.freeText}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onFreeTextChange(attachment.id, event.target.value)
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AttachmentsTab;
