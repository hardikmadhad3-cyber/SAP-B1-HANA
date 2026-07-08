import React, { useState } from "react";

const WindowHeader = ({ title, onClose }) => (
  <>
    <header className="sap-report-titlebar fac-modal-titlebar">
      <span className="sap-report-title">{title}</span>
      <div className="sales-analysis-window__controls">
        <button type="button" aria-label="Close" onClick={onClose}>x</button>
      </div>
    </header>
    <div className="sales-analysis-window__accent" />
  </>
);

const Footer = ({ onOk, onClose, onClear, clearLabel = "Clear" }) => (
  <footer className="fac-modal-footer">
    <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={onOk}>OK</button>
    <button type="button" className="sap-report-btn" onClick={onClose}>Cancel</button>
    {onClear ? <button type="button" className="sap-report-btn fac-modal-clear" onClick={onClear}>{clearLabel}</button> : null}
  </footer>
);

const MONTHS = [
  ["1", "January"], ["2", "February"], ["3", "March"], ["4", "April"],
  ["5", "May"], ["6", "June"], ["7", "July"], ["8", "August"],
  ["9", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
];

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index));

export function BalanceSheetRevaluationModal({ lookups, value, onChange, onClose, title = "Balance Sheet Revaluation" }) {
  const [draft, setDraft] = useState(value);
  const [tab, setTab] = useState("fc");
  const setField = (field, fieldValue) => setDraft((current) => ({ ...current, [field]: fieldValue }));

  return (
    <div className="fac-modal-backdrop">
      <section className="fac-modal fac-modal--revaluation">
        <WindowHeader title={title} onClose={onClose} />
        <div className="fac-modal-tabs">
          <button type="button" className={tab === "fc" ? "is-active" : ""} onClick={() => setTab("fc")}>FC</button>
          <button type="button" className={tab === "index" ? "is-active" : ""} onClick={() => setTab("index")}>Index</button>
        </div>
        <div className="fac-modal-body fac-revaluation-body">
          {tab === "fc" ? (
            <div className="fac-revaluation-fc">
              <label className="fac-revaluation-select-row"><span>Currency</span><select value={draft.currencyCode} onChange={(event) => setField("currencyCode", event.target.value)}>{lookups.currencies.map((item) => <option key={item.code} value={item.code}>{item.code} - {item.name}</option>)}</select></label>
              <fieldset className="fac-revaluation-method"><legend>Revaluation Method</legend>
                <label><input type="radio" checked={draft.fcMethod === "postingDate"} onChange={() => setField("fcMethod", "postingDate")} />Posting Date</label>
                <label><input type="radio" checked={draft.fcMethod === "dueDate"} onChange={() => setField("fcMethod", "dueDate")} />Due Date</label>
                <label><input type="radio" checked={draft.fcMethod === "fixedRate"} onChange={() => setField("fcMethod", "fixedRate")} />Fixed Rate</label>
                <input aria-label="Fixed Rate" type="number" value={draft.fixedRate} disabled={draft.fcMethod !== "fixedRate"} onChange={(event) => setField("fixedRate", event.target.value)} />
              </fieldset>
              <label className="fac-revaluation-average"><span>Average Rate from Interval (in Days)</span><input type="number" value={draft.averageRateDays} onChange={(event) => setField("averageRateDays", event.target.value)} /></label>
              <label className="fac-revaluation-journal"><input type="checkbox" checked={draft.referJournalRates} onChange={(event) => setField("referJournalRates", event.target.checked)} />Refer to Rates in Journal Entry and Journal Voucher Entry</label>
              <fieldset className="fac-revaluation-currencies"><legend>Revaluate All Currencies G/L Account/BP</legend>
                <label><input type="radio" checked={draft.allCurrenciesDisplay === "local"} onChange={() => setField("allCurrenciesDisplay", "local")} />Local Currency</label>
                <label><input type="radio" checked={draft.allCurrenciesDisplay === "system"} onChange={() => setField("allCurrenciesDisplay", "system")} />System Currency</label>
              </fieldset>
            </div>
          ) : (
            <div className="fac-revaluation-index">
              <label className="fac-revaluation-select-row"><span>Index</span><select value={draft.indexCode} onChange={(event) => setField("indexCode", event.target.value)}>{lookups.indexes.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
              <div className="fac-revaluation-index-to">
                <span>To</span>
                <select value={draft.indexToMonth || String(new Date().getMonth() + 1)} onChange={(event) => setField("indexToMonth", event.target.value)}>{MONTHS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select>
                <select value={draft.indexToYear || String(new Date().getFullYear())} onChange={(event) => setField("indexToYear", event.target.value)}>{YEAR_OPTIONS.map((year) => <option key={year} value={year}>{year}</option>)}</select>
                <span>Value</span>
                <input value={draft.indexValue || ""} onChange={(event) => setField("indexValue", event.target.value)} />
              </div>
              <fieldset className="fac-revaluation-method fac-revaluation-index-method"><legend>Revaluation Method</legend>
                <label><input type="radio" checked={draft.indexMethod === "postingDate"} onChange={() => setField("indexMethod", "postingDate")} />Posting Date</label>
                <label><input type="radio" checked={draft.indexMethod === "dueDate"} onChange={() => setField("indexMethod", "dueDate")} />Due Date</label>
              </fieldset>
            </div>
          )}
        </div>
        <Footer onOk={() => { onChange(draft); onClose(); }} onClose={onClose} />
      </section>
    </div>
  );
}

export function BalanceSheetFilterGridModal({ title, fields, rules, rows, onChange, onClose }) {
  const normalizedRows = fields.map((field, index) => rows[index] || {
    fieldCode: field.code, fieldName: field.name, rule: "", fromValue: "", toValue: "",
  });
  const updateRow = (index, field, value) => {
    const next = normalizedRows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    onChange(next);
  };
  return (
    <div className="fac-modal-backdrop">
      <section className="fac-modal fac-modal--grid">
        <WindowHeader title={title} onClose={onClose} />
        <div className="fac-filter-grid-wrap"><table className="fac-filter-grid"><thead><tr><th>#</th><th>Field</th><th>Rule</th><th>Value</th><th>To Value</th></tr></thead>
          <tbody>{normalizedRows.map((row, index) => <tr key={`${row.fieldCode}-${index}`}><td>{index + 1}</td><td>{row.fieldName}</td><td><select value={row.rule} onChange={(event) => updateRow(index, "rule", event.target.value)}>{rules.map((rule) => <option key={rule.code} value={rule.code}>{rule.name}</option>)}</select></td><td><input value={row.fromValue} onChange={(event) => updateRow(index, "fromValue", event.target.value)} /></td><td><input value={row.toValue} onChange={(event) => updateRow(index, "toValue", event.target.value)} /></td></tr>)}</tbody>
        </table></div>
        <Footer onOk={onClose} onClose={onClose} onClear={() => onChange([])} />
      </section>
    </div>
  );
}

export function BalanceSheetExpandedModal({ value, onChange, onOpenReferences, onOpenUdfs, onClose }) {
  return (
    <div className="fac-modal-backdrop">
      <section className="fac-modal fac-modal--expanded">
        <WindowHeader title="Expanded Selection Criteria" onClose={onClose} />
        <div className="fac-modal-body fac-expanded-body">
          <div className="fac-expanded-filter-row">
            <label><input type="checkbox" checked={value.referenceFields} onChange={(event) => onChange({ ...value, referenceFields: event.target.checked })} />Reference Fields</label>
            <button type="button" className="sap-report-btn" onClick={onOpenReferences}>...</button>
          </div>
          <div className="fac-expanded-filter-row">
            <label><input type="checkbox" checked={value.userDefinedFields} onChange={(event) => onChange({ ...value, userDefinedFields: event.target.checked })} />User-Defined Fields</label>
            <button type="button" className="sap-report-btn" onClick={onOpenUdfs}>...</button>
          </div>
          <div className="fac-expanded-blanket-row">
            <label><input type="checkbox" checked={value.blanketAgreement} onChange={(event) => onChange({ ...value, blanketAgreement: event.target.checked })} />Blanket Agreement</label>
            <input value={value.blanketAgreementFrom} disabled={!value.blanketAgreement} onChange={(event) => onChange({ ...value, blanketAgreementFrom: event.target.value })} />
            <input value={value.blanketAgreementTo} disabled={!value.blanketAgreement} onChange={(event) => onChange({ ...value, blanketAgreementTo: event.target.value })} />
          </div>
        </div>
        <Footer onOk={onClose} onClose={onClose} clearLabel="Clear Selections" onClear={() => onChange({ referenceFields: false, userDefinedFields: false, blanketAgreement: false, blanketAgreementFrom: "", blanketAgreementTo: "" })} />
      </section>
    </div>
  );
}
