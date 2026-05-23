import { useEffect, useRef } from 'react';

const ERROR_CLASS = 'sap-validation-error';

const cssEscape = (value) => {
  if (typeof window !== 'undefined' && window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return String(value || '').replace(/["\\]/g, '\\$&');
};

const hasValue = (value) => {
  if (!value) return false;
  if (typeof value === 'object') {
    return Object.values(value).some(hasValue);
  }
  return String(value).trim() !== '';
};

const getErrorSignature = (valErrors = {}) => JSON.stringify({
  header: valErrors.header || {},
  lines: valErrors.lines || {},
  form: valErrors.form || '',
});

const markControl = (control, message) => {
  if (!control) return null;

  control.classList.add(ERROR_CLASS);
  control.setAttribute('aria-invalid', 'true');
  if (message) control.setAttribute('title', String(message));

  const field = control.closest('.so-field, .po-field, .del-field, .im-field, td');
  field?.classList.add('sap-validation-error-field');

  return control;
};

const clearHighlights = (root) => {
  root.querySelectorAll(`.${ERROR_CLASS}`).forEach((control) => {
    control.classList.remove(ERROR_CLASS);
    control.removeAttribute('aria-invalid');
    control.removeAttribute('title');
  });
  root.querySelectorAll('.sap-validation-error-field').forEach((field) => {
    field.classList.remove('sap-validation-error-field');
  });
};

const findNamedControls = (root, name) =>
  Array.from(root.querySelectorAll(`[name="${cssEscape(name)}"]`));

const focusFirstError = (control) => {
  if (!control) return;

  const scrollTarget = control.closest('td, .so-field, .po-field, .del-field, .im-field') || control;
  scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

  if (typeof control.focus === 'function' && !control.disabled && !control.readOnly) {
    window.setTimeout(() => control.focus({ preventScroll: true }), 120);
  }
};

export default function useValidationHighlights(valErrors, { enabled = true, rootRef = null } = {}) {
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    const root = rootRef?.current || document.querySelector('.sap-document-page, .po-page, form');
    if (!root) return undefined;

    clearHighlights(root);

    if (!hasValue(valErrors)) {
      lastSignatureRef.current = '';
      return undefined;
    }

    const markedControls = [];
    Object.entries(valErrors.header || {}).forEach(([fieldName, message]) => {
      if (!hasValue(message)) return;
      const control = findNamedControls(root, fieldName)[0];
      const markedControl = markControl(control, message);
      if (markedControl) markedControls.push(markedControl);
    });

    Object.entries(valErrors.lines || {}).forEach(([lineIndex, lineErrors]) => {
      if (!lineErrors || typeof lineErrors !== 'object') return;
      Object.entries(lineErrors).forEach(([fieldName, message]) => {
        if (!hasValue(message)) return;
        const controls = findNamedControls(root, fieldName);
        const control = controls[Number(lineIndex)] || controls[0];
        const markedControl = markControl(control, message);
        if (markedControl) markedControls.push(markedControl);
      });
    });

    const signature = getErrorSignature(valErrors);
    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
      focusFirstError(markedControls[0]);
    }

    return undefined;
  }, [enabled, rootRef, valErrors]);
}
