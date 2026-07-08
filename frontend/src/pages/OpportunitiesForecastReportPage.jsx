import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import SalesEmployeeLookupModal from '../components/reports/SalesEmployeeLookupModal';
import OpportunitiesForecastCriteria from '../components/reports/OpportunitiesForecastCriteria';
import OpportunitiesForecastResultGrid from '../components/reports/OpportunitiesForecastResultGrid';
import useFloatingWindow from '../components/reports/useFloatingWindow';
import { useSapWindowTaskbarActions } from '../components/SapWindowTaskbarContext';
import { fetchBPGroups } from '../api/businessPartnerApi';
import {
  fetchCrmStages,
  fetchIndustries,
  fetchInterestLevels,
  fetchOpportunitiesForecastReport,
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

const createInitialCriteria = () => ({
  filters: {
    businessPartner: {
      ...createFilter(true),
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
    project: createFilter(false),
    userDefinedFields: createFilter(false),
  },
  groupBy: '',
  groupBy2: '',
});

const REPORT_COLUMNS = [
  { key: 'OpprID', label: 'Opportunity No.' },
  { key: 'OpprName', label: 'Opportunity Name' },
  { key: 'CardCode', label: 'BP Code' },
  { key: 'CardName', label: 'BP Name' },
  { key: 'Territory', label: 'Territory' },
  { key: 'Industry', label: 'Industry' },
  { key: 'SourceName', label: 'Source' },
  { key: 'PotentialAmount', label: 'Potential Amount (LC)' },
  { key: 'WeightedAmount', label: 'Weighted Amount (LC)' },
  { key: 'ClosingPercent', label: 'Closing %' },
  { key: 'PredictedAmount', label: 'Predicted Closing' },
  { key: 'ClosingDate', label: 'Closing Date' },
  { key: 'LastStage', label: 'Last Stage' },
  { key: 'MainSalesEmp', label: 'Main Sales Emp.' },
  { key: 'LastSalesEmp', label: 'Last Sales Emp.' },
  { key: 'ProjectCode', label: 'Project' },
];

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

const formatExportValue = (row, column) => {
  const value = row[column.key];
  if (['PotentialAmount', 'WeightedAmount', 'PredictedAmount'].includes(column.key)) {
    return Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (column.key === 'ClosingPercent') {
    return `${Number(value || 0).toFixed(2)}%`;
  }
  if (column.key === 'ClosingDate' && value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN');
  }
  return value || '';
};

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
    groupBy: criteria.groupBy || '',
    groupBy2: criteria.groupBy2 || '',
  };
};

export default function OpportunitiesForecastReportPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(createInitialCriteria);
  const [lookups, setLookups] = useState({});
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showSalesEmployeeLookup, setShowSalesEmployeeLookup] = useState(false);
  const [activeSalesEmployeeFilter, setActiveSalesEmployeeFilter] = useState('mainSalesEmp');

  const hasReport = reportData.length > 0;
  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 22,
    taskId: 'opportunities-forecast-criteria',
    taskTitle: 'Opportunities Forecast Report - Selection Criteria',
    taskPath: '/reports/crm/opportunities/forecast',
  });
  const reportWindow = useFloatingWindow({
    isOpen: hasReport,
    defaultTop: 12,
    taskId: 'opportunities-forecast-report',
    taskTitle: 'Opportunities Forecast Report',
    taskPath: '/reports/crm/opportunities/forecast',
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
          bpGroups: normalizeLegacyLookup(bpGroups || [], 'code', 'name'),
        });
      } catch (error) {
        if (!ignore) {
          setStatusMessage(error?.message || 'Could not load Opportunity Forecast lookups.');
        }
      }
    };

    loadLookupData();
    return () => {
      ignore = true;
    };
  }, []);

  const exportColumns = useMemo(() => REPORT_COLUMNS, []);

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
      const result = await fetchOpportunitiesForecastReport(buildReportPayload(criteria));
      if (result?.success === false) {
        throw new Error(result.error || 'Failed to generate Opportunities Forecast report.');
      }
      const rows = getResponseData(result);
      setReportData(rows);
      if (!rows.length) {
        setStatusMessage('No opportunities found for the selected criteria.');
      }
    } catch (error) {
      setReportData([]);
      setStatusMessage(error?.response?.data?.message || error?.message || 'Error generating report.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setCriteria(createInitialCriteria());
    setReportData([]);
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
  };

  const handleNewReport = () => {
    setReportData([]);
    setStatusMessage('');
  };

  const handleExportExcel = () => {
    exportReportAsExcel({
      companyName: company?.companyName || 'SAP Business One',
      reportTitle: 'Opportunities Forecast Report',
      fileName: 'Opportunities Forecast Report',
      columns: exportColumns.map((column) => ({
        label: column.label,
        align: ['PotentialAmount', 'WeightedAmount', 'ClosingPercent', 'PredictedAmount'].includes(column.key) ? 'right' : 'left',
      })),
      rows: reportData.map((row) => exportColumns.map((column) => ({
        value: formatExportValue(row, column),
        align: ['PotentialAmount', 'WeightedAmount', 'ClosingPercent', 'PredictedAmount'].includes(column.key) ? 'right' : 'left',
      }))),
    });
  };

  const handleExportPdf = () => {
    exportReportAsPdf({
      companyName: company?.companyName || 'SAP Business One',
      reportTitle: 'Opportunities Forecast Report',
      fileName: 'Opportunities Forecast Report',
      columns: exportColumns.map((column) => ({
        label: column.label,
        align: ['PotentialAmount', 'WeightedAmount', 'ClosingPercent', 'PredictedAmount'].includes(column.key) ? 'right' : 'left',
      })),
      rows: reportData.map((row) => exportColumns.map((column) => ({
        value: formatExportValue(row, column),
        align: ['PotentialAmount', 'WeightedAmount', 'ClosingPercent', 'PredictedAmount'].includes(column.key) ? 'right' : 'left',
      }))),
    });
  };

  return (
    <div className="opp-forecast-page sales-analysis-page sap-report-page">
      <div
        className={`opp-forecast-window sales-analysis-window sap-report-window${criteriaWindow.isMinimized ? ' is-minimized' : ''}${criteriaWindow.isMaximized ? ' is-maximized' : ''}`}
        {...criteriaWindow.windowProps}
      >
        <div className="sales-analysis-window__titlebar sap-report-titlebar" {...criteriaWindow.titleBarProps}>
          <div className="sales-analysis-window__title sap-report-title">Opportunities Forecast Report - Selection Criteria</div>
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
            <div className="sales-analysis-window__title sap-report-title">Opportunities Forecast Report</div>
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
              <OpportunitiesForecastResultGrid
                data={reportData}
                groupBy1={criteria.groupBy}
                groupBy2={criteria.groupBy2}
                loading={loading}
              />
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
