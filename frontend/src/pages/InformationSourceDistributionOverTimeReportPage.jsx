import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBPGroups } from '../api/businessPartnerApi';
import {
  fetchCrmStages,
  fetchIndustries,
  fetchInformationSourceDistributionOverTimeReport,
  fetchInterestLevels,
  fetchOpportunityForecastLookups,
  fetchTerritories,
} from '../api/opportunitiesForecastApi';
import SalesEmployeeLookupModal from '../components/reports/SalesEmployeeLookupModal';
import OpportunitiesForecastCriteria from '../components/reports/OpportunitiesForecastCriteria';
import useFloatingWindow from '../components/reports/useFloatingWindow';
import { useSapWindowTaskbarActions } from '../components/SapWindowTaskbarContext';
import '../styles/opportunities-forecast-report.css';

const REPORT_TITLE = 'Information Source Distribution Over Time Report';

const createFilter = (enabled = false) => ({
  enabled,
  value: '',
  label: '',
  from: '',
  to: '',
  codeFrom: '',
  codeTo: '',
  group: '',
});

const FILTER_ROWS = [
  [
    { key: 'businessPartner', label: 'Business Partner', type: 'bp' },
    { key: 'documents', label: 'Documents', type: 'select' },
  ],
  [
    { key: 'territories', label: 'Territories', type: 'select' },
    { key: 'amount', label: 'Amount', type: 'amountRange' },
  ],
  [
    { key: 'mainSalesEmp', label: 'Main Sales Emp.', type: 'salesEmp' },
    { key: 'percentageRate', label: 'Percentage Rate', type: 'numberRange' },
  ],
  [
    { key: 'lastSalesEmp', label: 'Last Sales Emp.', type: 'salesEmp' },
    { key: 'sources', label: 'Sources', type: 'select' },
  ],
  [
    { key: 'stages', label: 'Stages', type: 'select' },
    { key: 'partners', label: 'Partners', type: 'select' },
  ],
  [
    { key: 'dates', label: 'Dates', type: 'dateRange' },
    { key: 'competitors', label: 'Competitors', type: 'select' },
  ],
  [
    { key: 'industry', label: 'Industry', type: 'select' },
    { key: 'status', label: 'Status', type: 'select' },
  ],
  [
    { key: 'channelCode', label: 'BP Channel Code', type: 'select' },
    { key: 'project', label: 'Project', type: 'select' },
  ],
  [
    { key: 'interestLevel', label: 'Level of Interest', type: 'select' },
    { key: 'userDefinedFields', label: 'User-Defined Fields', type: 'text' },
  ],
];

const GROUP_BY_OPTIONS = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
];

const createInitialCriteria = () => ({
  filters: {
    businessPartner: createFilter(false),
    territories: createFilter(false),
    mainSalesEmp: createFilter(false),
    lastSalesEmp: createFilter(false),
    stages: createFilter(false),
    dates: createFilter(false),
    industry: createFilter(false),
    channelCode: createFilter(false),
    interestLevel: createFilter(false),
    documents: createFilter(false),
    amount: createFilter(false),
    percentageRate: createFilter(false),
    sources: createFilter(false),
    partners: createFilter(false),
    competitors: createFilter(false),
    status: createFilter(false),
    project: createFilter(false),
    userDefinedFields: createFilter(false),
  },
  groupBy: 'week',
});

const normalizeLookup = (rows, valueKey, labelKey = valueKey) =>
  (rows || []).map((row) => {
    if (typeof row === 'string') return { value: row, label: row, code: row, name: row };
    const value = row?.[valueKey] ?? row?.value ?? row?.code ?? '';
    const label = row?.[labelKey] ?? row?.label ?? row?.name ?? value;
    return {
      ...row,
      value,
      label,
      code: row?.code ?? value,
      name: row?.name ?? label,
    };
  });

const enabledValue = (filters, key) => (filters[key]?.enabled ? String(filters[key]?.value || '').trim() : '');
const enabledLabel = (filters, key) => (filters[key]?.enabled ? String(filters[key]?.label || filters[key]?.value || '').trim() : '');

