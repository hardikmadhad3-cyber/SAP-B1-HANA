import React, { useState } from 'react';
import QueryPickerModal from './QueryPickerModal';
import VisualTypePicker from './VisualTypePicker';
import FieldMappingPanel from './FieldMappingPanel';
import { fetchAnalyticsQuery } from '../../../api/analyticsQueryApi';

const STEP_PICK_QUERY = 'pick-query';
const STEP_CONFIGURE = 'configure';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Failed to load the selected query. Please try again.';

const AddWidgetWizard = ({ onAdd, onClose, saving }) => {
  const [step, setStep] = useState(STEP_PICK_QUERY);
  const [query, setQuery] = useState(null);
  const [widgetType, setWidgetType] = useState('table');
  const [title, setTitle] = useState('');
  const [fieldMapping, setFieldMapping] = useState({});
  const [loadError, setLoadError] = useState('');
  const [loadingQuery, setLoadingQuery] = useState(false);

  const handleQuerySelect = async (row) => {
    setLoadError('');
    setLoadingQuery(true);
    try {
      const detail = await fetchAnalyticsQuery(row.queryId);
      setQuery(detail);
      setTitle(detail.queryName);
      setStep(STEP_CONFIGURE);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoadingQuery(false);
    }
  };

  if (step === STEP_PICK_QUERY) {
    const footerNote = loadingQuery ? 'Loading query...' : (loadError || undefined);
    return <QueryPickerModal open onClose={onClose} onSelect={handleQuerySelect} footerNote={footerNote} />;
  }

  return (
    <div className="ads-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="ads-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="ads-modal__header">
          <span>Add Widget - {query.queryName}</span>
          <button type="button" onClick={onClose}>x</button>
        </header>
        <div className="ads-modal__body">
          <label className="ads-field">
            <span>Title</span>
            <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <span className="ads-field-mapping__label">Visual Type</span>
          <VisualTypePicker value={widgetType} onChange={setWidgetType} />

          <FieldMappingPanel
            columnMeta={query.columnMeta || []}
            widgetType={widgetType}
            value={fieldMapping}
            onChange={setFieldMapping}
            savedMeasures={query.measures || []}
          />
        </div>
        <footer className="ads-modal__footer">
          <button
            type="button"
            className="aqm-btn aqm-btn--primary"
            disabled={saving}
            onClick={() => onAdd({ queryId: query.queryId, widgetType, title, fieldMapping })}
          >
            {saving ? 'Adding...' : 'Add to Dashboard'}
          </button>
          <button type="button" className="aqm-btn aqm-btn--ghost" onClick={onClose}>Cancel</button>
        </footer>
      </div>
    </div>
  );
};

export default AddWidgetWizard;
