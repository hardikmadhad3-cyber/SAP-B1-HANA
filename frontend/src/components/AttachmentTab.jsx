import React from 'react';

function AttachmentTab({
  attachments,
  selectedAttachmentId,
  onSelectAttachment,
  onBrowse,
  onDisplay,
  onDelete,
  onFreeTextChange,
}) {
  const fillerRows = Math.max(0, 10 - attachments.length);

  return (
    <div className="gr-document__attachment-layout">
      <div className="gr-document__attachment-table">
        <table className="gr-matrix gr-matrix--attachments">
          <thead>
            <tr>
              <th className="gr-matrix__index">#</th>
              <th>Target Path</th>
              <th>File Name</th>
              <th>Attachment Date</th>
              <th>Free Text</th>
            </tr>
          </thead>
          <tbody>
            {attachments.map((attachment, index) => (
              <tr
                key={attachment.id}
                className={selectedAttachmentId === attachment.id ? 'is-active' : ''}
                onClick={() => onSelectAttachment(attachment.id)}
              >
                <td className="gr-matrix__row-number">{index + 1}</td>
                <td>{attachment.targetPath}</td>
                <td>{attachment.fileName}</td>
                <td>{attachment.attachmentDate}</td>
                <td>
                  <input
                    value={attachment.freeText}
                    onChange={(event) => onFreeTextChange(attachment.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </td>
              </tr>
            ))}

            {Array.from({ length: fillerRows }).map((_, index) => (
              <tr key={`attachment-filler-${index}`} className="gr-matrix__filler">
                <td className="gr-matrix__row-number">{attachments.length + index + 1}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="gr-document__attachment-actions">
        <button type="button" className="gr-btn gr-btn--gold" onClick={onBrowse}>
          Browse
        </button>
        <button
          type="button"
          className="gr-btn"
          onClick={onDisplay}
          disabled={!selectedAttachmentId}
        >
          Display
        </button>
        <button
          type="button"
          className="gr-btn"
          onClick={onDelete}
          disabled={!selectedAttachmentId}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default AttachmentTab;
