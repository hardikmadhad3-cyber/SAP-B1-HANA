import React, { useState, useEffect } from "react";
import { fetchIssueList } from "../../../api/issueForProductionApi";

export default function IssueList({ onSelect, onNew }) {
  const [issues,  setIssues]  = useState([]);
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const load = async (q = "") => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIssueList({ query: q });
      setIssues(data.issues || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <div className="im-page">
      <div className="im-toolbar">
        <span className="im-toolbar__title">Issue for Production — List</span>
        <button className="im-btn im-btn--primary" onClick={onNew}>New Issue</button>
      </div>

      {error && <div className="im-alert im-alert--error">{error}</div>}

      {/* Search bar at top */}
      <div className="ifp-list-search-bar">
        <input
          className="im-field__input"
          placeholder="Search by Doc No. or remarks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(query)}
          style={{ width: 350 }}
        />
        <button className="im-btn" onClick={() => load(query)} disabled={loading}>
          {loading ? "…" : "Search"}
        </button>
        <button className="im-btn" onClick={() => { setQuery(""); load(""); }}>Clear</button>
      </div>

      {/* Full table below */}
      <div className="ifp-list-container">
        <table className="ifp-list-table">
          <thead>
            <tr>
              <th style={{ width: 100 }}>Doc No.</th>
              <th style={{ width: 120 }}>Posting Date</th>
              <th style={{ width: 80, textAlign: 'right' }}>Lines</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 && !loading && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "#888", padding: "20px" }}>
                  No issue documents found.
                </td>
              </tr>
            )}
            {issues.map((doc) => (
              <tr key={doc.doc_entry} onClick={() => onSelect(doc.doc_entry)}>
                <td>{doc.doc_num}</td>
                <td>{doc.posting_date}</td>
                <td style={{ textAlign: "right" }}>{doc.total_lines}</td>
                <td>{doc.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
