import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBPGroups, fetchBPProperties, fetchSalesPersons } from '../api/businessPartnerApi';
import {
  fetchCrmStages,
  fetchOpportunitiesStageAnalysisReport,
} from '../api/opportunitiesForecastApi';
import BusinessPartnerLookupModal from '../components/reports/BusinessPartnerLookupModal';
import PropertiesSelectionModal from '../components/reports/PropertiesSelectionModal';
import useFloatingWindow from '../components/reports/useFloatingWindow';
import { useSapWindowTaskbarActions } from '../components/SapWindowTaskbarContext';
import '../styles/opportunities-stage-analysis-report.css';

const DEFAULT_BP_PROPERTIES = Array.from({ length: 64 }, (_, index) => ({
  number: index + 1,
  name: `Business Partners Property ${index + 1}`,
}));

const BP_TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'customer', label: 'Customer' },
  { value: 'lead', label: 'Lead' },
  { value: 'customerAndLead', label: 'Customer and Lead' },
  { value: 'vendor', label: 'Vendor' },
];

const GROUP_NONE_VALUE = '__NONE__';

const normalizeResponseData = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const createInitialCriteria = () => ({
  startDate: { from: '', to: '' },
  closingDate: { from: '', to: '' },
  stageSelection: {
    enabled: false,
    selectedCodes: [],
    selectedLabels: [],
    stageType: 'all',
  },
  salesEmployeeSelection: {
    enabled: false,
    selectedCodes: [],
    selectedLabels: [],
  },
  bpSelection: {
    enabled: false,
    codeFrom: '',
    codeTo: '',
    bpType: 'all',
    customerGroup: '',
    vendorGroup: '',
    propertyFilter: {
      ignoreProperties: true,
      linkMode: 'and',
      exactlyMatch: false,
      selectedPropertyNumbers: [],
    },
  },
  includeExpiredClosingDate: false,
  printGraph: false,
});

const getDisplayNumber = (value) => {
  const number = Number(value || 0);
  if (!number) return '';
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
};

const getLookupLabel = (selection, fallback = '') => {
  const labels = selection?.selectedLabels || [];
  if (!labels.length) return fallback;
  if (labels.length === 1) return labels[0];
  return `${labels.length} selected`;
};

const normalizeGroupRows = (rows = []) =>
  rows
    .map((group) => ({
      code: String(group.code ?? group.value ?? '').trim(),
      name: String(group.name ?? group.label ?? group.code ?? group.value ?? '').trim(),
    }))
    .filter((group) => group.code && group.name);

const getGroupOptions = (groups = []) => [
  ...normalizeGroupRows(groups),
  { code: '', name: 'All' },
  { code: GROUP_NONE_VALUE, name: 'None' },
];

const getPropertySummary = (propertyFilter = {}) => {
  if (propertyFilter.ignoreProperties !== false) return 'Ignore';
  const selectedCount = Array.isArray(propertyFilter.selectedPropertyNumbers)
    ? propertyFilter.selectedPropertyNumbers.length
    : 0;
  return selectedCount ? `${selectedCount} Selected` : 'None';
};

function WindowControls({ frame, onClose }) {
  return (
    <div className="stage-analysis-window__controls">
      <button
        type="button"
        className="sap-report-window-control"
        aria-label={frame.isMinimized ? 'Restore' : 'Minimize'}
        onClick={frame.toggleMinimize}
      />
      <button
        type="button"
        className="sap-report-window-control"
        aria-label={frame.isMaximized ? 'Restore Down' : 'Maximize'}
        onClick={frame.toggleMaximize}
      />
      <button
        type="button"
        className="sap-report-window-control"
        aria-label="Close"
        onClick={onClose}
      />
    </div>
  );
}

