import React from 'react';

const AGGREGATIONS = ['sum', 'avg', 'count', 'min', 'max'];
const SERIES_TYPES = ['bar', 'line'];

const DIMENSION_MEASURE_TYPES = [
  'bar', 'column-stacked',
  'bar-horizontal', 'bar-horizontal-stacked',
  'line', 'area', 'area-stacked',
  'pie', 'donut',
  'combo', 'funnel', 'treemap', 'radar', 'waterfall', 'heatmap',
];
const MULTI_MEASURE_TYPES = [
  'bar', 'column-stacked',
  'bar-horizontal', 'bar-horizontal-stacked',
  'line', 'area', 'area-stacked',
  'combo', 'radar', 'matrix',
];

const needsDimension = (widgetType) => DIMENSION_MEASURE_TYPES.includes(widgetType);
const needsMeasure = (widgetType) => ['kpi', 'gauge', 'matrix', 'bullet', 'card-trend', ...DIMENSION_MEASURE_TYPES].includes(widgetType);
const isTable = (widgetType) => widgetType === 'table';
const isScatter = (widgetType) => widgetType === 'scatter';
const isCombo = (widgetType) => widgetType === 'combo';
const isMatrix = (widgetType) => widgetType === 'matrix';
const isHeatmap = (widgetType) => widgetType === 'heatmap';
const isBullet = (widgetType) => widgetType === 'bullet';
const isCardTrend = (widgetType) => widgetType === 'card-trend';
const allowsMultipleMeasures = (widgetType) => MULTI_MEASURE_TYPES.includes(widgetType);

