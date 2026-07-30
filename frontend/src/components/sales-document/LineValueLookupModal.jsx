import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { matchesSapSearchText } from '../../utils/sapSearch';

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.34)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 21000,
};

const dialogStyle = {
  backgroundColor: 'var(--sap-surface)',
  border: '1px solid var(--sap-border-strong)',
  borderRadius: 'var(--sap-radius-md)',
  width: 820,
  maxWidth: 'calc(100% - 40px)',
  maxHeight: 'calc(100% - 48px)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--sap-shadow-modal)',
  color: 'var(--sap-text)',
  fontFamily: 'var(--sap-font-family)',
};

const buttonStyle = {
  padding: '6px 16px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 3,
  cursor: 'pointer',
};

const primaryButtonStyle = {
  ...buttonStyle,
  border: '1px solid var(--sap-primary-dark)',
  background: 'linear-gradient(180deg, var(--sap-primary) 0%, var(--sap-primary-dark) 100%)',
  color: '#fff',
};

const neutralButtonStyle = {
  ...buttonStyle,
  border: '1px solid var(--sap-border-strong)',
  background: 'linear-gradient(180deg, #ffffff 0%, #e8edf2 100%)',
  color: 'var(--sap-text)',
};

export default function LineValueLookupModal({
  isOpen,
  onClose,
  onSelect,
  onCreate,
  options = [],
  title = 'List of User-Defined Values',
  searchPlaceholder = 'Search values',
  emptyMessage = 'No values found',
  allowCreate = true,
  columns = null,
  createValueLabel = 'Value',
  createDescriptionLabel = 'Description',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;

    return options.filter((option) => {
      const searchableValues = [
        option?.value,
        option?.description,
        option?.label,
        ...Object.values(option || {}),
      ];
      return searchableValues.some((item) => matchesSapSearchText(item, searchQuery));
    });
  }, [options, searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedIndex(-1);
      setShowCreateForm(false);
      setNewValue('');
      setNewDescription('');
      setCreateError('');
      setSaving(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery, options]);

  const resetModal = () => {
    setSearchQuery('');
    setSelectedIndex(-1);
    setShowCreateForm(false);
    setNewValue('');
    setNewDescription('');
    setCreateError('');
    setSaving(false);
  };

  const closeModal = () => {
    resetModal();
    onClose();
    window.SapB1TabNavigation?.restoreLookup?.();
  };

  const chooseOption = (option) => {
    const selection = onSelect(option);
    resetModal();
    onClose();
    Promise.resolve(selection).finally(() => {
      window.SapB1TabNavigation?.completeLookup?.();
    });
  };

  const handleChoose = () => {
    if (selectedIndex < 0 || !filteredOptions[selectedIndex]) return;
    chooseOption(filteredOptions[selectedIndex]);
  };

  const handleCreate = async () => {
    const normalizedValue = String(newValue || '').trim();
    const normalizedDescription = String(newDescription || normalizedValue).trim();

    if (!normalizedValue) {
      setCreateError('Value is required.');
      return;
    }

    if (!onCreate) return;

    try {
      setSaving(true);
      setCreateError('');
      const createdOption = await onCreate({
        value: normalizedValue,
        description: normalizedDescription,
      });

      if (createdOption) chooseOption(createdOption);
    } catch (error) {
      setCreateError(error?.response?.data?.detail || error?.message || 'Failed to create value.');
    } finally {
      setSaving(false);
    }
  };

  const effectiveColumns = Array.isArray(columns) && columns.length
    ? columns
    : null;

  const showDescriptionColumn = !effectiveColumns && filteredOptions.some(
    (option) => option?.description && option.description !== option.value
  );
  const totalColumns = effectiveColumns ? effectiveColumns.length + 1 : (showDescriptionColumn ? 3 : 2);

  if (!isOpen) return null;

  const modal = (
    <div style={overlayStyle} onClick={closeModal}>
      <div style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sap-border)', background: 'var(--sap-toolbar-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--sap-heading)' }}>{title}</h3>
          <button type="button" onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--sap-text-muted)', padding: 0, width: 24, height: 24 }}>x</button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sap-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, minWidth: 40 }}>Find</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '1px solid var(--sap-border-strong)', borderRadius: 'var(--sap-radius-xs)' }}
              autoFocus
            />
          </div>
        </div>

        {allowCreate && showCreateForm && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sap-border)', background: 'var(--sap-surface-soft)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>{createValueLabel}</label>
              <input type="text" value={newValue} onChange={(event) => setNewValue(event.target.value)} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--sap-border-strong)', borderRadius: 'var(--sap-radius-xs)' }} autoFocus />
              <label style={{ fontSize: 12, fontWeight: 600 }}>{createDescriptionLabel}</label>
              <input type="text" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--sap-border-strong)', borderRadius: 'var(--sap-radius-xs)' }} />
            </div>
            {createError && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sap-danger)' }}>{createError}</div>}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 8 }}>
            <thead>
              <tr style={{ background: 'var(--sap-toolbar-bg)', borderBottom: '1px solid var(--sap-border)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 40 }}>#</th>
                {effectiveColumns ? (
                  effectiveColumns.map((column) => (
                    <th
                      key={column.key}
                      style={{
                        padding: '6px 8px',
                        textAlign: column.align || 'left',
                        fontWeight: 600,
                        width: column.width,
                      }}
                    >
                      {column.label}
                    </th>
                  ))
                ) : (
                  <>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Value</th>
                    {showDescriptionColumn && <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: '35%' }}>Description</th>}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredOptions.length === 0 ? (
                <tr>
                  <td colSpan={totalColumns} style={{ padding: 20, textAlign: 'center', color: 'var(--sap-text-muted)' }}>{emptyMessage}</td>
                </tr>
              ) : (
                filteredOptions.map((option, index) => (
                  <tr
                    key={`${option.value}-${index}`}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => chooseOption(option)}
                    style={{ backgroundColor: selectedIndex === index ? 'var(--sap-primary-soft)' : index % 2 === 0 ? 'var(--sap-surface)' : 'var(--sap-row-even)', cursor: 'pointer', borderBottom: '1px solid var(--sap-border-soft)' }}
                  >
                    <td style={{ padding: '6px 8px', color: 'var(--sap-text-muted)' }}>{index + 1}</td>
                    {effectiveColumns ? (
                      effectiveColumns.map((column) => (
                        <td
                          key={column.key}
                          style={{
                            padding: '6px 8px',
                            fontWeight: column.primary ? 500 : 400,
                            textAlign: column.align || 'left',
                          }}
                        >
                          {option[column.key] ?? ''}
                        </td>
                      ))
                    ) : (
                      <>
                        <td style={{ padding: '6px 8px', fontWeight: 500 }}>{option.value}</td>
                        {showDescriptionColumn && <td style={{ padding: '6px 8px' }}>{option.description || ''}</td>}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--sap-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--sap-toolbar-bg)' }}>
          {allowCreate && showCreateForm ? (
            <>
              <button type="button" onClick={handleCreate} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.65 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => { setShowCreateForm(false); setCreateError(''); setNewValue(''); setNewDescription(''); }} style={neutralButtonStyle}>Cancel New</button>
            </>
          ) : allowCreate ? (
            <button type="button" onClick={() => { setShowCreateForm(true); setCreateError(''); setNewValue(searchQuery.trim()); setNewDescription(searchQuery.trim()); }} style={primaryButtonStyle}>New</button>
          ) : null}
          <button type="button" onClick={handleChoose} disabled={selectedIndex < 0} style={{ ...primaryButtonStyle, opacity: selectedIndex >= 0 ? 1 : 0.65, cursor: selectedIndex >= 0 ? 'pointer' : 'not-allowed' }}>Choose</button>
          <button type="button" onClick={closeModal} style={neutralButtonStyle}>Cancel</button>
        </div>
      </div>
    </div>
  );

  const target = typeof document !== 'undefined'
    ? document.querySelector('.app-shell__content') || document.body
    : null;

  return target ? createPortal(modal, target) : modal;
}
