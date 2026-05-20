import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchInventoryTransferList } from '../api/inventoryTransferApi';

function InventoryTransferList() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [pageState, setPageState] = useState({
    loading: true,
    error: '',
  });

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setPageState({ loading: true, error: '' });
      try {
        const response = await fetchInventoryTransferList();
        if (!ignore) {
          setDocuments(response.data || []);
          setPageState({ loading: false, error: '' });
        }
      } catch (error) {
        if (!ignore) {
          setPageState({
            loading: false,
            error:
              error.response?.data?.message ||
              error.message ||
              'Failed to load inventory transfers.',
          });
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const openInventoryTransfer = (docEntry) => {
    navigate('/inventory-transfer', {
      state: {
        inventoryTransferDocEntry: docEntry,
      },
    });
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Inventory Transfer List</h2>
          <small className="text-muted">Click edit to load the selected inventory transfer.</small>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => navigate('/inventory-transfer')}
        >
          Back
        </button>
      </div>

      {pageState.error && (
        <div className="alert alert-danger" role="alert">
          {pageState.error}
        </div>
      )}

      <div className="card p-3">
        <div className="table-responsive">
          <table className="table table-bordered table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Action</th>
                <th>Doc No</th>
                <th>Posting Date</th>
                <th>Due Date</th>
                <th>From Warehouse</th>
                <th>To Warehouse</th>
                <th>Status</th>
                <th>Journal Remark</th>
              </tr>
            </thead>
            <tbody>
              {pageState.loading && (
                <tr>
                  <td colSpan="8" className="text-center py-4">
                    Loading inventory transfers...
                  </td>
                </tr>
              )}

              {!pageState.loading && documents.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">
                    No inventory transfers found.
                  </td>
                </tr>
              )}

              {!pageState.loading &&
                documents.map((document) => (
                  <tr
                    key={document.docEntry}
                    onDoubleClick={() => openInventoryTransfer(document.docEntry)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => openInventoryTransfer(document.docEntry)}
                      >
                        Open
                      </button>
                    </td>
                    <td>{document.docNum}</td>
                    <td>
                      {document.postingDate
                        ? new Date(document.postingDate).toLocaleDateString('en-GB')
                        : ''}
                    </td>
                    <td>
                      {document.dueDate
                        ? new Date(document.dueDate).toLocaleDateString('en-GB')
                        : ''}
                    </td>
                    <td>{document.fromWarehouse}</td>
                    <td>{document.toWarehouse}</td>
                    <td>{document.documentStatus}</td>
                    <td>{document.journalRemark}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default InventoryTransferList;