const FieldMappingPanel = ({ columnMeta = [], widgetType, value, onChange, savedMeasures = [] }) => {
  const columns = columnMeta.map((column) => column.name);
  const measures = Array.isArray(value?.measures) ? value.measures : [];

  const updateDimension = (dimension) => onChange({ ...value, dimension });
  const updateYDimension = (yDimension) => onChange({ ...value, yDimension });

  const updateMeasure = (index, patch) => {
    const nextMeasures = measures.map((measure, i) => (i === index ? { ...measure, ...patch } : measure));
    onChange({ ...value, measures: nextMeasures });
  };

  const applySavedMeasure = (index, measureName) => {
    const saved = savedMeasures.find((measure) => measure.name === measureName);
    if (!saved) return;
    updateMeasure(index, { field: saved.field, agg: saved.agg, label: saved.label });
  };

  const addMeasure = () => onChange({ ...value, measures: [...measures, { field: columns[0] || '', agg: 'sum' }] });
  const removeMeasure = (index) => onChange({ ...value, measures: measures.filter((_, i) => i !== index) });

  const updateTargetField = (targetField) => onChange({ ...value, targetField, targetValue: undefined });
  const updateTargetValue = (targetValue) => onChange({ ...value, targetField: '', targetValue });

  const compareMeasure = value?.compareMeasure || { field: columns[0] || '', agg: 'sum' };
  const updateCompareMeasure = (patch) => onChange({ ...value, compareMeasure: { ...compareMeasure, ...patch } });

  const toggleColumn = (column) => {
    const current = Array.isArray(value?.columns) ? value.columns : [];
    const next = current.includes(column) ? current.filter((c) => c !== column) : [...current, column];
    onChange({ ...value, columns: next });
  };

  const updateScatterField = (key, column) => onChange({ ...value, [key]: column });

  const rowFields = Array.isArray(value?.rowFields) ? value.rowFields : [];
  const addRowField = (column) => {
    if (!column || rowFields.includes(column)) return;
    onChange({ ...value, rowFields: [...rowFields, column] });
  };
  const removeRowField = (column) => onChange({ ...value, rowFields: rowFields.filter((f) => f !== column) });
  const updateColumnField = (column) => onChange({ ...value, columnField: column });

  if (!columns.length) {
    return <p className="ads-field-mapping__empty">This query has no captured columns yet - run Preview in Query Manager first.</p>;
  }

  return (
    <div className="ads-field-mapping">
      {needsDimension(widgetType) && (
        <label className="ads-field">
          <span>Dimension (X-axis / category)</span>
          <select value={value?.dimension || ''} onChange={(event) => updateDimension(event.target.value)}>
            <option value="">Select column</option>
            {columns.map((column) => <option key={column} value={column}>{column}</option>)}
          </select>
        </label>
      )}

      {needsMeasure(widgetType) && (
        <div className="ads-field-mapping__measures">
          <span className="ads-field-mapping__label">Measure(s)</span>
          {measures.map((measure, index) => (
            <div key={index} className="ads-measure-group">
              {savedMeasures.length > 0 && (
                <select
                  className="ads-measure-row__saved"
                  value=""
                  onChange={(event) => applySavedMeasure(index, event.target.value)}
                  title="Use a saved measure from Query Manager to pre-fill Field/Aggregation/Label"
                >
                  <option value="">Use saved measure...</option>
                  {savedMeasures.map((measure2) => (
                    <option key={measure2.name} value={measure2.name}>{measure2.label || measure2.name}</option>
                  ))}
                </select>
              )}
              <div className={`ads-measure-row${isCombo(widgetType) ? ' ads-measure-row--combo' : ''}`}>
              <select value={measure.field} onChange={(event) => updateMeasure(index, { field: event.target.value })}>
                {columns.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
              <select value={measure.agg} onChange={(event) => updateMeasure(index, { agg: event.target.value })}>
                {AGGREGATIONS.map((agg) => <option key={agg} value={agg}>{agg}</option>)}
              </select>
              {isCombo(widgetType) && (
                <select value={measure.seriesType || 'bar'} onChange={(event) => updateMeasure(index, { seriesType: event.target.value })}>
                  {SERIES_TYPES.map((seriesType) => <option key={seriesType} value={seriesType}>{seriesType}</option>)}
                </select>
              )}
              <input
                type="text"
                placeholder="Label"
                value={measure.label || ''}
                onChange={(event) => updateMeasure(index, { label: event.target.value })}
              />
              {measures.length > 1 && (
                <button type="button" className="aqm-btn aqm-btn--danger" onClick={() => removeMeasure(index)}>Remove</button>
              )}
              </div>
            </div>
          ))}
          {(allowsMultipleMeasures(widgetType) || measures.length === 0) && (
            <button type="button" className="aqm-btn aqm-btn--ghost" onClick={addMeasure}>+ Add Measure</button>
          )}
        </div>
      )}

      {isMatrix(widgetType) && (
        <div className="ads-field-mapping__matrix">
          <label className="ads-field">
            <span>Row Fields (in nesting order)</span>
            <select value="" onChange={(event) => addRowField(event.target.value)}>
              <option value="">+ Add row field</option>
              {columns.filter((column) => !rowFields.includes(column)).map((column) => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </label>
          <div className="ads-field-mapping__column-list">
            {rowFields.map((field, index) => (
              <span key={field} className="ads-filter-chip">
                {index + 1}. {field}
                <button type="button" onClick={() => removeRowField(field)} title="Remove row field">x</button>
              </span>
            ))}
            {!rowFields.length && <span className="ads-field-mapping__empty">No row fields yet.</span>}
          </div>

          <label className="ads-field">
            <span>Column Field (optional)</span>
            <select value={value?.columnField || ''} onChange={(event) => updateColumnField(event.target.value)}>
              <option value="">None</option>
              {columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
        </div>
      )}

      {isHeatmap(widgetType) && (
        <label className="ads-field">
          <span>Y Dimension (second axis)</span>
          <select value={value?.yDimension || ''} onChange={(event) => updateYDimension(event.target.value)}>
            <option value="">Select column</option>
            {columns.map((column) => <option key={column} value={column}>{column}</option>)}
          </select>
        </label>
      )}

      {isBullet(widgetType) && (
        <div className="ads-designer__meta-row">
          <label className="ads-field">
            <span>Target Field (optional)</span>
            <select value={value?.targetField || ''} onChange={(event) => updateTargetField(event.target.value)}>
              <option value="">None - use fixed value</option>
              {columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
          <label className="ads-field">
            <span>Target Value (if no field)</span>
            <input
              type="number"
              value={value?.targetValue ?? ''}
              disabled={Boolean(value?.targetField)}
              onChange={(event) => updateTargetValue(event.target.value)}
            />
          </label>
        </div>
      )}

      {isCardTrend(widgetType) && (
        <div className="ads-measure-row">
          <span className="ads-field-mapping__label">Compare Measure (prior period)</span>
          <select value={compareMeasure.field} onChange={(event) => updateCompareMeasure({ field: event.target.value })}>
            {columns.map((column) => <option key={column} value={column}>{column}</option>)}
          </select>
          <select value={compareMeasure.agg} onChange={(event) => updateCompareMeasure({ agg: event.target.value })}>
            {AGGREGATIONS.map((agg) => <option key={agg} value={agg}>{agg}</option>)}
          </select>
        </div>
      )}

      {isScatter(widgetType) && (
        <div className="ads-field-mapping__scatter">
          <label className="ads-field">
            <span>X Axis</span>
            <select value={value?.xField || ''} onChange={(event) => updateScatterField('xField', event.target.value)}>
              <option value="">Select column</option>
              {columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
          <label className="ads-field">
            <span>Y Axis</span>
            <select value={value?.yField || ''} onChange={(event) => updateScatterField('yField', event.target.value)}>
              <option value="">Select column</option>
              {columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
          <label className="ads-field">
            <span>Size (optional)</span>
            <select value={value?.sizeField || ''} onChange={(event) => updateScatterField('sizeField', event.target.value)}>
              <option value="">None</option>
              {columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
        </div>
      )}

      {isTable(widgetType) && (
        <div className="ads-field-mapping__columns">
          <span className="ads-field-mapping__label">Columns to display (none selected = all)</span>
          <div className="ads-field-mapping__column-list">
            {columns.map((column) => (
              <label key={column} className="ads-field-mapping__column-item">
                <input
                  type="checkbox"
                  checked={(value?.columns || []).includes(column)}
                  onChange={() => toggleColumn(column)}
                />
                {column}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldMappingPanel;
