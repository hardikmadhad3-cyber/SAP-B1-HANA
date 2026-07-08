import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import SalesEmployeeLookupModal from '../components/reports/SalesEmployeeLookupModal';
import OpportunitiesForecastCriteria from '../components/reports/OpportunitiesForecastCriteria';
import OpportunitiesStatisticsResultGrid from '../components/reports/OpportunitiesStatisticsResultGrid';
import useFloatingWindow from '../components/reports/useFloatingWindow';
import { useSapWindowTaskbarActions } from '../components/SapWindowTaskbarContext';
import { fetchBPGroups } from '../api/businessPartnerApi';
import {
  fetchCrmStages,
  fetchIndustries,
  fetchInterestLevels,
  fetchOpportunitiesStatisticsReport,
  fetchOpportunityForecastLookups,
  fetchTerritories,
} from '../api/opportunitiesForecastApi';
import { exportReportAsExcel, exportReportAsPdf } from '../utils/reportExportUtils';
import '../styles/opportunities-forecast-report.css';

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

const STATISTICS_FILTER_ROWS = [
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
  { value: 'bpCode', label: 'BP Code' },
  { value: 'mainSalesEmp', label: 'Main Sales Emp.' },
  { value: 'bpGroup', label: 'BP Group' },
  { value: 'territory', label: 'Territory' },
  { value: 'itemNo', label: 'Item No.' },
  { value: 'itemGroup', label: 'Item Group' },
];

const GROUP_BY_2_OPTIONS = [
  { value: '', label: '' },
  { value: 'bpCode', label: 'BP Code' },
  { value: 'mainSalesEmp', label: 'Main Sales Emp.' },
  { value: 'lastSalesEmp', label: 'Last Sales Emp.' },
  { value: 'territory', label: 'Territory' },
  { value: 'itemNo', label: 'Item No.' },
];

const EXPORT_COLUMNS = [
  { key: 'Group1Code', label: 'Group Code', align: 'left' },
  { key: 'Group1Name', label: 'Group Name', align: 'left' },
  { key: 'Total', label: 'Total', align: 'right' },
  { key: 'TotalOpen', label: 'Total Open', align: 'right' },
  { key: 'TotalWon', label: 'Total Won', align: 'right' },
  { key: 'TotalLost', label: 'Total Lost', align: 'right' },
  { key: 'TotalClosed', label: 'Total Closed', align: 'right' },
  { key: 'SuccessPercent', label: 'Success %', align: 'right' },
  { key: 'PotentialOpenAmount', label: 'Pot. Open Amount', align: 'right' },
  { key: 'WeightedOpenAmount', label: 'Weighted Open Amt', align: 'right' },
  { key: 'WonAmount', label: 'Won Amount', align: 'right' },
  { key: 'LostAmount', label: 'Lost Amount', align: 'right' },
];

