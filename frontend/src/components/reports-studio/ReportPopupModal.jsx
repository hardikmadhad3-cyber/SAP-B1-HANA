import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SapLookupModal from '../common/SapLookupModal';
import { fetchReportParameterLookupOptions } from '../../api/reportStudioApi';

const buildInputType = (paramType) => {
  if (paramType === 'date') return 'date';
  if (paramType === 'number') return 'number';
  return 'text';
};

const INFERRED_LOOKUPS = {
  item: {
    table: 'OITM',
    title: 'List of Items',
    columns: [
      { key: 'ItemCode', label: 'Item Code' },
      { key: 'ItemName', label: 'Item Name' },
    ],
    valueKey: 'ItemCode',
    displayKey: 'ItemName',
  },
  buyer: {
    table: 'OCRD_CUSTOMERS',
    title: 'List of Buyers',
    columns: [
      { key: 'CardName', label: 'BP Name' },
      { key: 'CardCode', label: 'BP Code' },
      { key: 'Balance', label: 'BP Balance' },
      { key: 'CardTypeLabel', label: 'BP Type' },
      { key: 'Active', label: 'Active' },
      { key: 'Inactive', label: 'Inactive' },
      { key: 'BillToBlock', label: 'Bill-to Block' },
      { key: 'BillToBuildingFloorRoom', label: 'Bill-to Building/Floor/Room' },
      { key: 'GTSRegistrationNumber', label: 'GTS Registration Number' },
    ],
    valueKey: 'CardCode',
    displayKey: 'CardName',
    modalWidth: 'min(1280px, calc(100vw - 40px))',
  },
  seller: {
    table: 'OCRD_SUPPLIERS',
    title: 'List of Sellers',
    columns: [
      { key: 'CardName', label: 'BP Name' },
      { key: 'CardCode', label: 'BP Code' },
      { key: 'Balance', label: 'BP Balance' },
      { key: 'CardTypeLabel', label: 'BP Type' },
      { key: 'Active', label: 'Active' },
      { key: 'Inactive', label: 'Inactive' },
      { key: 'BillToBlock', label: 'Bill-to Block' },
      { key: 'BillToBuildingFloorRoom', label: 'Bill-to Building/Floor/Room' },
      { key: 'GTSRegistrationNumber', label: 'GTS Registration Number' },
    ],
    valueKey: 'CardCode',
    displayKey: 'CardName',
    modalWidth: 'min(1280px, calc(100vw - 40px))',
  },
  businessPartner: {
    table: 'OCRD',
    title: 'List of Business Partners',
    columns: [
      { key: 'CardCode', label: 'BP Code' },
      { key: 'CardName', label: 'BP Name' },
      { key: 'Country', label: 'Country' },
      { key: 'CardTypeLabel', label: 'BP Type' },
      { key: 'Balance', label: 'Account Balance' },
      { key: 'Active', label: 'Active' },
      { key: 'VendorTypeId', label: 'Vendor Type ID' },
      { key: 'VendorOccupation', label: 'Vendor Occupation' },
    ],
    valueKey: 'CardCode',
    displayKey: 'CardCode',
    modalWidth: 'min(1280px, calc(100vw - 40px))',
  },
};

const inferParameterLookup = (parameter) => {
  const identity = `${parameter?.displayName || ''} ${parameter?.paramName || ''}`.toLowerCase();
  const lookupTable = String(parameter?.lookup?.table || '').trim().toUpperCase();

  if (identity.includes('seller') || identity.includes('vendor')) {
    return INFERRED_LOOKUPS.seller;
  }

  if (identity.includes('buyer') || identity.includes('customer')) {
    return INFERRED_LOOKUPS.buyer;
  }

  if (identity.includes('item') || identity.includes('product')) {
    return INFERRED_LOOKUPS.item;
  }

  if (
    lookupTable === 'OCRD' ||
    identity.includes('card code') ||
    identity.includes('cardcode') ||
    identity.includes('select * from ocrd')
  ) {
    return INFERRED_LOOKUPS.businessPartner;
  }

  return null;
};