function StageLookupModal({ isOpen, stages, selectedCodes, stageType, onClose, onApply }) {
  const [localCodes, setLocalCodes] = useState([]);
  const [localStageType, setLocalStageType] = useState('all');
  const frame = useFloatingWindow({
    isOpen,
    defaultTop: 74,
    taskId: 'stage-analysis-stage-lookup',
    taskTitle: 'Opportunity Stage',
    taskPath: '/reports/crm/opportunities/stage-analysis',
  });

  useEffect(() => {
    if (!isOpen) return;
    setLocalCodes(selectedCodes || []);
    setLocalStageType(stageType || 'all');
  }, [isOpen, selectedCodes, stageType]);

  if (!isOpen) return null;

  const toggleCode = (code) => {
    setLocalCodes((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  };

  const applySelection = () => {
    const selectedRows = stages.filter((stage) => localCodes.includes(stage.value));
    onApply({
      selectedCodes: localCodes,
      selectedLabels: selectedRows.map((stage) => stage.label || stage.name || stage.value),
      stageType: localStageType,
    });
    onClose();
  };

  return (
    <div className="stage-analysis-lookup-layer">
      <div
        className={`sap-report-window stage-analysis-lookup stage-analysis-lookup--stage ${frame.isMinimized ? 'is-minimized' : ''}`}
        {...frame.windowProps}
      >
        <div className="sap-report-titlebar stage-analysis-window__titlebar" {...frame.titleBarProps}>
          <div className="sap-report-title">Opportunity Stage</div>
          <WindowControls frame={frame} onClose={onClose} />
        </div>
        <div className="sap-report-accent" />
        {!frame.isMinimized ? (
          <div className="stage-analysis-lookup__body">
            <div className="stage-analysis-grid-wrap">
              <table className="sap-report-grid stage-analysis-lookup-grid">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Choose</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((stage, index) => (
                    <tr key={stage.value || index}>
                      <td>{index + 1}</td>
                      <td>{stage.label || stage.name || stage.value}</td>
                      <td className="stage-analysis-cell-center">
                        <input
                          type="checkbox"
                          checked={localCodes.includes(stage.value)}
                          onChange={() => toggleCode(stage.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  {!stages.length ? (
                    <tr>
                      <td colSpan="3" className="stage-analysis-empty-cell">No stages found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="stage-analysis-lookup__form-row">
              <label>Stage Type</label>
              <select
                className="sap-report-input"
                value={localStageType}
                onChange={(event) => setLocalStageType(event.target.value)}
              >
                <option value="all">All Stages</option>
                <option value="open">Open Stages</option>
                <option value="won">Won Stages</option>
                <option value="lost">Lost Stages</option>
              </select>
            </div>
            <div className="stage-analysis-lookup__footer">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={applySelection}>
                OK
              </button>
              <button type="button" className="sap-report-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SalesEmployeeMultiLookupModal({ isOpen, selectedCodes, onClose, onApply }) {
  const [searchText, setSearchText] = useState('');
  const [rows, setRows] = useState([]);
  const [localCodes, setLocalCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const frame = useFloatingWindow({
    isOpen,
    defaultTop: 82,
    taskId: 'stage-analysis-sales-employee-lookup',
    taskTitle: 'Sales Employee',
    taskPath: '/reports/crm/opportunities/stage-analysis',
  });

  const loadRows = async (query = '') => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchSalesPersons(query);
      setRows(Array.isArray(response) ? response : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load sales employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSearchText('');
    setLocalCodes(selectedCodes || []);
    loadRows('');
  }, [isOpen, selectedCodes]);

  if (!isOpen) return null;

  const normalizedRows = rows.map((row, index) => ({
    rowNo: index + 1,
    code: String(row.code ?? row.SlpCode ?? ''),
    name: String(row.name ?? row.SlpName ?? ''),
    active: row.Active ?? row.active ?? 'Y',
  }));

  const toggleCode = (code) => {
    setLocalCodes((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  };

  const applySelection = () => {
    const selectedRows = normalizedRows.filter((row) => localCodes.includes(row.code));
    onApply({
      selectedCodes: localCodes,
      selectedLabels: selectedRows.map((row) => row.name || row.code),
    });
    onClose();
  };

  return (
    <div className="stage-analysis-lookup-layer">
      <div
        className={`sap-report-window stage-analysis-lookup stage-analysis-lookup--sales-employee ${frame.isMinimized ? 'is-minimized' : ''}`}
        {...frame.windowProps}
      >
        <div className="sap-report-titlebar stage-analysis-window__titlebar" {...frame.titleBarProps}>
          <div className="sap-report-title">Sales Employee</div>
          <WindowControls frame={frame} onClose={onClose} />
        </div>
        <div className="sap-report-accent" />
        {!frame.isMinimized ? (
          <div className="stage-analysis-lookup__body">
            <div className="stage-analysis-lookup__find">
              <label>Find</label>
              <input
                className="sap-report-input"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    loadRows(searchText);
                  }
                }}
                autoFocus
              />
              <button type="button" className="sap-report-btn" onClick={() => loadRows(searchText)}>
                Find
              </button>
            </div>
            <div className="stage-analysis-grid-wrap">
              <table className="sap-report-grid stage-analysis-lookup-grid">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Active</th>
                    <th>Choose</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="stage-analysis-empty-cell">Loading sales employees...</td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="4" className="stage-analysis-empty-cell is-error">{error}</td>
                    </tr>
                  ) : normalizedRows.length ? normalizedRows.map((row) => (
                    <tr key={row.code}>
                      <td>{row.rowNo}</td>
                      <td>{row.name || row.code}</td>
                      <td className="stage-analysis-cell-center">
                        <input type="checkbox" checked={String(row.active || 'Y').toUpperCase() !== 'N'} readOnly />
                      </td>
                      <td className="stage-analysis-cell-center">
                        <input
                          type="checkbox"
                          checked={localCodes.includes(row.code)}
                          onChange={() => toggleCode(row.code)}
                        />
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="stage-analysis-empty-cell">No sales employees found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="stage-analysis-lookup__footer">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={applySelection}>
                OK
              </button>
              <button type="button" className="sap-report-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BPPropertiesModal({
  isOpen,
  value,
  customerGroups,
  vendorGroups,
  bpProperties,
  onClose,
  onApply,
  onOpenBpLookup,
}) {
  const [localValue, setLocalValue] = useState(value);
  const [showProperties, setShowProperties] = useState(false);
  const frame = useFloatingWindow({
    isOpen,
    defaultTop: 92,
    taskId: 'stage-analysis-bp-properties',
    taskTitle: 'BP Properties',
    taskPath: '/reports/crm/opportunities/stage-analysis',
  });

  useEffect(() => {
    if (isOpen) setLocalValue(value);
  }, [isOpen, value]);

  if (!isOpen) return null;

  const updateField = (field, fieldValue) => {
    setLocalValue((current) => ({ ...current, [field]: fieldValue }));
  };

  const applySelection = () => {
    onApply(localValue);
    onClose();
  };

  const selectAll = () => {
    setLocalValue((current) => ({
      ...current,
      bpType: 'all',
      customerGroup: '',
      vendorGroup: '',
      propertyFilter: {
        ignoreProperties: true,
        linkMode: 'and',
        exactlyMatch: false,
        selectedPropertyNumbers: [],
      },
    }));
  };

  return (
    <div className="stage-analysis-lookup-layer">
      <div
        className={`sap-report-window stage-analysis-lookup stage-analysis-lookup--bp ${frame.isMinimized ? 'is-minimized' : ''}`}
        {...frame.windowProps}
      >
        <div className="sap-report-titlebar stage-analysis-window__titlebar" {...frame.titleBarProps}>
          <div className="sap-report-title">BP Properties</div>
          <WindowControls frame={frame} onClose={onClose} />
        </div>
        <div className="sap-report-accent" />
        {!frame.isMinimized ? (
          <div className="stage-analysis-lookup__body">
            <div className="stage-analysis-bp-form">
              <label>Code</label>
              <span>From</span>
              <div className="stage-analysis-code-picker">
                <input
                  className="sap-report-input"
                  value={localValue.codeFrom || ''}
                  onChange={(event) => updateField('codeFrom', event.target.value)}
                />
                <button type="button" className="stage-analysis-ellipsis-btn" onClick={() => onOpenBpLookup('codeFrom')}>
                  ...
                </button>
              </div>
              <span>To</span>
              <div className="stage-analysis-code-picker">
                <input
                  className="sap-report-input"
                  value={localValue.codeTo || ''}
                  onChange={(event) => updateField('codeTo', event.target.value)}
                />
                <button type="button" className="stage-analysis-ellipsis-btn" onClick={() => onOpenBpLookup('codeTo')}>
                  ...
                </button>
              </div>

              <label>Business Partner Type</label>
              <select
                className="sap-report-input stage-analysis-bp-span"
                value={localValue.bpType || 'all'}
                onChange={(event) => updateField('bpType', event.target.value)}
              >
                {BP_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label>Customer Group</label>
              <select
                className="sap-report-input stage-analysis-bp-span"
                value={localValue.customerGroup ?? ''}
                onChange={(event) => updateField('customerGroup', event.target.value)}
              >
                {getGroupOptions(customerGroups).map((group) => (
                  <option key={group.code || group.name} value={group.code}>
                    {group.name || group.code}
                  </option>
                ))}
              </select>

              <label>Vendor Group</label>
              <select
                className="sap-report-input stage-analysis-bp-span"
                value={localValue.vendorGroup ?? ''}
                onChange={(event) => updateField('vendorGroup', event.target.value)}
              >
                {getGroupOptions(vendorGroups).map((group) => (
                  <option key={`vendor-${group.code || group.name}`} value={group.code}>
                    {group.name || group.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="stage-analysis-bp-properties-row">
              <button type="button" className="sap-report-btn" onClick={() => setShowProperties(true)}>
                Properties
              </button>
              <input className="sap-report-input" value={getPropertySummary(localValue.propertyFilter)} readOnly />
            </div>
            <div className="stage-analysis-lookup__footer stage-analysis-lookup__footer--wide">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={applySelection}>
                OK
              </button>
              <button type="button" className="sap-report-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="sap-report-btn"
                onClick={selectAll}
              >
                Select All
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <PropertiesSelectionModal
        isOpen={showProperties}
        title="Properties"
        propertyLabelPrefix="Business Partners Property"
        properties={bpProperties}
        value={localValue.propertyFilter}
        onClose={() => setShowProperties(false)}
        onSave={(propertyFilter) => updateField('propertyFilter', propertyFilter)}
      />
    </div>
  );
}

function StageAnalysisChart({ data, employeeColumns }) {
  const maxValue = Math.max(100, ...data.map((row) => Number(row.generalActualPercent || 0)));

  return (
    <div className="stage-analysis-chart">
      <div className="stage-analysis-chart__axis">
        <span>100</span>
        <span>0</span>
      </div>
      <div className="stage-analysis-chart__plot">
        {data.map((row) => {
          const height = Math.max(8, Math.round((Number(row.generalActualPercent || 0) / maxValue) * 88));
          return (
            <div className="stage-analysis-chart__bar-wrap" key={row.stageCode || row.stageName}>
              <div className="stage-analysis-chart__bar" style={{ height: `${height}%` }} />
              <div className="stage-analysis-chart__label">{row.stageName}</div>
            </div>
          );
        })}
      </div>
      <div className="stage-analysis-chart__legend">
        {(employeeColumns.length ? employeeColumns : [{ code: 'general', name: 'General' }]).slice(0, 3).map((employee) => (
          <span key={employee.code}>
            <i />
            {employee.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function OpportunitiesStageAnalysisReportPage() {
  const navigate = useNavigate();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(createInitialCriteria);
  const [stages, setStages] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [vendorGroups, setVendorGroups] = useState([]);
  const [bpProperties, setBpProperties] = useState(DEFAULT_BP_PROPERTIES);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showStageLookup, setShowStageLookup] = useState(false);
  const [showSalesEmployeeLookup, setShowSalesEmployeeLookup] = useState(false);
  const [showBpProperties, setShowBpProperties] = useState(false);
  const [showBpLookup, setShowBpLookup] = useState(false);
  const [bpLookupTarget, setBpLookupTarget] = useState('codeFrom');

  const hasReport = Boolean(report?.data?.length);
  const criteriaWindow = useFloatingWindow({
    isOpen: true,
    defaultTop: 24,
    taskId: 'stage-analysis-criteria',
    taskTitle: 'Stage Analysis - Selection Criteria',
    taskPath: '/reports/crm/opportunities/stage-analysis',
  });
  const reportWindow = useFloatingWindow({
    isOpen: hasReport,
    defaultTop: 14,
    taskId: 'stage-analysis-report',
    taskTitle: 'Stage Analysis',
    taskPath: '/reports/crm/opportunities/stage-analysis',
  });

  useEffect(() => {
    let ignore = false;

    const loadLookups = async () => {
      try {
        const [stageResponse, customerGroupResponse, vendorGroupResponse, propertyResponse] = await Promise.all([
          fetchCrmStages().catch(() => null),
          fetchBPGroups('', 'customer').catch(() => []),
          fetchBPGroups('', 'vendor').catch(() => []),
          fetchBPProperties().catch(() => []),
        ]);
        if (ignore) return;
        setStages(normalizeResponseData(stageResponse).map((stage) => ({
          value: String(stage.value ?? stage.code ?? ''),
          label: String(stage.label ?? stage.name ?? stage.value ?? ''),
        })).filter((stage) => stage.value || stage.label));
        setCustomerGroups(normalizeGroupRows(Array.isArray(customerGroupResponse) ? customerGroupResponse : []));
        setVendorGroups(normalizeGroupRows(Array.isArray(vendorGroupResponse) ? vendorGroupResponse : []));
        setBpProperties(Array.isArray(propertyResponse) && propertyResponse.length ? propertyResponse : DEFAULT_BP_PROPERTIES);
      } catch (_error) {
        if (!ignore) {
          setStages([]);
          setCustomerGroups([]);
          setVendorGroups([]);
          setBpProperties(DEFAULT_BP_PROPERTIES);
        }
      }
    };

    loadLookups();
    return () => {
      ignore = true;
    };
  }, []);

  const rows = report?.data || [];
  const employeeColumns = report?.employeeColumns || [];
  const resultColumnCount = 5 + (employeeColumns.length * 2);
  const fillerResultRows = Math.max(0, 7 - rows.length);

  const updateCriteria = (updater) => {
    setCriteria((current) => (typeof updater === 'function' ? updater(current) : updater));
  };

  const updateNested = (key, field, value) => {
    updateCriteria((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [field]: value,
      },
    }));
  };

  const buildPayload = () => ({
    ...criteria,
    stageSelection: {
      ...criteria.stageSelection,
      selectedCodes: criteria.stageSelection.enabled ? criteria.stageSelection.selectedCodes : [],
    },
    salesEmployeeSelection: {
      ...criteria.salesEmployeeSelection,
      selectedCodes: criteria.salesEmployeeSelection.enabled ? criteria.salesEmployeeSelection.selectedCodes : [],
    },
  });

  const loadReport = async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const response = await fetchOpportunitiesStageAnalysisReport(buildPayload());
      if (response?.success === false) {
        setReport(null);
        setStatusMessage(response.error || 'Could not load Stage Analysis.');
        return;
      }
      setReport({
        ...response,
        data: Array.isArray(response?.data) ? response.data : [],
        employeeColumns: Array.isArray(response?.employeeColumns) ? response.employeeColumns : [],
      });
      if (!response?.data?.length) {
        setStatusMessage('No records found for the selected criteria.');
      }
    } catch (error) {
      setReport(null);
      setStatusMessage(error?.response?.data?.message || error?.message || 'Could not load Stage Analysis.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate('/dashboard');
  };

  const handleBpSelect = (bp) => {
    const code = String(bp?.CardCode || '').trim();
    if (!code) return;
    updateNested('bpSelection', bpLookupTarget, code);
    setShowBpLookup(false);
  };

  const resultColumns = useMemo(
    () => [
      { key: 'rowNo', label: '#' },
      { key: 'stageName', label: 'Stage' },
      { key: 'definedPercent', label: 'Defined %' },
      { key: 'generalActualPercent', label: 'Actual %' },
      { key: 'generalLeadsInStage', label: 'Leads in Stage' },
    ],
    [],
  );

  return (
    <div className="sap-report-page stage-analysis-page">
      <div
        className={`sap-report-window stage-analysis-window stage-analysis-window--criteria ${criteriaWindow.isMinimized ? 'is-minimized' : ''} ${criteriaWindow.isMaximized ? 'is-maximized' : ''}`}
        {...criteriaWindow.windowProps}
      >
        <div className="sap-report-titlebar stage-analysis-window__titlebar" {...criteriaWindow.titleBarProps}>
          <div className="sap-report-title">Stage Analysis - Selection Criteria</div>
          <WindowControls frame={criteriaWindow} onClose={handleClose} />
        </div>
        <div className="sap-report-accent" />
        {!criteriaWindow.isMinimized ? (
          <div className="sap-report-body stage-analysis-criteria-body">
            <div className="stage-analysis-date-grid">
              <label>Start Date</label>
              <span>From</span>
              <input
                className="sap-report-input"
                value={criteria.startDate.from}
                onChange={(event) => updateNested('startDate', 'from', event.target.value)}
              />
              <button type="button" className="stage-analysis-calendar-btn" aria-label="Start date from calendar" />
              <span>To</span>
              <input
                className="sap-report-input"
                value={criteria.startDate.to}
                onChange={(event) => updateNested('startDate', 'to', event.target.value)}
              />
              <label>Predicted Closing Date</label>
              <span>From</span>
              <input
                className="sap-report-input"
                value={criteria.closingDate.from}
                onChange={(event) => updateNested('closingDate', 'from', event.target.value)}
              />
              <button type="button" className="stage-analysis-calendar-btn" aria-label="Predicted closing date calendar" />
              <span>To</span>
              <input
                className="sap-report-input"
                value={criteria.closingDate.to}
                onChange={(event) => updateNested('closingDate', 'to', event.target.value)}
              />
            </div>

            <div className="stage-analysis-filter-list">
              <label className="stage-analysis-check-line">
                <input
                  type="checkbox"
                  checked={criteria.stageSelection.enabled}
                  onChange={(event) => updateNested('stageSelection', 'enabled', event.target.checked)}
                />
                <span>Opportunity Stage</span>
              </label>
              <button type="button" className="stage-analysis-ellipsis-btn" onClick={() => setShowStageLookup(true)}>
                ...
              </button>
              <span className="stage-analysis-selection-text">{getLookupLabel(criteria.stageSelection)}</span>

              <label className="stage-analysis-check-line">
                <input
                  type="checkbox"
                  checked={criteria.salesEmployeeSelection.enabled}
                  onChange={(event) => updateNested('salesEmployeeSelection', 'enabled', event.target.checked)}
                />
                <span>Sales Employee</span>
              </label>
              <button type="button" className="stage-analysis-ellipsis-btn" onClick={() => setShowSalesEmployeeLookup(true)}>
                ...
              </button>
              <span className="stage-analysis-selection-text">{getLookupLabel(criteria.salesEmployeeSelection)}</span>

              <label className="stage-analysis-check-line">
                <input
                  type="checkbox"
                  checked={criteria.bpSelection.enabled}
                  onChange={(event) => updateNested('bpSelection', 'enabled', event.target.checked)}
                />
                <span>BP Code</span>
              </label>
              <button type="button" className="stage-analysis-ellipsis-btn" onClick={() => setShowBpProperties(true)}>
                ...
              </button>
              <span className="stage-analysis-selection-text">
                {criteria.bpSelection.codeFrom || criteria.bpSelection.codeTo
                  ? `${criteria.bpSelection.codeFrom || '*'} - ${criteria.bpSelection.codeTo || '*'}`
                  : ''}
              </span>
            </div>

            <label className="stage-analysis-expired-line">
              <input
                type="checkbox"
                checked={criteria.includeExpiredClosingDate}
                onChange={(event) => updateCriteria((current) => ({
                  ...current,
                  includeExpiredClosingDate: event.target.checked,
                }))}
              />
              <span>Add Opportunities with Expired Closing Date</span>
            </label>

            {statusMessage ? <div className="stage-analysis-status">{statusMessage}</div> : null}

            <div className="stage-analysis-footer">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={loadReport} disabled={loading}>
                OK
              </button>
              <button type="button" className="sap-report-btn" onClick={handleClose}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {hasReport ? (
        <div
          className={`sap-report-window stage-analysis-window stage-analysis-window--report ${reportWindow.isMinimized ? 'is-minimized' : ''} ${reportWindow.isMaximized ? 'is-maximized' : ''}`}
          {...reportWindow.windowProps}
        >
          <div className="sap-report-titlebar stage-analysis-window__titlebar" {...reportWindow.titleBarProps}>
            <div className="sap-report-title">Stage Analysis</div>
            <WindowControls frame={reportWindow} onClose={() => setReport(null)} />
          </div>
          <div className="sap-report-accent" />
          {!reportWindow.isMinimized ? (
            <div className="sap-report-body stage-analysis-report-body">
              <div className="stage-analysis-grid-wrap stage-analysis-result-wrap">
                <table className="sap-report-grid stage-analysis-result-grid">
                  <thead>
                    <tr>
                      <th rowSpan="2">#</th>
                      <th rowSpan="2">Stage</th>
                      <th colSpan="3">General</th>
                      {employeeColumns.map((employee) => (
                        <th key={employee.code} colSpan="2">{employee.name}</th>
                      ))}
                    </tr>
                    <tr>
                      {resultColumns.slice(2).map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                      {employeeColumns.map((employee) => (
                        <React.Fragment key={`${employee.code}-sub`}>
                          <th>Actual %</th>
                          <th>Leads in Stage</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.stageCode || row.stageName}>
                        <td>{row.rowNo}</td>
                        <td>{row.stageName}</td>
                        <td className="stage-analysis-cell-number">{getDisplayNumber(row.definedPercent)}</td>
                        <td className="stage-analysis-cell-number">{getDisplayNumber(row.generalActualPercent)}</td>
                        <td className="stage-analysis-cell-number">{getDisplayNumber(row.generalLeadsInStage)}</td>
                        {employeeColumns.map((employee) => {
                          const cell = row.employeeBreakdown?.[employee.code] || {};
                          return (
                            <React.Fragment key={`${row.stageCode}-${employee.code}`}>
                              <td className="stage-analysis-cell-number">{getDisplayNumber(cell.actualPercent)}</td>
                              <td className="stage-analysis-cell-number">{getDisplayNumber(cell.leadsInStage)}</td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                    {Array.from({ length: fillerResultRows }, (_, rowIndex) => (
                      <tr key={`empty-${rowIndex}`} className="stage-analysis-empty-result-row">
                        {Array.from({ length: resultColumnCount }, (_, cellIndex) => (
                          <td key={cellIndex}>&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="stage-analysis-report-lower">
                <StageAnalysisChart data={rows} employeeColumns={employeeColumns} />
                <div className="stage-analysis-report-actions">
                  <button type="button" className="stage-analysis-lookup-action" onClick={() => setShowStageLookup(true)}>
                    <span>...</span>
                    Stage
                  </button>
                  <button type="button" className="stage-analysis-lookup-action" onClick={() => setShowSalesEmployeeLookup(true)}>
                    <span>...</span>
                    Sales Employee
                  </button>
                  <label className="stage-analysis-check-line">
                    <input
                      type="checkbox"
                      checked={criteria.printGraph}
                      onChange={(event) => updateCriteria((current) => ({ ...current, printGraph: event.target.checked }))}
                    />
                    <span>Print Graph</span>
                  </label>
                </div>
              </div>

              <div className="stage-analysis-report-footer">
                <button type="button" className="stage-analysis-back-btn" onClick={() => setReport(null)} aria-label="Back" />
                <button type="button" className="sap-report-btn" onClick={() => setReport(null)}>
                  Cancel
                </button>
                <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={loadReport} disabled={loading}>
                  Refresh
                </button>
                <label className="stage-analysis-check-line stage-analysis-expired-report-line">
                  <input
                    type="checkbox"
                    checked={criteria.includeExpiredClosingDate}
                    onChange={(event) => updateCriteria((current) => ({
                      ...current,
                      includeExpiredClosingDate: event.target.checked,
                    }))}
                  />
                  <span>Display Opportunities With Expired Closing Date</span>
                </label>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <StageLookupModal
        isOpen={showStageLookup}
        stages={stages}
        selectedCodes={criteria.stageSelection.selectedCodes}
        stageType={criteria.stageSelection.stageType}
        onClose={() => setShowStageLookup(false)}
        onApply={(selection) => updateCriteria((current) => ({
          ...current,
          stageSelection: {
            ...current.stageSelection,
            enabled: true,
            ...selection,
          },
        }))}
      />

      <SalesEmployeeMultiLookupModal
        isOpen={showSalesEmployeeLookup}
        selectedCodes={criteria.salesEmployeeSelection.selectedCodes}
        onClose={() => setShowSalesEmployeeLookup(false)}
        onApply={(selection) => updateCriteria((current) => ({
          ...current,
          salesEmployeeSelection: {
            ...current.salesEmployeeSelection,
            enabled: true,
            ...selection,
          },
        }))}
      />

      <BPPropertiesModal
        isOpen={showBpProperties}
        value={criteria.bpSelection}
        customerGroups={customerGroups}
        vendorGroups={vendorGroups}
        bpProperties={bpProperties}
        onClose={() => setShowBpProperties(false)}
        onApply={(selection) => updateCriteria((current) => ({
          ...current,
          bpSelection: {
            ...current.bpSelection,
            enabled: true,
            ...selection,
          },
        }))}
        onOpenBpLookup={(target) => {
          setBpLookupTarget(target);
          setShowBpLookup(true);
        }}
      />

      <BusinessPartnerLookupModal
        isOpen={showBpLookup}
        onClose={() => setShowBpLookup(false)}
        onSelect={handleBpSelect}
        type="cCustomer"
      />

      {loading ? <div className="stage-analysis-loading">Loading Stage Analysis...</div> : null}
    </div>
  );
}
