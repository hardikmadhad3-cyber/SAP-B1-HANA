import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import SapLookupModal from './common/SapLookupModal';

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
  }, [dimensionRows, isOpen, line]);

  const pickerDimension = dimensionRows.find((dimension) => getDimensionCode(dimension) === pickerDimensionCode);
  const activeRules = useMemo(() => {
    return (rules || []).filter((rule) => getRuleDimensionCode(rule) === pickerDimensionCode);
  }, [pickerDimensionCode, rules]);

  if (!isOpen) return null;

  const selectRule = (rule) => {
    setDraft((current) => ({ ...current, [pickerDimensionCode]: getRuleCode(rule) }));
    setPickerDimensionCode('');
  };

  const openRulePicker = (dimensionCode) => {
    setActiveDimensionCode(dimensionCode);
    setPickerDimensionCode(dimensionCode);
  };

  const closeRulePicker = () => {
    setPickerDimensionCode('');
  };

  const getSelectedRuleName = (dimensionCode) => {
    const selectedCode = draft[dimensionCode];
    if (!selectedCode) return '';
    const selectedRule = rules.find((rule) => getRuleDimensionCode(rule) === dimensionCode && getRuleCode(rule) === selectedCode);
    return selectedRule ? getRuleName(selectedRule) : '';
  };

  const modal = (
    <div style={{ position: 'absolute', inset: 0, zIndex: 21000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.34)' }} onClick={onClose}>
      <div style={{ width: 690, maxWidth: 'calc(100% - 40px)', maxHeight: 'calc(100% - 48px)', display: 'flex', flexDirection: 'column', background: 'var(--sap-surface)', border: '1px solid var(--sap-border-strong)', boxShadow: 'var(--sap-shadow-modal)' }} onClick={(event) => event.stopPropagation()}>
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
                  <tr key={dimensionCode} onClick={() => setActiveDimensionCode(dimensionCode)} style={{ background: isActive ? 'var(--sap-row-hover)' : index % 2 ? 'var(--sap-row-even)' : 'var(--sap-surface)', cursor: 'pointer' }}>
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

        <SapLookupModal
          open={Boolean(pickerDimensionCode)}
          title="List of Distribution Rules"
          columns={[
            { key: 'ruleCode', label: 'Distribution Rule', width: 180, render: getRuleCode },
            { key: 'ruleName', label: 'Distribution Rule Name', render: getRuleName },
          ]}
          rows={activeRules}
          searchPlaceholder={pickerDimension ? `Search ${getDimensionName(pickerDimension)}` : 'Search distribution rules'}
          emptyMessage="No distribution rules found"
          onClose={closeRulePicker}
          onSelect={selectRule}
          getRowKey={(rule, index) => `${getRuleDimensionCode(rule)}-${getRuleCode(rule)}-${index}`}
          width="min(620px, calc(100vw - 40px))"
        />
      </div>
    </div>
  );

  const target = typeof document !== 'undefined'
    ? document.querySelector('.app-shell__content') || document.body
    : null;

  return target ? createPortal(modal, target) : modal;
}
