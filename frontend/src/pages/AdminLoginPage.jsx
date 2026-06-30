import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminLogin, isAdminAuthenticated } = useAuth();
  const [form, setForm] = useState({ username: 'manager', password: 'Admin@123' });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    const target = String(location.state?.from || '/admin');
    navigate(target.startsWith('/admin') ? target : '/admin', { replace: true });
  }, [isAdminAuthenticated, location.state, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const username = form.username.trim();
    const password = form.password;

    if (!username || !password) {
      setError('Enter User ID and Password.');
      return;
    }

    setError('');
    setIsSigningIn(true);

    try {
      await adminLogin(username, password);
      const target = String(location.state?.from || '/admin');
      navigate(target.startsWith('/admin') ? target : '/admin', { replace: true });
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Unable to sign in.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="auth-screen auth-screen--sap">
      <div className="sap-login">
        <div className="sap-login__titlebar">SAP Business One Admin</div>

        <div className="sap-login__content">
          <form className="sap-login__form" onSubmit={handleSubmit}>
            <div className="sap-login__brand">Admin Panel</div>

            <label className="sap-login__row">
              <span>User ID</span>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                disabled={isSigningIn}
                autoComplete="username"
              />
            </label>

            <label className="sap-login__row">
              <span>Password</span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                disabled={isSigningIn}
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <div className="sap-login__alert admin-panel-alert admin-panel-alert--error">
                {error}
              </div>
            ) : null}

            <div className="sap-login__actions">
              <button
                className="sap-button sap-button--primary"
                type="submit"
                disabled={isSigningIn}
                aria-busy={isSigningIn ? 'true' : 'false'}
              >
                {isSigningIn ? 'Signing In...' : 'Log In'}
              </button>
            </div>
          </form>
        </div>

        <div className="sap-login__statusbar">
          <span>Master database administration</span>
          <span>Company selection not required</span>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
