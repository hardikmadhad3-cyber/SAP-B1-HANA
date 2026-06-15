import React, { useEffect, useMemo, useState } from 'react';

const FIELD_BY_DIMENSION = {
  1: 'distributionRule',
  2: 'distributionRule2',
  3: 'distributionRule3',
  4: 'distributionRule4',
  5: 'distributionRule5',
};

const getRuleCode = (rule) => String(rule?.FactorCode || rule?.OcrCode || rule?.code || '').trim();
const getRuleName = (rule) => String(rule?.FactorDescription || rule?.OcrName || rule?.name || '').trim();
const getRuleDimensionCode = (rule) => String(rule?.DimensionCode || rule?.DimCode || rule?.dimensionCode || '1').trim() || '1';
const getDimensionCode = (dimension) => String(dimension?.DimensionCode || dimension?.DimCode || dimension?.code || '1').trim() || '1';
const getDimensionName = (dimension) => String(dimension?.DimensionName || dimension?.DimName || dimension?.DimDesc || dimension?.name || `Dimension ${getDimensionCode(dimension)}`).trim();

const buttonStyle = {
  border: '1px solid var(--sap-border-strong)',
  borderRadius: 2,
  background: 'linear-gradient(180deg, #fff 0%, #e8ecf0 100%)',
  cursor: 'pointer',
  fontSize: 12,
  height: 26,
  minWidth: 82,
  padding: '2px 10px',
};

const buildDimensions = (dimensions = [], rules = []) => {
  const map = new Map();

  dimensions.forEach((dimension) => {
    const code = getDimensionCode(dimension);
    if (Number(code) >= 1 && Number(code) <= 5) {
      map.set(code, { DimensionCode: code, DimensionName: getDimensionName(dimension) });
    }
  });

  rules.forEach((rule) => {
    const code = getRuleDimensionCode(rule);
    if (Number(code) >= 1 && Number(code) <= 5 && !map.has(code)) {
      map.set(code, { DimensionCode: code, DimensionName: rule.DimensionName || `Dimension ${code}` });
    }
  });

  if (!map.size) {
    map.set('1', { DimensionCode: '1', DimensionName: 'Distribution Rule' });
  }

  return [...map.values()].sort((a, b) => Number(a.DimensionCode) - Number(b.DimensionCode));
};

