import React, { useEffect, useMemo, useState } from "react";
import { matchesSapSearchText } from "../../utils/sapSearch";
import useFloatingWindow from "./useFloatingWindow";

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
  const windowFrame = useFloatingWindow({ isOpen, defaultTop: 54 });

  useEffect(() => {
    if (!isOpen) return;
    setSearchText("");
    setDraftCodes(Array.isArray(selectedCodes) ? [...selectedCodes] : []);
  }, [isOpen, selectedCodes]);

  const selectedSet = useMemo(() => new Set(draftCodes), [draftCodes]);

  const filteredAccounts = useMemo(() => {
    if (!searchText.trim()) return accounts;

    return accounts.filter((account) =>
      matchesSapSearchText(`${account.code || ""} ${account.formatCode || ""} ${account.name || ""}`, searchText),
    );
  }, [accounts, searchText]);

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
            <button type="button" aria-label="Restore" onClick={windowFrame.restoreWindow}>[]</button>
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
                <button type="button" onClick={() => setSearchText("")}>Clear</button>
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
                    {filteredAccounts.length ? filteredAccounts.map((account, index) => {
                      const code = account.code || "";
                      const isSelected = selectedSet.has(code);
                      return (
                        <tr
                          key={`${code}-${index}`}
                          className={isSelected ? "is-selected" : ""}
                          onClick={() => toggleCode(code)}
                        >
                          <td className="is-check"><input type="checkbox" checked={isSelected} onChange={() => toggleCode(code)} onClick={(event) => event.stopPropagation()} /></td>
                          <td className="is-index">{index + 1}</td>
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
                <button type="button" onClick={() => setDraftCodes(filteredAccounts.map((account) => account.code).filter(Boolean))}>Select All</button>
                <button type="button" onClick={() => setDraftCodes([])}>Clear Selection</button>
              </div>
            </div>
            <div className="ia-account-modal__footer">
              <button type="button" onClick={handleSave}>OK</button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default GLAccountLookupModal;