const isOptionalFilterLookup = (parameter) => {
  const identity = `${parameter?.displayName || ''} ${parameter?.paramName || ''}`.toLowerCase();
  return (
    identity.includes('item') ||
    identity.includes('product') ||
    identity.includes('customer') ||
    identity.includes('vendor') ||
    identity.includes('buyer') ||
    identity.includes('seller') ||
    identity.includes('business partner') ||
    identity.includes('card code') ||
    identity.includes('cardcode')
  );
};

const isEnterTypeParameter = (parameter) => {
  const identity = `${parameter?.displayName || ''} ${parameter?.paramName || ''}`.toLowerCase();
  return identity.includes('enter type') || identity.includes('type');
};

const normalizeOptionValue = (option) => String(
  option && typeof option === 'object'
    ? (option.value ?? option.label ?? '')
    : option,
).trim();

const normalizeOptionLabel = (option) => String(
  option && typeof option === 'object'
    ? (option.label ?? option.value ?? '')
    : option,
).trim();

const normalizeSelectOptions = (parameter) => {
  const sourceOptions = Array.isArray(parameter?.options) ? parameter.options : [];
  const options = sourceOptions
    .map((option) => ({
      value: normalizeOptionValue(option),
      label: normalizeOptionLabel(option),
    }))
    .filter((option) => option.value || option.label);

  if (!isEnterTypeParameter(parameter)) {
    return options;
  }

  const nextOptions = [...options];
  ['Soda', 'Sale'].forEach((label) => {
    const exists = nextOptions.some((option) =>
      String(option.value || option.label).trim().toLowerCase() === label.toLowerCase()
    );

    if (!exists) {
      nextOptions.push({ value: label, label });
    }
  });

  return nextOptions;
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
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveLookupParameter(null);
      setLookupDisplayValues({});
      setDragOffset({ x: 0, y: 0 });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      setDragOffset({
        x: event.clientX - dragState.startX + dragState.originX,
        y: event.clientY - dragState.startY + dragState.originY,
      });
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleLookupClose = () => setActiveLookupParameter(null);
  const openLookup = (parameter, lookup) => setActiveLookupParameter({ ...parameter, lookup });
  const handleDragStart = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: dragOffset.x,
      originY: dragOffset.y,
    };
  };

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
    <div className="rs-modal__backdrop" role="presentation" onClick={(event) => event.stopPropagation()}>
      <div
        className="rs-modal"
        role="dialog"
        aria-modal="true"
        style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rs-modal__titlebar rs-modal__titlebar--draggable" onMouseDown={handleDragStart}>
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
                const options = normalizeSelectOptions(parameter);
                const parameterLookup = inferParameterLookup(parameter) || parameter.lookup;
                const hasLookup = Boolean(parameterLookup);
                const isRequired = parameter.isRequired && !isOptionalFilterLookup(parameter) && !isEnterTypeParameter(parameter);
                const displayValue =
                  lookupDisplayValues[parameter.paramName] ??
                  values[parameter.paramName] ??
                  '';

                return (
                  <label key={parameter.parameterId || `${parameter.paramName}-${index}`} className="rs-field">
                    <span>
                      {parameter.displayName}
                      {isRequired ? ' *' : ''}
                    </span>

                    {hasLookup ? (
                      <div className="rs-lookup-field">
                        <input
                          type="text"
                          value={displayValue}
                          readOnly
                          required={isRequired}
                          placeholder={`Select ${parameter.displayName}`}
                          onClick={() => openLookup(parameter, parameterLookup)}
                          onFocus={() => openLookup(parameter, parameterLookup)}
                        />
                        <button
                          type="button"
                          className="rs-btn rs-btn--lookup"
                          onClick={() => openLookup(parameter, parameterLookup)}
                        >
                          ...
                        </button>
                      </div>
                    ) : options.length ? (
                      <select
                        value={values[parameter.paramName] ?? ''}
                        onChange={(event) => onChange(parameter.paramName, event.target.value)}
                        required={isRequired}
                      >
                        <option value="">Select</option>
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
                        required={isRequired}
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
        width={activeLookupParameter?.lookup?.modalWidth}
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
