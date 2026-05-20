import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGoodsReceipts } from '../api/goodsReceiptApi';

function GoodsReceiptList() {
  const navigate = useNavigate();
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [pageState, setPageState] = useState({
    loading: true,
    error: '',
  });

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setPageState({ loading: true, error: '' });
      try {
        const response = await fetchGoodsReceipts();
        if (!ignore) {
          setGoodsReceipts(response.data || []);
          setPageState({ loading: false, error: '' });
        }
      } catch (error) {
        if (!ignore) {
          setPageState({
            loading: false,
            error:
              error.response?.data?.message ||
              error.message ||
              'Failed to load goods receipts.',
          });
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const openGoodsReceipt = (docEntry) => {
    navigate('/goods-receipt', {
      state: { goodsReceiptDocEntry: docEntry },
    });
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Goods Receipt List</h2>
          <small className="text-muted">Click edit to load the selected goods receipt.</small>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => navigate('/goods-receipt')}
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
                    Loading goods receipts...
                  </td>
                </tr>
              )}

              {!pageState.loading && goodsReceipts.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-4">
                    No open goods receipts found.
                  </td>
                </tr>
              )}

              {!pageState.loading &&
                goodsReceipts.map((goodsReceipt) => (
                  <tr
                    key={goodsReceipt.docEntry}
                    onDoubleClick={() => openGoodsReceipt(goodsReceipt.docEntry)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => openGoodsReceipt(goodsReceipt.docEntry)}
                      >
                        Open
                      </button>
                    </td>
                    <td>{goodsReceipt.docNum}</td>
                    <td>
                      {goodsReceipt.postingDate
                        ? new Date(goodsReceipt.postingDate).toLocaleDateString('en-GB')
                        : ''}
                    </td>
                    <td>
                      {goodsReceipt.documentDate
                        ? new Date(goodsReceipt.documentDate).toLocaleDateString('en-GB')
                        : ''}
                    </td>
                    <td>{goodsReceipt.documentStatus}</td>
                    <td>{goodsReceipt.journalRemark}</td>
                    <td className="text-end">{Number(goodsReceipt.docTotal || 0).toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default GoodsReceiptList;
