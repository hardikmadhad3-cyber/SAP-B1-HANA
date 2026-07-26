import React from 'react';

const renderInput = (parameter, value, onChange) => {
  const commonProps = {
    value: value ?? '',
    onChange: (event) => onChange(parameter.name, event.target.value),
  };

  if (parameter.type === 'date') {
    return <input type="date" {...commonProps} />;
  }
  if (parameter.type === 'number') {
    return <input type="number" {...commonProps} />;
  }
  return <input type="text" {...commonProps} placeholder={parameter.label} />;
};

/**
 * One shared control per distinct parameter name across every widget's
 * underlying query on this dashboard - e.g. if three widgets all declare a
 * "fromDate" parameter, this renders a single "From Date" filter that drives
 * all three at once when Apply is pressed, the same way a widget's own
 * parameters work in Query Manager, just fanned out dashboard-wide.
 */
const DashboardFilterBar = ({ parameters, values, onChange, onApply, applying }) => {
  if (!parameters.length) return null;

  return (
    <div className="adv-filter-bar">
      {parameters.map((parameter) => (
        <label key={parameter.name} className="adv-filter-bar__field">
          <span>{parameter.label || parameter.name}{parameter.required ? ' *' : ''}</span>
          {renderInput(parameter, values[parameter.name], onChange)}
        </label>
      ))}
      <button type="button" className="adv-filter-bar__apply" onClick={onApply} disabled={applying}>
        {applying ? 'Applying...' : 'Apply Filters'}
      </button>
    </div>
  );
};

export default DashboardFilterBar;
