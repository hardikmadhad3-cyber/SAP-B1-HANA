import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const normalize = (value) => String(value ?? '').trim().toLowerCase();

const formatRate = (rate) => {
  if (rate === null || rate === undefined || rate === '') return '0';
  const num = Number(rate);
  if (!Number.isFinite(num)) return String(rate);
  return Number.isInteger(num) ? String(num) : String(num.toFixed(2)).replace(/\.?0+$/, '');
};

export const formatTaxCodeOption = (taxCode = {}) => {
  const code = String(taxCode.Code || '').trim();
  const name = String(taxCode.Name || taxCode.Description || '').trim();
  const rate = formatRate(taxCode.Rate);
  return [code, name, `${rate} %`].filter(Boolean).join(' - ');
};

export default function TaxCodeLookup({
  value,
  taxCodes = [],
  onChange,
  name = 'taxCode',
  className = '',
  style,
  disabled = false,
  error = false,
}) {
  const selected = taxCodes.find((tax) => String(tax.Code || '') === String(value || ''));
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const displayValue = open ? search : (selected ? formatTaxCodeOption(selected) : (value || ''));
  const needle = normalize(search);

  const options = useMemo(() => {
    const filtered = needle
      ? taxCodes.filter((tax) => {
          const haystack = `${tax.Code || ''} ${tax.Name || ''} ${tax.Description || ''} ${tax.Rate ?? ''}`.toLowerCase();
          return haystack.includes(needle);
        })
      : taxCodes;
    return filtered.slice(0, 100);
  }, [needle, taxCodes]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSearch('');
    setMenuStyle(null);
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!inputRef.current) return;

    const rect = inputRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const gutter = 8;
    const preferredWidth = Math.max(rect.width, 280);
    const width = Math.min(preferredWidth, viewportWidth - gutter * 2);
    const left = Math.min(Math.max(rect.left, gutter), viewportWidth - width - gutter);
    const spaceBelow = viewportHeight - rect.bottom - gutter;
    const spaceAbove = rect.top - gutter;
    const maxHeight = Math.max(120, Math.min(240, Math.max(spaceBelow, spaceAbove)));
    const opensUp = spaceBelow < 160 && spaceAbove > spaceBelow;

    setMenuStyle({
      position: 'fixed',
      zIndex: 30000,
      top: opensUp ? 'auto' : rect.bottom + 2,
      bottom: opensUp ? viewportHeight - rect.top + 2 : 'auto',
      left,
      width,
      maxHeight,
      overflowY: 'auto',
      background: '#fff',
      border: '1px solid #8fa4bd',
      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.18)',
      borderRadius: 2,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updateMenuPosition();
  }, [open, updateMenuPosition, options.length]);

  useEffect(() => {
    if (!open) return undefined;

    const isInsideLookup = (target) => (
      inputRef.current?.contains(target) || menuRef.current?.contains(target)
    );

    const handleOutsidePointer = (event) => {
      if (!isInsideLookup(event.target)) {
        closeMenu();
      }
    };

    const handleOutsideFocus = (event) => {
      if (!isInsideLookup(event.target)) {
        closeMenu();
      }
    };

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('pointerdown', handleOutsidePointer, true);
    document.addEventListener('focusin', handleOutsideFocus, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('pointerdown', handleOutsidePointer, true);
      document.removeEventListener('focusin', handleOutsideFocus, true);
    };
  }, [closeMenu, open, updateMenuPosition]);

  useEffect(() => {
    if (disabled && open) {
      closeMenu();
    }
  }, [closeMenu, disabled, open]);

  const commit = (code) => {
    onChange({
      target: {
        name,
        value: code,
      },
    });
    closeMenu();
  };

  const canShowEmptyMessage = needle.length > 0;
  const shouldRenderMenu = open && !disabled && menuStyle && (options.length > 0 || canShowEmptyMessage);

  const menu = shouldRenderMenu ? (
    <div ref={menuRef} style={menuStyle}>
      {options.length ? options.map((tax) => (
        <button
          key={tax.Code}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            commit(tax.Code);
          }}
          style={{
            display: 'block',
            width: '100%',
            minHeight: 24,
            padding: '4px 8px',
            border: 0,
            borderBottom: '1px solid #edf1f5',
            background: String(tax.Code || '') === String(value || '') ? '#dfeaf6' : '#fff',
            color: '#111',
            textAlign: 'left',
            fontSize: 11,
            lineHeight: '16px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={formatTaxCodeOption(tax)}
        >
          {formatTaxCodeOption(tax)}
        </button>
      )) : canShowEmptyMessage ? (
        <div style={{ padding: '6px 8px', fontSize: 11, color: '#6b7280' }}>No tax codes found</div>
      ) : null}
    </div>
  ) : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        className={className}
        style={style}
        value={displayValue}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        onFocus={() => {
          setSearch('');
          setOpen(true);
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (
              document.activeElement !== inputRef.current &&
              !menuRef.current?.contains(document.activeElement)
            ) {
              closeMenu();
            }
          }, 120);
        }}
        placeholder="Search tax code"
      />
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
