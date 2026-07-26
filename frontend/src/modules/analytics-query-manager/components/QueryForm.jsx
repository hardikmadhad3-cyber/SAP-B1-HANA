import React, { useState } from 'react';
import SqlEditor from './SqlEditor';
import ParameterBuilder from './ParameterBuilder';
import MeasureBuilder from './MeasureBuilder';
import PreviewResultGrid from './PreviewResultGrid';
import { previewAnalyticsQuery } from '../../../api/analyticsQueryApi';

const emptyForm = () => ({
  queryCode: '',
  queryName: '',
  category: '',
  description: '',
  sqlText: 'SELECT TOP 100 * FROM OITM',
  parameters: [],
  measures: [],
  rowLimit: 500,
  timeoutMs: 15000,
});

const normalizeError = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const QueryForm = ({ initialQuery, onSave, onCancel, saving }) => {
  const [form, setForm] = useState(() => (initialQuery
    ? {
      queryCode: initialQuery.queryCode,
      queryName: initialQuery.queryName,
      category: initialQuery.category || '',
      description: initialQuery.description || '',
      sqlText: initialQuery.sqlText,
      parameters: initialQuery.parameters || [],
      measures: initialQuery.measures || [],
      rowLimit: initialQuery.rowLimit || 500,
      timeoutMs: initialQuery.timeoutMs || 15000,
    }
    : emptyForm()));
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const isEditing = Boolean(initialQuery);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const result = await previewAnalyticsQuery({
        sqlText: form.sqlText,
        parameters: form.parameters,
        rowLimit: Number(form.rowLimit) || 500,
        timeoutMs: Number(form.timeoutMs) || 15000,
        paramValues: Object.fromEntries(form.parameters.map((parameter) => [parameter.name, parameter.default])),
      });
      setPreviewResult(result);
    } catch (error) {
      setPreviewError(normalizeError(error, 'Failed to run query.'));
      setPreviewResult(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!form.queryCode.trim() || !form.queryName.trim() || !form.sqlText.trim()) {
      setFormError('Query Code, Query Name, and SQL are required.');
      return;
    }

    try {
      await onSave({
        ...form,
        rowLimit: Number(form.rowLimit) || 500,
        timeoutMs: Number(form.timeoutMs) || 15000,
      });
    } catch (error) {
      setFormError(normalizeError(error, 'Failed to save query.'));
    }
  };

  return (
    <form className="aqm-form" onSubmit={handleSubmit}>
      <div className="aqm-form__split">
        <label className="aqm-field">
          <span>Query Code</span>
          <input
            type="text"
            value={form.queryCode}
            disabled={isEditing}
            onChange={(event) => updateField('queryCode', event.target.value.toUpperCase())}
            placeholder="MONTHLY_PURCHASE_VALUE"
          />
        </label>
        <label className="aqm-field">
          <span>Query Name</span>
          <input
            type="text"
            value={form.queryName}
            onChange={(event) => updateField('queryName', event.target.value)}
            placeholder="Monthly Purchase Value"
          />
        </label>
      </div>

      <div className="aqm-form__split">
        <label className="aqm-field">
          <span>Category</span>
          <input
            type="text"
            value={form.category}
            onChange={(event) => updateField('category', event.target.value)}
            placeholder="Purchase"
          />
        </label>
        <label className="aqm-field">
          <span>Description</span>
          <input
            type="text"
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </label>
      </div>

      <div className="aqm-form__split aqm-form__split--triple">
        <label className="aqm-field">
          <span>Row Limit</span>
          <input
            type="number"
            min="1"
            max="5000"
            value={form.rowLimit}
            onChange={(event) => updateField('rowLimit', event.target.value)}
          />
        </label>
        <label className="aqm-field">
          <span>Timeout (ms)</span>
          <input
            type="number"
            min="1000"
            max="60000"
            value={form.timeoutMs}
            onChange={(event) => updateField('timeoutMs', event.target.value)}
          />
        </label>
      </div>

      <label className="aqm-field">
        <span>SQL (SELECT / WITH only - use @paramName for parameters)</span>
        <SqlEditor value={form.sqlText} onChange={(value) => updateField('sqlText', value)} />
      </label>

      <ParameterBuilder parameters={form.parameters} onChange={(parameters) => updateField('parameters', parameters)} />

      <div className="aqm-form__preview-actions">
        <button type="button" className="aqm-btn" onClick={handlePreview} disabled={previewLoading}>
          {previewLoading ? 'Running...' : 'Preview / Run'}
        </button>
      </div>

      <PreviewResultGrid result={previewResult} error={previewError} loading={previewLoading} />

      <MeasureBuilder
        measures={form.measures}
        columns={(previewResult?.columns || initialQuery?.columnMeta || []).map((column) => column.name)}
        onChange={(measures) => updateField('measures', measures)}
      />

      {formError && <div className="aqm-form__error">{formError}</div>}

      <div className="aqm-form__actions">
        <button type="submit" className="aqm-btn aqm-btn--primary" disabled={saving}>
          {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Query')}
        </button>
        <button type="button" className="aqm-btn aqm-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default QueryForm;