const buildPayload = (criteria) => {
  const filters = criteria.filters || {};
  return {
    businessPartner: filters.businessPartner?.enabled
      ? {
          codeFrom: filters.businessPartner.codeFrom,
          codeTo: filters.businessPartner.codeTo,
          group: filters.businessPartner.group,
        }
      : {},
    territory: enabledValue(filters, 'territories'),
    industry: enabledValue(filters, 'industry'),
    mainSalesEmp: enabledValue(filters, 'mainSalesEmp'),
    mainSalesEmpName: enabledLabel(filters, 'mainSalesEmp'),
    lastSalesEmp: enabledValue(filters, 'lastSalesEmp'),
    lastSalesEmpName: enabledLabel(filters, 'lastSalesEmp'),
    stage: enabledValue(filters, 'stages'),
    closingDate: {
      enabled: Boolean(filters.dates?.enabled),
      from: filters.dates?.from || '',
      to: filters.dates?.to || '',
    },
    interestLevel: enabledValue(filters, 'interestLevel'),
    channelCode: enabledValue(filters, 'channelCode'),
    source: enabledValue(filters, 'sources'),
    partner: enabledValue(filters, 'partners'),
    competitor: enabledValue(filters, 'competitors'),
    status: enabledValue(filters, 'status'),
    project: enabledValue(filters, 'project'),
    document: enabledValue(filters, 'documents'),
    userDefinedField: enabledValue(filters, 'userDefinedFields'),
    amount: {
      enabled: Boolean(filters.amount?.enabled),
      from: filters.amount?.from || '',
      to: filters.amount?.to || '',
    },
    percentageRate: {
      enabled: Boolean(filters.percentageRate?.enabled),
      from: filters.percentageRate?.from || '',
      to: filters.percentageRate?.to || '',
    },
    groupBy: criteria.groupBy || 'week',
  };
};

function WindowControls({ frame, onClose }) {
  return (
    <div className="sales-analysis-window__controls">
      <button type="button" aria-label={frame.isMinimized ? 'Restore' : 'Minimize'} onClick={frame.toggleMinimize}>-</button>
      <button type="button" aria-label={frame.isMaximized ? 'Restore' : 'Maximize'} onClick={frame.toggleMaximize}>[]</button>
      <button type="button" aria-label="Close" onClick={onClose}>x</button>
    </div>
  );
}

const formatCount = (value) => {
  const count = Number(value || 0);
  return count ? count.toLocaleString('en-IN') : '';
};

