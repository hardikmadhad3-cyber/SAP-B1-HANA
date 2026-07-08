import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const Header = () => {
  const navigate = useNavigate();
  const { user, company, roleName, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <div>
        <div className="topbar__eyebrow">SAP Business One</div>
        <h1>Web Client</h1>
      </div>

      <div className="topbar__meta">
        <div className="topbar__chip">
          <span className="topbar__chip-label">User</span>
          <strong>{user?.fullName || user?.username}</strong>
        </div>

        <div className="topbar__chip">
          <span className="topbar__chip-label">Company</span>
          <strong>{company?.companyName || 'Not selected'}</strong>
        </div>

        <div className="topbar__chip">
          <span className="topbar__chip-label">Role</span>
          <strong>{roleName || 'Unassigned'}</strong>
        </div>

        <button type="button" className="topbar__logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