export default function DistributionRuleAssignmentModal({
  isOpen,
  line,
  rules = [],
  dimensions = [],
  onClose,
  onApply,
}) {
  const dimensionRows = useMemo(() => buildDimensions(dimensions, rules), [dimensions, rules]);
  const [draft, setDraft] = useState({});
  const [activeDimensionCode, setActiveDimensionCode] = useState('');
  const [pickerDimensionCode, setPickerDimensionCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRuleIndex, setSelectedRuleIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen) return;

    const nextDraft = {};
    dimensionRows.forEach((dimension) => {
      const code = getDimensionCode(dimension);
      nextDraft[code] = line?.[FIELD_BY_DIMENSION[Number(code)]] || '';
    });
    setDraft(nextDraft);
    setActiveDimensionCode(dimensionRows[0] ? getDimensionCode(dimensionRows[0]) : '1');
    setPickerDimensionCode('');
    setSearchQuery('');
    setSelectedRuleIndex(-1);
  }, [dimensionRows, isOpen, line]);

  const pickerDimension = dimensionRows.find((dimension) => getDimensionCode(dimension) === pickerDimensionCode);
  const activeRules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (rules || [])
      .filter((rule) => getRuleDimensionCode(rule) === pickerDimensionCode)
      .filter((rule) => {
        if (!query) return true;
        return getRuleCode(rule).toLowerCase().includes(query) || getRuleName(rule).toLowerCase().includes(query);
      });
  }, [pickerDimensionCode, rules, searchQuery]);

  useEffect(() => {
    setSelectedRuleIndex(-1);
  }, [pickerDimensionCode, searchQuery]);

  if (!isOpen) return null;

  const selectRule = (rule) => {
    setDraft((current) => ({ ...current, [pickerDimensionCode]: getRuleCode(rule) }));
    setPickerDimensionCode('');
  };

  const chooseSelectedRule = () => {
    if (selectedRuleIndex < 0 || !activeRules[selectedRuleIndex]) return;
    selectRule(activeRules[selectedRuleIndex]);
  };

  const openRulePicker = (dimensionCode) => {
    setActiveDimensionCode(dimensionCode);
    setPickerDimensionCode(dimensionCode);
    setSearchQuery('');
    setSelectedRuleIndex(-1);
  };

  const closeRulePicker = () => {
    setPickerDimensionCode('');
    setSearchQuery('');
    setSelectedRuleIndex(-1);
  };

  const getSelectedRuleName = (dimensionCode) => {
    const selectedCode = draft[dimensionCode];
    if (!selectedCode) return '';
    const selectedRule = rules.find((rule) => getRuleDimensionCode(rule) === dimensionCode && getRuleCode(rule) === selectedCode);
    return selectedRule ? getRuleName(selectedRule) : '';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.34)' }} onClick={onClose}>
      <div style={{ width: 690, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--sap-surface)', border: '1px solid var(--sap-border-strong)', boxShadow: 'var(--sap-shadow-modal)' }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--sap-toolbar-bg)', borderBottom: '3px solid var(--sap-primary)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Select Distr. Rule</h3>
          <button type="button" onClick={onClose} style={{ width: 24, height: 22, border: '1px solid var(--sap-border-strong)', background: '#f5f6f7', cursor: 'pointer' }}>x</button>
        </div>

        <div style={{ padding: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--sap-toolbar-bg)' }}>
                <th style={{ width: 42, padding: 6, textAlign: 'left', border: '1px solid var(--sap-border)' }}>#</th>
                <th style={{ padding: 6, textAlign: 'left', border: '1px solid var(--sap-border)' }}>Dimensions</th>
                <th style={{ padding: 6, textAlign: 'left', border: '1px solid var(--sap-border)' }}>Distr. Rule Code</th>
                <th style={{ padding: 6, textAlign: 'left', border: '1px solid var(--sap-border)' }}>Distr. Rule Name</th>
              </tr>
            </thead>
            <tbody>
              {dimensionRows.map((dimension, index) => {
                const dimensionCode = getDimensionCode(dimension);
                const isActive = dimensionCode === activeDimensionCode;
                return (
                  <tr key={dimensionCode} onClick={() => setActiveDimensionCode(dimensionCode)} style={{ background: isActive ? '#ffe999' : index % 2 ? 'var(--sap-row-even)' : 'var(--sap-surface)', cursor: 'pointer' }}>
                    <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)' }}>{index + 1}</td>
                    <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)', fontWeight: 600 }}>{getDimensionName(dimension)}</td>
                    <td style={{ padding: 3, border: '1px solid var(--sap-border)' }}>
                      <input readOnly value={draft[dimensionCode] || ''} onFocus={() => setActiveDimensionCode(dimensionCode)} style={{ width: 'calc(100% - 28px)', height: 22, border: '1px solid var(--sap-border-strong)', padding: '2px 5px', background: '#fff7bf' }} />
                      <button type="button" onClick={() => openRulePicker(dimensionCode)} style={{ ...buttonStyle, minWidth: 24, width: 24, height: 22, padding: 0, marginLeft: 2 }}>...</button>
                    </td>
                    <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)' }}>{getSelectedRuleName(dimensionCode)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--sap-border)', display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => onApply(draft)} style={{ ...buttonStyle, background: 'linear-gradient(180deg, var(--sap-primary) 0%, var(--sap-primary-dark) 100%)', color: '#fff' }}>OK</button>
          <button type="button" onClick={onClose} style={buttonStyle}>Cancel</button>
        </div>

        {pickerDimensionCode ? (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.22)' }} onClick={closeRulePicker}>
            <div style={{ width: 560, maxWidth: '92vw', maxHeight: '78vh', display: 'flex', flexDirection: 'column', background: 'var(--sap-surface)', border: '1px solid var(--sap-border-strong)', boxShadow: 'var(--sap-shadow-modal)' }} onClick={(event) => event.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '3px solid var(--sap-primary)', background: 'var(--sap-toolbar-bg)', fontWeight: 600, fontSize: 13 }}>
                <span>List of Distribution Rules</span>
                <button type="button" onClick={closeRulePicker} style={{ width: 24, height: 22, border: '1px solid var(--sap-border-strong)', background: '#f5f6f7', cursor: 'pointer' }}>x</button>
              </div>
              <div style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ minWidth: 32, fontSize: 12, fontWeight: 600 }}>Find</label>
                <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} style={{ flex: 1, height: 24, border: '1px solid var(--sap-border-strong)', padding: '2px 6px' }} />
              </div>
              <div style={{ padding: '0 10px 8px', fontSize: 12, color: 'var(--sap-text-muted)' }}>{pickerDimension ? getDimensionName(pickerDimension) : ''}</div>
              <div style={{ flex: 1, minHeight: 160, overflow: 'auto', padding: '0 10px 10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--sap-toolbar-bg)' }}>
                      <th style={{ padding: 6, textAlign: 'left', border: '1px solid var(--sap-border)' }}>Distribution Rule</th>
                      <th style={{ padding: 6, textAlign: 'left', border: '1px solid var(--sap-border)' }}>Distribution Rule Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRules.length ? activeRules.map((rule, index) => (
                      <tr key={`${getRuleCode(rule)}-${index}`} onClick={() => setSelectedRuleIndex(index)} onDoubleClick={() => selectRule(rule)} style={{ background: selectedRuleIndex === index ? '#ffe999' : index % 2 ? 'var(--sap-row-even)' : 'var(--sap-surface)', cursor: 'pointer' }}>
                        <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)', fontWeight: 600 }}>{getRuleCode(rule)}</td>
                        <td style={{ padding: '5px 6px', border: '1px solid var(--sap-border)' }}>{getRuleName(rule)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={2} style={{ padding: 16, textAlign: 'center', color: 'var(--sap-text-muted)' }}>No distribution rules found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: 10, borderTop: '1px solid var(--sap-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={chooseSelectedRule} disabled={selectedRuleIndex < 0} style={{ ...buttonStyle, opacity: selectedRuleIndex >= 0 ? 1 : 0.6 }}>Choose</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
