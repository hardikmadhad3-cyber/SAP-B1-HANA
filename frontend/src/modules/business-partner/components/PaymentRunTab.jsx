import React, { useEffect, useState } from "react";

const EMPTY_OPTION = { code: "", name: "-- Select --" };

const dedupeByValue = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item.value ?? "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function PaymentRunTab({
  form,
  onChange,
  setForm,
  fetchBanks,
  fetchCountries,
  fetchHouseBankAccounts,
}) {
  const [countryOptions, setCountryOptions] = useState([EMPTY_OPTION]);
  const [bankOptions, setBankOptions] = useState([EMPTY_OPTION]);
  const [houseBankAccounts, setHouseBankAccounts] = useState([]);

  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      try {
        const rows = await fetchCountries("");
        if (!active) return;
        setCountryOptions([
          EMPTY_OPTION,
          ...rows.map((row) => ({ code: row.code || "", name: row.name || row.code || "" })),
        ]);
      } catch (_) {
        if (active) setCountryOptions([EMPTY_OPTION]);
      }
    };

    loadCountries();
    return () => { active = false; };
  }, [fetchCountries]);

  useEffect(() => {
    let active = true;

    const loadBanks = async () => {
      const country = String(form.HouseBankCountry || "").trim();
      if (!country) {
        setBankOptions([EMPTY_OPTION]);
        return;
      }

      try {
        const rows = await fetchBanks("", country);
        if (!active) return;
        setBankOptions([
          EMPTY_OPTION,
          ...rows.map((row) => ({
            code: row.code || "",
            name: row.name || row.code || "",
            branch: row.branch || "",
            swift: row.swift || "",
            iban: row.iban || "",
          })),
        ]);
      } catch (_) {
        if (active) setBankOptions([EMPTY_OPTION]);
      }
    };

    loadBanks();
    return () => { active = false; };
  }, [fetchBanks, form.HouseBankCountry]);

  useEffect(() => {
    let active = true;

    const loadHouseBankAccounts = async () => {
      const bankCode = String(form.HouseBank || "").trim();
      const country = String(form.HouseBankCountry || "").trim();

      if (!bankCode) {
        setHouseBankAccounts([]);
        return;
      }

      try {
        const rows = await fetchHouseBankAccounts(bankCode, country);
        if (!active) return;
        setHouseBankAccounts(rows || []);
      } catch (_) {
        if (active) setHouseBankAccounts([]);
      }
    };

    loadHouseBankAccounts();
    return () => { active = false; };
  }, [fetchHouseBankAccounts, form.HouseBank, form.HouseBankCountry]);

  useEffect(() => {
    if (!form.HouseBank || houseBankAccounts.length === 0) return;

    const hasSelectedAccount = houseBankAccounts.some((row) => row.account === form.HouseBankAccount);
    if (hasSelectedAccount) return;

    applyLinkedBankRow(houseBankAccounts[0], {
      HouseBank: form.HouseBank,
      HouseBankCountry: form.HouseBankCountry || houseBankAccounts[0]?.country || "",
    });
  }, [houseBankAccounts, form.HouseBank, form.HouseBankAccount, form.HouseBankCountry]);

  const accountOptions = dedupeByValue([
    { value: "", label: "-- Select --" },
    ...(form.HouseBankAccount ? [{
      value: form.HouseBankAccount,
      label: form.HouseBankAccount,
    }] : []),
    ...houseBankAccounts
      .filter((row) => row.account)
      .map((row) => ({
        value: row.account,
        label: row.branch ? `${row.account} - ${row.branch}` : row.account,
      })),
  ]);

  const ibanOptions = dedupeByValue([
    { value: "", label: "-- Select --" },
    ...(form.HouseBankIBAN ? [{
      value: form.HouseBankIBAN,
      label: form.HouseBankIBAN,
    }] : []),
    ...houseBankAccounts
      .filter((row) => row.iban)
      .map((row) => ({
        value: row.iban,
        label: row.branch ? `${row.iban} - ${row.branch}` : row.iban,
      })),
  ]);

  const selectedBankMaster = bankOptions.find((bank) => bank.code === form.HouseBank) || null;

  const applyLinkedBankRow = (row, overrides = {}) => {
    setForm((prev) => ({
      ...prev,
      HouseBankCountry: overrides.HouseBankCountry ?? row?.country ?? prev.HouseBankCountry ?? "",
      HouseBank: overrides.HouseBank ?? row?.bankCode ?? prev.HouseBank ?? "",
      HouseBankAccount: overrides.HouseBankAccount ?? row?.account ?? "",
      HouseBankBranch: overrides.HouseBankBranch ?? row?.branch ?? selectedBankMaster?.branch ?? "",
      HouseBankIBAN: overrides.HouseBankIBAN ?? row?.iban ?? selectedBankMaster?.iban ?? "",
      HouseBankSwift: overrides.HouseBankSwift ?? row?.swift ?? selectedBankMaster?.swift ?? "",
      HouseBankControlKey: overrides.HouseBankControlKey ?? row?.controlKey ?? "",
    }));
  };

  const handleCountryChange = (e) => {
    const nextCountry = e.target.value;
    setForm((prev) => ({
      ...prev,
      HouseBankCountry: nextCountry,
      HouseBank: "",
      HouseBankAccount: "",
      HouseBankBranch: "",
      HouseBankIBAN: "",
      HouseBankSwift: "",
      HouseBankControlKey: "",
    }));
  };

  const handleBankChange = (e) => {
    const nextBank = e.target.value;
    const matchedBank = bankOptions.find((row) => row.code === nextBank) || null;

    setForm((prev) => ({
      ...prev,
      HouseBank: nextBank,
      HouseBankAccount: "",
      HouseBankBranch: matchedBank?.branch || "",
      HouseBankIBAN: matchedBank?.iban || "",
      HouseBankSwift: matchedBank?.swift || "",
      HouseBankControlKey: "",
    }));
  };

  const handleAccountChange = (e) => {
    const nextAccount = e.target.value;
    const matchedRow = houseBankAccounts.find((row) => row.account === nextAccount);

    if (matchedRow) {
      applyLinkedBankRow(matchedRow, {
        HouseBankAccount: nextAccount,
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      HouseBankAccount: nextAccount,
    }));
  };

  const handleIBANChange = (e) => {
    const nextIBAN = e.target.value;
    const matchedRow = houseBankAccounts.find((row) => row.iban === nextIBAN);

    if (matchedRow) {
      applyLinkedBankRow(matchedRow, {
        HouseBankIBAN: nextIBAN,
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      HouseBankIBAN: nextIBAN,
    }));
  };

  return (
    <div style={{ display: "flex", gap: 40 }}>
      <div style={{ minWidth: 320, maxWidth: 380 }}>
        <div className="im-section-title">House Bank</div>
        <div className="im-field">
          <label className="im-field__label">Country/Region</label>
          <select className="im-field__select" name="HouseBankCountry" value={form.HouseBankCountry || ""} onChange={handleCountryChange}>
            {countryOptions.map((country) => (
              <option key={country.code} value={country.code}>{country.name}</option>
            ))}
          </select>
        </div>
        <div className="im-field">
          <label className="im-field__label">Bank</label>
          <select className="im-field__select" name="HouseBank" value={form.HouseBank || ""} onChange={handleBankChange} disabled={!form.HouseBankCountry}>
            {bankOptions.map((bank) => (
              <option key={`${bank.code}-${bank.name}`} value={bank.code}>{bank.name}</option>
            ))}
          </select>
        </div>
        <div className="im-field">
          <label className="im-field__label">Account</label>
          <select className="im-field__select" name="HouseBankAccount" value={form.HouseBankAccount || ""} onChange={handleAccountChange} disabled={!form.HouseBank}>
            {accountOptions.map((option) => (
              <option key={`acct-${option.value}`} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="im-field">
          <label className="im-field__label">Branch</label>
          <input className="im-field__input" name="HouseBankBranch" value={form.HouseBankBranch || ""} onChange={onChange} readOnly style={{ background: "#f7f7f7" }} />
        </div>
        <div className="im-field">
          <label className="im-field__label">IBAN</label>
          <select className="im-field__select" name="HouseBankIBAN" value={form.HouseBankIBAN || ""} onChange={handleIBANChange} disabled={!form.HouseBank}>
            {ibanOptions.map((option) => (
              <option key={`iban-${option.value}`} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="im-field">
          <label className="im-field__label">BIC/SWIFT Code</label>
          <input className="im-field__input" name="HouseBankSwift" value={form.HouseBankSwift || ""} onChange={onChange} readOnly style={{ background: "#f7f7f7" }} />
        </div>
        <div className="im-field">
          <label className="im-field__label">Control No.</label>
          <input className="im-field__input" name="HouseBankControlKey" value={form.HouseBankControlKey || ""} onChange={onChange} readOnly style={{ background: "#f7f7f7" }} />
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="im-field">
            <label className="im-field__label"></label>
            <label className="im-checkbox-label">
              <input type="checkbox" name="PaymentBlock" checked={form.PaymentBlock === "tYES"} onChange={onChange} />
              <span>Payment Block</span>
            </label>
          </div>
          <div className="im-field">
            <label className="im-field__label"></label>
            <label className="im-checkbox-label">
              <input type="checkbox" name="SinglePayment" checked={form.SinglePayment === "tYES"} onChange={onChange} />
              <span>Single Payment</span>
            </label>
          </div>
          <div className="im-field">
            <label className="im-field__label"></label>
            <label className="im-checkbox-label">
              <input type="checkbox" name="CollectionAuthorization" checked={form.CollectionAuthorization === "tYES"} onChange={onChange} />
              <span>Collection Authorization</span>
            </label>
          </div>
          <div className="im-field">
            <label className="im-field__label">Bank Charges Code</label>
            <input className="im-field__input" name="BankChargesAllocationCode" value={form.BankChargesAllocationCode || ""} onChange={onChange} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div className="im-section-title">Payment Methods</div>
        <div className="im-grid-wrap">
          <table className="im-grid" style={{ minWidth: 400 }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Code</th>
                <th>Description</th>
                <th style={{ width: 60 }}>Include</th>
                <th style={{ width: 60 }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {(form.BPPaymentMethods || []).length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#aaa", padding: 20, fontSize: 12 }}>
                    No payment methods defined
                  </td>
                </tr>
              ) : (
                (form.BPPaymentMethods || []).map((pm, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{pm.PaymentMethodCode}</td>
                    <td>{pm.Description}</td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={pm.Include === "tYES"} readOnly />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={pm.Active === "tYES"} readOnly />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button className="im-btn" onClick={() => {}}>Clear Default</button>
          <button className="im-btn im-btn--primary" style={{ marginLeft: "auto" }} onClick={() => {}}>Set as Default</button>
        </div>
      </div>
    </div>
  );
}
