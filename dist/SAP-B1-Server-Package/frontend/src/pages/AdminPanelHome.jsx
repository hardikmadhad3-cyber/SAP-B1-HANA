import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminEntities } from '../api/adminPanelApi';

const GROUP_ORDER = ['Core Setup', 'Security', 'Navigation', 'Reporting'];

const AdminPanelHome = () => {
  const [entities, setEntities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let isCancelled = false;

    const loadEntities = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await fetchAdminEntities();
        if (!isCancelled) {
          setEntities(response.entities || []);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.response?.data?.message || loadError.message || 'Unable to load admin sections.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadEntities();
    return () => {
      isCancelled = true;
    };
  }, []);

  const filteredEntities = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return entities;

    return entities.filter((entity) => (
      String(entity.title || '').toLowerCase().includes(query)
      || String(entity.description || '').toLowerCase().includes(query)
      || String(entity.group || '').toLowerCase().includes(query)
    ));
  }, [entities, searchTerm]);

  const groupedEntities = useMemo(() => {
    const groups = new Map();

    for (const entity of filteredEntities) {
      const groupName = entity.group || 'Other';
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }

      groups.get(groupName).push(entity);
    }

    return Array.from(groups.entries()).sort((a, b) => {
      const groupIndexA = GROUP_ORDER.indexOf(a[0]);
      const groupIndexB = GROUP_ORDER.indexOf(b[0]);

      if (groupIndexA === -1 && groupIndexB === -1) {
        return a[0].localeCompare(b[0]);
      }

      if (groupIndexA === -1) return 1;
      if (groupIndexB === -1) return -1;
      return groupIndexA - groupIndexB;
    });
  }, [filteredEntities]);

  const totalRecords = entities.reduce((sum, entity) => sum + Number(entity.count || 0), 0);

  return (
    <div className="admin-panel-page">
      <section className="admin-panel-hero">
        <div className="admin-panel-hero__copy">
          <div className="admin-panel-hero__eyebrow">Admin Workspace</div>
          <h1>Manage users, companies, roles, and access in one place</h1>
          <p>
            This dedicated workspace is separated from the day-to-day transaction screens so admin work
            feels safer, cleaner, and easier to navigate.
          </p>
        </div>

        <div className="admin-panel-hero__stats">
          <div className="admin-panel-stat-card">
            <span>Available Sections</span>
            <strong>{filteredEntities.length}</strong>
          </div>
          <div className="admin-panel-stat-card">
            <span>Tracked Rows</span>
            <strong>{totalRecords}</strong>
          </div>
        </div>
      </section>

      <section className="admin-panel-toolbar">
        <div className="admin-panel-toolbar__search">
          <label htmlFor="admin-panel-search">Find a section</label>
          <input
            id="admin-panel-search"
            type="search"
            className="admin-panel-input"
            placeholder="Search companies, users, roles, access..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="admin-panel-toolbar__note">
          <strong>Separate workspace</strong>
          <span>Admin opens outside the regular SAP screens for a cleaner experience.</span>
        </div>
      </section>

      {isLoading ? (
        <div className="admin-panel-empty">Loading admin sections...</div>
      ) : null}

      {error ? (
        <div className="admin-panel-alert admin-panel-alert--error">{error}</div>
      ) : null}

      {!isLoading && !error ? (
        <div className="admin-panel-groups">
          {groupedEntities.map(([groupName, groupEntities]) => (
            <section key={groupName} className="admin-panel-group">
              <div className="admin-panel-group__header">
                <h2>{groupName}</h2>
                <span>{groupEntities.length} sections</span>
              </div>

              <div className="admin-panel-card-grid">
                {groupEntities.map((entity) => (
                  <Link key={entity.key} to={entity.path} className="admin-panel-card">
                    <div className="admin-panel-card__count">{entity.count}</div>
                    <div className="admin-panel-card__title">{entity.title}</div>
                    <div className="admin-panel-card__description">{entity.description}</div>
                    <div className="admin-panel-card__action">Open section</div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default AdminPanelHome;
