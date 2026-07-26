import React, { useState } from 'react';
import { computeDistinctValues, COMPARISON_OPERATORS, getFilterKey } from './fieldFilterUtils';
import '../../styles/analytics-chart-widget.css';

const SelectSlicer = ({ filter, widgetRowsById, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const distinctValues = computeDistinctValues(widgetRowsById, filter.field);
  const visibleValues = search
    ? distinctValues.filter((value) => value.toLowerCase().includes(search.toLowerCase()))
    : distinctValues;

  const toggleValue = (value) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    onChange(next);
  };

  return (
    <div className="dff-slicer">
      <button type="button" className="dff-slicer__toggle" onClick={() => setOpen((prev) => !prev)}>
        {filter.label || filter.field}
        {selected.length > 0 && <span className="dff-slicer__count">{selected.length}</span>}
      </button>
      {open && (
        <div className="dff-slicer__panel">
          <input
            type="text"
            className="dff-slicer__search"
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="dff-slicer__list">
            {visibleValues.length === 0 && <div className="dff-slicer__empty">No values yet.</div>}
            {visibleValues.map((value) => (
              <label key={value} className="dff-slicer__item">
                <input type="checkbox" checked={selected.includes(value)} onChange={() => toggleValue(value)} />
                <span>{value || '(blank)'}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <button type="button" className="dff-slicer__clear" onClick={() => onChange([])}>Clear</button>
          )}
        </div>
      )}
    </div>
  );
};

const ComparisonSlicer = ({ filter, current, onChange }) => {
  const operator = current?.operator || filter.operator || '>';
  const value = current?.value ?? filter.value ?? '';

  return (
    <div className="dff-slicer dff-slicer--comparison">
      <span className="dff-slicer__comparison-label">{filter.label || filter.field}</span>
      <select
        className="dff-slicer__comparison-operator"
        value={operator}
        onChange={(event) => onChange({ operator: event.target.value, value })}
      >
        {COMPARISON_OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
      </select>
      <input
        type="number"
        className="dff-slicer__comparison-value"
        value={value}
        onChange={(event) => onChange({ operator, value: event.target.value })}
      />
    </div>
  );
};

const DateRangeSlicer = ({ filter, current, onChange }) => {
  const from = current?.from ?? filter.from ?? '';
  const to = current?.to ?? filter.to ?? '';

  return (
    <div className="dff-slicer dff-slicer--daterange">
      <span className="dff-slicer__comparison-label">{filter.label || filter.field}</span>
      <input type="date" value={from} onChange={(event) => onChange({ from: event.target.value, to })} />
      <span>to</span>
      <input type="date" value={to} onChange={(event) => onChange({ from, to: event.target.value })} />
    </div>
  );
};

const TopNSlicer = ({ filter, current, onChange }) => {
  const n = current?.n ?? filter.n ?? 10;
  const direction = current?.direction ?? filter.direction ?? 'desc';

  return (
    <div className="dff-slicer dff-slicer--comparison">
      <span className="dff-slicer__comparison-label">Top</span>
      <input
        type="number"
        min="1"
        className="dff-slicer__comparison-value"
        value={n}
        onChange={(event) => onChange({ n: event.target.value, direction })}
      />
      <select value={direction} onChange={(event) => onChange({ n, direction: event.target.value })}>
        <option value="desc">Highest</option>
        <option value="asc">Lowest</option>
      </select>
      <span className="dff-slicer__comparison-label">{filter.label || filter.field}</span>
    </div>
  );
};

/**
 * Field-value slicer bar - one control per dashboard-defined filter. Shared
 * between Dashboard Studio (live preview while designing) and the published
 * Viewer. Distinct from the query-parameter DashboardFilterBar (Viewer-only).
 * 'select' filters render a checkbox multi-select; 'comparison' filters
 * render an operator+value control (e.g. "OnHand > 0"), pre-filled from the
 * filter's design-time default so it's already applied on load.
 */
const DashboardFieldFilterBar = ({ filters = [], widgetRowsById = {}, values = {}, onChange }) => {
  if (!filters.length) return null;

  const updateFilterValues = (key, nextValues) => {
    onChange({ ...values, [key]: nextValues });
  };

  return (
    <div className="dff-bar">
      {filters.map((filter) => {
        const key = getFilterKey(filter);
        if (filter.type === 'comparison') {
          return (
            <ComparisonSlicer
              key={key}
              filter={filter}
              current={values[key]}
              onChange={(nextValue) => updateFilterValues(key, nextValue)}
            />
          );
        }
        if (filter.type === 'dateRange') {
          return (
            <DateRangeSlicer
              key={key}
              filter={filter}
              current={values[key]}
              onChange={(nextValue) => updateFilterValues(key, nextValue)}
            />
          );
        }
        if (filter.type === 'topN') {
          return (
            <TopNSlicer
              key={key}
              filter={filter}
              current={values[key]}
              onChange={(nextValue) => updateFilterValues(key, nextValue)}
            />
          );
        }
        return (
          <SelectSlicer
            key={key}
            filter={filter}
            widgetRowsById={widgetRowsById}
            selected={values[key] || []}
            onChange={(nextValues) => updateFilterValues(key, nextValues)}
          />
        );
      })}
    </div>
  );
};

export default DashboardFieldFilterBar;
