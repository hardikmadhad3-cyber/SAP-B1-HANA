import React, { useEffect, useState } from 'react';
import './styles/SalesQuotationList.css';
import { useNavigate } from 'react-router-dom';
import { fetchSalesQuotations } from '../../api/salesQuotationApi';

function SalesQuotationList() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchSalesQuotations();
        if (!ignore) setQuotations(res.data.quotations || []);
      } catch (e) {
        if (!ignore) setError('Failed to load sales quotations.');
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  return (
    <div className="sales-quotation-list-container">
      <div className="sales-quotation-list-header">
        <h1>Sales Quotations</h1>
        <button className="btn-primary" onClick={() => navigate('/sales-quotation')}>
          + New Quotation
        </button>
      </div>

      <div className="sales-quotation-list-content">
        {loading && <p>Loading...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {!loading && !error && quotations.length === 0 && (
          <p>No sales quotations found.</p>
        )}
        {!loading && quotations.length > 0 && (
          <table className="sq-list-table">
            <thead>
              <tr>
                <th>Doc No</th>
                <th>Customer Code</th>
                <th>Customer Name</th>
                <th>Posting Date</th>
                <th>Delivery Date</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map(q => (
                <tr
                  key={q.doc_entry}
                  className="sq-list-row"
                  onClick={() => navigate('/sales-quotation', {
                    state: { salesQuotationDocEntry: q.doc_entry }
                  })}
                >
                  <td>{q.doc_num}</td>
                  <td>{q.customer_code}</td>
                  <td>{q.customer_name}</td>
                  <td>{q.posting_date}</td>
                  <td>{q.delivery_date}</td>
                  <td>
                    <span className={`sq-status sq-status--${(q.status || '').toLowerCase()}`}>
                      {q.status}
                    </span>
                  </td>
                  <td>{Number(q.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default SalesQuotationList;