function InformationSourceResultGrid({ rows, sources, groupBy }) {
  const fillerRows = Math.max(0, 12 - rows.length);
  const totals = sources.reduce((result, source) => {
    result[source.code] = rows.reduce((sum, row) => sum + Number(row.values?.[source.code] || 0), 0);
    return result;
  }, {});
  const grandTotal = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const periodHeader = groupBy === 'day' ? 'Days' : groupBy === 'month' ? 'Months' : 'Weeks';

  return (
    <div className="isd-result-grid-wrap">
      <table className="sap-report-grid isd-result-grid">
        <thead>
          <tr>
            <th>#</th>
            <th>{periodHeader}</th>
            {sources.map((source) => <th key={source.code}>{source.name}</th>)}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.periodSort}-${row.periodLabel}`}>
              <td>{row.rowNo}</td>
              <td>{row.periodLabel}</td>
              {sources.map((source) => {
                const value = Number(row.values?.[source.code] || 0);
                return (
                  <td key={source.code} className="is-numeric">
                    {value ? <span className="isd-link-arrow" aria-hidden="true" /> : null}
                    {formatCount(value)}
                  </td>
                );
              })}
              <td className="is-numeric">{formatCount(row.total)}</td>
            </tr>
          ))}
          {Array.from({ length: fillerRows }, (_, index) => (
            <tr key={`empty-${index}`} className="isd-empty-row">
              <td>&nbsp;</td>
              <td />
              {sources.map((source) => <td key={source.code} />)}
              <td />
            </tr>
          ))}
          <tr className="isd-total-row">
            <td />
            <td />
            {sources.map((source) => <td key={source.code} className="is-numeric">{formatCount(totals[source.code])}</td>)}
            <td className="is-numeric">{formatCount(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function InformationSourceGraph({ rows, sources }) {
  const activeSources = sources.length ? sources : [{ code: 'total', name: 'Total' }];
  const maxValue = Math.max(1, ...rows.flatMap((row) => activeSources.map((source) => (
    source.code === 'total' ? Number(row.total || 0) : Number(row.values?.[source.code] || 0)
  ))));
  const colors = ['#ffe56b', '#b7dc70', '#9ec3f4', '#f4a261', '#c9a3ff', '#75d7c5'];

  return (
    <div className="isd-graph">
      <div className="isd-graph__axis">
        <span>{maxValue.toFixed(1)}</span>
        <span>{(maxValue / 2).toFixed(1)}</span>
        <span>0.0</span>
      </div>
      <div className="isd-graph__plot">
        {rows.map((row) => (
          <div className="isd-graph__period" key={`${row.periodSort}-${row.periodLabel}`}>
            <div className="isd-graph__bars">
              {activeSources.map((source, sourceIndex) => {
                const value = source.code === 'total' ? Number(row.total || 0) : Number(row.values?.[source.code] || 0);
                const height = value ? Math.max(3, (value / maxValue) * 100) : 0;
                return (
                  <span
                    key={source.code}
                    style={{ height: `${height}%`, backgroundColor: colors[sourceIndex % colors.length] }}
                    title={`${source.name}: ${value}`}
                  />
                );
              })}
            </div>
            <div className="isd-graph__label">{row.periodLabel}</div>
          </div>
        ))}
      </div>
      <div className="isd-graph__legend">
        {activeSources.map((source, index) => (
          <span key={source.code}>
            <i style={{ backgroundColor: colors[index % colors.length] }} />
            {source.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function InformationSourceDistributionOverTimeReportPage() {
  const navigate = useNavigate();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(createInitialCriteria);
  const [lookups, setLookups] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showSalesEmployeeLookup, setShowSalesEmployeeLookup] = useState(false);
  const [activeSalesEmployeeFilter, setActiveSalesEmployeeFilter] = useState('mainSalesEmp');
  const [showGraph, setShowGraph] = useState(false);

  const hasReport = Boolean(report?.data?.length);
  const criteriaFrame = useFloatingWindow({
    isOpen: true,
    defaultTop: 22,
    taskId: 'information-source-distribution-over-time-criteria',
    taskTitle: `${REPORT_TITLE} - Selection Criteria`,
    taskPath: '/reports/crm/opportunities/information-source-distribution-over-time',
  });
  const reportFrame = useFloatingWindow({
    isOpen: hasReport,
    defaultTop: 14,
    taskId: 'information-source-distribution-over-time-report',
    taskTitle: REPORT_TITLE,
    taskPath: '/reports/crm/opportunities/information-source-distribution-over-time',
  });
  const graphFrame = useFloatingWindow({
    isOpen: showGraph,
    defaultTop: 8,
    taskId: 'information-source-distribution-over-time-graph',
    taskTitle: `${REPORT_TITLE} - Selection Criteria`,
    taskPath: '/reports/crm/opportunities/information-source-distribution-over-time',
  });

  useEffect(() => {
    let ignore = false;
    const loadLookups = async () => {
      try {
        const [combined, stages, territories, industries, interestLevels, bpGroups] = await Promise.all([
          fetchOpportunityForecastLookups().catch(() => null),
          fetchCrmStages().catch(() => null),
          fetchTerritories().catch(() => null),
          fetchIndustries().catch(() => null),
          fetchInterestLevels().catch(() => null),
          fetchBPGroups().catch(() => null),
        ]);
        if (ignore) return;
        const combinedData = combined?.data || {};
        setLookups({
          ...combinedData,
          stages: combinedData.stages?.length ? combinedData.stages : normalizeLookup(stages?.data || [], 'StageID', 'StageName'),
          territories: combinedData.territories?.length ? combinedData.territories : normalizeLookup(territories?.data || [], 'Territory', 'Territory'),
          industries: combinedData.industries?.length ? combinedData.industries : normalizeLookup(industries?.data || [], 'Industry', 'Industry'),
          interestLevels: combinedData.interestLevels?.length ? combinedData.interestLevels : normalizeLookup(interestLevels?.data || [], 'IntrLevel', 'IntrLevel'),
          statuses: combinedData.statuses?.length
            ? combinedData.statuses
            : [
                { value: 'O', label: 'Open', code: 'O', name: 'Open' },
                { value: 'W', label: 'Won', code: 'W', name: 'Won' },
                { value: 'L', label: 'Lost', code: 'L', name: 'Lost' },
              ],
          bpGroups: normalizeLookup(bpGroups || [], 'code', 'name'),
        });
      } catch (error) {
        if (!ignore) setStatusMessage(error?.message || 'Could not load lookups.');
      }
    };
    loadLookups();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCriteriaChange = (path, value) => {
    setCriteria((current) => {
      const next = { ...current, filters: { ...current.filters } };
      const keys = path.split('.');
      let target = next;
      keys.forEach((key, index) => {
        if (index === keys.length - 1) {
          target[key] = value;
          return;
        }
        target[key] = { ...(target[key] || {}) };
        target = target[key];
      });
      return next;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setStatusMessage('');
    setShowGraph(false);
    try {
      const response = await fetchInformationSourceDistributionOverTimeReport(buildPayload(criteria));
      if (response?.success === false) throw new Error(response.error || `Could not load ${REPORT_TITLE}.`);
      setReport({
        ...response,
        data: Array.isArray(response?.data) ? response.data : [],
        sources: Array.isArray(response?.sources) ? response.sources : [],
      });
      if (!response?.data?.length) setStatusMessage('No records found for the selected criteria.');
    } catch (error) {
      setReport(null);
      setStatusMessage(error?.response?.data?.message || error?.message || 'Error generating report.');
    } finally {
      setLoading(false);
    }
  };

  const handleSalesEmployeeSelect = (row) => {
    const code = String(row?.code || row?.SlpCode || '').trim();
    const name = String(row?.name || row?.SlpName || code).trim();
    setCriteria((current) => ({
      ...current,
      filters: {
        ...current.filters,
        [activeSalesEmployeeFilter]: {
          ...current.filters[activeSalesEmployeeFilter],
          enabled: true,
          value: code || name,
          label: name,
        },
      },
    }));
  };

  const closeCriteria = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate('/dashboard');
  };

  const sources = useMemo(() => report?.sources || [], [report]);
  const rows = report?.data || [];

  return (
    <div className="opp-forecast-page isd-page sales-analysis-page sap-report-page">
      <div className={`opp-forecast-window sales-analysis-window sap-report-window${criteriaFrame.isMinimized ? ' is-minimized' : ''}${criteriaFrame.isMaximized ? ' is-maximized' : ''}`} {...criteriaFrame.windowProps}>
        <div className="sales-analysis-window__titlebar sap-report-titlebar" {...criteriaFrame.titleBarProps}>
          <div className="sales-analysis-window__title sap-report-title">{REPORT_TITLE} - Selection Criteria</div>
          <WindowControls frame={criteriaFrame} onClose={closeCriteria} />
        </div>
        <div className="sales-analysis-window__accent sap-report-accent" />
        {!criteriaFrame.isMinimized ? (
          <div className="sales-analysis-window__body opp-criteria-body">
            <OpportunitiesForecastCriteria
              criteria={criteria}
              lookups={lookups}
              onChange={handleCriteriaChange}
              onOpenExternalLookup={(filterKey) => {
                setActiveSalesEmployeeFilter(filterKey);
                setShowSalesEmployeeLookup(true);
              }}
              onSubmit={handleSubmit}
              onCancel={() => {
                setCriteria(createInitialCriteria());
                setReport(null);
                setShowGraph(false);
                setStatusMessage('');
              }}
              loading={loading}
              filterRows={FILTER_ROWS}
              groupByOptions={GROUP_BY_OPTIONS}
              showGroupBy2={false}
            />
            {statusMessage ? <div className="sales-analysis__status opp-status">{statusMessage}</div> : null}
          </div>
        ) : null}
      </div>

      {hasReport ? (
        <div className={`isd-report-window sales-analysis-window sap-report-window${reportFrame.isMinimized ? ' is-minimized' : ''}${reportFrame.isMaximized ? ' is-maximized' : ''}`} {...reportFrame.windowProps}>
          <div className="sales-analysis-window__titlebar sap-report-titlebar" {...reportFrame.titleBarProps}>
            <div className="sales-analysis-window__title sap-report-title">{REPORT_TITLE}</div>
            <WindowControls frame={reportFrame} onClose={() => setReport(null)} />
          </div>
          <div className="sales-analysis-window__accent sap-report-accent" />
          {!reportFrame.isMinimized ? (
            <div className="sales-analysis-window__body isd-report-body">
              <InformationSourceResultGrid rows={rows} sources={sources} groupBy={criteria.groupBy} />
              <div className="isd-report-footer">
                <button type="button" className="isd-back-btn" onClick={() => setReport(null)} aria-label="Back" />
                <button type="button" className="sap-report-btn" onClick={() => setReport(null)}>OK</button>
                <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={() => setShowGraph(true)}>Show Graph</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showGraph && hasReport ? (
        <div className={`isd-graph-window sales-analysis-window sap-report-window${graphFrame.isMinimized ? ' is-minimized' : ''}${graphFrame.isMaximized ? ' is-maximized' : ''}`} {...graphFrame.windowProps}>
          <div className="sales-analysis-window__titlebar sap-report-titlebar" {...graphFrame.titleBarProps}>
            <div className="sales-analysis-window__title sap-report-title">{REPORT_TITLE} - Selection Criteria</div>
            <WindowControls frame={graphFrame} onClose={() => setShowGraph(false)} />
          </div>
          <div className="sales-analysis-window__accent sap-report-accent" />
          {!graphFrame.isMinimized ? (
            <div className="sales-analysis-window__body isd-graph-body">
              <InformationSourceGraph rows={rows} sources={sources} />
              <div className="isd-graph-footer">
                <button type="button" className="isd-back-btn" onClick={() => setShowGraph(false)} aria-label="Back" />
                <button type="button" className="sap-report-btn sap-report-btn--primary">Settings</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <SalesEmployeeLookupModal
        isOpen={showSalesEmployeeLookup}
        onClose={() => setShowSalesEmployeeLookup(false)}
        onSelect={handleSalesEmployeeSelect}
      />
    </div>
  );
}
