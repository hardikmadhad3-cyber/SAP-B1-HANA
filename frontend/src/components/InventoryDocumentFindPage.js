import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createCompanyScopedRouteState } from '../utils/companyStorageScope';
import '../styles/sales-order-list.css';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const INITIAL_FILTERS = {
  query: '',
  docNum: '',
  status: '',
  postingDateFrom: '',
  postingDateTo: '',
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB');
};

const normalizeText = (value) => String(value ?? '').trim().toLowerCase();

const getComparableDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const getErrorMessage = (error, fallbackMessage) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail?.error?.message) return detail.error.message;
  if (detail?.message) return detail.message;
  return error?.message || fallbackMessage;
};

function InventoryDocumentFindPage({
  title,
  backPath,
  fetchDocuments,
  editPath,
  editStateKey,
  emptyLabel,
  loadingLabel,
  columns,
  searchFields,
}) {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageState, setPageState] = useState({
    loading: true,
    error: '',
  });

  useEffect(() => {
    let ignore = false;

    const loadDocuments = async () => {
      setPageState({ loading: true, error: '' });
      try {
        const response = await fetchDocuments();
        if (!ignore) {
          setDocuments(Array.isArray(response.data) ? response.data : []);
          setPageState({ loading: false, error: '' });
        }
      } catch (error) {
        if (!ignore) {
          setPageState({
            loading: false,
            error: getErrorMessage(error, `Failed to load ${title.toLowerCase()}.`),
          });
        }
      }
    };

    loadDocuments();
    return () => {
      ignore = true;
    };
  }, [fetchDocuments, title]);

  const filteredDocuments = useMemo(() => {
    const query = normalizeText(appliedFilters.query);
    const docNum = normalizeText(appliedFilters.docNum);
    const status = normalizeText(appliedFilters.status);
    const postingDateFrom = appliedFilters.postingDateFrom || '';
    const postingDateTo = appliedFilters.postingDateTo || '';

    return documents.filter((document) => {
      if (docNum && !normalizeText(document.docNum).includes(docNum)) return false;
      if (status && !normalizeText(document.documentStatus).includes(status)) return false;

      const postingDate = getComparableDate(document.postingDate);
      if (postingDateFrom && postingDate && postingDate < postingDateFrom) return false;
      if (postingDateTo && postingDate && postingDate > postingDateTo) return false;
      if ((postingDateFrom || postingDateTo) && !postingDate) return false;

      if (!query) return true;
      return searchFields.some((fieldName) =>
        normalizeText(document[fieldName]).includes(query)
      );
    });
  }, [appliedFilters, documents, searchFields]);

  const totalCount = filteredDocuments.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStartIndex = (safePage - 1) * pageSize;
  const visibleDocuments = filteredDocuments.slice(pageStartIndex, pageStartIndex + pageSize);
  const pageStart = totalCount === 0 ? 0 : pageStartIndex + 1;
  const pageEnd = Math.min(pageStartIndex + pageSize, totalCount);
  const hasActiveFilters = Object.values(appliedFilters).some((value) => String(value || '').trim() !== '');

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
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

  const openDocument = (docEntry) => {
    navigate(editPath, {
      state: createCompanyScopedRouteState({ [editStateKey]: docEntry }, company),
    });
  };

  return (
    <div className="container-fluid sap-find-page">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">{title}</h2>
          <small className="text-muted">Filter by document, status, and posting date.</small>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => navigate(backPath)}
        >
          Back
        </button>
      </div>

      {pageState.error && (
        <div className="alert alert-danger" role="alert">
          {pageState.error}
        </div>
      )}

      <div className="card p-3 sap-find-card">
        <div className="sap-find-filter-grid mb-3">
          <div className="sap-find-field">
            <label className="form-label mb-1">Doc No</label>
            <input
              type="text"
              className="form-control"
              name="docNum"
              value={filters.docNum}
              onChange={handleFilterChange}
              onKeyDown={handleFilterKeyDown}
              placeholder="Enter Doc No"
            />
          </div>

          <div className="sap-find-field">
            <label className="form-label mb-1">Status</label>
            <input
              type="text"
              className="form-control"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              onKeyDown={handleFilterKeyDown}
              placeholder="All Statuses"
            />
          </div>

          <div className="sap-find-field">
            <label className="form-label mb-1">Posting Date From</label>
            <input
              type="date"
              className="form-control"
              name="postingDateFrom"
              value={filters.postingDateFrom}
              onChange={handleFilterChange}
              onKeyDown={handleFilterKeyDown}
            />
          </div>

          <div className="sap-find-field">
            <label className="form-label mb-1">Posting Date To</label>
            <input
              type="date"
              className="form-control"
              name="postingDateTo"
              value={filters.postingDateTo}
              onChange={handleFilterChange}
              onKeyDown={handleFilterKeyDown}
            />
          </div>

          <div className="sap-find-field sap-find-actions">
            <button type="button" className="btn btn-primary w-100" onClick={handleApplyFilters}>
              Search
            </button>
            <button type="button" className="btn btn-outline-secondary w-100" onClick={handleClearFilters}>
              Clear Filters
            </button>
          </div>
        </div>

        <div className="sap-find-results-row mb-3">
          <div className="sap-find-global-field">
            <label className="form-label mb-1">Global Search</label>
            <input
              type="text"
              className="form-control"
              name="query"
              value={filters.query}
              onChange={handleFilterChange}
              onKeyDown={handleFilterKeyDown}
              placeholder="Search by Doc No., status, warehouse, business partner, or remarks"
            />
          </div>

          <div className="sap-find-results-tools">
            <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-sm-end gap-2 h-100">
              <small className="text-muted">
                {pageState.loading
                  ? 'Searching...'
                  : totalCount === 0
                    ? `0 ${emptyLabel}`
                    : `${totalCount} ${emptyLabel}`}
              </small>
              <label className="d-flex align-items-center gap-2 text-muted mb-0">
                <span>Rows</span>
                <select
                  className="form-select form-select-sm"
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  style={{ width: 'auto' }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
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
                {columns.map((column) => (
                  <th key={column.key} className={column.align === 'end' ? 'text-end' : undefined}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageState.loading && (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-4">
                    {loadingLabel}
                  </td>
                </tr>
              )}

              {!pageState.loading && visibleDocuments.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center text-muted py-4">
                    {hasActiveFilters ? `No ${emptyLabel} found for the selected filters.` : `No ${emptyLabel} found.`}
                  </td>
                </tr>
              )}

              {!pageState.loading &&
                visibleDocuments.map((document) => (
                  <tr
                    key={document.docEntry}
                    onDoubleClick={() => openDocument(document.docEntry)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => openDocument(document.docEntry)}
                      >
                        Select
                      </button>
                    </td>
                    {columns.map((column) => {
                      const rawValue = column.render
                        ? column.render(document)
                        : document[column.key];
                      return (
                        <td key={column.key} className={column.align === 'end' ? 'text-end' : undefined}>
                          {column.type === 'date' ? formatDate(rawValue) : rawValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mt-3">
          <small className="text-muted">
            {totalCount === 0
              ? `Showing 0 ${emptyLabel}`
              : `Showing ${pageStart}-${pageEnd} of ${totalCount} ${emptyLabel}`}
          </small>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={pageState.loading || safePage <= 1}
            >
              Previous
            </button>
            <small className="text-muted mb-0">
              Page {safePage} of {totalPages}
            </small>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={pageState.loading || safePage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InventoryDocumentFindPage;
