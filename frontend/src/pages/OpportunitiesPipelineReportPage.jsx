import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBPGroups, fetchBPProperties, fetchSalesPersons } from '../api/businessPartnerApi';
import {
  fetchOpportunityForecastLookups,
  fetchOpportunitiesPipelineReport,
} from '../api/opportunitiesForecastApi';
import BusinessPartnerLookupModal from '../components/reports/BusinessPartnerLookupModal';
import PropertiesSelectionModal from '../components/reports/PropertiesSelectionModal';
import useFloatingWindow from '../components/reports/useFloatingWindow';
import { useSapWindowTaskbarActions } from '../components/SapWindowTaskbarContext';
import '../styles/opportunities-pipeline-report.css';

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

const DOCUMENT_OPTIONS = [
  { value: 'salesQuotation', label: 'Sales Quotation' },
  { value: 'salesOrder', label: 'Sales Order' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'arInvoice', label: 'A/R Invoice' },
  { value: 'purchaseQuotation', label: 'Purchase Quotation' },
  { value: 'purchaseOrder', label: 'Purchase Order' },
  { value: 'goodsReceiptPo', label: 'Goods Receipt PO' },
  { value: 'apInvoice', label: 'A/P Invoice' },
];

const DISPLAY_OPTIONS = [
  { value: 'expectedTotal', label: 'Expected Total' },
  { value: 'weightedTotal', label: 'Weighted Total Amount' },
  { value: 'closingPercentage', label: 'Closing Percentage' },
];

const EXPANDED_FIELDS = [
  { key: 'territories', label: 'Territories', lookupKey: 'territories' },
  { key: 'sources', label: 'Sources', lookupKey: 'sources' },
  { key: 'partners', label: 'Partners', lookupKey: 'partners' },
  { key: 'competitors', label: 'Competitors', lookupKey: 'competitors' },
  { key: 'industry', label: 'Industry', lookupKey: 'industries' },
  { key: 'bpChannelCode', label: 'BP Channel Code', lookupKey: 'channelCodes' },
  { key: 'levelOfInterest', label: 'Level of Interest', lookupKey: 'interestLevels' },
  { key: 'project', label: 'Project', lookupKey: 'projects' },
  { key: 'userDefinedFields', label: 'User-Defined Fields', lookupKey: 'userDefinedFields' },
];

const emptyRange = () => ({ enabled: false, from: '', to: '' });

const createInitialCriteria = () => ({
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
  salesEmployeeSelection: {
    enabled: false,
    selectedCodes: [],
    selectedLabels: [],
  },
  stageSelection: {
    enabled: false,
    selectedCodes: [],
    selectedLabels: [],
    stageType: 'all',
  },
  dateSelection: {
    enabled: false,
    startDate: emptyRange(),
    closingDate: emptyRange(),
    predictedClosingDate: emptyRange(),
  },
  documentsSelection: {
    enabled: false,
    selectedCodes: [],
    selectedLabels: [],
    documentType: 'all',
  },
  amountsSelection: {
    enabled: false,
    potentialAmount: emptyRange(),
    weightedAmount: emptyRange(),
    grossProfitTotal: emptyRange(),
  },
  percentageSelection: {
    enabled: false,
    closingPercentage: emptyRange(),
  },
  expandedSelection: EXPANDED_FIELDS.reduce((acc, field) => ({
    ...acc,
    [field.key]: {
      enabled: false,
      selectedCodes: [],
      selectedLabels: [],
    },
  }), {}),
  displayMode: 'expectedTotal',
  printGraph: false,
});

const normalizeRows = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const normalizeLookupRows = (rows = []) =>
  rows
    .map((row) => ({
      value: String(row.value ?? row.code ?? row.CardCode ?? row.SlpCode ?? '').trim(),
      label: String(row.label ?? row.name ?? row.CardName ?? row.SlpName ?? row.value ?? row.code ?? '').trim(),
      active: row.Active ?? row.active ?? 'Y',
    }))
    .filter((row) => row.value || row.label);

const normalizeGroupRows = (rows = []) =>
  rows
    .map((group) => ({
      code: String(group.code ?? group.value ?? '').trim(),
      name: String(group.name ?? group.label ?? group.code ?? group.value ?? '').trim(),
    }))
    .filter((group) => group.code || group.name);

const getGroupOptions = (groups = []) => [
  { code: '', name: 'All' },
  ...normalizeGroupRows(groups),
  { code: GROUP_NONE_VALUE, name: 'None' },
];

