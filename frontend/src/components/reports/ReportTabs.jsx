import "../../styles/report-system.css";

function ReportTabs({ tabs, activeKey, onChange, className = "" }) {
  return (
    <div className={`report-tabs${className ? ` ${className}` : ""}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === activeKey}
          className={`report-tabs__tab${tab.key === activeKey ? " is-active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default ReportTabs;
