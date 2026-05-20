import React from 'react';

function SettingsSection({ title, fields, groupKey, formSettings, onSettingChange }) {
  return (
    <div className="mb-4">
      <h6 className="border-bottom pb-1 mb-2">{title}</h6>

      {fields.map((field) => (
        <div
          key={field.key}
          className="d-flex justify-content-between align-items-center mb-2"
        >
          <span className="small">{field.label}</span>

          <div className="d-flex gap-2">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={formSettings[groupKey]?.[field.key]?.visible !== false}
                onChange={(event) =>
                  onSettingChange(groupKey, field.key, 'visible', event.target.checked)
                }
              />
              <label className="form-check-label small">V</label>
            </div>

            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={formSettings[groupKey]?.[field.key]?.active !== false}
                onChange={(event) =>
                  onSettingChange(groupKey, field.key, 'active', event.target.checked)
                }
              />
              <label className="form-check-label small">A</label>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FormSettingsPanel({
  isOpen,
  onClose,
  matrixFields,
  headerUdfFields,
  rowUdfFields,
  formSettings,
  onSettingChange,
  variant = 'floating',
  className = '',
  style,
}) {
  if (!isOpen) {
    return null;
  }

  const isSidebar = variant === 'sidebar';
  const wrapperClassName = [isSidebar ? '' : 'po-form-settings-floating', className]
    .filter(Boolean)
    .join(' ');
  const wrapperStyle = isSidebar
    ? style
    : {
        position: 'fixed',
        top: '172px',
        right: '12px',
        width: '380px',
        maxWidth: 'calc(100vw - 24px)',
        height: 'calc(100vh - 184px)',
        zIndex: 1050,
        overflowY: 'auto',
        paddingBottom: '12px',
        ...style,
      };
  const cardStyle = isSidebar
    ? {
        minHeight: '0',
        background: '#fff',
      }
    : {
        minHeight: '100%',
        borderRadius: '14px',
        border: '1px solid #d7e1ec',
        boxShadow: '0 16px 36px rgba(15, 23, 42, 0.12)',
        background: '#fff',
      };

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      <div
        className="card p-3 po-udf-sidebar-card"
        style={cardStyle}
      >
        <div className="po-udf-sidebar-header">
          <div>
            <h6 className="mb-1">Form Settings</h6>
            <small className="text-muted">Control visibility and activity</small>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Form Settings"
            title="Close"
            className="po-udf-sidebar-close"
          />
        </div>

        <div className="po-udf-sidebar-body">
          <SettingsSection
            title="Matrix Columns"
            fields={matrixFields}
            groupKey="matrixColumns"
            formSettings={formSettings}
            onSettingChange={onSettingChange}
          />
          <SettingsSection
            title="Header UDF Sidebar"
            fields={headerUdfFields}
            groupKey="headerUdfs"
            formSettings={formSettings}
            onSettingChange={onSettingChange}
          />
          <SettingsSection
            title="Row UDF Columns"
            fields={rowUdfFields}
            groupKey="rowUdfs"
            formSettings={formSettings}
            onSettingChange={onSettingChange}
          />
        </div>
      </div>
    </div>
  );
}

export default FormSettingsPanel;
