import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchIncomingPaymentOpenInvoices,
  fetchIncomingPaymentReferenceData,
  searchIncomingPayments,
  searchIncomingPaymentBusinessPartners,
  searchIncomingPaymentControlAccounts,
  submitIncomingPayment,
} from "../../api/incomingPaymentsApi";
import "./incomingPayments.css";

const today = new Date().toISOString().slice(0, 10);

const formatSapDate = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year.slice(2)}` : value;
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const parseAmount = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/^INR\s*/i, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampPayment = (value, balanceDue) => {
  const amount = Math.max(0, parseAmount(value));
  return Math.min(amount, Number(balanceDue || 0));
};

const normalizePercent = (value) => {
  const parsed = Math.max(0, parseAmount(value));
  return Math.min(parsed, 100);
};

function SapLookupField({
  value,
  onChange,
  onSelect,
  fetchOptions,
  columns,
  title,
  className = "",
  readOnly = false,
  buttonLabel = "...",
  triggerOpen = 0,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef(null);

  const load = async (nextQuery = "") => {
    setLoading(true);
    try {
      const data = await fetchOptions(nextQuery);
      setRows(data || []);
      setSelectedIndex(0);
    } catch (_error) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    if (readOnly) return;
    setOpen(true);
    setQuery("");
    load("");
  };

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (triggerOpen > 0) openModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerOpen]);

  const pick = (row) => {
    if (!row) return;
    onSelect(row);
    setOpen(false);
  };

  return (
    <>
      <span className={`sap-lookup ${className}`}>
        <input value={value} onChange={(event) => onChange(event.target.value)} readOnly={readOnly} />
        <button type="button" className="sap-lookup__arrow" onClick={openModal} disabled={readOnly}>
          {buttonLabel}
        </button>
      </span>

      {open ? createPortal(
        <div
          className="modal show d-block ip-lookup-modal-layer"
          tabIndex="-1"
          role="dialog"
          onMouseDown={() => setOpen(false)}
        >
          <div className="modal-dialog modal-xl ip-lookup-dialog" role="document" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-content ip-lookup-content">
              <div className="modal-header ip-lookup-header">
                <h6 className="modal-title mb-0">List of {title}</h6>
                <button type="button" className="ip-lookup-close" onClick={() => setOpen(false)}>x</button>
              </div>
              <div className="modal-body ip-lookup-body">
                <div className="ip-lookup-find">
                  <label>Find</label>
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      load(event.target.value);
                    }}
                  />
                </div>
                <div className="ip-lookup-table-wrap">
                  <table className="ip-lookup-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {columns.map((column) => (
                          <th key={column.key}>{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={columns.length + 1}>Loading...</td></tr>
                      ) : rows.length ? (
                        rows.map((row, index) => (
                          <tr
                            key={`${row.code || index}-${index}`}
                            className={selectedIndex === index ? "is-active" : ""}
                            onClick={() => setSelectedIndex(index)}
                            onDoubleClick={() => pick(row)}
                          >
                            <td>{index + 1}</td>
                            {columns.map((column) => (
                              <td key={column.key}>{row[column.key]}</td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={columns.length + 1}>No matching records found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer ip-lookup-footer">
                <button type="button" className="po-btn po-btn--primary" onClick={() => pick(rows[selectedIndex])} disabled={!rows.length}>Choose</button>
                <button type="button" className="po-btn" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

const FieldRow = ({ label, children }) => (
  <label className="sap-field-row">
    <span>{label}</span>
    {children}
  </label>
);

const getBranchRegNo = (branches = [], branchCode = "") => {
  const branch = branches.find((item) => String(item.code) === String(branchCode));
  return branch?.branchRegNo || branch?.vatRegNum || branch?.taxIdNum || "";
};

export default function IncomingPaymentsPage() {
  const createInitialHeader = (branch = "", transactionNumber = "", series = {}) => ({
    businessPartnerCode: "",
    businessPartnerName: "",
    bpType: "Customer",
    seriesCode: series.code || "",
    seriesName: series.name || "",
    documentNumber: series.nextNumber || "",
    billToCode: "",
    billToAddress: "",
    contactPerson: "",
    project: "",
    blanketAgreement: "",
    postingDate: today,
    dueDate: today,
    documentDate: today,
    referenceNumber: "",
    transactionNumber,
    branch,
    branchRegNo: "",
    referencedDocument: "",
    wtTaxCode: "",
    wtTaxBaseSum: "",
    controlAccount: "",
    controlAccountName: "",
    cashAccount: "",
    cashAccountName: "",
  });

  const [header, setHeader] = useState({
    businessPartnerCode: "",
    businessPartnerName: "",
    bpType: "Customer",
    seriesCode: "",
    seriesName: "",
    documentNumber: "",
    billToCode: "",
    billToAddress: "",
    contactPerson: "",
    project: "",
    blanketAgreement: "",
    postingDate: today,
    dueDate: today,
    documentDate: today,
    referenceNumber: "",
    transactionNumber: "",
    branch: "",
    branchRegNo: "",
    referencedDocument: "",
    wtTaxCode: "",
    wtTaxBaseSum: "",
    controlAccount: "",
    controlAccountName: "",
    cashAccount: "",
    cashAccountName: "",
  });
  const [branches, setBranches] = useState([]);
  const [documentSeries, setDocumentSeries] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [paymentOnAccount, setPaymentOnAccount] = useState(false);
  const [paymentOnAccountAmount, setPaymentOnAccountAmount] = useState("0.00");
  const [wtTaxAmount, setWtTaxAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [journalRemarks, setJournalRemarks] = useState("");
  const [bpLookupTrigger, setBpLookupTrigger] = useState(0);
  const [documentFindTrigger, setDocumentFindTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    fetchIncomingPaymentReferenceData()
      .then((data) => {
        if (!mounted) return;
        const seriesRows = data.series || [];
        const defaultSeries =
          seriesRows.find((series) => series.code === data.defaultSeriesCode) ||
          seriesRows.find((series) => series.isDefault) ||
          seriesRows[0] ||
          null;
        const branchRows = data.branches || [];
        setBranches(branchRows);
        setDocumentSeries(seriesRows);
        setHeader((current) => {
          const selectedBranch = current.branch || branchRows[0]?.code || "";
          return {
            ...current,
            seriesCode: current.seriesCode || defaultSeries?.code || "",
            seriesName: current.seriesName || defaultSeries?.name || "",
            documentNumber: current.documentNumber || data.nextDocumentNumber || defaultSeries?.nextNumber || "",
            transactionNumber: data.nextTransactionNumber || current.transactionNumber,
            branch: selectedBranch,
            branchRegNo: getBranchRegNo(branchRows, selectedBranch),
            cashAccount: data.defaultCashAccount || current.cashAccount,
          };
        });
      })
      .catch(() => {
        if (mounted) setLoadError("Reference data could not be loaded.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedTotal = useMemo(
    () =>
      invoices.reduce((sum, invoice) => {
        if (!invoice.selected) return sum;
        return sum + clampPayment(invoice.totalPayment, invoice.balanceDue);
      }, 0),
    [invoices],
  );

  const totalAmountDue = selectedTotal + (paymentOnAccount ? parseAmount(paymentOnAccountAmount) : 0);
  const openBalance = Math.max(0, totalAmountDue - parseAmount(wtTaxAmount));

  const getPayableInvoiceTotal = (rows = invoices) =>
    rows.reduce((sum, invoice) => {
      const payment = clampPayment(invoice.totalPayment, invoice.balanceDue);
      if (!invoice.selected && payment <= 0) return sum;
      return sum + payment;
    }, 0);

  const updateHeader = (field, value) => {
    setSuccessMessage("");
    setHeader((current) => ({ ...current, [field]: value }));
  };

  const changeSeries = (value) => {
    setSuccessMessage("");
    if (value === "Manual") {
      setHeader((current) => ({
        ...current,
        seriesCode: "Manual",
        seriesName: "Manual",
        documentNumber: "",
      }));
      return;
    }

    const selectedSeries = documentSeries.find((series) => series.code === value);
    setHeader((current) => ({
      ...current,
      seriesCode: selectedSeries?.code || value,
      seriesName: selectedSeries?.name || "",
      documentNumber: selectedSeries?.nextNumber || current.documentNumber,
    }));
  };

  const normalizeInvoices = (rows = []) =>
    rows.map((row) => ({ ...row, selected: false, cashDiscountPercent: "0.00" }));

  const changeBpType = (bpType) => {
    setLoadError("");
    setSuccessMessage("");
    setInvoices([]);
    setPaymentOnAccount(bpType === "Account");
    setPaymentOnAccountAmount("0.00");
    setHeader((current) => ({
      ...current,
      bpType,
      businessPartnerCode: "",
      businessPartnerName: "",
      billToCode: "",
      billToAddress: "",
      contactPerson: "",
      blanketAgreement: "",
      controlAccount: bpType === "Account" ? current.controlAccount : "",
    }));
    setJournalRemarks("");
  };

  const loadInvoices = async (cardCode, branch = header.branch) => {
    if (!cardCode) {
      setInvoices([]);
      return;
    }

    setLoading(true);
    setLoadError("");
    setSuccessMessage("");
    try {
      const rows = await fetchIncomingPaymentOpenInvoices(cardCode, branch);
      setInvoices(normalizeInvoices(rows || []));
      const firstControlAccount = rows?.find((row) => row.controlAccount)?.controlAccount || "";
      if (firstControlAccount) {
        setHeader((current) => ({
          ...current,
          controlAccount: current.controlAccount || firstControlAccount,
        }));
      }
    } catch (_error) {
      setLoadError("Open invoices could not be loaded for this business partner.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const changeBranch = (value) => {
    setSuccessMessage("");
    setHeader((current) => ({
      ...current,
      branch: value,
      branchRegNo: getBranchRegNo(branches, value),
    }));
    if (header.bpType === "Customer" && header.businessPartnerCode) {
      loadInvoices(header.businessPartnerCode, value);
    } else {
      setInvoices([]);
    }
  };

  const handleBusinessPartnerSelect = (row) => {
    setLoadError("");
    setSuccessMessage("");
    setHeader((current) => ({
      ...current,
      businessPartnerCode: row.code,
      businessPartnerName: row.name,
      billToCode: row.billToCode || current.billToCode,
      billToAddress: row.billToAddress || "",
      contactPerson: row.contactPerson || "",
      controlAccount: row.controlAccount || current.controlAccount,
    }));
    setJournalRemarks(`Incoming Payments - ${row.code}`);
    if (header.bpType === "Customer") {
      loadInvoices(row.code);
    } else {
      setInvoices([]);
      setSuccessMessage(
        header.bpType === "Vendor"
          ? "Vendor selected. SAP B1 incoming payments for vendors are used for return/refund scenarios."
          : "Account selected. Enter Payment on Account and cash details before posting.",
      );
    }
  };

  const handleAccountSelect = (row) => {
    setLoadError("");
    setSuccessMessage("");
    setInvoices([]);
    setPaymentOnAccount(true);
    setHeader((current) => ({
      ...current,
      businessPartnerCode: row.code,
      businessPartnerName: row.name,
      controlAccount: row.code,
    }));
    setJournalRemarks(`Incoming Payments - ${row.code}`);
  };

  const toggleInvoice = (id, selected) => {
    setSuccessMessage("");
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === id
          ? {
              ...invoice,
              selected,
              cashDiscountPercent: selected ? normalizePercent(invoice.cashDiscountPercent).toFixed(2) : invoice.cashDiscountPercent,
              totalPayment: selected ? clampPayment(invoice.totalPayment, invoice.balanceDue).toFixed(2) : invoice.totalPayment,
            }
          : invoice,
      ),
    );
  };

  const changePayment = (id, value) => {
    setSuccessMessage("");
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === id
          ? {
              ...invoice,
              selected: parseAmount(value) > 0 ? true : invoice.selected,
              totalPayment: value,
            }
          : invoice,
      ),
    );
  };

  const settlePayment = (id) => {
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === id
          ? {
              ...invoice,
              totalPayment: clampPayment(invoice.totalPayment, invoice.balanceDue).toFixed(2),
            }
          : invoice,
      ),
    );
  };

  const changeCashDiscount = (id, value) => {
    setSuccessMessage("");
    setInvoices((current) =>
      current.map((invoice) => {
        if (invoice.id !== id) return invoice;
        const percent = normalizePercent(value);
        const discountedBalance = Number(invoice.balanceDue || 0) * (1 - percent / 100);
        return {
          ...invoice,
          cashDiscountPercent: value,
          totalPayment: invoice.selected ? discountedBalance.toFixed(2) : invoice.totalPayment,
        };
      }),
    );
  };

  const settleCashDiscount = (id) => {
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === id
          ? {
              ...invoice,
              cashDiscountPercent: normalizePercent(invoice.cashDiscountPercent).toFixed(2),
            }
          : invoice,
      ),
    );
  };

  const openInvoiceDocument = (invoice) => {
    if (!invoice?.documentNo) return;
    setSuccessMessage(`A/R Invoice ${invoice.documentNo} selected for reference.`);
  };

  const selectAll = () => {
    setSuccessMessage("");
    setInvoices((current) =>
      current.map((invoice) => ({
        ...invoice,
        selected: true,
        cashDiscountPercent: normalizePercent(invoice.cashDiscountPercent).toFixed(2),
        totalPayment: clampPayment(invoice.totalPayment || invoice.balanceDue, invoice.balanceDue).toFixed(2),
      })),
    );
  };

  const deselectAll = () => {
    setSuccessMessage("");
    setInvoices((current) => current.map((invoice) => ({ ...invoice, selected: false })));
  };

  const openBusinessPartnerLookup = ({ clearMessages = true } = {}) => {
    if (clearMessages) {
      setLoadError("");
      setSuccessMessage("");
    }
    setBpLookupTrigger((value) => value + 1);
  };

  const openFind = () => {
    setLoadError("");
    setSuccessMessage("");
    setDocumentFindTrigger((value) => value + 1);
  };

  const handleIncomingPaymentSelect = (row) => {
    setLoadError("");
    setSuccessMessage("");
    const selectedBranch = row.branch || header.branch;
    setHeader((current) => ({
      ...current,
      businessPartnerCode: row.businessPartnerCode || "",
      businessPartnerName: row.businessPartnerName || "",
      billToAddress: row.billToAddress || "",
      postingDate: row.postingDate || current.postingDate,
      dueDate: row.dueDate || row.postingDate || current.dueDate,
      documentDate: row.documentDate || current.documentDate,
      referenceNumber: row.referenceNumber || "",
      transactionNumber: row.transactionNumber || current.transactionNumber,
      documentNumber: row.documentNo || row.code || current.documentNumber,
      branch: selectedBranch || current.branch,
      branchRegNo: getBranchRegNo(branches, selectedBranch || current.branch),
    }));
    setJournalRemarks(row.journalRemarks || `Incoming Payments - ${row.businessPartnerCode || row.code}`);
    setPaymentOnAccount(Number(row.paymentOnAccountAmount || 0) > 0);
    setPaymentOnAccountAmount(money(row.paymentOnAccountAmount));
    setSuccessMessage(`Incoming payment ${row.documentNo || row.code} loaded.`);
    loadInvoices(row.businessPartnerCode, selectedBranch);
  };

  const resetForm = () => {
    const selectedSeries =
      documentSeries.find((series) => series.code === header.seriesCode) ||
      documentSeries.find((series) => series.isDefault) ||
      documentSeries[0] ||
      {};
    setHeader((current) => createInitialHeader(current.branch, current.transactionNumber, selectedSeries));
    setInvoices([]);
    setPaymentOnAccount(false);
    setPaymentOnAccountAmount("0.00");
    setWtTaxAmount("");
    setRemarks("");
    setJournalRemarks("");
    setLoadError("");
    setSuccessMessage("");
  };

  const addInSequence = () => {
    setSuccessMessage("");
    setInvoices((current) => {
      const nextIndex = current.findIndex((invoice) => !invoice.selected && !invoice.blocked);
      if (nextIndex < 0) return current;

      return current.map((invoice, index) =>
        index === nextIndex
          ? {
              ...invoice,
              selected: true,
              totalPayment: clampPayment(invoice.totalPayment || invoice.balanceDue, invoice.balanceDue).toFixed(2),
            }
          : invoice,
      );
    });
  };

  const getErrorMessage = (error, fallback) => {
    const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.message;
    if (typeof detail === "string") return detail;
    if (detail?.error?.message?.value) return detail.error.message.value;
    if (detail?.error?.message) return detail.error.message;
    return fallback;
  };

  const handleOk = async () => {
    setLoadError("");
    setSuccessMessage("");

    if (!header.businessPartnerCode) {
      setLoadError("Select a business partner before adding the incoming payment.");
      openBusinessPartnerLookup({ clearMessages: false });
      return;
    }

    const payableInvoiceTotal = getPayableInvoiceTotal();
    const payableTotal = payableInvoiceTotal + (paymentOnAccount ? parseAmount(paymentOnAccountAmount) : 0);

    if (payableTotal <= 0) {
      setLoadError("Select at least one document or enter a Payment on Account amount.");
      return;
    }

    const invalidPayment = invoices.some(
      (invoice) => invoice.selected && clampPayment(invoice.totalPayment, invoice.balanceDue) <= 0,
    );

    if (invalidPayment) {
      setLoadError("Selected documents must have a Total Payment amount greater than zero.");
      return;
    }

    const payableInvoices = invoices
      .map((invoice) => {
        const payment = clampPayment(invoice.totalPayment, invoice.balanceDue);
        return payment > 0
          ? {
              ...invoice,
              selected: true,
              cashDiscountPercent: normalizePercent(invoice.cashDiscountPercent).toFixed(2),
              totalPayment: payment.toFixed(2),
            }
          : invoice;
      })
      .filter((invoice) => invoice.selected && clampPayment(invoice.totalPayment, invoice.balanceDue) > 0);

    setInvoices((current) =>
      current.map((invoice) => {
        const match = payableInvoices.find((item) => item.id === invoice.id);
        return match || invoice;
      }),
    );

    const payload = {
      header,
      invoices: payableInvoices,
      paymentOnAccount: {
        enabled: paymentOnAccount,
        amount: paymentOnAccountAmount,
      },
      wtTaxAmount,
      remarks,
      journalRemarks,
    };

    setPosting(true);
    try {
      const response = await submitIncomingPayment(payload);
      const docNo = response?.doc_num || response?.DocNum;
      setSuccessMessage(
        docNo
          ? `Incoming payment posted to SAP. Doc No: ${docNo}.`
          : "Incoming payment posted to SAP.",
      );
    } catch (error) {
      setLoadError(getErrorMessage(error, "Incoming payment submission failed."));
    } finally {
      setPosting(false);
    }
  };

  const branchName = branches.find((branch) => branch.code === header.branch)?.name || "";
  const isCustomer = header.bpType === "Customer";
  const isVendor = header.bpType === "Vendor";
  const isAccount = header.bpType === "Account";
  const partnerLookupTitle = isVendor ? "Vendors" : isAccount ? "G/L Accounts" : "Business Partners";
  const partnerAddressLabel = isVendor ? "Pay To" : "Bill To";

  return (
    <div className="po-page ip-payments-page">
      <div className="po-toolbar">
        <span className="po-toolbar__title">Incoming Payments</span>
        <button type="button" className="po-btn" onClick={openFind}>Find</button>
        <button type="button" className="po-btn po-btn--primary" onClick={handleOk} disabled={posting}>
          {posting ? "Posting..." : "OK"}
        </button>
        <button type="button" className="po-btn" onClick={resetForm} disabled={posting}>Cancel</button>
        <button type="button" className="po-btn" onClick={deselectAll} disabled={posting}>Deselect All</button>
        <button type="button" className="po-btn" onClick={selectAll} disabled={posting}>Select All</button>
        <button type="button" className="po-btn" onClick={addInSequence} disabled={posting}>Add in Sequence</button>
      </div>
      <span className="sap-hidden-lookup">
        <SapLookupField
          value=""
          onChange={() => {}}
          onSelect={handleIncomingPaymentSelect}
          fetchOptions={searchIncomingPayments}
          title="Incoming Payments"
          columns={[
            { label: "Document No.", key: "documentNo" },
            { label: "BP Code", key: "businessPartnerCode" },
            { label: "BP Name", key: "businessPartnerName" },
            { label: "Posting Date", key: "postingDate" },
            { label: "Total", key: "totalAmount" },
          ]}
          triggerOpen={documentFindTrigger}
        />
      </span>
      {loadError ? <div className="sap-alert sap-alert--top">{loadError}</div> : null}
      {successMessage ? <div className="sap-alert sap-alert--success sap-alert--top">{successMessage}</div> : null}

      <div className="sap-window">
        <div className="sap-header-area">
          <div className="sap-header-left">
            <div className="sap-bp-row">
              <div>
                <FieldRow label="Code">
                  <SapLookupField
                    value={header.businessPartnerCode}
                    onChange={(value) => updateHeader("businessPartnerCode", value)}
                    onSelect={isAccount ? handleAccountSelect : handleBusinessPartnerSelect}
                    fetchOptions={(query) =>
                      isAccount
                        ? searchIncomingPaymentControlAccounts(query)
                        : searchIncomingPaymentBusinessPartners(query, header.bpType)
                    }
                    title={partnerLookupTitle}
                    columns={isAccount
                      ? [{ label: "Code", key: "code" }, { label: "Name", key: "name" }]
                      : [
                          { label: "Code", key: "code" },
                          { label: "Name", key: "name" },
                          { label: "Currency", key: "currency" },
                        ]}
                    triggerOpen={bpLookupTrigger}
                  />
                </FieldRow>
                <FieldRow label="Name">
                  <input value={header.businessPartnerName} onChange={(event) => updateHeader("businessPartnerName", event.target.value)} />
                </FieldRow>
                {!isAccount ? (
                  <FieldRow label={partnerAddressLabel}>
                    <div className="sap-bill-to">
                      <select value={header.billToCode} onChange={(event) => updateHeader("billToCode", event.target.value)}>
                        <option value={header.billToCode}>{header.billToCode || partnerAddressLabel}</option>
                      </select>
                      <textarea value={header.billToAddress} onChange={(event) => updateHeader("billToAddress", event.target.value)} />
                    </div>
                  </FieldRow>
                ) : null}
              </div>

              <div className="sap-radio-stack">
                {["Customer", "Vendor", "Account"].map((type) => (
                  <label key={type}>
                    <input
                      type="radio"
                      name="ip-bp-type"
                      checked={header.bpType === type}
                      onChange={() => changeBpType(type)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {!isAccount ? (
              <FieldRow label="Contact Person">
                <input value={header.contactPerson} onChange={(event) => updateHeader("contactPerson", event.target.value)} />
              </FieldRow>
            ) : null}
            <FieldRow label="Project">
              <SapLookupField
                value={header.project}
                onChange={(value) => updateHeader("project", value)}
                onSelect={(row) => updateHeader("project", row.code)}
                fetchOptions={async () => []}
                title="Projects"
                columns={[{ label: "Code", key: "code" }, { label: "Name", key: "name" }]}
              />
            </FieldRow>
            {isCustomer ? (
              <FieldRow label="Blanket Agreement">
                <input value={header.blanketAgreement} onChange={(event) => updateHeader("blanketAgreement", event.target.value)} />
              </FieldRow>
            ) : null}
          </div>

          <div className="sap-header-right">
            <FieldRow label="No.">
              <div className="sap-dual">
                <select value={header.seriesCode || ""} onChange={(event) => changeSeries(event.target.value)}>
                  {!documentSeries.length ? <option value="">Series</option> : null}
                  {documentSeries.map((series) => (
                    <option key={series.code} value={series.code}>{series.name}</option>
                  ))}
                  <option value="Manual">Manual</option>
                </select>
                <input
                  value={header.documentNumber}
                  readOnly={header.seriesCode !== "Manual"}
                  onChange={(event) => updateHeader("documentNumber", event.target.value)}
                />
              </div>
            </FieldRow>
            <FieldRow label="Posting Date">
              <input value={formatSapDate(header.postingDate)} onChange={(event) => updateHeader("postingDate", event.target.value)} />
            </FieldRow>
            <FieldRow label="Due Date">
              <input value={formatSapDate(header.dueDate)} onChange={(event) => updateHeader("dueDate", event.target.value)} />
            </FieldRow>
            <FieldRow label="Document Date">
              <input value={formatSapDate(header.documentDate)} onChange={(event) => updateHeader("documentDate", event.target.value)} />
            </FieldRow>
            <FieldRow label="Reference">
              <input value={header.referenceNumber} onChange={(event) => updateHeader("referenceNumber", event.target.value)} />
            </FieldRow>
            <FieldRow label="Transaction No.">
              <SapLookupField
                value={header.transactionNumber}
                onChange={(value) => updateHeader("transactionNumber", value)}
                onSelect={(row) => updateHeader("transactionNumber", row.code)}
                fetchOptions={async () => [{ code: header.transactionNumber || "2562", name: "Current Transaction" }]}
                title="Transactions"
                columns={[{ label: "No.", key: "code" }, { label: "Description", key: "name" }]}
              />
            </FieldRow>
            <FieldRow label="WTax Code">
              <input value={header.wtTaxCode} onChange={(event) => updateHeader("wtTaxCode", event.target.value)} />
            </FieldRow>
            <FieldRow label="WTax Base Sum">
              <input value={header.wtTaxBaseSum} onChange={(event) => updateHeader("wtTaxBaseSum", event.target.value)} />
            </FieldRow>
          </div>
        </div>

        <div className="sap-mid-row">
          <FieldRow label="Branch">
            <select value={header.branch} onChange={(event) => changeBranch(event.target.value)}>
              <option value="">Branch</option>
              {branches.map((branch) => (
                <option key={branch.code} value={branch.code}>{branch.code} - {branch.name}</option>
              ))}
            </select>
          </FieldRow>
          <div className="sap-branch-right">
            <FieldRow label="Branch Reg. No.">
              <input value={header.branchRegNo} onChange={(event) => updateHeader("branchRegNo", event.target.value)} />
            </FieldRow>
            <FieldRow label="Referenced Document">
              <SapLookupField
                value={header.referencedDocument}
                onChange={(value) => updateHeader("referencedDocument", value)}
                onSelect={(row) => updateHeader("referencedDocument", row.code)}
                fetchOptions={async () => []}
                title="Referenced Documents"
                columns={[{ label: "Document", key: "code" }, { label: "Name", key: "name" }]}
              />
            </FieldRow>
          </div>
        </div>

        <div className="sap-tabs">
          <button type="button" className="is-active">Contents</button>
          <button type="button">Attachments</button>
        </div>

        <section className="sap-grid-wrap">
          <table className="sap-grid">
            <thead>
              <tr>
                <th>Selected</th>
                <th>Document No.</th>
                <th>Installment</th>
                <th>Document Type</th>
                <th>Date</th>
                <th>*</th>
                <th>Total</th>
                <th>WTax Amount</th>
                <th>Balance Due</th>
                <th>Cash Discount %</th>
                <th>Total Rounding Amount</th>
                <th>Total Payment</th>
                <th>Distr. Rule</th>
                <th>Overdue Days</th>
                <th>Blocked</th>
                <th>Payment Order Run</th>
                <th>Branch</th>
                <th>Blanket Agreement</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="18" className="sap-empty">Loading open invoices...</td></tr>
              ) : invoices.length ? (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className={invoice.selected ? "is-selected" : ""}>
                    <td className="sap-cell--editable"><input type="checkbox" checked={Boolean(invoice.selected)} onChange={(event) => toggleInvoice(invoice.id, event.target.checked)} /></td>
                    <td className="sap-cell--readonly">
                      <button type="button" className="sap-doc-arrow" onClick={() => openInvoiceDocument(invoice)}>→</button>
                      <span className="sap-link-cell">{invoice.documentNo}</span>
                    </td>
                    <td className="sap-cell--readonly">{invoice.installment || "1 of 1"}</td>
                    <td className="sap-cell--readonly">{invoice.documentType === "A/R Invoice" ? "IN" : invoice.documentType}</td>
                    <td className="sap-cell--readonly">{formatSapDate(invoice.date)}</td>
                    <td className="sap-cell--readonly">*</td>
                    <td className="sap-money sap-cell--readonly">{money(invoice.total)}</td>
                    <td className="sap-money sap-cell--readonly">0.00</td>
                    <td className="sap-money sap-cell--readonly">{money(invoice.balanceDue)}</td>
                    <td className="sap-cell--editable">
                      <input
                        className="sap-cell-input"
                        value={invoice.cashDiscountPercent ?? "0.00"}
                        onChange={(event) => changeCashDiscount(invoice.id, event.target.value)}
                        onBlur={() => settleCashDiscount(invoice.id)}
                      />
                    </td>
                    <td className="sap-money sap-cell--readonly"></td>
                    <td>
                      <input
                        className="sap-cell-input"
                        value={invoice.totalPayment ?? ""}
                        onChange={(event) => changePayment(invoice.id, event.target.value)}
                        onBlur={() => settlePayment(invoice.id)}
                      />
                    </td>
                    <td className="sap-cell--readonly">{invoice.distributionRule}</td>
                    <td className="sap-cell--readonly">{invoice.overdueDays}</td>
                    <td className="sap-cell--editable"><input type="checkbox" /></td>
                    <td className="sap-cell--readonly"><input type="checkbox" checked={Boolean(invoice.paymentOrderRun)} readOnly /></td>
                    <td className="sap-cell--readonly">{invoice.branchDisplay || (invoice.branch ? `${invoice.branch} - ${invoice.branchName || branchName}` : "")}</td>
                    <td className="sap-cell--readonly">{header.blanketAgreement}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="18" className="sap-empty">
                    {isAccount
                      ? "Account payment mode does not display BP invoices. Use Payment on Account."
                      : isVendor
                        ? "Vendor mode does not display customer A/R invoices."
                        : header.businessPartnerCode
                          ? `No open invoices found${header.branch ? ` for branch ${header.branch} - ${branchName}` : ""}.`
                          : "Choose a customer to display invoices."}
                  </td>
                </tr>
              )}
              {Array.from({ length: Math.max(8, 14 - invoices.length) }).map((_, index) => (
                <tr key={`blank-${index}`} className="sap-blank-row">
                  {Array.from({ length: 18 }).map((__, colIndex) => <td key={colIndex}></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="sap-payment-row">
          <div className="sap-payment-on-account">
            <label>
              <input type="checkbox" checked={paymentOnAccount} onChange={(event) => setPaymentOnAccount(event.target.checked)} />
              <span>Payment on Account</span>
            </label>
            <input
              value={paymentOnAccountAmount}
              disabled={!paymentOnAccount}
              onChange={(event) => setPaymentOnAccountAmount(event.target.value)}
              onBlur={() => setPaymentOnAccountAmount(money(parseAmount(paymentOnAccountAmount)))}
            />
          </div>
        </div>

        <div className="sap-footer-area">
          <div className="sap-footer-left">
            <FieldRow label="Remarks">
              <input className="sap-yellow" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            </FieldRow>
            <FieldRow label="Journal Remarks">
              <input value={journalRemarks} onChange={(event) => setJournalRemarks(event.target.value)} />
            </FieldRow>
            {paymentOnAccount ? (
              <FieldRow label="Control Account">
                <SapLookupField
                  value={header.controlAccount}
                  onChange={(value) => updateHeader("controlAccount", value)}
                  onSelect={(row) =>
                    setHeader((current) => ({ ...current, controlAccount: row.code, controlAccountName: row.name }))
                  }
                  fetchOptions={searchIncomingPaymentControlAccounts}
                  title="G/L Accounts"
                  columns={[{ label: "Code", key: "code" }, { label: "Name", key: "name" }]}
                />
              </FieldRow>
            ) : null}
            <label className="sap-created">
              <input type="checkbox" disabled />
              <span>Created by Payment Wizard</span>
            </label>
          </div>

          <div className="sap-summary">
            <FieldRow label="WTax Amount">
              <input value={wtTaxAmount} onChange={(event) => setWtTaxAmount(event.target.value)} onBlur={() => setWtTaxAmount(money(parseAmount(wtTaxAmount)))} />
            </FieldRow>
            <FieldRow label="Total Amount Due">
              <input value={`INR ${money(totalAmountDue)}`} readOnly />
            </FieldRow>
            <FieldRow label="Open Balance">
              <input value={openBalance ? `INR ${money(openBalance)}` : ""} readOnly />
            </FieldRow>
          </div>
        </div>
      </div>
    </div>
  );
}
