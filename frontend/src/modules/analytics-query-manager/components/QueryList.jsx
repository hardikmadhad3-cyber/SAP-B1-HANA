import React, { useMemo, useState } from 'react';

const QueryList = ({ queries, selectedQueryId, onSelect, onCreateNew }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return queries;
    return queries.filter((query) =>
      query.queryName.toLowerCase().includes(term) ||
      query.queryCode.toLowerCase().includes(term) ||
      (query.category || '').toLowerCase().includes(term));
  }, [queries, search]);

  return (
    <div className="aqm-list">
      <div className="aqm-list__header">
        <input
          type="search"
          placeholder="Search queries..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" className="aqm-btn aqm-btn--primary" onClick={onCreateNew}>
          + New Query
        </button>
      </div>

      <div className="aqm-list__table-wrap">
        <table className="aqm-list__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Category</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((query) => (
              <tr
                key={query.queryId}
                className={Number(selectedQueryId) === Number(query.queryId) ? 'is-selected' : ''}
                onClick={() => onSelect(query)}
              >
                <td>{query.queryName}</td>
                <td>{query.queryCode}</td>
                <td>{query.category || '-'}</td>
                <td>
                  <span className={`aqm-status-pill aqm-status-pill--${query.status.toLowerCase()}`}>
                    {query.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="aqm-list__empty">No queries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QueryList;
