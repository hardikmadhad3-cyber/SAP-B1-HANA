import React, { useState, useRef, useEffect } from "react";

/**
 * SAP B1-style ComboBox — text input with dropdown arrow
 * Shows suggestions on click/focus, filters as you type
 * Supports both static options (for prefixes) and dynamic fetchOptions (for lookups)
 */
export default function ComboBox({
  name,
  value,
  onChange,
  onSelect,
  onBlur,
  fetchOptions,
  staticOptions = [],
  placeholder = "",
  readOnly = false,
  autoFocus = false,
  error = "",
  title = "",
  className = "",
  dropdownSearchable = false,
  dropdownSearchPlaceholder = "Search...",
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [options, setOptions] = useState(staticOptions);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null);
  const dropdownSearchRef = useRef(null);

  // Load options when dropdown opens (only for dynamic fetch)
  useEffect(() => {
    if (showDropdown && fetchOptions) {
      loadOptions(dropdownSearchable ? searchTerm : (value || ""));
    }
  }, [showDropdown, fetchOptions, value, dropdownSearchable, searchTerm]);

  // Initialize with static options if provided
  useEffect(() => {
    if (staticOptions.length > 0) {
      setOptions(staticOptions);
    } else if (!fetchOptions) {
      setOptions([]);
    }
  }, [staticOptions, fetchOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (showDropdown && dropdownSearchable && dropdownSearchRef.current) {
      dropdownSearchRef.current.focus();
    }
  }, [showDropdown, dropdownSearchable]);

  const loadOptions = async (query) => {
    if (!fetchOptions) return;
    setLoading(true);
    try {
      const results = await fetchOptions(query);
      setOptions(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error("Failed to load options:", err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    onChange(e);
  };

  const handleSelect = (option) => {
    if (onSelect) {
      onSelect(option);
    } else {
      onChange({ target: { name, value: option.code } });
    }
    setShowDropdown(false);
    setSearchTerm("");
  };

  const handleToggleDropdown = () => {
    if (readOnly) return;
    setShowDropdown((prev) => {
      const nextValue = !prev;
      if (!nextValue) {
        setSearchTerm("");
      }
      return nextValue;
    });
  };

  const handleInputFocus = () => {
    if (!readOnly) setShowDropdown(true);
  };

  const handleDropdownSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const normalizedFilterText = String(dropdownSearchable ? searchTerm : value || "")
    .trim()
    .toLowerCase();

  const filteredOptions = normalizedFilterText
    ? options.filter((opt) =>
      opt.code?.toLowerCase().includes(normalizedFilterText) ||
      opt.name?.toLowerCase().includes(normalizedFilterText)
    )
    : options;

  const isInputReadOnly = readOnly || dropdownSearchable;

  return (
    <div className={`im-combobox${className ? ` ${className}` : ""}`} ref={wrapperRef}>
      <input
        className={`im-combobox__input${error ? " im-combobox__input--error" : ""}`}
        name={name}
        value={value || ""}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={onBlur}
        readOnly={isInputReadOnly}
        autoFocus={autoFocus}
        placeholder={placeholder}
        title={title}
        autoComplete="off"
      />
      <button
        type="button"
        className="im-combobox__arrow"
        onClick={handleToggleDropdown}
        disabled={readOnly}
        tabIndex={-1}
      >
        ▼
      </button>
      {error && <span className="im-combobox__error">{error}</span>}
      
      {showDropdown && (
        <div className="im-combobox__dropdown">
          {dropdownSearchable && (
            <div className="im-combobox__search-wrap">
              <input
                ref={dropdownSearchRef}
                type="text"
                className="im-combobox__search-input"
                value={searchTerm}
                onChange={handleDropdownSearchChange}
                placeholder={dropdownSearchPlaceholder}
                autoComplete="off"
              />
            </div>
          )}
          {loading ? (
            <div className="im-combobox__loading">Loading...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="im-combobox__empty">No items found</div>
          ) : (
            <ul className="im-combobox__list">
              {filteredOptions.map((opt, i) => (
                <li
                  key={i}
                  className="im-combobox__item"
                  onClick={() => handleSelect(opt)}
                >
                  <span className="im-combobox__item-code">{opt.code}</span>
                  {opt.name && (
                    <span className="im-combobox__item-name">{opt.name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
