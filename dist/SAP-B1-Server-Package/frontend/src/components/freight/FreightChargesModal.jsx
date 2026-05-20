import React, { useEffect, useMemo, useState } from 'react';
import { fetchFreightDistributionRules, fetchFreightProjects } from '../../api/freightLookupApi';
import {
  DEFAULT_FREIGHT_DIMENSIONS,
  FREIGHT_DISTRIBUTION_METHOD_OPTIONS,
  calculateFreightAmounts,
  normalizeFreightChargeRow,
  summarizeFreightRows,
} from './freightUtils';

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalBoxStyle = {
  background: '#f3f3f3',
  border: '1px solid #8b8b8b',
  boxShadow: '0 10px 20px rgba(0,0,0,0.18)',
};

const sapButtonStyle = {
  padding: '4px 18px',
  fontSize: 12,
  border: '1px solid #8b8b8b',
  background: 'linear-gradient(180deg, #fff7d6 0%, #ffc93a 100%)',
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  ...sapButtonStyle,
  background: 'linear-gradient(180deg, #ffffff 0%, #e6e6e6 100%)',
};

const inputCellStyle = {
  width: '100%',
  height: 24,
  border: '1px solid #c7c7c7',
  padding: '0 6px',
  fontSize: 12,
  background: '#fffef2',
};

const readOnlyCellStyle = {
  ...inputCellStyle,
  background: '#f5f5f5',
};

