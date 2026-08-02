import React, { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { matchesSapSearchText } from "../../utils/sapSearch";

export default function SapLookupModal({
  open,
  title,
  columns = [],
  fetchOptions,
  rows,
  loading: externalLoading = false,
  onClose,
  onSelect,
  onNew,
  onQueryChange,
  footerNote,
  footerControls,
  initialQuery = "",
  searchPlaceholder = "Search",
  emptyMessage = "No matching records found.",
  newLabel = "New",
  chooseLabel = "Choose",
  cancelLabel = "Cancel",
  getRowKey,
  width = "min(980px, calc(100% - 40px))",
  portalTarget,
  fetchOnOpen = true,
}) {
  const searchId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [fetchedRows, setFetchedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const baseRows = Array.isArray(rows) ? rows : fetchedRows;
  const isLoading = externalLoading || loading;
  const visibleColumns = useMemo(
    () => columns.filter(Boolean),
    [columns],
  );
  const activeRows = useMemo(() => {
    if (!Array.isArray(rows)) return baseRows;
    if (!query.trim()) return baseRows;

    return baseRows.filter((row) =>
      visibleColumns.some((column) => {
        if (column.searchable === false || column.key === "rowNumber") return false;
        const value = typeof column.render === "function" ? column.render(row, 0) : row[column.key];
        return matchesSapSearchText(value, query);
      })
    );
  }, [baseRows, query, rows, visibleColumns]);

  useEffect(() => {
    if (!open || !fetchOptions) return undefined;
    if (!fetchOnOpen && !query.trim()) {
      setFetchedRows([]);
      setLoading(false);
      return undefined;
    }

    let ignore = false;
    setLoading(true);
    Promise.resolve(fetchOptions(query))
      .then((nextRows) => {
        if (!ignore) setFetchedRows(Array.isArray(nextRows) ? nextRows : []);
      })
      .catch(() => {
        if (!ignore) setFetchedRows([]);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [open, query, fetchOptions, fetchOnOpen]);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, open, activeRows.length]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const chooseRow = (row) => {
    if (!row) return;
    onSelect(row);
  };

  const handleChoose = () => {
    if (selectedIndex < 0) return;
    chooseRow(activeRows[selectedIndex]);
  };

  if (!open) return null;

  const target =
    typeof document === "undefined"
      ? null
      : typeof portalTarget === "function"
        ? portalTarget()
        : portalTarget || document.querySelector(".app-shell__content") || document.body;

  const modal = (
    <div
      className="sap-lookup-modal__overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="sap-lookup-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sap-lookup-modal__header">
          <span>{title}</span>
          <button type="button" className="sap-lookup-modal__close" aria-label="Close" onClick={onClose}>
            x
          </button>
        </header>

        <div className="sap-lookup-modal__filter">
          <label htmlFor={searchId}>Find</label>
          <input
            id={searchId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              onQueryChange?.(event.target.value);
            }}
            placeholder={searchPlaceholder}
            autoFocus
          />
        </div>

        <div className="sap-lookup-modal__body">
          {isLoading ? (
            <div className="sap-lookup-modal__empty">Loading...</div>
          ) : activeRows.length === 0 ? (
            <div className="sap-lookup-modal__empty">{emptyMessage}</div>
          ) : (
            <table className="sap-lookup-modal__table">
              <thead>
                <tr>
                  {visibleColumns.map((column) => (
                    <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, index) => (
                  <tr
                    key={getRowKey ? getRowKey(row, index) : (row.code || row.CardCode || row.ItemCode || row.value || index)}
                    className={selectedIndex === index ? "is-selected" : undefined}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      chooseRow(row);
                    }}
                  >
                    {visibleColumns.map((column) => (
                      <td key={column.key} className={column.align === "right" ? "is-right" : undefined}>
                        {typeof column.render === "function" ? column.render(row, index) : (row[column.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="sap-lookup-modal__footer">
          <span>{footerNote || `${activeRows.length} records`}</span>
          {footerControls ? <div className="sap-lookup-modal__footer-controls">{footerControls}</div> : null}
          <button
            type="button"
            className="sap-lookup-modal__btn sap-lookup-modal__btn--primary"
            onClick={handleChoose}
            disabled={selectedIndex < 0}
          >
            {chooseLabel}
          </button>
          <button type="button" className="sap-lookup-modal__btn" onClick={onClose}>
            {cancelLabel}
          </button>
          {onNew ? (
            <button type="button" className="sap-lookup-modal__btn sap-lookup-modal__btn--primary" onClick={onNew}>
              {newLabel}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );

  return target ? createPortal(modal, target) : modal;
}
