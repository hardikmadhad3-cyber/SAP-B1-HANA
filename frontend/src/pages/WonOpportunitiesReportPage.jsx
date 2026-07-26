import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWonOpportunitiesReport } from '../api/opportunitiesForecastApi';
import BusinessPartnerLookupModal from '../components/reports/BusinessPartnerLookupModal';
import SalesEmployeeLookupModal from '../components/reports/SalesEmployeeLookupModal';
import useFloatingWindow from '../components/reports/useFloatingWindow';
import { ReportBackButton, ReportWindowControls } from '../components/reports/ReportWindowControls';
import { useSapWindowTaskbarActions } from '../components/SapWindowTaskbarContext';
import '../styles/won-opportunities-report.css';

const createInitialCriteria = () => ({
  startDate: { from: '', to: '' },
  closingDate: { from: '', to: '' },
  salesEmployeeSelection: {
    enabled: false,
    selectedCodes: [],
    selectedLabels: [],
  },
  bpSelection: {
    enabled: false,
    selectedCodes: [],
    selectedLabels: [],
    codeFrom: '',
    codeTo: '',
  },
  rangeDays: 10,
  printDiagram: false,
});

const formatNumber = (value) => {
  const number = Number(value || 0);
  if (!number) return '';
  return Number.isInteger(number)
    ? number.toLocaleString('en-IN')
    : number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getSelectionLabel = (selection) => {
  const labels = selection?.selectedLabels || [];
  if (!labels.length) return '';
  return labels.length === 1 ? labels[0] : `${labels.length} selected`;
};

function WonReportChart({ title, rows, valueKey }) {
  const maxValue = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));

  return (
    <div className="won-opportunities-chart">
      <div className="won-opportunities-chart__title">{title}</div>
      <div className="won-opportunities-chart__body">
        <div className="won-opportunities-chart__axis">
          <span>{formatNumber(maxValue) || '0'}</span>
          <span>0</span>
        </div>
        <div className="won-opportunities-chart__plot">
          {rows.map((row) => {
            const value = Number(row[valueKey] || 0);
            const height = value > 0 ? Math.max(10, Math.round((value / maxValue) * 88)) : 0;
            return (
              <div className="won-opportunities-chart__bar-wrap" key={`${valueKey}-${row.daysUntilClosing}`}>
                <div
                  className={`won-opportunities-chart__bar ${value ? '' : 'is-empty'}`}
                  style={{ height: `${height}%` }}
                />
                <div className="won-opportunities-chart__label">{row.daysUntilClosing}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function WonOpportunitiesReportPage() {
  const navigate = useNavigate();
  const { closeActiveAndRestorePrevious } = useSapWindowTaskbarActions();
  const [criteria, setCriteria] = useState(createInitialCriteria);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showSalesEmployeeLookup, setShowSalesEmployeeLookup] = useState(false);
  const [showBpLookup, setShowBpLookup] = useState(false);

  const hasReport = Boolean(report);
  const rows = report?.data || [];
  const fillerRows = Math.max(0, 28 - rows.length);

  const criteriaWindow = useFloatingWindow({
    isOpen: !hasReport,
    defaultTop: 24,
    taskId: 'won-opportunities-criteria',
    taskTitle: 'Won Opportunities Report - Selection Criteria',
    taskPath: '/reports/crm/opportunities/won',
    bounds: 'parent',
  });
  const reportWindow = useFloatingWindow({
    isOpen: hasReport,
    defaultTop: 8,
    taskId: 'won-opportunities-report',
    taskTitle: 'Won Opportunities Report',
    taskPath: '/reports/crm/opportunities/won',
    bounds: 'parent',
  });

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
    salesEmployeeSelection: {
      ...criteria.salesEmployeeSelection,
      selectedCodes: criteria.salesEmployeeSelection.enabled ? criteria.salesEmployeeSelection.selectedCodes : [],
    },
    bpSelection: {
      ...criteria.bpSelection,
      selectedCodes: criteria.bpSelection.enabled ? criteria.bpSelection.selectedCodes : [],
    },
  });

  const loadReport = async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const response = await fetchWonOpportunitiesReport(buildPayload());
      if (response?.success === false) {
        setReport(null);
        setStatusMessage(response.error || 'Could not load Won Opportunities Report.');
        return;
      }

      const normalizedRows = Array.isArray(response?.data) ? response.data : [];
      setReport({ ...response, data: normalizedRows });
      if (!normalizedRows.some((row) => Number(row.opportunityCount || 0) > 0)) {
        setStatusMessage('No records found for the selected criteria.');
      }
    } catch (error) {
      setReport(null);
      setStatusMessage(error?.response?.data?.message || error?.message || 'Could not load Won Opportunities Report.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (closeActiveAndRestorePrevious()) return;
    navigate('/dashboard');
  };

  const handleSalesEmployeeSelect = (row) => {
    const code = String(row?.code || '').trim();
    if (!code) return;
    updateCriteria((current) => ({
      ...current,
      salesEmployeeSelection: {
        enabled: true,
        selectedCodes: [code],
        selectedLabels: [String(row?.name || code)],
      },
    }));
  };

  const handleBpSelect = (bp) => {
    const code = String(bp?.CardCode || '').trim();
    if (!code) return;
    updateCriteria((current) => ({
      ...current,
      bpSelection: {
        enabled: true,
        selectedCodes: [code],
        selectedLabels: [String(bp?.CardName || code)],
        codeFrom: code,
        codeTo: code,
      },
    }));
  };

  return (
    <div className="sap-report-page won-opportunities-page">
      {!hasReport ? (
        <div
          className={`sap-report-window won-opportunities-window won-opportunities-window--criteria ${criteriaWindow.isMinimized ? 'is-minimized' : ''}`}
          {...criteriaWindow.windowProps}
        >
          <div className="sap-report-titlebar won-opportunities-window__titlebar" {...criteriaWindow.titleBarProps}>
            <div className="sap-report-title">Won Opportunities Report - Selection Criteria</div>
            <ReportWindowControls
              windowFrame={criteriaWindow}
              onMinimize={criteriaWindow.toggleMinimize}
              onClose={handleClose}
              className="won-opportunities-window__controls"
            />
          </div>
          <div className="sap-report-accent" />
          {!criteriaWindow.isMinimized ? (
            <div className="sap-report-body won-opportunities-criteria-body">
              <div className="won-opportunities-date-grid">
                <label>Start Date From</label>
                <div className="won-opportunities-date-field">
                  <input
                    className="sap-report-input"
                    value={criteria.startDate.from}
                    onChange={(event) => updateNested('startDate', 'from', event.target.value)}
                  />
                  <button type="button" className="won-opportunities-calendar-btn" aria-label="Start date from calendar" />
                </div>
                <span>To</span>
                <input
                  className="sap-report-input"
                  value={criteria.startDate.to}
                  onChange={(event) => updateNested('startDate', 'to', event.target.value)}
                />

                <label>Closing Date From</label>
                <input
                  className="sap-report-input"
                  value={criteria.closingDate.from}
                  onChange={(event) => updateNested('closingDate', 'from', event.target.value)}
                />
                <span>To</span>
                <input
                  className="sap-report-input"
                  value={criteria.closingDate.to}
                  onChange={(event) => updateNested('closingDate', 'to', event.target.value)}
                />
              </div>

              <div className="won-opportunities-filter-list">
                <label className="won-opportunities-check-line">
                  <input
                    type="checkbox"
                    checked={criteria.salesEmployeeSelection.enabled}
                    onChange={(event) => updateNested('salesEmployeeSelection', 'enabled', event.target.checked)}
                  />
                  <span>Sales Employee</span>
                </label>
                <button type="button" className="won-opportunities-ellipsis-btn" onClick={() => setShowSalesEmployeeLookup(true)}>
                  ...
                </button>
                <span className="won-opportunities-selection-text">{getSelectionLabel(criteria.salesEmployeeSelection)}</span>

                <label className="won-opportunities-check-line">
                  <input
                    type="checkbox"
                    checked={criteria.bpSelection.enabled}
                    onChange={(event) => updateNested('bpSelection', 'enabled', event.target.checked)}
                  />
                  <span>BP Code</span>
                </label>
                <button type="button" className="won-opportunities-ellipsis-btn" onClick={() => setShowBpLookup(true)}>
                  ...
                </button>
                <span className="won-opportunities-selection-text">{getSelectionLabel(criteria.bpSelection)}</span>
              </div>

              {statusMessage ? <div className="won-opportunities-status">{statusMessage}</div> : null}

              <div className="won-opportunities-criteria-footer">
                <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={loadReport} disabled={loading}>
                  OK
                </button>
                <button type="button" className="sap-report-btn" onClick={handleClose}>
                  Cancel
                </button>
                <input
                  className="sap-report-input won-opportunities-range-input"
                  value={criteria.rangeDays}
                  onChange={(event) => updateCriteria((current) => ({ ...current, rangeDays: event.target.value }))}
                />
                <span>Range in Days</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasReport ? (
        <div
          className={`sap-report-window won-opportunities-window won-opportunities-window--report ${reportWindow.isMinimized ? 'is-minimized' : ''} ${reportWindow.isMaximized ? 'is-maximized' : ''}`}
          {...reportWindow.windowProps}
        >
          <div className="sap-report-titlebar won-opportunities-window__titlebar" {...reportWindow.titleBarProps}>
            <div className="sap-report-title">Won Opportunities Report</div>
            <ReportWindowControls
              windowFrame={reportWindow}
              onMinimize={reportWindow.toggleMinimize}
              onClose={() => setReport(null)}
              className="won-opportunities-window__controls"
            />
          </div>
          <div className="sap-report-accent" />
          {!reportWindow.isMinimized ? (
            <div className="sap-report-body won-opportunities-report-body">
              <div className="won-opportunities-grid-wrap">
                <table className="sap-report-grid won-opportunities-result-grid">
                  <thead>
                    <tr>
                      <th>Days Until Closing</th>
                      <th>No. of Opportunities</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.daysUntilClosing}>
                        <td>{row.daysUntilClosing}</td>
                        <td className="won-opportunities-cell-number">{formatNumber(row.opportunityCount)}</td>
                        <td className="won-opportunities-cell-number">{formatNumber(row.totalAmount)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: fillerRows }, (_, rowIndex) => (
                      <tr key={`empty-${rowIndex}`} className="won-opportunities-empty-row">
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="won-opportunities-lower">
                <WonReportChart title="Total Income" rows={rows} valueKey="totalAmount" />
                <WonReportChart title="Total Opportunities" rows={rows} valueKey="opportunityCount" />
              </div>

              <div className="won-opportunities-report-footer">
                <ReportBackButton onClick={() => setReport(null)} className="won-opportunities-back-btn" />
                <button type="button" className="sap-report-btn" onClick={() => setReport(null)}>
                  Cancel
                </button>
                <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={loadReport} disabled={loading}>
                  Refresh
                </button>
                <label className="won-opportunities-check-line">
                  <input
                    type="checkbox"
                    checked={criteria.printDiagram}
                    onChange={(event) => updateCriteria((current) => ({ ...current, printDiagram: event.target.checked }))}
                  />
                  <span>Print Diagram</span>
                </label>
                <input
                  className="sap-report-input won-opportunities-range-input"
                  value={criteria.rangeDays}
                  onChange={(event) => updateCriteria((current) => ({ ...current, rangeDays: event.target.value }))}
                />
                <span className="won-opportunities-range-label">Range in Days</span>
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

      <BusinessPartnerLookupModal
        isOpen={showBpLookup}
        onClose={() => setShowBpLookup(false)}
        onSelect={handleBpSelect}
        type=""
      />

      {loading ? <div className="won-opportunities-loading">Loading Won Opportunities Report...</div> : null}
    </div>
  );
}
