import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SapLookupModal from '../common/SapLookupModal';
import { fetchReportParameterLookupOptions } from '../../api/reportStudioApi';

const buildInputType = (paramType) => {
  if (paramType === 'date') return 'date';
  if (paramType === 'number') return 'number';
  return 'text';
};

function ReportPopupModal({
  isOpen,
  report,
  parameters,
  values,
  isRunning,
  onChange,
  onClose,
  onRun,
}) {
  const [activeLookupParameter, setActiveLookupParameter] = useState(null);
  const [lookupDisplayValues, setLookupDisplayValues] = useState({});

  useEffect(() => {
    if (!isOpen) {
      setActiveLookupParameter(null);
      setLookupDisplayValues({});
    }
  }, [isOpen]);

  const handleLookupClose = () => setActiveLookupParameter(null);

  const lookupColumns = useMemo(
    () => activeLookupParameter?.lookup?.columns || [],
    [activeLookupParameter],
  );

  const fetchLookupOptions = useCallback(
    async (query) => {
      if (!activeLookupParameter?.lookup) {
        return [];
      }

      const response = await fetchReportParameterLookupOptions(activeLookupParameter.lookup, query);
      return response?.items || [];
    },
    [activeLookupParameter],
  );

  if (!isOpen || !report) {
    return null;
  }

  return (
    <div className="rs-modal__backdrop" role="presentation" onClick={onClose}>
      <div className="rs-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="rs-modal__titlebar">
          <span>{report.reportName} - Selection Criteria</span>
          <button type="button" className="rs-modal__close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="rs-modal__body">
          <div className="rs-modal__summary">
            <div><strong>Code:</strong> {report.reportCode}</div>
            <div><strong>Type:</strong> {report.reportType}</div>
          </div>

          <div className="rs-modal__fields">
            {parameters.length ? (
              parameters.map((parameter, index) => {
                const options = Array.isArray(parameter.options) ? parameter.options : [];
                const hasLookup = Boolean(parameter.lookup);
                const displayValue =
                  lookupDisplayValues[parameter.paramName] ??
                  values[parameter.paramName] ??
                  '';

                return (
                  <label key={parameter.parameterId || `${parameter.paramName}-${index}`} className="rs-field">
                    <span>
                      {parameter.displayName}
                      {parameter.isRequired ? ' *' : ''}
                    </span>

                    {hasLookup ? (
                      <div className="rs-lookup-field">
                        <input
                          type="text"
                          value={displayValue}
                          readOnly
                          required={parameter.isRequired}
                          placeholder={`Select ${parameter.displayName}`}
                        />
                        <button
                          type="button"
                          className="rs-btn rs-btn--lookup"
                          onClick={() => setActiveLookupParameter(parameter)}
                        >
                          ...
                        </button>
                      </div>
                    ) : options.length ? (
                      <select
                        value={values[parameter.paramName] ?? ''}
                        onChange={(event) => onChange(parameter.paramName, event.target.value)}
                        required={parameter.isRequired}
                      >
                        {!parameter.isRequired ? <option value="">Select</option> : null}
                        {options.map((option) => (
                          <option key={`${parameter.paramName}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={buildInputType(parameter.paramType)}
                        value={values[parameter.paramName] ?? ''}
                        onChange={(event) => onChange(parameter.paramName, event.target.value)}
                        required={parameter.isRequired}
                      />
                    )}
                  </label>
                );
              })
            ) : (
              <div className="rs-panel__empty">This report has no parameters, so it can run directly.</div>
            )}
          </div>
        </div>

        <div className="rs-modal__footer">
          <button type="button" className="rs-btn rs-btn--primary" onClick={onRun} disabled={isRunning}>
            {isRunning ? 'Running...' : 'OK'}
          </button>
          <button type="button" className="rs-btn" onClick={onClose} disabled={isRunning}>
            Cancel
          </button>
        </div>
      </div>

      <SapLookupModal
        open={Boolean(activeLookupParameter?.lookup)}
        title={activeLookupParameter?.lookup?.title || 'Select Value'}
        columns={lookupColumns}
        fetchOptions={fetchLookupOptions}
        initialQuery=""
        onClose={handleLookupClose}
        onSelect={(row) => {
          if (!activeLookupParameter?.lookup) {
            return;
          }

          const valueKey = activeLookupParameter.lookup.valueKey;
          const displayKey = activeLookupParameter.lookup.displayKey;
          const nextValue = row?.[valueKey] ?? '';
          const nextDisplay = [
            row?.[valueKey],
            displayKey !== valueKey ? row?.[displayKey] : null,
          ].filter(Boolean).join(' - ');

          onChange(activeLookupParameter.paramName, nextValue);
          setLookupDisplayValues((current) => ({
            ...current,
            [activeLookupParameter.paramName]: nextDisplay || String(nextValue || ''),
          }));
          handleLookupClose();
        }}
      />
    </div>
  );
}

export default ReportPopupModal;
