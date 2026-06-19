import React from 'react';

const CURRENCY_MODES = [
  { value: 'BP', label: 'BP Currency' },
  { value: 'LOCAL', label: 'Local Currency' },
  { value: 'SYSTEM', label: 'System Currency' },
];

const LOCAL_CURRENCY = 'INR';

const findBpCurrency = (businessPartners = [], cardCode = '') => {
  const partner = businessPartners.find((bp) => String(bp.CardCode || '') === String(cardCode || ''));
  const currency = String(partner?.Currency || '').trim();
  return currency && currency !== '##' ? currency : '';
};

const emitHeaderChange = (onHeaderChange, name, value) => {
  if (typeof onHeaderChange !== 'function') return;
  onHeaderChange({
    target: {
      name,
      value,
      type: 'select-one',
      checked: false,
    },
  });
};

function DocumentCurrencySelect({
  classPrefix = 'so',
  header = {},
  onHeaderChange,
  businessPartners = [],
  disabled = false,
  localCurrency = LOCAL_CURRENCY,
  systemCurrency = '',
}) {
  const mode = header.currencyMode || 'BP';
  const bpCurrency = findBpCurrency(businessPartners, header.vendor);
  const currentCurrency = String(header.currency || '').trim();
  const resolvedLocalCurrency = String(localCurrency || '').trim() || LOCAL_CURRENCY;
  const resolvedSystemCurrency = String(systemCurrency || '').trim() || resolvedLocalCurrency;
  const displayCurrency = mode === 'BP'
    ? (bpCurrency || currentCurrency || resolvedLocalCurrency)
    : mode === 'SYSTEM'
      ? (currentCurrency || resolvedSystemCurrency)
      : (currentCurrency || resolvedLocalCurrency);
  const showCurrencyCode = mode === 'BP';

  const handleModeChange = (event) => {
    const nextMode = event.target.value;
    const nextCurrency = nextMode === 'BP'
      ? (bpCurrency || currentCurrency || resolvedLocalCurrency)
      : nextMode === 'SYSTEM'
        ? resolvedSystemCurrency
        : resolvedLocalCurrency;

    emitHeaderChange(onHeaderChange, 'currencyMode', nextMode);
    emitHeaderChange(onHeaderChange, 'currency', nextCurrency);
  };

  return (
    <div className={`${classPrefix}-field`}>
      <label className={`${classPrefix}-field__label`}>Currency</label>
      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
        <select
          name="currencyMode"
          className={`${classPrefix}-field__select`}
          value={mode}
          onChange={handleModeChange}
          disabled={disabled}
          style={{ flex: '1 1 58%' }}
        >
          {CURRENCY_MODES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {showCurrencyCode && (
          <input
            name="currency"
            className={`${classPrefix}-field__input`}
            value={displayCurrency}
            readOnly
            disabled={disabled}
            style={{ flex: '0 0 92px', background: '#f7f9fb' }}
            tabIndex={-1}
          />
        )}
      </div>
    </div>
  );
}

export default DocumentCurrencySelect;
