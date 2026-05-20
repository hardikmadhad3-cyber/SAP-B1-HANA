import React, { useEffect, useMemo, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPublicCompanies } from '../api/authApi';
import { useAuth } from '../auth/AuthContext';
import { getLastSelectedCompanyId } from '../auth/storage';
import { getDefaultRoute } from '../auth/routeUtils';

const LoginPage = () => {
  const navigate = useNavigate();
  const {
    login,
    loadCompanies,
    completeCompanySelection,
    logout,
    getLastSelectedCompanyInfo,
  } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [publicCompanies, setPublicCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [chooserSearch, setChooserSearch] = useState('');
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadInitialCompanies = async () => {
      setIsLoadingCompanies(true);

      try {
        const response = await fetchPublicCompanies();
        if (ignore) return;

        const companies = Array.isArray(response) ? response : [];
        setPublicCompanies(companies);
        const rememberedCompany = getLastSelectedCompanyInfo?.();
        const defaultCompany =
          companies.find((company) => company.companyId === rememberedCompany?.companyId) ||
          companies[0] ||
          null;

        setSelectedCompanyId(defaultCompany?.companyId || null);
      } catch (_loadError) {
        if (ignore) return;
        setPublicCompanies([]);
        setError('Unable to load company list.');
      } finally {
        if (!ignore) {
          setIsLoadingCompanies(false);
        }
      }
    };

    loadInitialCompanies();

    return () => {
      ignore = true;
    };
  }, [getLastSelectedCompanyInfo]);

  const selectedCompany =
    (Array.isArray(publicCompanies) ? publicCompanies : []).find((company) => company.companyId === selectedCompanyId) || null;
  const canSubmitLogin = form.username.trim() && form.password && !isSigningIn;

  const filteredCompanies = useMemo(() => {
    const companies = Array.isArray(publicCompanies) ? publicCompanies : [];
    const term = chooserSearch.trim().toLowerCase();
    if (!term) return companies;

    return companies.filter((company) =>
      [company.companyName, company.dbName, company.serverName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [chooserSearch, publicCompanies]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const executeLogin = async ({ preferredCompanyId, requireSelectedCompany }) => {
    const pending = await login(form.username, form.password);
    const assignedCompanies = await loadCompanies(pending.user.userId);

    if (!assignedCompanies.length) {
      throw new Error('No company is assigned to this user by admin.');
    }

    const rememberedCompanyId = getLastSelectedCompanyId(pending.user.userId);
    const preferredCompany = assignedCompanies.find((company) => company.companyId === preferredCompanyId);

    if (requireSelectedCompany && preferredCompanyId && !preferredCompany) {
      throw new Error('You do not have access to the selected company.');
    }

    const nextCompany =
      preferredCompany ||
      assignedCompanies.find((company) => company.companyId === rememberedCompanyId) ||
      assignedCompanies.find((company) => company.isDefault) ||
      assignedCompanies[0] ||
      null;

    if (!nextCompany?.companyId) {
      throw new Error('No company is available for this user.');
    }

    const nextSession = await completeCompanySelection(nextCompany.companyId);
    startTransition(() => {
      navigate(getDefaultRoute(nextSession.menuPaths || []), { replace: true });
    });
  };

  const handlePrimaryLogin = async (event) => {
    event.preventDefault();
    setError('');
    setIsSigningIn(true);

    try {
      await executeLogin({
        preferredCompanyId: selectedCompanyId,
        requireSelectedCompany: false,
      });
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Unable to sign in.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleChooserConfirm = async () => {
    if (!selectedCompanyId) {
      setError('Select a company to continue.');
      return;
    }

    setError('');
    setIsSigningIn(true);

    try {
      await executeLogin({
        preferredCompanyId: selectedCompanyId,
        requireSelectedCompany: true,
      });
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Unable to sign in.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleExit = () => {
    logout();
    setForm({ username: '', password: '' });
    setChooserSearch('');
    setIsChooserOpen(false);
    setError('');
  };

  return (
    <div className="auth-screen auth-screen--sap">
      <div className="sap-login">
        <div className="sap-login__titlebar">SAP Business One</div>

        <div className="sap-login__content">
          <form className="sap-login__form" onSubmit={handlePrimaryLogin}>
            <div className="sap-login__brand">SAP Business One</div>

            <label className="sap-login__row">
              <span>Company Name</span>
              <input value={selectedCompany?.companyName || ''} readOnly />
            </label>

            <label className="sap-login__row">
              <span>User ID</span>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                disabled={isSigningIn}
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
              />
            </label>

            {error ? <div className="auth-alert sap-login__alert">{error}</div> : null}

            <div className="sap-login__actions">
              <button
                type="submit"
                className="sap-button sap-button--primary"
                disabled={!canSubmitLogin}
                aria-busy={isSigningIn}
              >
                {isSigningIn ? 'Working...' : 'OK'}
              </button>

              <button
                type="button"
                className="sap-button"
                onClick={handleExit}
                disabled={isSigningIn}
              >
                Exit
              </button>

              <button
                type="button"
                className="sap-button"
                onClick={() => setIsChooserOpen(true)}
                disabled={isSigningIn}
              >
                Change Company
              </button>
            </div>
          </form>
        </div>
      </div>

      {isChooserOpen ? (
        <div className="sap-modal">
          <div className="sap-chooser">
            <div className="sap-chooser__titlebar">Choose/Create Company</div>

            <div className="sap-chooser__top">
              <label className="sap-chooser__field">
                <span>User ID</span>
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  disabled={isSigningIn}
                />
              </label>

              <label className="sap-chooser__field">
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  disabled={isSigningIn}
                />
              </label>
            </div>

            <div className="sap-chooser__details">
              <label className="sap-chooser__field sap-chooser__field--wide">
                <span>Database</span>
                <input value={selectedCompany?.dbName || ''} readOnly />
              </label>

              <label className="sap-chooser__field sap-chooser__field--search">
                <span>Find By</span>
                <input
                  value={chooserSearch}
                  onChange={(event) => setChooserSearch(event.target.value)}
                  placeholder="Company or database name"
                  disabled={isSigningIn || isLoadingCompanies}
                />
              </label>
            </div>

            {error ? <div className="auth-alert sap-chooser__alert">{error}</div> : null}

            <div className="sap-chooser__section-title">Companies On Current Server</div>

            <div className="sap-chooser__grid">
              <div className="sap-chooser__head">
                <span>Company Name</span>
                <span>Database Name</span>
                <span>Server</span>
              </div>

              <div className="sap-chooser__body">
                {isLoadingCompanies ? (
                  <div className="company-grid__empty">Loading companies...</div>
                ) : filteredCompanies.length ? (
                  filteredCompanies.map((company) => (
                    <button
                      key={company.companyId}
                      type="button"
                      className={`sap-chooser__row${selectedCompanyId === company.companyId ? ' is-selected' : ''}`}
                      onClick={() => setSelectedCompanyId(company.companyId)}
                      disabled={isSigningIn}
                    >
                      <span>{company.companyName}</span>
                      <span>{company.dbName}</span>
                      <span>{company.serverName}</span>
                    </button>
                  ))
                ) : (
                  <div className="company-grid__empty">No companies match the current filter.</div>
                )}
              </div>
            </div>

            <div className="sap-chooser__actions">
              <button
                type="button"
                className="sap-button sap-button--primary"
                onClick={handleChooserConfirm}
                disabled={!canSubmitLogin || !selectedCompanyId}
                aria-busy={isSigningIn}
              >
                {isSigningIn ? 'Working...' : 'OK'}
              </button>

              <button
                type="button"
                className="sap-button"
                onClick={() => setIsChooserOpen(false)}
                disabled={isSigningIn}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LoginPage;
