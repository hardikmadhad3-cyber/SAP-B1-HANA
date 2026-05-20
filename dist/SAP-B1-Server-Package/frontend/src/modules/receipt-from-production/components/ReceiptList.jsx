import { useState, useEffect } from "react";
import { fetchReceiptList } from "../../../api/receiptFromProductionApi";
import "../../item-master/styles/itemMaster.css";

export default function ReceiptList({ onSelect, onNew }) {
  const [receipts, setReceipts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (q = "") => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReceiptList({ query: q });
      setReceipts(data.receipts || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const handleSearch = () => {
    load(query);
  };

  const handleClear = () => {
    setQuery("");
    load("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="im-page">
      {/* Page Title */}
      <div className="im-toolbar">
        <span className="im-toolbar__title">Receipt from Production — List</span>
        <button className="im-btn im-btn--primary" onClick={onNew}>
          New Receipt
        </button>
      </div>

      {/* Error Alert */}
      {error && <div className="im-alert im-alert--error">{error}</div>}

      {/* Search Bar Section */}
      <div className="im-header-card" style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            className="im-field__input"
            placeholder="Search by Doc No. or remarks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            style={{ flex: 1, maxWidth: 400 }}
            autoFocus
          />
          <button className="im-btn" onClick={handleSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
          <button className="im-btn" onClick={handleClear} disabled={loading}>
            Clear
          </button>
        </div>
      </div>

      {/* Results List */}
      <div style={{ padding: "16px", background: "#fff" }}>
        <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 4 }}>
          <table className="rfp-list-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f7fa", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>
                  Doc No.
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>
                  Posting Date
                </th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, fontSize: 13 }}>
                  Lines
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 13 }}>
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      color: "#888",
                      padding: "30px",
                      fontSize: 13,
                    }}
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && receipts.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      color: "#888",
                      padding: "30px",
                      fontSize: 13,
                    }}
                  >
                    No receipt documents found.
                  </td>
                </tr>
              )}
              {!loading &&
                receipts.map((doc) => (
                  <tr
                    key={doc.doc_entry}
                    onClick={() => onSelect(doc.doc_entry)}
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 500 }}>
                      {doc.doc_num}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>
                      {doc.posting_date}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "center" }}>
                      {doc.total_lines}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#555" }}>
                      {doc.remarks || "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Results Count */}
        {!loading && receipts.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#666", textAlign: "right" }}>
            {receipts.length} record{receipts.length !== 1 ? "s" : ""} found
          </div>
        )}
      </div>
    </div>
  );
}
