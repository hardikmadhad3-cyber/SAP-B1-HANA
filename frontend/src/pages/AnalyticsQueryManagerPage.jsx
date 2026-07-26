import React, { useCallback, useEffect, useState } from 'react';
import QueryList from '../modules/analytics-query-manager/components/QueryList';
import QueryForm from '../modules/analytics-query-manager/components/QueryForm';
import {
  fetchAnalyticsQueries,
  fetchAnalyticsQuery,
  createAnalyticsQuery,
  updateAnalyticsQuery,
  deleteAnalyticsQuery,
  publishAnalyticsQuery,
  unpublishAnalyticsQuery,
} from '../api/analyticsQueryApi';
import '../modules/analytics-query-manager/styles/query-manager.css';

const normalizeError = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const AnalyticsQueryManagerPage = () => {
  const [queries, setQueries] = useState([]);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [mode, setMode] = useState('list');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadQueries = useCallback(async () => {
    try {
      const data = await fetchAnalyticsQueries();
      setQueries(data);
    } catch (loadError) {
      setError(normalizeError(loadError, 'Failed to load queries.'));
    }
  }, []);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

  const handleSelect = async (query) => {
    setError('');
    try {
      const detail = await fetchAnalyticsQuery(query.queryId);
      setSelectedQuery(detail);
      setMode('edit');
    } catch (selectError) {
      setError(normalizeError(selectError, 'Failed to load query.'));
    }
  };

  const handleCreateNew = () => {
    setSelectedQuery(null);
    setMode('create');
  };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (selectedQuery) {
        await updateAnalyticsQuery(selectedQuery.queryId, form);
      } else {
        await createAnalyticsQuery(form);
      }
      await loadQueries();
      setMode('list');
      setSelectedQuery(null);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!selectedQuery) return;
    setError('');
    try {
      const updated = selectedQuery.status === 'Published'
        ? await unpublishAnalyticsQuery(selectedQuery.queryId)
        : await publishAnalyticsQuery(selectedQuery.queryId);
      setSelectedQuery(updated);
      await loadQueries();
    } catch (toggleError) {
      setError(normalizeError(toggleError, 'Failed to update query status.'));
    }
  };

  const handleDelete = async () => {
    if (!selectedQuery) return;
    if (!window.confirm(`Delete query "${selectedQuery.queryName}"?`)) return;
    setError('');
    try {
      await deleteAnalyticsQuery(selectedQuery.queryId);
      await loadQueries();
      setMode('list');
      setSelectedQuery(null);
    } catch (deleteError) {
      setError(normalizeError(deleteError, 'Failed to delete query.'));
    }
  };

  return (
    <div className="aqm-window">
      <div className="aqm-window__titlebar">
        <h2>Query Manager</h2>
      </div>
      <div className="aqm-window__body">
        <div className="aqm-card">
          <div className="aqm-card__header">
            <h3>Saved Queries</h3>
          </div>
          <QueryList
            queries={queries}
            selectedQueryId={selectedQuery?.queryId}
            onSelect={handleSelect}
            onCreateNew={handleCreateNew}
          />
        </div>

        <div className="aqm-card">
          <div className="aqm-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>{mode === 'create' ? 'New Query' : (selectedQuery ? selectedQuery.queryName : 'Select a query')}</h3>
            {selectedQuery && mode === 'edit' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="aqm-btn" onClick={handlePublishToggle}>
                  {selectedQuery.status === 'Published' ? 'Unpublish' : 'Publish'}
                </button>
                <button type="button" className="aqm-btn aqm-btn--danger" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            )}
          </div>

          {error && <div className="aqm-form__error" style={{ padding: '8px 16px' }}>{error}</div>}

          {(mode === 'create' || (mode === 'edit' && selectedQuery)) ? (
            <QueryForm
              key={selectedQuery?.queryId || 'new'}
              initialQuery={mode === 'edit' ? selectedQuery : null}
              onSave={handleSave}
              onCancel={() => { setMode('list'); setSelectedQuery(null); }}
              saving={saving}
            />
          ) : (
            <div className="aqm-empty-state">Select a query from the list, or create a new one.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsQueryManagerPage;
