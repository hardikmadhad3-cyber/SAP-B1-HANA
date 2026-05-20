import React, { useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getDefaultRoute } from '../../auth/routeUtils';

const CompanySelectionPanel = () => {
  const navigate = useNavigate();
  const {
    pendingAuth,
    user,
    loadCompanies,
    completeCompanySelection,
    getRememberedCompanyId,
    logout,
  } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let ignore = false;

    const fetchCompanies = async () => {
      if (!pendingAuth?.user?.userId) {
        setCompanies([]);
        setSelectedCompanyId(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const response = await loadCompanies(pendingAuth.user.userId);
        if (ignore) return;

        setCompanies(response);
        const rememberedCompanyId = getRememberedCompanyId();
        const defaultCompany =
          response.find((company) => company.companyId === rememberedCompanyId) ||
          response.find((company) => company.isDefault) ||
          response[0] ||
          null;

        setSelectedCompanyId(defaultCompany?.companyId || null);
      } catch (loadError) {
        if (ignore) return;
        setError(loadError.response?.data?.message || 'Unable to load assigned companies.');
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    fetchCompanies();

    return () => {
      ignore = true;
    };
  }, [getRememberedCompanyId, loadCompanies, pendingAuth?.user?.userId]);

  const filteredCompanies = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return companies;

    return companies.filter((company) =>
      [company.companyName, company.dbName, company.serverName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [companies, deferredSearch]);

  const handleConfirm = async () => {
    if (!selectedCompanyId) {
      setError('Choose a company to continue.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const nextSession = await completeCompanySelection(selectedCompanyId);
      startTransition(() => {
        navigate(getDefaultRoute(nextSession.menuPaths || []), { replace: true });
      });
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Unable to open the selected company.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="company-panel">
      <div className="company-panel__header">
        <div>
          <div className="company-panel__eyebrow">Company Selection</div>
          <h1>Choose a company database</h1>
          <p>
            Signed in as <strong>{user?.fullName || user?.username}</strong>. Select the company
            you want to work with.
          </p>
        </div>

        <label className="company-panel__search">
          <span>Filter companies</span>
          <input
            type="search"
            placeholder="Search by company, DB, or server"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </label>
      </div>

      {error ? <div className="auth-alert">{error}</div> : null}

      <div className="company-grid">
        <div className="company-grid__head">
          <span>Company Name</span>
          <span>Database</span>
          <span>Server</span>
        </div>

        <div className="company-grid__body">
          {isLoading ? (
            <div className="company-grid__empty">Loading assigned companies...</div>
          ) : filteredCompanies.length ? (
            filteredCompanies.map((company) => (
              <button
                key={company.companyId}
                type="button"
                className={`company-row${selectedCompanyId === company.companyId ? ' is-selected' : ''}`}
                onClick={() => setSelectedCompanyId(company.companyId)}
                disabled={isSubmitting}
              >
                <span>
                  {company.companyName}
                  {company.isDefault ? <em>Default</em> : null}
                </span>
                <span>{company.dbName}</span>
                <span>{company.serverName}</span>
              </button>
            ))
          ) : (
            <div className="company-grid__empty">No companies match the current filter.</div>
          )}
        </div>
      </div>

      <div className="company-panel__actions">
        <button
          type="button"
          className="company-panel__button company-panel__button--ghost"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>

        <button
          type="button"
          className="company-panel__button"
          onClick={handleConfirm}
          disabled={isLoading || isSubmitting || !selectedCompanyId}
        >
          {isSubmitting ? 'Opening Company...' : 'OK'}
        </button>
      </div>
    </div>
  );
};

export default CompanySelectionPanel;
