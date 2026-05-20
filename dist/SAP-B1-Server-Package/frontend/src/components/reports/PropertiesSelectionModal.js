import React, { useEffect, useMemo, useState } from 'react';
import useFloatingWindow from './useFloatingWindow';

const buildDraftState = (value = {}) => ({
  ignoreProperties: value.ignoreProperties ?? true,
  linkMode: value.linkMode || 'and',
  exactlyMatch: value.exactlyMatch ?? false,
  selectedPropertyNumbers: Array.isArray(value.selectedPropertyNumbers)
    ? [...value.selectedPropertyNumbers]
    : [],
});

function PropertiesSelectionModal({
  isOpen,
  onClose,
  onSave,
  title = 'Properties',
  propertyLabelPrefix = 'Property',
  properties = [],
  value,
}) {
  const [draft, setDraft] = useState(buildDraftState(value));
  const windowFrame = useFloatingWindow({ isOpen, defaultTop: 60 });

  useEffect(() => {
    if (!isOpen) return;
    setDraft(buildDraftState(value));
  }, [isOpen, value]);

  const normalizedProperties = useMemo(
    () =>
      properties.map((property, index) => ({
        number: Number(property.number || index + 1),
        name: property.name || `${propertyLabelPrefix} ${index + 1}`,
      })),
    [properties, propertyLabelPrefix],
  );

  const selectedSet = useMemo(
    () => new Set(draft.selectedPropertyNumbers.map((entry) => Number(entry))),
    [draft.selectedPropertyNumbers],
  );

  const toggleProperty = (number) => {
    setDraft((current) => {
      const exists = current.selectedPropertyNumbers.some((entry) => Number(entry) === Number(number));
      return {
        ...current,
        selectedPropertyNumbers: exists
          ? current.selectedPropertyNumbers.filter((entry) => Number(entry) !== Number(number))
          : [...current.selectedPropertyNumbers, Number(number)].sort((left, right) => left - right),
      };
    });
  };

  const handleSave = () => {
    onSave({
      ignoreProperties: draft.ignoreProperties,
      linkMode: draft.linkMode,
      exactlyMatch: draft.exactlyMatch,
      selectedPropertyNumbers: [...draft.selectedPropertyNumbers].sort((left, right) => left - right),
    });
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="sap-properties-modal__backdrop" onClick={onClose}>
      <div
        className="sap-properties-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        {...windowFrame.windowProps}
      >
        <div className="sap-properties-modal__titlebar" {...windowFrame.titleBarProps}>
          <div className="sap-properties-modal__title">{title}</div>
          <div className="sap-properties-modal__controls">
            <button
              type="button"
              aria-label={windowFrame.isMinimized ? 'Restore' : 'Minimize'}
              onClick={windowFrame.toggleMinimize}
            >
              {windowFrame.isMinimized ? '□' : '-'}
            </button>
            <button type="button" aria-label="Restore" onClick={windowFrame.restoreWindow}>□</button>
            <button type="button" aria-label="Close" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="sap-properties-modal__accent" />

        {!windowFrame.isMinimized ? (
          <div className="sap-properties-modal__body">
          <div className="sap-properties-modal__panel">
            <label className="sap-properties-modal__checkbox-line">
              <input
                type="checkbox"
                checked={draft.ignoreProperties}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    ignoreProperties: event.target.checked,
                  }))
                }
              />
              <span>Ignore Properties</span>
            </label>

            <div className={`sap-properties-modal__top-options${draft.ignoreProperties ? ' is-disabled' : ''}`}>
              <div className="sap-properties-modal__link-row">
                <span className="sap-properties-modal__top-label">Link</span>
                <label className="sap-properties-modal__radio-line">
                  <input
                    type="radio"
                    name="propertyLinkMode"
                    checked={draft.linkMode === 'or'}
                    onChange={() => setDraft((current) => ({ ...current, linkMode: 'or' }))}
                    disabled={draft.ignoreProperties}
                  />
                  <span>Or</span>
                </label>
                <label className="sap-properties-modal__radio-line">
                  <input
                    type="radio"
                    name="propertyLinkMode"
                    checked={draft.linkMode === 'and'}
                    onChange={() => setDraft((current) => ({ ...current, linkMode: 'and' }))}
                    disabled={draft.ignoreProperties}
                  />
                  <span>And</span>
                </label>
              </div>

              <label className="sap-properties-modal__checkbox-line">
                <input
                  type="checkbox"
                  checked={draft.exactlyMatch}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      exactlyMatch: event.target.checked,
                    }))
                  }
                  disabled={draft.ignoreProperties}
                />
                <span>Exactly Match</span>
              </label>
            </div>

            <div className={`sap-properties-modal__grid-wrap${draft.ignoreProperties ? ' is-disabled' : ''}`}>
              <table className="sap-properties-modal__grid">
                <thead>
                  <tr>
                    <th className="is-index">&nbsp;</th>
                    <th className="is-property">Property</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedProperties.map((property) => {
                    const isSelected = selectedSet.has(property.number);
                    return (
                      <tr
                        key={property.number}
                        className={isSelected ? 'is-selected' : ''}
                        onClick={() => {
                          if (!draft.ignoreProperties) {
                            toggleProperty(property.number);
                          }
                        }}
                      >
                        <td className="is-index">{property.number}</td>
                        <td className="is-property">{property.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sap-properties-modal__toolbar">
              <button
                type="button"
                className="sap-properties-modal__action-btn"
                disabled={draft.ignoreProperties}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    selectedPropertyNumbers: [],
                  }))
                }
              >
                Clear Selection
              </button>
              <button
                type="button"
                className="sap-properties-modal__action-btn"
                disabled={draft.ignoreProperties}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    selectedPropertyNumbers: normalizedProperties
                      .map((property) => property.number)
                      .filter((number) => !selectedSet.has(number)),
                  }))
                }
              >
                Invert Selection
              </button>
              <button
                type="button"
                className="sap-properties-modal__action-btn"
                disabled={draft.ignoreProperties}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    selectedPropertyNumbers: normalizedProperties.map((property) => property.number),
                  }))
                }
              >
                Select All
              </button>
            </div>
          </div>

          <div className="sap-properties-modal__footer">
            <button type="button" className="sap-properties-modal__primary-btn" onClick={handleSave}>
              OK
            </button>
            <button type="button" className="sap-properties-modal__primary-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PropertiesSelectionModal;
