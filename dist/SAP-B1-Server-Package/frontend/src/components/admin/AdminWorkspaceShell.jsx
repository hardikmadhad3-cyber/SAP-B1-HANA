import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { fetchAdminEntities } from '../../api/adminPanelApi';
import { useAuth } from '../../auth/AuthContext';

const GROUP_ORDER = ['Core Setup', 'Security', 'Navigation', 'Reporting'];

const AdminWorkspaceShell = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    adminLogout,
    adminRoleName,
    adminUser,
    company,
    isAdminAuthenticated,
    roleName,
    user,
  } = useAuth();
  const [entities, setEntities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const displayUser = adminUser || user;
  const displayRoleName = adminRoleName || roleName;
  const workspaceSubtitle = isAdminAuthenticated ? 'Master Setup' : (company?.dbName || 'Configuration');

  useEffect(() => {
    let ignore = false;

    const loadEntities = async () => {
      try {
        setIsLoading(true);
        const response = await fetchAdminEntities();
        if (!ignore) {
          setEntities(response.entities || []);
        }
      } catch (_error) {
        if (!ignore) {
          setEntities([]);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadEntities();
    return () => {
      ignore = true;
    };
  }, []);

  const groupedEntities = useMemo(() => {
    const groups = new Map();
    for (const entity of entities) {
      const groupName = entity.group || 'Other';
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName).push(entity);
    }

    return Array.from(groups.entries()).sort((left, right) => {
      const leftIndex = GROUP_ORDER.indexOf(left[0]);
      const rightIndex = GROUP_ORDER.indexOf(right[0]);

      if (leftIndex === -1 && rightIndex === -1) return left[0].localeCompare(right[0]);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
  }, [entities]);

  const currentEntity = entities.find((entity) =>
    location.pathname === entity.path || location.pathname.startsWith(`${entity.path}/`)
  );
  const pageTitle = currentEntity?.title || (location.pathname === '/admin' ? 'Overview' : 'Admin Workspace');
  const pageDescription = currentEntity?.description || 'Manage application setup, users, roles, and access rights.';

  const handleAdminLogout = () => {
    adminLogout();
    navigate('/admin-login', { replace: true });
  };

  return (
    <div className="admin-workspace">
      <aside className="admin-workspace__sidebar">
        <div className="admin-workspace__brand">
          <div className="admin-workspace__brand-mark">AP</div>
          <div>
            <div className="admin-workspace__brand-title">Admin Panel</div>
            <div className="admin-workspace__brand-subtitle">{workspaceSubtitle}</div>
          </div>
        </div>

        <nav className="admin-workspace__nav">
          <div className="admin-workspace__nav-group">
            <div className="admin-workspace__nav-label">Workspace</div>
            <NavLink to="/admin" end className={({ isActive }) => `admin-workspace__nav-link${isActive ? ' is-active' : ''}`}>
              Overview
            </NavLink>
            <NavLink to="/general-settings" className={({ isActive }) => `admin-workspace__nav-link${isActive ? ' is-active' : ''}`}>
              General Settings
            </NavLink>
          </div>

          {isLoading ? (
            <div className="admin-workspace__loading">Loading sections...</div>
          ) : groupedEntities.map(([groupName, items]) => (
            <div key={groupName} className="admin-workspace__nav-group">
              <div className="admin-workspace__nav-label">{groupName}</div>
              {items.map((entity) => (
                <NavLink
                  key={entity.key}
                  to={entity.path}
                  className={({ isActive }) => `admin-workspace__nav-link${isActive ? ' is-active' : ''}`}
                >
                  <span>{entity.title}</span>
                  <small>{entity.count}</small>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <section className="admin-workspace__main">
        <header className="admin-workspace__header">
          <div>
            <div className="admin-workspace__eyebrow">Admin Panel</div>
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>

          <div className="admin-workspace__meta">
            <div className="admin-workspace__meta-card">
              <span>User</span>
              <strong>{displayUser?.fullName || displayUser?.username || 'Admin'}</strong>
            </div>
            <div className="admin-workspace__meta-card">
              <span>Role</span>
              <strong>{displayRoleName || 'Admin'}</strong>
            </div>
            {isAdminAuthenticated ? (
              <button className="admin-panel-button admin-panel-button--ghost" type="button" onClick={handleAdminLogout}>
                Log Out
              </button>
            ) : null}
          </div>
        </header>

        <div className="admin-workspace__content">
          {children}
        </div>
      </section>
    </div>
  );
};

export default AdminWorkspaceShell;