const getPropertySummary = (propertyFilter = {}) => {
  if (propertyFilter.ignoreProperties !== false) return 'Ignore';
  const count = Array.isArray(propertyFilter.selectedPropertyNumbers)
    ? propertyFilter.selectedPropertyNumbers.length
    : 0;
  return count ? `${count} Selected` : 'None';
};

const formatAmount = (value) =>
  Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });

function WindowControls({ frame, onClose }) {
  return (
    <div className="pipeline-window__controls">
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

function MultiSelectLookupModal({
  isOpen,
  title,
  rows,
  selectedCodes,
  loading,
  error,
  showFind = false,
  showActive = false,
  bottomLabel = '',
  bottomValue = '',
  bottomOptions = [],
  onBottomChange,
  onFind,
  onClose,
  onApply,
}) {
  const [localCodes, setLocalCodes] = useState([]);
  const [findText, setFindText] = useState('');
  const frame = useFloatingWindow({
    isOpen,
    defaultTop: 88,
    taskId: `opportunities-pipeline-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    taskTitle: title,
    taskPath: '/reports/crm/opportunities/pipeline',
  });

  useEffect(() => {
    if (!isOpen) return;
    setLocalCodes(selectedCodes || []);
    setFindText('');
  }, [isOpen, selectedCodes]);

  if (!isOpen) return null;

  const normalizedRows = normalizeLookupRows(rows);
  const toggle = (value) => {
    setLocalCodes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };
  const apply = () => {
    const selectedRows = normalizedRows.filter((row) => localCodes.includes(row.value));
    onApply({
      selectedCodes: localCodes,
      selectedLabels: selectedRows.map((row) => row.label || row.value),
      bottomValue,
    });
    onClose();
  };

  return (
    <div className="pipeline-dialog-layer">
      <div
        className={`sap-report-window pipeline-dialog pipeline-dialog--lookup ${frame.isMinimized ? 'is-minimized' : ''}`}
        {...frame.windowProps}
      >
        <div className="sap-report-titlebar pipeline-window__titlebar" {...frame.titleBarProps}>
          <div className="sap-report-title">{title}</div>
          <WindowControls frame={frame} onClose={onClose} />
        </div>
        <div className="sap-report-accent" />
        {!frame.isMinimized ? (
          <div className="pipeline-dialog__body">
            {showFind ? (
              <div className="pipeline-dialog__find">
                <label>Find</label>
                <input
                  className="sap-report-input"
                  value={findText}
                  onChange={(event) => setFindText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onFind?.(findText);
                    }
                  }}
                  autoFocus
                />
              </div>
            ) : null}
            <div className="pipeline-grid-wrap pipeline-dialog__grid-wrap">
              <table className="sap-report-grid pipeline-dialog-grid">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    {showActive ? <th>Active</th> : null}
                    <th>Choose</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={showActive ? 4 : 3} className="pipeline-empty-cell">Loading...</td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={showActive ? 4 : 3} className="pipeline-empty-cell is-error">{error}</td>
                    </tr>
                  ) : normalizedRows.length ? normalizedRows.map((row, index) => (
                    <tr key={`${row.value || row.label}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{row.label || row.value}</td>
                      {showActive ? (
                        <td className="pipeline-cell-center">
                          <input type="checkbox" checked={String(row.active || 'Y').toUpperCase() !== 'N'} readOnly />
                        </td>
                      ) : null}
                      <td className="pipeline-cell-center">
                        <input
                          type="checkbox"
                          checked={localCodes.includes(row.value)}
                          onChange={() => toggle(row.value)}
                        />
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={showActive ? 4 : 3} className="pipeline-empty-cell">No rows found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {bottomLabel ? (
              <div className="pipeline-dialog__form-row">
                <label>{bottomLabel}</label>
                <select className="sap-report-input" value={bottomValue} onChange={(event) => onBottomChange?.(event.target.value)}>
                  {bottomOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="pipeline-dialog__footer">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={apply}>OK</button>
              <button type="button" className="sap-report-btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RangeDialog({ isOpen, title, rows, value, onClose, onApply }) {
  const [draft, setDraft] = useState(value || {});
  const frame = useFloatingWindow({
    isOpen,
    defaultTop: 110,
    taskId: `opportunities-pipeline-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    taskTitle: title,
    taskPath: '/reports/crm/opportunities/pipeline',
  });

  useEffect(() => {
    if (isOpen) setDraft(value || {});
  }, [isOpen, value]);

  if (!isOpen) return null;

  const updateRange = (key, field, fieldValue) => {
    setDraft((current) => ({
      ...current,
      [key]: {
        ...current[key],
        enabled: true,
        [field]: fieldValue,
      },
    }));
  };

  const apply = () => {
    onApply({
      ...draft,
      enabled: true,
    });
    onClose();
  };

  return (
    <div className="pipeline-dialog-layer">
      <div
        className={`sap-report-window pipeline-dialog pipeline-dialog--range ${frame.isMinimized ? 'is-minimized' : ''}`}
        {...frame.windowProps}
      >
        <div className="sap-report-titlebar pipeline-window__titlebar" {...frame.titleBarProps}>
          <div className="sap-report-title">{title}</div>
          <WindowControls frame={frame} onClose={onClose} />
        </div>
        <div className="sap-report-accent" />
        {!frame.isMinimized ? (
          <div className="pipeline-dialog__body">
            <div className="pipeline-range-grid">
              {rows.map((row) => (
                <React.Fragment key={row.key}>
                  <label>{row.label}</label>
                  <span>From</span>
                  <input
                    className="sap-report-input"
                    value={draft[row.key]?.from || ''}
                    onChange={(event) => updateRange(row.key, 'from', event.target.value)}
                  />
                  <span>To</span>
                  <input
                    className="sap-report-input"
                    value={draft[row.key]?.to || ''}
                    onChange={(event) => updateRange(row.key, 'to', event.target.value)}
                  />
                </React.Fragment>
              ))}
            </div>
            <div className="pipeline-dialog__footer">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={apply}>OK</button>
              <button type="button" className="sap-report-btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BPPropertiesDialog({
  isOpen,
  value,
  customerGroups,
  vendorGroups,
  bpProperties,
  onClose,
  onApply,
  onOpenBpLookup,
}) {
  const [draft, setDraft] = useState(value);
  const [showProperties, setShowProperties] = useState(false);
  const frame = useFloatingWindow({
    isOpen,
    defaultTop: 74,
    taskId: 'opportunities-pipeline-bp-properties',
    taskTitle: 'BP Properties',
    taskPath: '/reports/crm/opportunities/pipeline',
  });

  useEffect(() => {
    if (isOpen) setDraft(value);
  }, [isOpen, value]);

  if (!isOpen) return null;

  const updateField = (field, fieldValue) => {
    setDraft((current) => ({ ...current, [field]: fieldValue }));
  };

  const apply = () => {
    onApply({ ...draft, enabled: true });
    onClose();
  };

  const selectAll = () => {
    setDraft((current) => ({
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
    <div className="pipeline-dialog-layer">
      <div
        className={`sap-report-window pipeline-dialog pipeline-dialog--bp ${frame.isMinimized ? 'is-minimized' : ''}`}
        {...frame.windowProps}
      >
        <div className="sap-report-titlebar pipeline-window__titlebar" {...frame.titleBarProps}>
          <div className="sap-report-title">BP Properties</div>
          <WindowControls frame={frame} onClose={onClose} />
        </div>
        <div className="sap-report-accent" />
        {!frame.isMinimized ? (
          <div className="pipeline-dialog__body">
            <div className="pipeline-bp-form">
              <label>Code</label>
              <span>From</span>
              <div className="pipeline-code-picker">
                <input className="sap-report-input" value={draft.codeFrom || ''} onChange={(event) => updateField('codeFrom', event.target.value)} />
                <button type="button" className="pipeline-ellipsis-btn" onClick={() => onOpenBpLookup('codeFrom')}>...</button>
              </div>
              <span>To</span>
              <div className="pipeline-code-picker">
                <input className="sap-report-input" value={draft.codeTo || ''} onChange={(event) => updateField('codeTo', event.target.value)} />
                <button type="button" className="pipeline-ellipsis-btn" onClick={() => onOpenBpLookup('codeTo')}>...</button>
              </div>

              <label>Business Partner Type</label>
              <select className="sap-report-input pipeline-bp-span" value={draft.bpType || 'all'} onChange={(event) => updateField('bpType', event.target.value)}>
                {BP_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>

              <label>Customer Group</label>
              <select className="sap-report-input pipeline-bp-span" value={draft.customerGroup ?? ''} onChange={(event) => updateField('customerGroup', event.target.value)}>
                {getGroupOptions(customerGroups).map((group) => <option key={`customer-${group.code || group.name}`} value={group.code}>{group.name || group.code}</option>)}
              </select>

              <label>Vendor Group</label>
              <select className="sap-report-input pipeline-bp-span" value={draft.vendorGroup ?? ''} onChange={(event) => updateField('vendorGroup', event.target.value)}>
                {getGroupOptions(vendorGroups).map((group) => <option key={`vendor-${group.code || group.name}`} value={group.code}>{group.name || group.code}</option>)}
              </select>
            </div>
            <div className="pipeline-bp-properties-row">
              <button type="button" className="sap-report-btn" onClick={() => setShowProperties(true)}>Properties</button>
              <input className="sap-report-input" value={getPropertySummary(draft.propertyFilter)} readOnly />
            </div>
            <div className="pipeline-dialog__footer pipeline-dialog__footer--wide">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={apply}>OK</button>
              <button type="button" className="sap-report-btn" onClick={onClose}>Cancel</button>
              <button type="button" className="sap-report-btn" onClick={selectAll}>Select All</button>
            </div>
          </div>
        ) : null}
      </div>
      <PropertiesSelectionModal
        isOpen={showProperties}
        title="Properties"
        propertyLabelPrefix="Business Partners Property"
        properties={bpProperties}
        value={draft.propertyFilter}
        onClose={() => setShowProperties(false)}
        onSave={(propertyFilter) => updateField('propertyFilter', propertyFilter)}
      />
    </div>
  );
}

function ExpandedSelectionDialog({ isOpen, value, lookups, onClose, onApply, onOpenLookup }) {
  const [draft, setDraft] = useState(value);
  const frame = useFloatingWindow({
    isOpen,
    defaultTop: 64,
    taskId: 'opportunities-pipeline-expanded-selection',
    taskTitle: 'Expanded Selection Criteria',
    taskPath: '/reports/crm/opportunities/pipeline',
  });

  useEffect(() => {
    if (isOpen) setDraft(value);
  }, [isOpen, value]);

  if (!isOpen) return null;

  const toggle = (key, enabled) => {
    setDraft((current) => ({
      ...current,
      [key]: {
        ...current[key],
        enabled,
      },
    }));
  };
  const clear = () => {
    setDraft(createInitialCriteria().expandedSelection);
  };
  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <div className="pipeline-dialog-layer">
      <div
        className={`sap-report-window pipeline-dialog pipeline-dialog--expanded ${frame.isMinimized ? 'is-minimized' : ''}`}
        {...frame.windowProps}
      >
        <div className="sap-report-titlebar pipeline-window__titlebar" {...frame.titleBarProps}>
          <div className="sap-report-title">Expanded Selection Criteria</div>
          <WindowControls frame={frame} onClose={onClose} />
        </div>
        <div className="sap-report-accent" />
        {!frame.isMinimized ? (
          <div className="pipeline-dialog__body">
            <div className="pipeline-expanded-panel">
              {EXPANDED_FIELDS.map((field) => {
                const rows = lookups[field.lookupKey] || [];
                return (
                  <React.Fragment key={field.key}>
                    <label className="pipeline-check-line">
                      <input
                        type="checkbox"
                        checked={Boolean(draft[field.key]?.enabled)}
                        onChange={(event) => toggle(field.key, event.target.checked)}
                      />
                      <span>{field.label}</span>
                    </label>
                    <button
                      type="button"
                      className="pipeline-ellipsis-btn"
                      onClick={() => onOpenLookup(field, draft)}
                      disabled={!rows.length && field.key !== 'userDefinedFields'}
                    >
                      ...
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
            <div className="pipeline-expanded-footer">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={apply}>OK</button>
              <button type="button" className="sap-report-btn" onClick={onClose}>Cancel</button>
              <button type="button" className="sap-report-btn" onClick={clear}>Clear</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PipelineCylinder({ rows, displayMode }) {
  const visibleRows = rows.slice(0, 3);
  const total = Math.max(
    1,
    ...visibleRows.map((row) => {
      if (displayMode === 'weightedTotal') return Number(row.weightedAmount || 0);
      if (displayMode === 'closingPercentage') return Number(row.closingPercentage || 0);
      return Number(row.expectedTotal || 0);
    }),
  );

  return (
    <div className="pipeline-cylinder" aria-hidden="true">
      {visibleRows.length ? visibleRows.map((row, index) => {
        const rawValue = displayMode === 'weightedTotal'
          ? row.weightedAmount
          : displayMode === 'closingPercentage'
            ? row.closingPercentage
            : row.expectedTotal;
        const width = Math.max(22, Math.round((Number(rawValue || 0) / total) * 48));
        return (
          <div
            key={row.id || row.description}
            className={`pipeline-cylinder__segment pipeline-cylinder__segment--${index + 1}`}
            style={{ width: `${width + 18}%` }}
          />
        );
      }) : (
        <>
          <div className="pipeline-cylinder__segment pipeline-cylinder__segment--1" />
          <div className="pipeline-cylinder__segment pipeline-cylinder__segment--2" />
          <div className="pipeline-cylinder__segment pipeline-cylinder__segment--3" />
        </>
      )}
      <div className="pipeline-cylinder__cap" />
    </div>
  );
}

export default function OpportunitiesPipelineReportPage() {
  const navigate = useNavigate();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(createInitialCriteria);
  const [lookups, setLookups] = useState({
    stages: [],
    territories: [],
    sources: [],
    partners: [],
    competitors: [],
    industries: [],
    channelCodes: [],
    interestLevels: [],
    projects: [],
    userDefinedFields: [],
  });
  const [customerGroups, setCustomerGroups] = useState([]);
  const [vendorGroups, setVendorGroups] = useState([]);
  const [bpProperties, setBpProperties] = useState(DEFAULT_BP_PROPERTIES);
  const [salesEmployeeRows, setSalesEmployeeRows] = useState([]);
  const [salesEmployeeLoading, setSalesEmployeeLoading] = useState(false);
  const [salesEmployeeError, setSalesEmployeeError] = useState('');
  const [report, setReport] = useState({ data: [], totals: { expectedTotal: 0, weightedAmount: 0 } });
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [activeDialog, setActiveDialog] = useState('');
  const [lookupDialog, setLookupDialog] = useState(null);
  const [bpLookupTarget, setBpLookupTarget] = useState('');
  const [expandedDraft, setExpandedDraft] = useState(null);
  const [stageTypeDraft, setStageTypeDraft] = useState('all');
  const [documentTypeDraft, setDocumentTypeDraft] = useState('all');

  const frame = useFloatingWindow({
    isOpen: true,
    defaultTop: 18,
    taskId: 'opportunities-pipeline-report',
    taskTitle: 'Opportunities Pipeline',
    taskPath: '/reports/crm/opportunities/pipeline',
  });

  const rows = report?.data || [];
  const totals = report?.totals || {};
  const fillerRows = Math.max(0, 5 - rows.length);

  const loadReport = async (payload = criteria) => {
    setLoading(true);
    setStatusMessage('');
    try {
      const response = await fetchOpportunitiesPipelineReport(payload);
      if (response?.success === false) {
        setReport({ data: [], totals: { expectedTotal: 0, weightedAmount: 0 } });
        setStatusMessage(response.error || 'Could not load Opportunities Pipeline.');
        return;
      }
      setReport({
        ...response,
        data: Array.isArray(response?.data) ? response.data : [],
        totals: response?.totals || { expectedTotal: 0, weightedAmount: 0 },
      });
      if (!response?.data?.length) setStatusMessage('No records found for the selected criteria.');
    } catch (error) {
      setReport({ data: [], totals: { expectedTotal: 0, weightedAmount: 0 } });
      setStatusMessage(error?.response?.data?.message || error?.message || 'Could not load Opportunities Pipeline.');
    } finally {
      setLoading(false);
    }
  };

  const loadSalesEmployees = async (query = '') => {
    setSalesEmployeeLoading(true);
    setSalesEmployeeError('');
    try {
      const response = await fetchSalesPersons(query);
      setSalesEmployeeRows(Array.isArray(response) ? response : []);
    } catch (error) {
      setSalesEmployeeRows([]);
      setSalesEmployeeError(error?.response?.data?.message || error?.message || 'Failed to load sales employees.');
    } finally {
      setSalesEmployeeLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const initialCriteria = createInitialCriteria();

    const loadInitialData = async () => {
      try {
        const [lookupResponse, customerGroupResponse, vendorGroupResponse, propertyResponse] = await Promise.all([
          fetchOpportunityForecastLookups().catch(() => null),
          fetchBPGroups('', 'customer').catch(() => []),
          fetchBPGroups('', 'vendor').catch(() => []),
          fetchBPProperties().catch(() => []),
        ]);
        if (ignore) return;
        const lookupData = lookupResponse?.data || {};
        setLookups({
          stages: normalizeLookupRows(lookupData.stages || []),
          territories: normalizeLookupRows(lookupData.territories || []),
          sources: normalizeLookupRows(lookupData.sources || []),
          partners: normalizeLookupRows(lookupData.partners || []),
          competitors: normalizeLookupRows(lookupData.competitors || []),
          industries: normalizeLookupRows(lookupData.industries || []),
          channelCodes: normalizeLookupRows(lookupData.channelCodes || []),
          interestLevels: normalizeLookupRows(lookupData.interestLevels || []),
          projects: normalizeLookupRows(lookupData.projects || []),
          userDefinedFields: [],
        });
        setCustomerGroups(normalizeRows(customerGroupResponse));
        setVendorGroups(normalizeRows(vendorGroupResponse));
        setBpProperties(Array.isArray(propertyResponse) && propertyResponse.length ? propertyResponse : DEFAULT_BP_PROPERTIES);
      } catch (_error) {
        if (!ignore) setBpProperties(DEFAULT_BP_PROPERTIES);
      }
    };

    loadInitialData();
    loadReport(initialCriteria);

    return () => {
      ignore = true;
    };
  }, []);

  const updateCriteria = (updater) => {
    setCriteria((current) => (typeof updater === 'function' ? updater(current) : updater));
  };
  const updateSelectionEnabled = (key, enabled) => {
    updateCriteria((current) => ({
      ...current,
      [key]: {
        ...current[key],
        enabled,
      },
    }));
  };
  const resetCriteria = () => {
    const nextCriteria = createInitialCriteria();
    setCriteria(nextCriteria);
    loadReport(nextCriteria);
  };
  const handleClose = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate('/dashboard');
  };
  const handleBpSelect = (bp) => {
    const code = String(bp?.CardCode || '').trim();
    if (!code || !bpLookupTarget) return;
    updateCriteria((current) => ({
      ...current,
      bpSelection: {
        ...current.bpSelection,
        enabled: true,
        [bpLookupTarget]: code,
      },
    }));
    setBpLookupTarget('');
  };
  const openSalesEmployeeDialog = () => {
    setActiveDialog('salesEmployee');
    loadSalesEmployees('');
  };
  const openExpandedLookup = (field, draftValue) => {
    setExpandedDraft(draftValue);
    setLookupDialog({
      title: field.label,
      fieldKey: field.key,
      lookupKey: field.lookupKey,
      rows: lookups[field.lookupKey] || [],
      selectedCodes: draftValue[field.key]?.selectedCodes || [],
      target: 'expanded',
    });
  };

  const stageRows = useMemo(() => lookups.stages, [lookups.stages]);
  const displayedStatus = statusMessage || (loading ? 'Loading Opportunities Pipeline...' : '');

  return (
    <div className="sap-report-page pipeline-page">
      <div
        className={`sap-report-window pipeline-window ${frame.isMinimized ? 'is-minimized' : ''} ${frame.isMaximized ? 'is-maximized' : ''}`}
        {...frame.windowProps}
      >
        <div className="sap-report-titlebar pipeline-window__titlebar" {...frame.titleBarProps}>
          <div className="sap-report-title">Opportunities Pipeline</div>
          <WindowControls frame={frame} onClose={handleClose} />
        </div>
        <div className="sap-report-accent" />
        {!frame.isMinimized ? (
          <div className="sap-report-body pipeline-body">
            <div className="pipeline-main">
              <div className="pipeline-left">
                {[
                  ['bpSelection', 'BP Code', () => setActiveDialog('bp')],
                  ['salesEmployeeSelection', 'Sales Employee', openSalesEmployeeDialog],
                  ['stageSelection', 'Stage', () => {
                    setStageTypeDraft(criteria.stageSelection.stageType || 'all');
                    setActiveDialog('stage');
                  }],
                  ['dateSelection', 'Date', () => setActiveDialog('date')],
                  ['documentsSelection', 'Documents', () => {
                    setDocumentTypeDraft(criteria.documentsSelection.documentType || 'all');
                    setActiveDialog('documents');
                  }],
                  ['amountsSelection', 'Amounts', () => setActiveDialog('amounts')],
                  ['percentageSelection', 'Percentage Rate', () => setActiveDialog('percentage')],
                ].map(([key, label, open]) => (
                  <React.Fragment key={key}>
                    <label className="pipeline-check-line">
                      <input
                        type="checkbox"
                        checked={Boolean(criteria[key]?.enabled)}
                        onChange={(event) => updateSelectionEnabled(key, event.target.checked)}
                      />
                      <span>{label}</span>
                    </label>
                    <button type="button" className="pipeline-ellipsis-btn" onClick={open}>...</button>
                  </React.Fragment>
                ))}

                <button type="button" className="sap-report-btn pipeline-expand-btn" onClick={() => setActiveDialog('expanded')}>
                  Expand
                </button>

                <label className="pipeline-display-label">Display</label>
                <select
                  className="sap-report-input pipeline-display-select"
                  value={criteria.displayMode}
                  onChange={(event) => updateCriteria((current) => ({ ...current, displayMode: event.target.value }))}
                >
                  {DISPLAY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div className="pipeline-right">
                <PipelineCylinder rows={rows} displayMode={criteria.displayMode} />
                <div className="pipeline-grid-wrap pipeline-result-wrap">
                  <table className="sap-report-grid pipeline-result-grid">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Description</th>
                        <th>No.</th>
                        <th>Expected Total</th>
                        <th>Weighted Amount</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id || row.description}>
                          <td>{row.id}</td>
                          <td>{row.description}</td>
                          <td className="pipeline-cell-number">{formatAmount(row.no)}</td>
                          <td className="pipeline-cell-number">{formatAmount(row.expectedTotal)}</td>
                          <td className="pipeline-cell-number">{formatAmount(row.weightedAmount)}</td>
                          <td className="pipeline-cell-number">{row.closingPercentage ? formatAmount(row.closingPercentage) : ''}</td>
                        </tr>
                      ))}
                      {Array.from({ length: fillerRows }, (_, index) => (
                        <tr key={`empty-${index}`} className="pipeline-empty-result-row">
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                        </tr>
                      ))}
                      <tr className="pipeline-total-row">
                        <td />
                        <td />
                        <td />
                        <td className="pipeline-cell-number">{formatAmount(totals.expectedTotal)}</td>
                        <td className="pipeline-cell-number">{formatAmount(totals.weightedAmount)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="pipeline-scrollbar" aria-hidden="true">
                  <span />
                  <i />
                  <b />
                </div>
              </div>
            </div>

            {displayedStatus ? <div className="pipeline-status">{displayedStatus}</div> : null}

            <div className="pipeline-footer">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={() => loadReport()} disabled={loading}>OK</button>
              <button type="button" className="sap-report-btn" onClick={handleClose}>Cancel</button>
              <label className="pipeline-print-check">
                <input
                  type="checkbox"
                  checked={criteria.printGraph}
                  onChange={(event) => updateCriteria((current) => ({ ...current, printGraph: event.target.checked }))}
                />
                <span>Print Graph</span>
              </label>
              <button type="button" className="sap-report-btn pipeline-clear-btn" onClick={resetCriteria}>Clear Conditions</button>
              <button type="button" className="sap-report-btn" onClick={() => loadReport()} disabled={loading}>Refresh</button>
            </div>
          </div>
        ) : null}
      </div>

      <BPPropertiesDialog
        isOpen={activeDialog === 'bp'}
        value={criteria.bpSelection}
        customerGroups={customerGroups}
        vendorGroups={vendorGroups}
        bpProperties={bpProperties}
        onClose={() => setActiveDialog('')}
        onApply={(selection) => updateCriteria((current) => ({ ...current, bpSelection: selection }))}
        onOpenBpLookup={(target) => setBpLookupTarget(target)}
      />

      <MultiSelectLookupModal
        isOpen={activeDialog === 'salesEmployee'}
        title="Sales Employee"
        rows={salesEmployeeRows.map((row) => ({
          value: String(row.code ?? row.SlpCode ?? ''),
          label: String(row.name ?? row.SlpName ?? ''),
          active: row.Active ?? row.active ?? 'Y',
        }))}
        selectedCodes={criteria.salesEmployeeSelection.selectedCodes}
        loading={salesEmployeeLoading}
        error={salesEmployeeError}
        showFind
        showActive
        onFind={loadSalesEmployees}
        onClose={() => setActiveDialog('')}
        onApply={(selection) => updateCriteria((current) => ({
          ...current,
          salesEmployeeSelection: { ...current.salesEmployeeSelection, enabled: true, ...selection },
        }))}
      />

      <MultiSelectLookupModal
        isOpen={activeDialog === 'stage'}
        title="Stage"
        rows={stageRows}
        selectedCodes={criteria.stageSelection.selectedCodes}
        bottomLabel="Stage Type"
        bottomValue={stageTypeDraft}
        bottomOptions={[
          { value: 'all', label: 'All Stages' },
          { value: 'open', label: 'Open Stages' },
          { value: 'won', label: 'Won Stages' },
          { value: 'lost', label: 'Lost Stages' },
        ]}
        onBottomChange={setStageTypeDraft}
        onClose={() => setActiveDialog('')}
        onApply={(selection) => updateCriteria((current) => ({
          ...current,
          stageSelection: {
            ...current.stageSelection,
            enabled: true,
            selectedCodes: selection.selectedCodes,
            selectedLabels: selection.selectedLabels,
            stageType: stageTypeDraft,
          },
        }))}
      />

      <RangeDialog
        isOpen={activeDialog === 'date'}
        title="Date"
        value={criteria.dateSelection}
        rows={[
          { key: 'startDate', label: 'Start Date' },
          { key: 'closingDate', label: 'Closing Date' },
          { key: 'predictedClosingDate', label: 'Predicted Closing Date' },
        ]}
        onClose={() => setActiveDialog('')}
        onApply={(selection) => updateCriteria((current) => ({ ...current, dateSelection: selection }))}
      />

      <MultiSelectLookupModal
        isOpen={activeDialog === 'documents'}
        title="Documents"
        rows={DOCUMENT_OPTIONS}
        selectedCodes={criteria.documentsSelection.selectedCodes}
        bottomLabel="Document Type"
        bottomValue={documentTypeDraft}
        bottomOptions={[
          { value: 'all', label: 'All Documents' },
          { value: 'sales', label: 'Sales Documents' },
          { value: 'purchase', label: 'Purchase Documents' },
        ]}
        onBottomChange={setDocumentTypeDraft}
        onClose={() => setActiveDialog('')}
        onApply={(selection) => updateCriteria((current) => ({
          ...current,
          documentsSelection: {
            ...current.documentsSelection,
            enabled: true,
            selectedCodes: selection.selectedCodes,
            selectedLabels: selection.selectedLabels,
            documentType: documentTypeDraft,
          },
        }))}
      />

      <RangeDialog
        isOpen={activeDialog === 'amounts'}
        title="Amounts"
        value={criteria.amountsSelection}
        rows={[
          { key: 'potentialAmount', label: 'Potential Amount' },
          { key: 'weightedAmount', label: 'Weighted Amount' },
          { key: 'grossProfitTotal', label: 'Gross Profit Total' },
        ]}
        onClose={() => setActiveDialog('')}
        onApply={(selection) => updateCriteria((current) => ({ ...current, amountsSelection: selection }))}
      />

      <RangeDialog
        isOpen={activeDialog === 'percentage'}
        title="Percentage Rate"
        value={criteria.percentageSelection}
        rows={[{ key: 'closingPercentage', label: 'Closing %' }]}
        onClose={() => setActiveDialog('')}
        onApply={(selection) => updateCriteria((current) => ({ ...current, percentageSelection: selection }))}
      />

      <ExpandedSelectionDialog
        isOpen={activeDialog === 'expanded'}
        value={criteria.expandedSelection}
        lookups={lookups}
        onClose={() => setActiveDialog('')}
        onApply={(selection) => updateCriteria((current) => ({ ...current, expandedSelection: selection }))}
        onOpenLookup={openExpandedLookup}
      />

      <MultiSelectLookupModal
        isOpen={Boolean(lookupDialog)}
        title={lookupDialog?.title || ''}
        rows={lookupDialog?.rows || []}
        selectedCodes={lookupDialog?.selectedCodes || []}
        onClose={() => setLookupDialog(null)}
        onApply={(selection) => {
          if (!lookupDialog || lookupDialog.target !== 'expanded') return;
          const nextExpanded = {
            ...(expandedDraft || criteria.expandedSelection),
            [lookupDialog.fieldKey]: {
              ...(expandedDraft || criteria.expandedSelection)[lookupDialog.fieldKey],
              enabled: true,
              selectedCodes: selection.selectedCodes,
              selectedLabels: selection.selectedLabels,
            },
          };
          setExpandedDraft(nextExpanded);
          updateCriteria((current) => ({ ...current, expandedSelection: nextExpanded }));
        }}
      />

      <BusinessPartnerLookupModal
        isOpen={Boolean(bpLookupTarget)}
        onClose={() => setBpLookupTarget('')}
        onSelect={handleBpSelect}
        type=""
      />
    </div>
  );
}