const createInitialCriteria = () => ({
  filters: {
    businessPartner: {
      ...createFilter(false),
      codeFrom: '',
      codeTo: '',
      group: '',
    },
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
  groupBy: 'bpCode',
  groupBy2: '',
});

const getResponseData = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const normalizeLegacyLookup = (rows, valueKey, labelKey = valueKey) =>
  (rows || []).map((row) => {
    if (typeof row === 'string') {
      return { value: row, label: row, code: row, name: row };
    }
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

const buildReportPayload = (criteria) => {
  const filters = criteria.filters || {};
  const enabledValue = (key) => (filters[key]?.enabled ? String(filters[key]?.value || '').trim() : '');
  const enabledLabel = (key) => (filters[key]?.enabled ? String(filters[key]?.label || filters[key]?.value || '').trim() : '');

  return {
    businessPartner: filters.businessPartner?.enabled
      ? {
          codeFrom: filters.businessPartner.codeFrom,
          codeTo: filters.businessPartner.codeTo,
          group: filters.businessPartner.group,
        }
      : {},
    territory: enabledValue('territories'),
    industry: enabledValue('industry'),
    mainSalesEmp: enabledValue('mainSalesEmp'),
    mainSalesEmpName: enabledLabel('mainSalesEmp'),
    lastSalesEmp: enabledValue('lastSalesEmp'),
    lastSalesEmpName: enabledLabel('lastSalesEmp'),
    stage: enabledValue('stages'),
    closingDate: {
      enabled: Boolean(filters.dates?.enabled),
      from: filters.dates?.from || '',
      to: filters.dates?.to || '',
    },
    interestLevel: enabledValue('interestLevel'),
    channelCode: enabledValue('channelCode'),
    source: enabledValue('sources'),
    partner: enabledValue('partners'),
    competitor: enabledValue('competitors'),
    status: enabledValue('status'),
    project: enabledValue('project'),
    document: enabledValue('documents'),
    userDefinedField: enabledValue('userDefinedFields'),
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
    groupBy: criteria.groupBy || 'bpCode',
    groupBy2: criteria.groupBy2 || '',
  };
};

const formatExportValue = (row, column) => {
  const value = row[column.key];
  if (['PotentialOpenAmount', 'WeightedOpenAmount', 'WonAmount', 'LostAmount'].includes(column.key)) {
    return Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (column.key === 'SuccessPercent') {
    const percent = Number(value || 0);
    return percent ? percent.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '';
  }
  if (column.key.startsWith('Total')) {
    const count = Number(value || 0);
    return count ? count.toLocaleString('en-IN') : '';
  }
  return value || '';
};

export default function OpportunitiesStatisticsReportPage({
  reportTitle = 'Opportunities Statistics Report',
  criteriaTitle = 'Opportunities Statistics Report - Selection Criteria',
  taskPath = '/reports/crm/opportunities/statistics',
  taskIdPrefix = 'opportunities-statistics',
  fetchReport = fetchOpportunitiesStatisticsReport,
  hideStatusFilter = false,
  emptyMessage = 'No opportunities found for the selected criteria.',
} = {}) {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(createInitialCriteria);
  const [lookups, setLookups] = useState({});
  const [reportData, setReportData] = useState([]);
  const [reportMeta, setReportMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showSalesEmployeeLookup, setShowSalesEmployeeLookup] = useState(false);
  const [activeSalesEmployeeFilter, setActiveSalesEmployeeFilter] = useState('mainSalesEmp');

  const hasReport = reportData.length > 0;
  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 22,
    taskId: `${taskIdPrefix}-criteria`,
    taskTitle: criteriaTitle,
    taskPath,
  });
  const reportWindow = useFloatingWindow({
    isOpen: hasReport,
    defaultTop: 12,
    taskId: `${taskIdPrefix}-report`,
    taskTitle: reportTitle,
    taskPath,
  });

  useEffect(() => {
    let ignore = false;

    const loadLookupData = async () => {
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
          stages: combinedData.stages?.length
            ? combinedData.stages
            : normalizeLegacyLookup(stages?.data || [], 'StageID', 'StageName'),
          territories: combinedData.territories?.length
            ? combinedData.territories
            : normalizeLegacyLookup(territories?.data || [], 'Territory', 'Territory'),
          industries: combinedData.industries?.length
            ? combinedData.industries
            : normalizeLegacyLookup(industries?.data || [], 'Industry', 'Industry'),
          interestLevels: combinedData.interestLevels?.length
            ? combinedData.interestLevels
            : normalizeLegacyLookup(interestLevels?.data || [], 'IntrLevel', 'IntrLevel'),
          statuses: combinedData.statuses?.length
            ? combinedData.statuses
            : [
                { value: 'O', label: 'Open', code: 'O', name: 'Open' },
                { value: 'W', label: 'Won', code: 'W', name: 'Won' },
                { value: 'L', label: 'Lost', code: 'L', name: 'Lost' },
              ],
          bpGroups: normalizeLegacyLookup(bpGroups || [], 'code', 'name'),
        });
      } catch (error) {
        if (!ignore) {
          setStatusMessage(error?.message || `Could not load ${reportTitle} lookups.`);
        }
      }
    };

    loadLookupData();
    return () => {
      ignore = true;
    };
  }, []);

  const exportColumns = useMemo(() => EXPORT_COLUMNS, []);
  const filterRows = useMemo(
    () =>
      hideStatusFilter
        ? STATISTICS_FILTER_ROWS.map((pair) =>
            pair.map((config) => (config?.key === 'status' ? null : config)),
          )
        : STATISTICS_FILTER_ROWS,
    [hideStatusFilter],
  );

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

  const handleOpenExternalLookup = (filterKey) => {
    setActiveSalesEmployeeFilter(filterKey);
    setShowSalesEmployeeLookup(true);
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

  const handleSubmit = async () => {
    setLoading(true);
    setStatusMessage('');

    try {
      const result = await fetchReport(buildReportPayload(criteria));
      if (result?.success === false) {
        throw new Error(result.error || `Failed to generate ${reportTitle}.`);
      }
      const rows = getResponseData(result);
      setReportData(rows);
      setReportMeta(result?.meta || {});
      if (!rows.length) {
        setStatusMessage(emptyMessage);
      }
    } catch (error) {
      setReportData([]);
      setReportMeta({});
      setStatusMessage(error?.response?.data?.message || error?.message || 'Error generating report.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setCriteria(createInitialCriteria());
    setReportData([]);
    setReportMeta({});
    setStatusMessage('');
  };

  const handleCloseCriteriaWindow = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate('/dashboard');
  };

  const handleMinimizeCriteriaWindow = () => {
    criteriaWindow.toggleMinimize();
    navigate('/dashboard');
  };

  const handleCloseReportWindow = () => {
    setReportData([]);
    setReportMeta({});
  };

  const handleNewReport = () => {
    setReportData([]);
    setReportMeta({});
    setStatusMessage('');
  };

  const exportRows = reportData.map((row) => exportColumns.map((column) => ({
    value: formatExportValue(row, column),
    align: column.align,
  })));

  const handleExportExcel = () => {
    exportReportAsExcel({
      companyName: company?.companyName || 'SAP Business One',
      reportTitle,
      fileName: reportTitle,
      columns: exportColumns.map((column) => ({
        label: column.label,
        align: column.align,
      })),
      rows: exportRows,
    });
  };

  const handleExportPdf = () => {
    exportReportAsPdf({
      companyName: company?.companyName || 'SAP Business One',
      reportTitle,
      fileName: reportTitle,
      columns: exportColumns.map((column) => ({
        label: column.label,
        align: column.align,
      })),
      rows: exportRows,
    });
  };

  return (
    <div className="opp-forecast-page sales-analysis-page sap-report-page">
      <div
        className={`opp-forecast-window sales-analysis-window sap-report-window${criteriaWindow.isMinimized ? ' is-minimized' : ''}${criteriaWindow.isMaximized ? ' is-maximized' : ''}`}
        {...criteriaWindow.windowProps}
      >
        <div className="sales-analysis-window__titlebar sap-report-titlebar" {...criteriaWindow.titleBarProps}>
          <div className="sales-analysis-window__title sap-report-title">{criteriaTitle}</div>
          <div className="sales-analysis-window__controls">
            <button type="button" aria-label={criteriaWindow.isMinimized ? 'Restore' : 'Minimize'} onClick={handleMinimizeCriteriaWindow}>
              -
            </button>
            <button type="button" aria-label={criteriaWindow.isMaximized ? 'Restore' : 'Maximize'} onClick={criteriaWindow.toggleMaximize}>
              []
            </button>
            <button type="button" aria-label="Close" onClick={handleCloseCriteriaWindow}>
              x
            </button>
          </div>
        </div>
        <div className="sales-analysis-window__accent sap-report-accent" />

        {!criteriaWindow.isMinimized ? (
          <div className="sales-analysis-window__body opp-criteria-body">
            <OpportunitiesForecastCriteria
              criteria={criteria}
              lookups={lookups}
              onChange={handleCriteriaChange}
              onOpenExternalLookup={handleOpenExternalLookup}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              loading={loading}
              filterRows={filterRows}
              groupByOptions={GROUP_BY_OPTIONS}
              groupBy2Options={GROUP_BY_2_OPTIONS}
            />
            {statusMessage ? <div className="sales-analysis__status opp-status">{statusMessage}</div> : null}
          </div>
        ) : null}
      </div>

      {hasReport ? (
        <div
          className={`opp-forecast-report-window sales-analysis-window sales-analysis-window--report sap-report-window${reportWindow.isMinimized ? ' is-minimized' : ''}${reportWindow.isMaximized ? ' is-maximized' : ''}`}
          {...reportWindow.windowProps}
        >
          <div className="sales-analysis-window__titlebar sap-report-titlebar" {...reportWindow.titleBarProps}>
            <div className="sales-analysis-window__title sap-report-title">{reportTitle}</div>
            <div className="sales-analysis-window__controls">
              <button type="button" aria-label={reportWindow.isMinimized ? 'Restore' : 'Minimize'} onClick={reportWindow.toggleMinimize}>
                -
              </button>
              <button type="button" aria-label={reportWindow.isMaximized ? 'Restore' : 'Maximize'} onClick={reportWindow.toggleMaximize}>
                []
              </button>
              <button type="button" aria-label="Close" onClick={handleCloseReportWindow}>
                x
              </button>
            </div>
          </div>
          <div className="sales-analysis-window__accent sap-report-accent" />

          {!reportWindow.isMinimized ? (
            <div className="sales-analysis-window__body sales-analysis-window__body--report opp-report-body">
              <OpportunitiesStatisticsResultGrid data={reportData} groupLabels={reportMeta.groupBy || {}} loading={loading} />
              <div className="sales-analysis-report__footer">
                <button type="button" className="sales-analysis-report__back-btn sap-report-btn" onClick={handleNewReport}>
                  &lt;
                </button>
                <span>{reportData.length} records</span>
                <div className="sales-analysis-report__action-group">
                  <button type="button" className="sales-analysis__sap-btn sap-report-btn" onClick={handleExportExcel}>
                    Export Excel
                  </button>
                  <button type="button" className="sales-analysis__sap-btn sap-report-btn" onClick={handleExportPdf}>
                    Export PDF
                  </button>
                </div>
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
