import React, { useEffect, useMemo, useState } from "react";
import useFloatingWindow from "./useFloatingWindow";

const PAGE_SIZE = 100;

function GLAccountLookupModal({
  isOpen,
  accounts = [],
  selectedCodes = [],
  onClose,
  onSave,
  title = "List of G/L Accounts",
}) {
  const [searchText, setSearchText] = useState("");
  const [draftCodes, setDraftCodes] = useState([]);
  const [page, setPage] = useState(0);
  const windowFrame = useFloatingWindow({ isOpen, defaultTop: 54, bounds: 'parent' });

  useEffect(() => {
    if (!isOpen) return;
    setSearchText("");
    setPage(0);
    setDraftCodes(Array.isArray(selectedCodes) ? [...selectedCodes] : []);
  }, [isOpen, selectedCodes]);

  const selectedSet = useMemo(() => new Set(draftCodes), [draftCodes]);

  const filteredAccounts = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return accounts;

    return accounts.filter((account) =>
      `${account.code || ""} ${account.formatCode || ""} ${account.name || ""}`.toLowerCase().includes(query),
    );
  }, [accounts, searchText]);

  useEffect(() => {
    setPage(0);
  }, [searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pagedAccounts = filteredAccounts.slice(pageStart, pageStart + PAGE_SIZE);

  const toggleCode = (code) => {
    setDraftCodes((current) => (
      current.includes(code)
        ? current.filter((entry) => entry !== code)
        : [...current, code]
    ));
  };

  const handleSave = () => {
    onSave([...new Set(draftCodes.filter(Boolean))]);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="ia-account-modal__backdrop" onClick={onClose}>
      <div
        className="ia-account-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        {...windowFrame.windowProps}
      >
        <div className="ia-account-modal__titlebar" {...windowFrame.titleBarProps}>
          <div className="ia-account-modal__title">{title}</div>
          <div className="ia-account-modal__controls">
            <button type="button" aria-label={windowFrame.isMinimized ? "Restore" : "Minimize"} onClick={windowFrame.toggleMinimize}>
              {windowFrame.isMinimized ? "[]" : "-"}
            </button>
            <button type="button" aria-label="Close" onClick={onClose}>x</button>
          </div>
        </div>
        <div className="ia-account-modal__accent" />

        {!windowFrame.isMinimized ? (
          <>
            <div className="ia-account-modal__body">
              <div className="ia-account-modal__toolbar">
                <label htmlFor="ia-account-find">Find</label>
                <input
                  id="ia-account-find"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  autoFocus
                />
                <button type="button" className="sap-report-btn" onClick={() => setSearchText("")}>Clear</button>
              </div>

              <div className="ia-account-modal__grid-wrap">
                <table className="ia-account-modal__grid">
                  <thead>
                    <tr>
                      <th className="is-check">&nbsp;</th>
                      <th className="is-index">#</th>
                      <th>Account Code</th>
                      <th>Account Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAccounts.length ? pagedAccounts.map((account, index) => {
                      const code = account.code || "";
                      const isSelected = selectedSet.has(code);
                      return (
                        <tr
                          key={`${code}-${pageStart + index}`}
                          className={isSelected ? "is-selected" : ""}
                          onClick={() => toggleCode(code)}
                        >
                          <td className="is-check"><input type="checkbox" checked={isSelected} onChange={() => toggleCode(code)} onClick={(event) => event.stopPropagation()} /></td>
                          <td className="is-index">{pageStart + index + 1}</td>
                          <td>{account.formatCode || code}</td>
                          <td>{account.name || ""}</td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={4} className="ia-account-modal__state">No G/L accounts found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ia-account-modal__actions">
                <button type="button" className="sap-report-btn" onClick={() => setDraftCodes(filteredAccounts.map((account) => account.code).filter(Boolean))}>Select All</button>
                <button type="button" className="sap-report-btn" onClick={() => setDraftCodes([])}>Clear Selection</button>
                <span className="ia-account-modal__page-info">
                  {filteredAccounts.length ? `Showing ${pageStart + 1}-${pageStart + pagedAccounts.length} of ${filteredAccounts.length}` : ''}
                </span>
                <button
                  type="button"
                  className="sap-report-btn"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="sap-report-btn"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  Next
                </button>
              </div>
            </div>
            <div className="ia-account-modal__footer">
              <button type="button" className="sap-report-btn sap-report-btn--primary" onClick={handleSave}>OK</button>
              <button type="button" className="sap-report-btn" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default GLAccountLookupModal;
