import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGoodsIssueList } from '../api/goodsIssueApi';

function GoodsIssueList() {
  const navigate = useNavigate();
  const [goodsIssues, setGoodsIssues] = useState([]);
  const [pageState, setPageState] = useState({
    loading: true,
    error: '',
  });

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setPageState({ loading: true, error: '' });
      try {
        const response = await fetchGoodsIssueList();
        if (!ignore) {
          setGoodsIssues(response.data || []);
          setPageState({ loading: false, error: '' });
        }
      } catch (error) {
        if (!ignore) {
          setPageState({
            loading: false,
            error:
              error.response?.data?.message ||
              error.message ||
              'Failed to load goods issues.',
          });
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const openGoodsIssue = (docEntry) => {
    navigate('/goods-issue', {
      state: { goodsIssueDocEntry: docEntry },
    });
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Goods Issue List</h2>
          <small className="text-muted">Click edit to load the selected goods issue.</small>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => navigate('/goods-issue')}
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
                <th>Document Date</th>
                <th>Status</th>
                <th>Journal Remark</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              {pageState.loading && (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    Loading goods issues...
                  </td>
                </tr>
              )}

              {!pageState.loading && goodsIssues.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-4">
                    No goods issues found.
                  </td>
                </tr>
              )}

              {!pageState.loading &&
                goodsIssues.map((goodsIssue) => (
                  <tr
                    key={goodsIssue.docEntry}
                    onDoubleClick={() => openGoodsIssue(goodsIssue.docEntry)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => openGoodsIssue(goodsIssue.docEntry)}
                      >
                        Open
                      </button>
                    </td>
                    <td>{goodsIssue.docNum}</td>
                    <td>
                      {goodsIssue.postingDate
                        ? new Date(goodsIssue.postingDate).toLocaleDateString('en-GB')
                        : ''}
                    </td>
                    <td>
                      {goodsIssue.documentDate
                        ? new Date(goodsIssue.documentDate).toLocaleDateString('en-GB')
                        : ''}
                    </td>
                    <td>{goodsIssue.documentStatus}</td>
                    <td>{goodsIssue.journalRemark}</td>
                    <td className="text-end">{Number(goodsIssue.docTotal || 0).toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default GoodsIssueList;
