import React, { useEffect, useMemo, useState } from 'react';

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.34)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const dialogStyle = {
  backgroundColor: 'var(--sap-surface)',
  border: '1px solid var(--sap-border-strong)',
  borderRadius: 'var(--sap-radius-md)',
  width: '820px',
  maxWidth: '92vw',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--sap-shadow-modal)',
  color: 'var(--sap-text)',
  fontFamily: 'var(--sap-font-family)',
};

const headerStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--sap-border)',
  background: 'var(--sap-toolbar-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const closeButtonStyle = {
  background: 'none',
  border: 'none',
  fontSize: 20,
  cursor: 'pointer',
  color: 'var(--sap-text-muted)',
  padding: 0,
  width: 24,
  height: 24,
};

const footerButtonStyle = {
  padding: '6px 16px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 3,
  cursor: 'pointer',
};

const primaryButtonStyle = {
  ...footerButtonStyle,
  border: '1px solid var(--sap-primary-dark)',
  background: 'linear-gradient(180deg, var(--sap-primary) 0%, var(--sap-primary-dark) 100%)',
  color: '#fff',
};

const neutralButtonStyle = {
  ...footerButtonStyle,
  border: '1px solid var(--sap-border-strong)',
  background: 'linear-gradient(180deg, #ffffff 0%, #e8edf2 100%)',
  color: 'var(--sap-text)',
};

export default function QualitySelectionModal({
  isOpen,
  onClose,
  onSelect,
  onCreate,
  options = [],
  title = 'List of User-Defined Values',
  searchPlaceholder = 'Search values',
  emptyMessage = 'No values found',
  allowCreate = true,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;

    return options.filter((option) => {
      const value = String(option?.value || '').toLowerCase();
      const description = String(option?.description || '').toLowerCase();
      const label = String(option?.label || '').toLowerCase();
      return value.includes(query) || description.includes(query) || label.includes(query);
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

  const handleClose = () => {
    setSearchQuery('');
    setSelectedIndex(-1);
    setShowCreateForm(false);
    setNewValue('');
    setNewDescription('');
    setCreateError('');
    setSaving(false);
    onClose();
  };

  const handleChoose = () => {
    if (selectedIndex < 0 || !filteredOptions[selectedIndex]) return;
    onSelect(filteredOptions[selectedIndex]);
    handleClose();
  };

  const handleStartCreate = () => {
    setShowCreateForm(true);
    setCreateError('');
    setNewValue(searchQuery.trim());
    setNewDescription(searchQuery.trim());
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

      if (createdOption) {
        onSelect(createdOption);
        handleClose();
      }
    } catch (error) {
      setCreateError(error?.response?.data?.detail || error?.message || 'Failed to create value.');
    } finally {
      setSaving(false);
    }
  };

  const showDescriptionColumn = filteredOptions.some(
    (option) => option?.description && option.description !== option.value
  );

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={handleClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--sap-heading)' }}>{title}</h3>
          <button type="button" onClick={handleClose} style={closeButtonStyle}>
            x
          </button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sap-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, minWidth: 40 }}>Find</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 12,
                border: '1px solid var(--sap-border-strong)',
                borderRadius: 'var(--sap-radius-xs)',
              }}
              autoFocus
            />
          </div>
        </div>

        {allowCreate && showCreateForm && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sap-border)', background: 'var(--sap-surface-soft)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Value</label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--sap-border-strong)', borderRadius: 'var(--sap-radius-xs)' }}
                autoFocus
              />
              <label style={{ fontSize: 12, fontWeight: 600 }}>Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--sap-border-strong)', borderRadius: 'var(--sap-radius-xs)' }}
              />
            </div>
            {createError && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sap-danger)' }}>{createError}</div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 11,
              marginTop: 8,
            }}
          >
            <thead>
              <tr style={{ background: 'var(--sap-toolbar-bg)', borderBottom: '1px solid var(--sap-border)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 40 }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Value</th>
                {showDescriptionColumn && (
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: '35%' }}>
                    Description
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredOptions.length === 0 ? (
                <tr>
                  <td
                    colSpan={showDescriptionColumn ? 3 : 2}
                    style={{ padding: 20, textAlign: 'center', color: 'var(--sap-text-muted)' }}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                filteredOptions.map((option, index) => (
                  <tr
                    key={`${option.value}-${index}`}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => {
                      onSelect(option);
                      handleClose();
                    }}
                    style={{
                      backgroundColor: selectedIndex === index ? 'var(--sap-primary-soft)' : index % 2 === 0 ? 'var(--sap-surface)' : 'var(--sap-row-even)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--sap-border-soft)',
                    }}
                  >
                    <td style={{ padding: '6px 8px', color: 'var(--sap-text-muted)' }}>{index + 1}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{option.value}</td>
                    {showDescriptionColumn && (
                      <td style={{ padding: '6px 8px' }}>{option.description || ''}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--sap-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            background: 'var(--sap-toolbar-bg)',
            }}
          >
          {allowCreate && showCreateForm ? (
            <>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                style={{
                  ...primaryButtonStyle,
                  opacity: saving ? 0.65 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateError('');
                  setNewValue('');
                  setNewDescription('');
                }}
                style={neutralButtonStyle}
              >
                Cancel New
              </button>
            </>
          ) : allowCreate ? (
            <button
              type="button"
              onClick={handleStartCreate}
              style={primaryButtonStyle}
            >
              New
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleChoose}
            disabled={selectedIndex < 0}
            style={{
              ...primaryButtonStyle,
              opacity: selectedIndex >= 0 ? 1 : 0.65,
              cursor: selectedIndex >= 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Choose
          </button>
          <button
            type="button"
            onClick={handleClose}
            style={neutralButtonStyle}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
