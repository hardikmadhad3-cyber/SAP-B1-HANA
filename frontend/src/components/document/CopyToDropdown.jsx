import React from 'react';
import { getCopyToTargets } from '../../services/documentCopyService';

const closeDropdowns = (dropdownClassName) => {
  if (typeof document === 'undefined') return;
  document.querySelectorAll(`.${dropdownClassName}`).forEach((node) => node.classList.remove('active'));
};

export default function CopyToDropdown({
  sourceDocType,
  disabled = false,
  onCopyTo,
  buttonClassName = 'so-btn sap-document-toolbar__copy',
  dropdownClassName = 'so-dropdown',
  menuClassName = 'so-dropdown-menu',
  style,
}) {
  const targets = getCopyToTargets(sourceDocType);
  const isDisabled = disabled || !targets.length;

  return (
    <div className={dropdownClassName} style={style}>
      <button
        type="button"
        className={buttonClassName}
        disabled={isDisabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (isDisabled) return;

          const dropdown = event.currentTarget.parentElement;
          const isActive = dropdown.classList.contains('active');
          closeDropdowns(dropdownClassName);
          if (!isActive) dropdown.classList.add('active');
        }}
        style={{ opacity: isDisabled ? 0.5 : 1 }}
      >
        Copy To ▼
      </button>
      <div className={menuClassName}>
        {targets.map((target) => (
          <button
            key={target.key}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onCopyTo?.(target.key);
              closeDropdowns(dropdownClassName);
            }}
          >
            {target.label}
          </button>
        ))}
      </div>
    </div>
  );
}
