import React, { useMemo, useState } from 'react';

const DashboardList = ({ dashboards, selectedDashboardId, onSelect, onCreateNew }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return dashboards;
    return dashboards.filter((dashboard) =>
      dashboard.dashboardName.toLowerCase().includes(term) ||
      dashboard.dashboardCode.toLowerCase().includes(term));
  }, [dashboards, search]);

  return (
    <div className="aqm-list">
      <div className="aqm-list__header">
        <input
          type="search"
          placeholder="Search dashboards..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" className="aqm-btn aqm-btn--primary" onClick={onCreateNew}>
          + New Dashboard
        </button>
      </div>

      <div className="aqm-list__table-wrap">
        <table className="aqm-list__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dashboard) => (
              <tr
                key={dashboard.dashboardId}
                className={Number(selectedDashboardId) === Number(dashboard.dashboardId) ? 'is-selected' : ''}
                onClick={() => onSelect(dashboard)}
              >
                <td>{dashboard.dashboardName}</td>
                <td>{dashboard.dashboardCode}</td>
                <td>
                  <span className={`aqm-status-pill aqm-status-pill--${dashboard.status.toLowerCase()}`}>
                    {dashboard.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="aqm-list__empty">No dashboards found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardList;
