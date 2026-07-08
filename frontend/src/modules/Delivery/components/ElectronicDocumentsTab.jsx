import React from 'react';

const GENERATION_TYPES = [
  { value: 'edocGenerate', label: 'Generate' },
  { value: 'edocGenerateLater', label: 'Generate - Later' },
  { value: 'edocNotRelevant', label: 'Not Relevant' },
  { value: 'edocGenerateOffline', label: 'Generate Offline' },
];

const Row = ({ label, children }) => (
  <div className="del-edoc-row">
    <label>{label}</label>
    {children}
  </div>
);

export default function ElectronicDocumentsTab({ header, onHeaderChange, formats = [], onOpenEWayBill, disabled = false }) {
  const formatOptions = [...formats];
  if (header.edocExportFormat && !formatOptions.some((format) => String(format.AbsEntry) === String(header.edocExportFormat))) {
    formatOptions.unshift({ AbsEntry: header.edocExportFormat, Name: `Format ${header.edocExportFormat}` });
  }

  return (
    <div className="del-tab-panel del-edoc-tab">
      <section className="del-edoc-section">
        <h6 className="del-section-title">E-Way Bill</h6>
        <Row label="eDoc Generation Type">
          <select className="del-field__select" name="edocGenerationType" value={header.edocGenerationType || ''} onChange={onHeaderChange} disabled={disabled}>
            <option value="">Select</option>
            {GENERATION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Row>
        <Row label="eDoc Format">
          <select className="del-field__select" name="edocExportFormat" value={header.edocExportFormat || ''} onChange={onHeaderChange} disabled={disabled}>
            <option value="">Select</option>
            {formatOptions.map((format) => (
              <option key={format.AbsEntry} value={format.AbsEntry}>{format.Name || format.Descr || format.AbsEntry}</option>
            ))}
          </select>
        </Row>
        <Row label="Documents Mapping Determination">
          <input className="del-field__input" value="Double-click to open" readOnly />
        </Row>
        <Row label="Document Status">
          <input className="del-field__input" value={header.edocStatus || (header.edocGenerationType === 'edocNotRelevant' ? 'Not Relevant' : 'Waiting')} readOnly />
        </Row>
        <Row label="E-Way Bill Details">
          <div
            role="button"
            tabIndex={0}
            className={`del-edoc-details-button${disabled ? ' is-read-only' : ''}`}
            onClick={onOpenEWayBill}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenEWayBill();
              }
            }}
            title={disabled ? 'View E-Way Bill Details (read-only)' : 'Open E-Way Bill Details'}
            aria-label={disabled ? 'View E-Way Bill Details read-only' : 'Open E-Way Bill Details'}
          >
            ...
          </div>
        </Row>
      </section>

      <section className="del-edoc-section">
        <h6 className="del-section-title">Generic eDoc Protocol</h6>
        <Row label="eDoc Generation Type"><input className="del-field__input" value="Not Relevant" readOnly /></Row>
        <Row label="eDoc Format"><input className="del-field__input" value="" readOnly /></Row>
        <Row label="Documents Mapping Determination"><input className="del-field__input" value="Double-click to open" readOnly /></Row>
        <Row label="Document Status"><input className="del-field__input" value="" readOnly /></Row>
      </section>
    </div>
  );
}
