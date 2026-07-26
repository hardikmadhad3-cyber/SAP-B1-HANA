import React from 'react';

const AGGREGATIONS = ['sum', 'avg', 'count', 'min', 'max'];

const emptyMeasure = (columns) => ({ name: '', label: '', field: columns[0] || '', agg: 'sum' });

/**
 * Reusable, named {field, aggregation, label} shortcuts saved on a query -
 * selectable later in Dashboard Studio's Field Mapping panel instead of
 * re-picking the same field+aggregation by hand every time. Structurally a
 * near-copy of ParameterBuilder.jsx (same add/remove-row list pattern).
 */
const MeasureBuilder = ({ measures, columns, onChange }) => {
  const updateMeasure = (index, patch) => {
    const next = measures.map((measure, i) => (i === index ? { ...measure, ...patch } : measure));
    onChange(next);
  };

  const removeMeasure = (index) => {
    onChange(measures.filter((_, i) => i !== index));
  };

  const addMeasure = () => {
    onChange([...measures, emptyMeasure(columns)]);
  };

  return (
    <div className="aqm-param-builder">
      <div className="aqm-param-builder__header">
        <h4>Measures</h4>
        <button type="button" className="aqm-btn aqm-btn--ghost" onClick={addMeasure} disabled={!columns.length}>
          + Add Measure
        </button>
      </div>

      {!columns.length && (
        <p className="aqm-param-builder__empty">Run Preview above first to capture this query's columns.</p>
      )}

      {columns.length > 0 && measures.length === 0 && (
        <p className="aqm-param-builder__empty">
          No saved measures yet. A measure is a reusable shortcut (e.g. "Total OnHand" = sum(OnHand)) that
          shows up as a preset when building any widget's Field Mapping in Dashboard Studio.
        </p>
      )}

      {measures.map((measure, index) => (
        <div className="aqm-param-row" key={index}>
          <input
            type="text"
            placeholder="Name (e.g. Total OnHand)"
            value={measure.name}
            onChange={(event) => updateMeasure(index, { name: event.target.value })}
          />
          <input
            type="text"
            placeholder="Display label"
            value={measure.label}
            onChange={(event) => updateMeasure(index, { label: event.target.value })}
          />
          <select
            value={measure.field}
            onChange={(event) => updateMeasure(index, { field: event.target.value })}
          >
            {columns.map((column) => <option key={column} value={column}>{column}</option>)}
          </select>
          <select
            value={measure.agg}
            onChange={(event) => updateMeasure(index, { agg: event.target.value })}
          >
            {AGGREGATIONS.map((agg) => <option key={agg} value={agg}>{agg}</option>)}
          </select>
          <button type="button" className="aqm-btn aqm-btn--danger" onClick={() => removeMeasure(index)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

export default MeasureBuilder;
