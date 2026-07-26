import React from 'react';

const PARAM_TYPES = ['string', 'number', 'date'];

const emptyParameter = () => ({ name: '', label: '', type: 'string', default: '', required: false });

const ParameterBuilder = ({ parameters, onChange }) => {
  const updateParameter = (index, patch) => {
    const next = parameters.map((parameter, i) => (i === index ? { ...parameter, ...patch } : parameter));
    onChange(next);
  };

  const removeParameter = (index) => {
    onChange(parameters.filter((_, i) => i !== index));
  };

  const addParameter = () => {
    onChange([...parameters, emptyParameter()]);
  };

  return (
    <div className="aqm-param-builder">
      <div className="aqm-param-builder__header">
        <h4>Parameters</h4>
        <button type="button" className="aqm-btn aqm-btn--ghost" onClick={addParameter}>
          + Add Parameter
        </button>
      </div>

      {parameters.length === 0 && (
        <p className="aqm-param-builder__empty">
          No parameters declared. Reference them in SQL as <code>@paramName</code>.
        </p>
      )}

      {parameters.map((parameter, index) => (
        <div className="aqm-param-row" key={index}>
          <input
            type="text"
            placeholder="name (e.g. fromDate)"
            value={parameter.name}
            onChange={(event) => updateParameter(index, { name: event.target.value })}
          />
          <input
            type="text"
            placeholder="Display label"
            value={parameter.label}
            onChange={(event) => updateParameter(index, { label: event.target.value })}
          />
          <select
            value={parameter.type}
            onChange={(event) => updateParameter(index, { type: event.target.value })}
          >
            {PARAM_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Default value"
            value={parameter.default}
            onChange={(event) => updateParameter(index, { default: event.target.value })}
          />
          <label className="aqm-param-row__required">
            <input
              type="checkbox"
              checked={Boolean(parameter.required)}
              onChange={(event) => updateParameter(index, { required: event.target.checked })}
            />
            Required
          </label>
          <button type="button" className="aqm-btn aqm-btn--danger" onClick={() => removeParameter(index)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

export default ParameterBuilder;