function DistributionRuleListModal({ isOpen, onClose, onChoose, rules, title = 'List of Distribution Rules' }) {
  const [query, setQuery] = useState('');
  const [selectedRule, setSelectedRule] = useState(null);
  const filteredRules = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rules;
    return rules.filter((rule) =>
      String(rule.FactorCode || rule.OcrCode || '').toLowerCase().includes(normalizedQuery) ||
      String(rule.FactorDescription || rule.OcrName || '').toLowerCase().includes(normalizedQuery)
    );
  }, [query, rules]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedRule(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{ ...modalBoxStyle, width: 580 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '8px 12px', borderBottom: '4px solid #f3ba00', background: '#6d6d6d', color: '#fff', fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <label style={{ minWidth: 38, fontSize: 12 }}>Find</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...inputCellStyle, height: 22 }} />
          </div>
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #c7c7c7', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#efefef' }}>
                  <th style={{ border: '1px solid #c7c7c7', padding: '4px 6px', textAlign: 'left' }}>Distribution Rule</th>
                  <th style={{ border: '1px solid #c7c7c7', padding: '4px 6px', textAlign: 'left' }}>Distribution Rule Name</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => {
                  const code = rule.FactorCode || rule.OcrCode || '';
                  const name = rule.FactorDescription || rule.OcrName || '';
                  return (
                    <tr
                      key={code}
                      style={{
                        cursor: 'pointer',
                        background: selectedRule?.code === code ? '#fff1b8' : '#fff',
                      }}
                      onClick={() => setSelectedRule({ code, name })}
                      onDoubleClick={() => onChoose({ code, name })}
                    >
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>{code}</td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>{name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ padding: 12, display: 'flex', gap: 8 }}>
          <button type="button" style={sapButtonStyle} onClick={() => selectedRule && onChoose(selectedRule)} disabled={!selectedRule}>
            Choose
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DistributionRuleAssignmentModal({ isOpen, onClose, onSave, value, rules }) {
  const [rows, setRows] = useState(DEFAULT_FREIGHT_DIMENSIONS.map((dimension) => ({ ...dimension, code: '', name: '' })));
  const [activeDimension, setActiveDimension] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setRows(
        (value && value.length ? value : DEFAULT_FREIGHT_DIMENSIONS).map((row, index) => ({
          id: row.id || index + 1,
          name: row.name || row.DimName || DEFAULT_FREIGHT_DIMENSIONS[index]?.name || `DIM-${index + 1}`,
          code: row.code || '',
          displayName: row.displayName || row.name || '',
        }))
      );
    }
  }, [isOpen, value]);

  const updateRule = (dimensionIndex, selectedRule) => {
    setRows((previousRows) => previousRows.map((row, rowIndex) => (
      rowIndex === dimensionIndex
        ? { ...row, code: selectedRule.code, displayName: selectedRule.name }
        : row
    )));
    setActiveDimension(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div style={modalOverlayStyle} onClick={onClose}>
        <div style={{ ...modalBoxStyle, width: 740 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '8px 12px', borderBottom: '4px solid #f3ba00', background: '#6d6d6d', color: '#fff', fontWeight: 600 }}>
            Select Distr. Rule
          </div>
          <div style={{ padding: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff' }}>
              <thead>
                <tr style={{ background: '#efefef' }}>
                  <th style={{ border: '1px solid #c7c7c7', padding: '4px 6px', width: 40 }}>#</th>
                  <th style={{ border: '1px solid #c7c7c7', padding: '4px 6px', textAlign: 'left' }}>Dimensions</th>
                  <th style={{ border: '1px solid #c7c7c7', padding: '4px 6px', textAlign: 'left' }}>Distr. Rule Code</th>
                  <th style={{ border: '1px solid #c7c7c7', padding: '4px 6px', textAlign: 'left' }}>Distr. Rule Name</th>
                  <th style={{ border: '1px solid #c7c7c7', padding: '4px 6px', width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id || index}>
                    <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>{row.name}</td>
                    <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                      <input
                        style={inputCellStyle}
                        value={row.code || ''}
                        readOnly
                        onClick={() => setActiveDimension(index)}
                      />
                    </td>
                    <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                      <input
                        style={readOnlyCellStyle}
                        value={row.displayName || ''}
                        readOnly
                      />
                    </td>
                    <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px', textAlign: 'center' }}>
                      <button type="button" style={{ ...secondaryButtonStyle, padding: '2px 8px' }} onClick={() => setActiveDimension(index)}>...</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 12, display: 'flex', gap: 8 }}>
            <button type="button" style={sapButtonStyle} onClick={() => onSave(rows)}>OK</button>
            <button type="button" style={secondaryButtonStyle} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>

      <DistributionRuleListModal
        isOpen={activeDimension != null}
        onClose={() => setActiveDimension(null)}
        onChoose={(selectedRule) => updateRule(activeDimension, selectedRule)}
        rules={rules}
      />
    </>
  );
}

function ProjectListModal({ isOpen, onClose, onChoose, projects }) {
  const [query, setQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return projects;
    return projects.filter((project) =>
      String(project.Code || project.PrjCode || '').toLowerCase().includes(normalizedQuery) ||
      String(project.Name || project.PrjName || '').toLowerCase().includes(normalizedQuery)
    );
  }, [projects, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedProject(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{ ...modalBoxStyle, width: 640 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '8px 12px', borderBottom: '4px solid #f3ba00', background: '#6d6d6d', color: '#fff', fontWeight: 600 }}>
          List of Projects
        </div>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <label style={{ minWidth: 38, fontSize: 12 }}>Find</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...inputCellStyle, height: 22 }} />
          </div>
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #c7c7c7', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#efefef' }}>
                  <th style={{ border: '1px solid #c7c7c7', padding: '4px 6px', textAlign: 'left' }}>Project Code</th>
                  <th style={{ border: '1px solid #c7c7c7', padding: '4px 6px', textAlign: 'left' }}>Project Name</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const code = project.Code || project.PrjCode || '';
                  const name = project.Name || project.PrjName || '';
                  return (
                    <tr
                      key={code}
                      style={{
                        cursor: 'pointer',
                        background: selectedProject?.code === code ? '#fff1b8' : '#fff',
                      }}
                      onClick={() => setSelectedProject({ code, name })}
                      onDoubleClick={() => onChoose({ code, name })}
                    >
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>{code}</td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>{name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ padding: 12, display: 'flex', gap: 8 }}>
          <button type="button" style={sapButtonStyle} onClick={() => selectedProject && onChoose(selectedProject)} disabled={!selectedProject}>
            Choose
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function FreightChargesModal({
  isOpen,
  onClose,
  onApply,
  freightCharges = [],
  taxCodes = [],
  loading = false,
  title = 'Freight Charges',
}) {
  const [rows, setRows] = useState([]);
  const [hideZeroAmounts, setHideZeroAmounts] = useState(false);
  const [errors, setErrors] = useState({});
  const [distributionRules, setDistributionRules] = useState([]);
  const [projects, setProjects] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [activeDistributionRow, setActiveDistributionRow] = useState(null);
  const [activeProjectRow, setActiveProjectRow] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setRows((freightCharges || []).map((charge, index) => normalizeFreightChargeRow(charge, index, taxCodes)));
    setErrors({});
  }, [freightCharges, isOpen, taxCodes]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadLookups = async () => {
      setLookupLoading(true);
      try {
        const [ruleRows, projectRows] = await Promise.all([
          fetchFreightDistributionRules(),
          fetchFreightProjects(),
        ]);
        if (!cancelled) {
          setDistributionRules(Array.isArray(ruleRows) ? ruleRows : []);
          setProjects(Array.isArray(projectRows) ? projectRows : []);
        }
      } catch (_error) {
        if (!cancelled) {
          setDistributionRules([]);
          setProjects([]);
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    };
    loadLookups();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const visibleRows = useMemo(() => (
    hideZeroAmounts
      ? rows.filter((row) => Number(row.netAmount || 0) !== 0 || Number(row.grossAmount || 0) !== 0)
      : rows
  ), [hideZeroAmounts, rows]);

  const totals = useMemo(() => summarizeFreightRows(rows, taxCodes), [rows, taxCodes]);

  const updateRow = (index, updates) => {
    setRows((previousRows) => previousRows.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const nextRow = { ...row, ...updates };
      const amounts = calculateFreightAmounts(nextRow, taxCodes);
      return {
        ...nextRow,
        totalTaxAmount: amounts.taxAmount,
        grossAmount: amounts.grossAmount,
        netAmount: amounts.netAmount,
      };
    }));
    setErrors((previousErrors) => ({ ...previousErrors, [index]: '' }));
  };

  const validateRows = () => {
    const nextErrors = {};
    rows.forEach((row, index) => {
      if (Number(row.netAmount || 0) > 0 && !String(row.taxCode || '').trim()) {
        nextErrors[index] = 'Tax Code is required when Net Amount is greater than zero.';
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleApply = () => {
    if (!validateRows()) return;
    onApply(totals);
  };

  if (!isOpen) return null;

  return (
    <>
      <div style={modalOverlayStyle} onClick={onClose}>
        <div
          style={{ ...modalBoxStyle, width: '92vw', maxWidth: 1620, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '8px 12px', borderBottom: '4px solid #f3ba00', background: '#6d6d6d', color: '#fff', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>{title}</span>
            <button type="button" onClick={onClose} style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16 }}>X</button>
          </div>

          <div style={{ padding: '10px 12px 0' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={hideZeroAmounts} onChange={(e) => setHideZeroAmounts(e.target.checked)} />
              Do Not Display Freight Charges with Zero Amount
            </label>
          </div>

          <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff' }}>
              <thead>
                <tr style={{ background: '#efefef' }}>
                  {['#', 'Freight Name', 'Remarks', 'Tax Code', 'Total Tax Amount', 'Distrib. Method', 'Net Amount', 'Status', 'Freight Tax Distrib. Method', 'Distr. Rule', 'Project', 'Gross Amount'].map((label) => (
                    <th key={label} style={{ border: '1px solid #c7c7c7', padding: '4px 6px', textAlign: label.includes('Amount') ? 'right' : 'left' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} style={{ padding: 20, textAlign: 'center' }}>Loading freight charges...</td>
                  </tr>
                ) : visibleRows.map((row, index) => {
                  const actualIndex = rows.findIndex((candidate) => candidate.id === row.id);
                  const distrRuleLabel = row.distributionRules.filter((rule) => rule.code).map((rule) => rule.code).join(' / ');
                  return (
                    <tr key={row.id}>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px', textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <input style={readOnlyCellStyle} value={row.expnsName} readOnly />
                      </td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <input style={inputCellStyle} value={row.remarks} onChange={(e) => updateRow(actualIndex, { remarks: e.target.value })} />
                      </td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <select style={{ ...inputCellStyle, background: '#fff' }} value={row.taxCode} onChange={(e) => updateRow(actualIndex, { taxCode: e.target.value })}>
                          <option value="">Select</option>
                          {taxCodes.map((taxCode) => (
                            <option key={taxCode.Code} value={taxCode.Code}>
                              {taxCode.Code} - {taxCode.Name || taxCode.Code}
                            </option>
                          ))}
                        </select>
                        {errors[actualIndex] && <div style={{ color: '#b42318', fontSize: 10, marginTop: 2 }}>{errors[actualIndex]}</div>}
                      </td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <input style={{ ...readOnlyCellStyle, textAlign: 'right' }} value={`INR ${Number(row.totalTaxAmount || 0).toFixed(2)}`} readOnly />
                      </td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <select style={{ ...inputCellStyle, background: '#fff' }} value={row.distributionMethod} onChange={(e) => updateRow(actualIndex, { distributionMethod: e.target.value })}>
                          {FREIGHT_DISTRIBUTION_METHOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <input
                          style={{ ...inputCellStyle, textAlign: 'right' }}
                          value={row.netAmount}
                          onChange={(e) => updateRow(actualIndex, { netAmount: e.target.value })}
                        />
                      </td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px', textAlign: 'center' }}>{row.status ? '○' : ''}</td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <select style={{ ...inputCellStyle, background: '#fff' }} value={row.freightTaxDistributionMethod} onChange={(e) => updateRow(actualIndex, { freightTaxDistributionMethod: e.target.value })}>
                          {FREIGHT_DISTRIBUTION_METHOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            style={{ ...inputCellStyle, flex: 1 }}
                            value={distrRuleLabel}
                            readOnly
                            onClick={() => setActiveDistributionRow(actualIndex)}
                          />
                          <button type="button" style={{ ...secondaryButtonStyle, padding: '2px 8px' }} onClick={() => setActiveDistributionRow(actualIndex)}>...</button>
                        </div>
                      </td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            style={{ ...inputCellStyle, flex: 1 }}
                            value={row.projectCode}
                            readOnly
                            onClick={() => setActiveProjectRow(actualIndex)}
                          />
                          <button type="button" style={{ ...secondaryButtonStyle, padding: '2px 8px' }} onClick={() => setActiveProjectRow(actualIndex)}>...</button>
                        </div>
                      </td>
                      <td style={{ border: '1px solid #d5d5d5', padding: '4px 6px' }}>
                        <input style={{ ...readOnlyCellStyle, textAlign: 'right' }} value={`INR ${Number(row.grossAmount || 0).toFixed(2)}`} readOnly />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #c7c7c7' }}>
            <div style={{ fontSize: 12, color: '#555' }}>
              {lookupLoading ? 'Loading distribution rules and projects...' : `Net: INR ${totals.totalNet.toFixed(2)} | Tax: INR ${totals.totalTax.toFixed(2)} | Gross: INR ${totals.totalGross.toFixed(2)}`}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={sapButtonStyle} onClick={handleApply}>Update</button>
              <button type="button" style={secondaryButtonStyle} onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <DistributionRuleAssignmentModal
        isOpen={activeDistributionRow != null}
        onClose={() => setActiveDistributionRow(null)}
        onSave={(selectedRules) => {
          updateRow(activeDistributionRow, { distributionRules: selectedRules });
          setActiveDistributionRow(null);
        }}
        value={activeDistributionRow != null ? rows[activeDistributionRow]?.distributionRules : []}
        rules={distributionRules}
      />

      <ProjectListModal
        isOpen={activeProjectRow != null}
        onClose={() => setActiveProjectRow(null)}
        onChoose={(project) => {
          updateRow(activeProjectRow, { projectCode: project.code, projectName: project.name });
          setActiveProjectRow(null);
        }}
        projects={projects}
      />
    </>
  );
}
