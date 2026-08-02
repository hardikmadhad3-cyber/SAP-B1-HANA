import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { searchItems } from '../api/itemApi';
import { createCompanyScopedRouteState } from '../utils/companyStorageScope';
import { matchesSapSearchText } from '../utils/sapSearch';
import '../modules/item-master/styles/itemMaster.css';
import '../styles/sales-order-list.css';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const MAX_ROWS = 25000;

const INITIAL_FILTERS = {
  query: '',
  itemCode: '',
  itemName: '',
  itemGroup: '',
  itemType: '',
  status: '',
};

const ITEM_TYPE_OPTIONS = [
  { code: '', name: 'All Types' },
  { code: 'itItems', name: 'Items' },
  { code: 'itLabor', name: 'Labor' },
  { code: 'itTravel', name: 'Travel' },
];

const STATUS_OPTIONS = [
  { code: '', name: 'All Statuses' },
  { code: 'active', name: 'Active' },
  { code: 'inactive', name: 'Inactive' },
];

const includesText = (value, query) => matchesSapSearchText(value, query);

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message || error?.message || fallbackMessage;

function ItemMasterListPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageState, setPageState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let ignore = false;

    const loadItems = async () => {
      setPageState({ loading: true, error: '' });
      try {
        const query = appliedFilters.query || appliedFilters.itemCode || appliedFilters.itemName || '';
        const rows = await searchItems(query, MAX_ROWS, 0);
        if (!ignore) {
          setItems(Array.isArray(rows) ? rows : []);
          setPageState({ loading: false, error: '' });
        }
      } catch (error) {
        if (!ignore) {
          setPageState({
            loading: false,
            error: getErrorMessage(error, 'Failed to load items.'),
          });
        }
      }
    };

    loadItems();

    return () => {
      ignore = true;
    };
  }, [appliedFilters]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const isActive = item.Valid === 'tYES' && item.Frozen !== 'tYES';
      const statusMatch =
        !appliedFilters.status ||
        (appliedFilters.status === 'active' && isActive) ||
        (appliedFilters.status === 'inactive' && !isActive);

      return (
        (!appliedFilters.itemCode || includesText(item.ItemCode, appliedFilters.itemCode)) &&
        (!appliedFilters.itemName || includesText(item.ItemName, appliedFilters.itemName)) &&
        (!appliedFilters.itemGroup || includesText(item.ItemsGroupName || item.ItemsGroupCode, appliedFilters.itemGroup)) &&
        (!appliedFilters.itemType || item.ItemType === appliedFilters.itemType) &&
        statusMatch
      );
    });
  }, [items, appliedFilters]);

  const totalCount = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = totalCount === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const pageEnd = Math.min(page * pageSize, totalCount);
  const visibleItems = filteredItems.slice(pageStart ? pageStart - 1 : 0, pageEnd);
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
          <h2 className="mb-1">Item Master Data</h2>
          <small className="text-muted">Filter by item code, description, group, type, and status.</small>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/item-master')}>
          Back
        </button>
      </div>

      {pageState.error && <div className="alert alert-danger" role="alert">{pageState.error}</div>}

      <div className="card p-3 sap-find-card">
        <div className="sap-find-filter-grid mb-3">
          <div className="sap-find-field">
            <label className="form-label mb-1">Item Code</label>
            <input className="form-control" name="itemCode" value={filters.itemCode} onChange={handleFilterChange} onKeyDown={handleFilterKeyDown} placeholder="Enter Item Code" />
          </div>
          <div className="sap-find-field">
            <label className="form-label mb-1">Description</label>
            <input className="form-control" name="itemName" value={filters.itemName} onChange={handleFilterChange} onKeyDown={handleFilterKeyDown} placeholder="Enter Description" />
          </div>
          <div className="sap-find-field">
            <label className="form-label mb-1">Item Group</label>
            <input className="form-control" name="itemGroup" value={filters.itemGroup} onChange={handleFilterChange} onKeyDown={handleFilterKeyDown} placeholder="Enter Item Group" />
          </div>
          <div className="sap-find-field">
            <label className="form-label mb-1">Item Type</label>
            <select className="form-select" name="itemType" value={filters.itemType} onChange={handleFilterChange}>
              {ITEM_TYPE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
            </select>
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
            <input className="form-control" name="query" value={filters.query} onChange={handleFilterChange} onKeyDown={handleFilterKeyDown} placeholder="Search by Item Code or Description" />
          </div>
          <div className="sap-find-results-tools">
            <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-sm-end gap-2 h-100">
              <small className="text-muted">
                {pageState.loading ? 'Searching...' : `${totalCount} items found${items.length >= MAX_ROWS ? ` (showing first ${MAX_ROWS})` : ''}`}
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
                <th>Item Code</th>
                <th>Description</th>
                <th>Item Group</th>
                <th>Item Type</th>
                <th>Inventory</th>
                <th>Sales</th>
                <th>Purchasing</th>
                <th>Status</th>
                <th className="text-end">Price</th>
              </tr>
            </thead>
            <tbody>
              {pageState.loading && <tr><td colSpan="10" className="text-center py-4">Loading items...</td></tr>}
              {!pageState.loading && visibleItems.length === 0 && (
                <tr><td colSpan="10" className="text-center text-muted py-4">{hasActiveFilters ? 'No items found for the selected filters.' : 'No items found.'}</td></tr>
              )}
              {!pageState.loading && visibleItems.map((item) => (
                <tr key={item.ItemCode}>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => navigate('/item-master', {
                        state: createCompanyScopedRouteState({ itemMasterItemCode: item.ItemCode, itemCode: item.ItemCode }, company),
                      })}
                    >
                      Select
                    </button>
                  </td>
                  <td>{item.ItemCode}</td>
                  <td>{item.ItemName}</td>
                  <td>{item.ItemsGroupName || item.ItemsGroupCode || '-'}</td>
                  <td>{ITEM_TYPE_OPTIONS.find((option) => option.code === item.ItemType)?.name || item.ItemType || '-'}</td>
                  <td>{item.InventoryItem === 'tYES' ? 'Yes' : 'No'}</td>
                  <td>{item.SalesItem === 'tYES' ? 'Yes' : 'No'}</td>
                  <td>{item.PurchaseItem === 'tYES' ? 'Yes' : 'No'}</td>
                  <td>{item.Valid === 'tYES' && item.Frozen !== 'tYES' ? 'Active' : 'Inactive'}</td>
                  <td className="text-end">{Number(item.Price || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mt-3">
          <small className="text-muted">{totalCount === 0 ? 'Showing 0 items' : `Showing ${pageStart}-${pageEnd} of ${totalCount} items`}</small>
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

export default ItemMasterListPage;
