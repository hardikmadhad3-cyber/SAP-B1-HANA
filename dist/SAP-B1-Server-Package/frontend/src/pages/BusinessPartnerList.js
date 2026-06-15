import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { searchBP } from '../api/businessPartnerApi';
import { createCompanyScopedRouteState } from '../utils/companyStorageScope';
import '../modules/item-master/styles/itemMaster.css';
import '../styles/sales-order-list.css';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const MAX_ROWS = 25000;

const INITIAL_FILTERS = {
  query: '',
  cardCode: '',
  cardName: '',
  cardType: '',
  phone: '',
  email: '',
  status: '',
};

const CARD_TYPE_OPTIONS = [
  { code: '', name: 'All Types' },
  { code: 'cCustomer', name: 'Customer' },
  { code: 'cSupplier', name: 'Supplier' },
  { code: 'cLead', name: 'Lead' },
];

const STATUS_OPTIONS = [
  { code: '', name: 'All Statuses' },
  { code: 'active', name: 'Active' },
  { code: 'inactive', name: 'Inactive' },
];

const includesText = (value, query) =>
  String(value || '').toLowerCase().includes(String(query || '').trim().toLowerCase());

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message || error?.message || fallbackMessage;

function BusinessPartnerListPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [partners, setPartners] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageState, setPageState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let ignore = false;

    const loadPartners = async () => {
      setPageState({ loading: true, error: '' });
      try {
        const query = appliedFilters.query || appliedFilters.cardCode || appliedFilters.cardName || '';
        const rows = await searchBP(query, appliedFilters.cardType, MAX_ROWS, 0);
        if (!ignore) {
          setPartners(Array.isArray(rows) ? rows : []);
          setPageState({ loading: false, error: '' });
        }
      } catch (error) {
        if (!ignore) {
          setPageState({
            loading: false,
            error: getErrorMessage(error, 'Failed to load business partners.'),
          });
        }
      }
    };

    loadPartners();

    return () => {
      ignore = true;
    };
  }, [appliedFilters]);

  const filteredPartners = useMemo(() => {
    return partners.filter((partner) => {
      const isActive = partner.Active !== 'No' && partner.Inactive !== 'Yes';
      const statusMatch =
        !appliedFilters.status ||
        (appliedFilters.status === 'active' && isActive) ||
        (appliedFilters.status === 'inactive' && !isActive);

      return (
        (!appliedFilters.cardCode || includesText(partner.CardCode, appliedFilters.cardCode)) &&
        (!appliedFilters.cardName || includesText(partner.CardName, appliedFilters.cardName)) &&
        (!appliedFilters.phone || includesText(partner.Phone1, appliedFilters.phone)) &&
        (!appliedFilters.email || includesText(partner.EmailAddress, appliedFilters.email)) &&
        statusMatch
      );
    });
  }, [partners, appliedFilters]);

  const totalCount = filteredPartners.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = totalCount === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const pageEnd = Math.min(page * pageSize, totalCount);
  const visiblePartners = filteredPartners.slice(pageStart ? pageStart - 1 : 0, pageEnd);
  const hasActiveFilters = Object.values(appliedFilters).some((value) => String(value || '').trim() !== '');

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const handleFilterKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleApplyFilters();
    }
  };

  const handlePageSizeChange = (event) => {
    setPageSize(Number(event.target.value) || 25);
    setPage(1);
  };

  return (
    <div className="container-fluid sap-find-page">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Business Partners</h2>
          <small className="text-muted">Filter by code, name, type, contact, and status.</small>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/business-partner')}>
          Back
        </button>
      </div>

      {pageState.error && <div className="alert alert-danger" role="alert">{pageState.error}</div>}

      <div className="card p-3 sap-find-card">
        <div className="sap-find-filter-grid mb-3">
          <div className="sap-find-field">
            <label className="form-label mb-1">BP Code</label>
            <input className="form-control" name="cardCode" value={filters.cardCode} onChange={handleFilterChange} onKeyDown={handleFilterKeyDown} placeholder="Enter BP Code" />
          </div>
          <div className="sap-find-field">
            <label className="form-label mb-1">BP Name</label>
            <input className="form-control" name="cardName" value={filters.cardName} onChange={handleFilterChange} onKeyDown={handleFilterKeyDown} placeholder="Enter BP Name" />
          </div>
          <div className="sap-find-field">
            <label className="form-label mb-1">Type</label>
            <select className="form-select" name="cardType" value={filters.cardType} onChange={handleFilterChange}>
              {CARD_TYPE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
            </select>
          </div>
          <div className="sap-find-field">
            <label className="form-label mb-1">Phone</label>
            <input className="form-control" name="phone" value={filters.phone} onChange={handleFilterChange} onKeyDown={handleFilterKeyDown} placeholder="Enter Phone" />
          </div>
          <div className="sap-find-field">
            <label className="form-label mb-1">Email</label>
            <input className="form-control" name="email" value={filters.email} onChange={handleFilterChange} onKeyDown={handleFilterKeyDown} placeholder="Enter Email" />
          </div>
          <div className="sap-find-field">
            <label className="form-label mb-1">Status</label>
            <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
              {STATUS_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
            </select>
          </div>
          <div className="sap-find-field sap-find-actions">
            <button type="button" className="btn btn-primary w-100" onClick={handleApplyFilters}>Search</button>
            <button type="button" className="btn btn-outline-secondary w-100" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>

        <div className="sap-find-results-row mb-3">
          <div className="sap-find-global-field">
            <label className="form-label mb-1">Global Search</label>
            <input className="form-control" name="query" value={filters.query} onChange={handleFilterChange} onKeyDown={handleFilterKeyDown} placeholder="Search by BP Code or BP Name" />
          </div>
          <div className="sap-find-results-tools">
            <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-sm-end gap-2 h-100">
              <small className="text-muted">
                {pageState.loading ? 'Searching...' : `${totalCount} business partners found${partners.length >= MAX_ROWS ? ` (showing first ${MAX_ROWS})` : ''}`}
              </small>
              <label className="d-flex align-items-center gap-2 text-muted mb-0">
                <span>Rows</span>
                <select className="form-select form-select-sm" value={pageSize} onChange={handlePageSizeChange} style={{ width: 'auto' }}>
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="table-responsive sap-find-table-wrap">
          <table className="table table-bordered table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Action</th>
                <th>BP Code</th>
                <th>BP Name</th>
                <th>Type</th>
                <th>Group</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Currency</th>
                <th>Status</th>
                <th className="text-end">Balance</th>
              </tr>
            </thead>
            <tbody>
              {pageState.loading && <tr><td colSpan="10" className="text-center py-4">Loading business partners...</td></tr>}
              {!pageState.loading && visiblePartners.length === 0 && (
                <tr><td colSpan="10" className="text-center text-muted py-4">{hasActiveFilters ? 'No business partners found for the selected filters.' : 'No business partners found.'}</td></tr>
              )}
              {!pageState.loading && visiblePartners.map((partner) => (
                <tr key={partner.CardCode}>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => navigate('/business-partner', {
                        state: createCompanyScopedRouteState({ businessPartnerCardCode: partner.CardCode, cardCode: partner.CardCode }, company),
                      })}
                    >
                      Select
                    </button>
                  </td>
                  <td>{partner.CardCode}</td>
                  <td>{partner.CardName}</td>
                  <td>{CARD_TYPE_OPTIONS.find((option) => option.code === partner.CardType)?.name || partner.CardType || '-'}</td>
                  <td>{partner.GroupCode || '-'}</td>
                  <td>{partner.Phone1 || '-'}</td>
                  <td>{partner.EmailAddress || '-'}</td>
                  <td>{partner.Currency || '-'}</td>
                  <td>{partner.Active !== 'No' && partner.Inactive !== 'Yes' ? 'Active' : 'Inactive'}</td>
                  <td className="text-end">{Number(partner.Balance || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mt-3">
          <small className="text-muted">{totalCount === 0 ? 'Showing 0 business partners' : `Showing ${pageStart}-${pageEnd} of ${totalCount} business partners`}</small>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={pageState.loading || page <= 1}>Previous</button>
            <small className="text-muted mb-0">Page {page} of {totalPages}</small>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={pageState.loading || page >= totalPages}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessPartnerListPage;
