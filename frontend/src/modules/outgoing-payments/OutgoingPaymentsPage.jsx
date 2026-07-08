import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  fetchOutgoingPaymentByDocEntry,
  fetchOutgoingPaymentOpenInvoices,
  fetchOutgoingPaymentReferenceData,
  searchOutgoingPayments,
  searchOutgoingPaymentBusinessPartners,
  searchOutgoingPaymentCashAccounts,
  searchOutgoingPaymentControlAccounts,
  submitOutgoingPayment,
} from "../../api/outgoingPaymentsApi";
import { useRelationshipMapRegistration } from "../../components/relationship-map/RelationshipMapHost";
import PaymentMeansModal, {
  createDefaultPaymentMeans,
  paymentMeansTotal,
} from "../payments/PaymentMeansModal";
import "./outgoingPayments.css";

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
  return Math.min(amount, parseAmount(balanceDue));
};

const normalizePercent = (value) => {
  const parsed = Math.max(0, parseAmount(value));
  return Math.min(parsed, 100);
};

const calculateDiscountedPayment = (invoice, percentValue = invoice.cashDiscountPercent) => {
  const balanceDue = parseAmount(invoice.balanceDue);
  const percent = normalizePercent(percentValue);
  return clampPayment(balanceDue * (1 - percent / 100), balanceDue).toFixed(2);
};

const sapBusinessPartnerLookupColumns = [
  { label: "BP Name", key: "name", width: 300 },
  { label: "BP Code", key: "code", width: 100 },
  { label: "BP Balance", key: "balance", align: "right", width: 110, render: (row) => money(row.balance) },
  { label: "BP Type", key: "bpType", width: 95 },
  { label: "Active", key: "active", width: 70 },
  { label: "Inactive", key: "inactive", width: 80 },
  { label: "Bill-to Block", key: "billToBlock", width: 190 },
  { label: "Bill-to Building/Floor/Room", key: "billToBuilding", width: 260 },
  { label: "GTS Registration Number", key: "gstRegistrationNumber", width: 220 },
];

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
  onBlur = () => {},
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
        <input value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} readOnly={readOnly} />
        <button type="button" className="sap-lookup__arrow" onClick={openModal} disabled={readOnly}>
          {buttonLabel}
        </button>
      </span>

      {open ? createPortal(
        <div
          className="modal show d-block ip-lookup-modal-layer"
          tabIndex="-1"
          role="dialog"
          onMouseDown={(event) => {
            event.stopPropagation();
            setOpen(false);
          }}
        >
          <div className="modal-dialog modal-xl ip-lookup-dialog" role="document" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-content ip-lookup-content">
              <div className="modal-header ip-lookup-header">
                <h6 className="modal-title mb-0">List of {title}</h6>
                <div className="ip-lookup-window-controls" aria-label="Window controls">
                  <button type="button" className="ip-lookup-window-btn" aria-label="Minimize" disabled>-</button>
                  <button type="button" className="ip-lookup-window-btn" aria-label="Maximize" disabled>[]</button>
                  <button type="button" className="ip-lookup-window-btn ip-lookup-close" aria-label="Close" onClick={() => setOpen(false)}>x</button>
                </div>
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
                          <th
                            key={column.key}
                            className={column.align === "right" ? "ip-lookup-cell--right" : undefined}
                            style={column.width ? { minWidth: column.width } : undefined}
                          >
                            {column.label}
                          </th>
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
                              <td
                                key={column.key}
                                className={column.align === "right" ? "ip-lookup-cell--right" : undefined}
                                style={column.width ? { minWidth: column.width } : undefined}
                              >
                                {column.render ? column.render(row) : row[column.key]}
                              </td>
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

const normalizeDistributionRules = (rows = []) =>
  (rows || [])
    .map((rule) => ({
      code: String(rule.code ?? rule.FactorCode ?? rule.OcrCode ?? rule.DistributionRule ?? "").trim(),
      name: String(rule.name ?? rule.FactorDescription ?? rule.OcrName ?? rule.Description ?? "").trim(),
    }))
    .filter((rule) => rule.code);

const normalizeLocations = (rows = []) =>
  (rows || [])
    .map((location) => ({
      code: String(location.code ?? location.Code ?? location.LocationCode ?? "").trim(),
      name: String(location.name ?? location.Location ?? location.Name ?? "").trim(),
    }))
    .filter((location) => location.code);

export default function OutgoingPaymentsPage() {
  const location = useLocation();
  const requestedDocEntry = Number(location.state?.outgoingPaymentDocEntry || 0);
  const createInitialHeader = (branch = "", transactionNumber = "", series = {}) => ({
    businessPartnerCode: "",
    businessPartnerName: "",
    bpType: "Vendor",
    seriesCode: series.code || "",
    seriesName: series.name || "",
    documentNumber: series.nextNumber || "",
    billToCode: "",
    billToAddress: "",
    contactPerson: "",
    project: "",
    docCurrency: "INR",
    toOrderOf: "",
    payToText: "",
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
    bpType: "Vendor",
    seriesCode: "",
    seriesName: "",
    documentNumber: "",
    billToCode: "",
    billToAddress: "",
    contactPerson: "",
    project: "",
    docCurrency: "INR",
    toOrderOf: "",
    payToText: "",
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
  const [accountRows, setAccountRows] = useState([]);
  const [distributionRules, setDistributionRules] = useState([]);
  const [locations, setLocations] = useState([]);
  const [currentDocEntry, setCurrentDocEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [paymentOnAccount, setPaymentOnAccount] = useState(false);
  const [displayMatchingBillingAddress, setDisplayMatchingBillingAddress] = useState(false);
  const [paymentOnAccountAmount, setPaymentOnAccountAmount] = useState("0.00");
  const [accountDistributionRule, setAccountDistributionRule] = useState("");
  const [accountLocation, setAccountLocation] = useState("");
  const [wtTaxAmount, setWtTaxAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [journalRemarks, setJournalRemarks] = useState("");
  const [bpLookupTrigger, setBpLookupTrigger] = useState(0);
  const [documentFindTrigger, setDocumentFindTrigger] = useState(0);
  const [paymentMeansOpen, setPaymentMeansOpen] = useState(false);
  const [paymentMeans, setPaymentMeans] = useState(() => createDefaultPaymentMeans());
  const routedDocumentRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    fetchOutgoingPaymentReferenceData()
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
        setDistributionRules(normalizeDistributionRules(data.distributionRules || data.distribution_rules || []));
        setLocations(normalizeLocations(data.locations || []));
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
          };
        });
        setPaymentMeans((current) => ({
          ...current,
          currency: current.currency || "INR",
        }));
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

  const accountRowsTotal = useMemo(
    () => accountRows.reduce((sum, row) => sum + parseAmount(row.amount), 0),
    [accountRows],
  );
  const isFoundDocument = Boolean(currentDocEntry);
  const paymentOnAccountDue = header.bpType === "Account" || paymentOnAccount ? parseAmount(paymentOnAccountAmount) : 0;
  const totalAmountDue = accountRows.length
    ? accountRowsTotal
    : selectedTotal + paymentOnAccountDue;
  const openBalance = Math.max(0, paymentOnAccountDue);
  useRelationshipMapRegistration({
    enabled: Boolean(currentDocEntry),
    objectType: 46,
    docEntry: currentDocEntry,
    header,
    total: totalAmountDue,
  });

  const getPayableInvoiceTotal = (rows = invoices) =>
    rows.reduce((sum, invoice) => {
      const payment = clampPayment(invoice.totalPayment, invoice.balanceDue);
      if (!invoice.selected && payment <= 0) return sum;
      return sum + payment;
    }, 0);

  const updateHeader = (field, value) => {
    if (isFoundDocument) return;
    setSuccessMessage("");
    setHeader((current) => ({ ...current, [field]: value }));
  };

  const changeSeries = (value) => {
    if (isFoundDocument) return;
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
    if (isFoundDocument) return;
    setLoadError("");
    setSuccessMessage("");
    setInvoices([]);
    setAccountRows([]);
    setPaymentOnAccount(bpType === "Account");
    setPaymentOnAccountAmount("0.00");
    setPaymentMeans(createDefaultPaymentMeans({ currency: header.docCurrency || "INR" }));
    setAccountDistributionRule("");
    setAccountLocation("");
    setHeader((current) => ({
      ...current,
      bpType,
      businessPartnerCode: "",
      businessPartnerName: "",
      billToCode: "",
      billToAddress: "",
      contactPerson: "",
      blanketAgreement: "",
      docCurrency: current.docCurrency || "INR",
      toOrderOf: bpType === "Account" ? current.toOrderOf : "",
      payToText: bpType === "Account" ? current.payToText : "",
      controlAccount: "",
      controlAccountName: "",
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
      const rows = await fetchOutgoingPaymentOpenInvoices(cardCode, branch);
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
    if (isFoundDocument) return;
    setSuccessMessage("");
    setHeader((current) => ({
      ...current,
      branch: value,
      branchRegNo: getBranchRegNo(branches, value),
    }));
    if (header.bpType === "Vendor" && header.businessPartnerCode) {
      loadInvoices(header.businessPartnerCode, value);
    } else {
      setInvoices([]);
    }
  };

  const handleBusinessPartnerSelect = (row) => {
    if (isFoundDocument) return;
    setLoadError("");
    setSuccessMessage("");
    setHeader((current) => ({
      ...current,
      businessPartnerCode: row.code,
      businessPartnerName: row.name,
      billToCode: row.payToCode || current.billToCode,
      billToAddress: row.payToAddress || "",
      contactPerson: row.contactPerson || "",
      controlAccount: row.controlAccount || current.controlAccount,
    }));
    setJournalRemarks(`Outgoing Payments - ${row.code}`);
    if (header.bpType === "Vendor") {
      loadInvoices(row.code);
    } else {
      setInvoices([]);
      setSuccessMessage(
        header.bpType === "Customer"
          ? "Customer selected. SAP B1 outgoing payments for customers are used for return/refund scenarios."
          : "Account selected. Enter Payment on Account and cash details before posting.",
      );
    }
  };

  const handleAccountSelect = (row) => {
    if (isFoundDocument) return;
    setLoadError("");
    setSuccessMessage("");
    setInvoices([]);
    setPaymentOnAccount(true);
    setAccountDistributionRule("");
    setAccountLocation("");
    setHeader((current) => ({
      ...current,
      businessPartnerCode: row.code,
      businessPartnerName: row.name,
      controlAccount: row.code,
    }));
    setJournalRemarks(`Outgoing Payments - ${row.code}`);
  };

  const clearAccountSelection = () => {
    setHeader((current) => ({
      ...current,
      businessPartnerCode: "",
      businessPartnerName: "",
      controlAccount: "",
      controlAccountName: "",
    }));
  };

  const resolveAccountCode = async (value) => {
    if (isFoundDocument) return null;
    const accountCode = String(value || "").trim();
    if (!accountCode) {
      clearAccountSelection();
      return null;
    }

    try {
      const rows = await searchOutgoingPaymentControlAccounts(accountCode);
      const match = (rows || []).find((row) => String(row.code || "").trim().toUpperCase() === accountCode.toUpperCase());
      if (!match) {
        clearAccountSelection();
        setLoadError(`G/L Account ${accountCode} is not a posting account. Choose a posting G/L account from the lookup, same as SAP B1.`);
        return null;
      }

      setLoadError("");
      setSuccessMessage("");
      setInvoices([]);
      setPaymentOnAccount(true);
      setHeader((current) => ({
        ...current,
        businessPartnerCode: match.code,
        businessPartnerName: match.name,
        controlAccount: match.code,
        controlAccountName: match.name,
      }));
      setJournalRemarks(`Outgoing Payments - ${match.code}`);
      return match;
    } catch (_error) {
      clearAccountSelection();
      setLoadError(`G/L Account ${accountCode} could not be validated. Choose a posting G/L account from the lookup.`);
      return null;
    }
  };

  const toggleInvoice = (id, selected) => {
    if (isFoundDocument) return;
    setSuccessMessage("");
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === id
          ? {
              ...invoice,
              selected,
              cashDiscountPercent: selected ? normalizePercent(invoice.cashDiscountPercent).toFixed(2) : invoice.cashDiscountPercent,
              totalPayment: selected ? calculateDiscountedPayment(invoice) : invoice.totalPayment,
            }
          : invoice,
      ),
    );
  };

  const changePayment = (id, value) => {
    if (isFoundDocument) return;
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
    if (isFoundDocument) return;
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
    if (isFoundDocument) return;
    setSuccessMessage("");
    setInvoices((current) =>
      current.map((invoice) => {
        if (invoice.id !== id) return invoice;
        const percent = normalizePercent(value);
        return {
          ...invoice,
          selected: true,
          cashDiscountPercent: value,
          totalPayment: calculateDiscountedPayment(invoice, percent),
        };
      }),
    );
  };

  const settleCashDiscount = (id) => {
    if (isFoundDocument) return;
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === id
          ? {
              ...invoice,
              cashDiscountPercent: normalizePercent(invoice.cashDiscountPercent).toFixed(2),
              totalPayment: invoice.selected ? calculateDiscountedPayment(invoice) : invoice.totalPayment,
            }
          : invoice,
      ),
    );
  };

  const changeDistributionRule = (id, value) => {
    if (isFoundDocument) return;
    setSuccessMessage("");
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === id
          ? {
              ...invoice,
              distributionRule: value,
            }
          : invoice,
      ),
    );
  };

  const openInvoiceDocument = (invoice) => {
    if (!invoice?.documentNo) return;
    setSuccessMessage(`A/P Invoice ${invoice.documentNo} selected for reference.`);
  };

  const selectAll = () => {
    if (isFoundDocument) return;
    setSuccessMessage("");
    setInvoices((current) =>
      current.map((invoice) => ({
        ...invoice,
        selected: true,
        cashDiscountPercent: normalizePercent(invoice.cashDiscountPercent).toFixed(2),
        totalPayment: calculateDiscountedPayment(invoice),
      })),
    );
  };

  const deselectAll = () => {
    if (isFoundDocument) return;
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

  const handleOutgoingPaymentSelect = async (row) => {
    setLoadError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      const payment = row.docEntry ? await fetchOutgoingPaymentByDocEntry(row.docEntry) : row;
      const selectedBranch = payment.branch || header.branch;
      const postedAccountRows = payment.accountRows || [];
      setAccountDistributionRule(postedAccountRows[0]?.distributionRule || "");
      setAccountLocation(postedAccountRows[0]?.location || "");
      setHeader((current) => ({
        ...current,
        businessPartnerCode: payment.businessPartnerCode || "",
        businessPartnerName: payment.businessPartnerName || "",
        bpType: postedAccountRows.length ? "Account" : current.bpType,
        billToAddress: payment.payToAddress || "",
        postingDate: payment.postingDate || current.postingDate,
        dueDate: payment.dueDate || payment.postingDate || current.dueDate,
        documentDate: payment.documentDate || current.documentDate,
        referenceNumber: payment.referenceNumber || "",
        transactionNumber: payment.transactionNumber || current.transactionNumber,
        documentNumber: payment.documentNo || payment.code || current.documentNumber,
        branch: selectedBranch || current.branch,
        branchRegNo: getBranchRegNo(branches, selectedBranch || current.branch),
        controlAccount: postedAccountRows[0]?.accountCode || current.controlAccount,
        controlAccountName: postedAccountRows[0]?.accountName || current.controlAccountName,
        cashAccount: payment.cashAccount || current.cashAccount,
      }));
      const postedInvoices = (payment.invoices || []).map((invoice) => ({
        ...invoice,
        selected: true,
        cashDiscountPercent: invoice.cashDiscountPercent ?? "0.00",
        totalPayment: money(invoice.totalPayment),
      }));
      const postedAccountTotal = postedAccountRows.reduce((sum, account) => sum + parseAmount(account.amount), 0);
      setInvoices(postedInvoices);
      setAccountRows(postedAccountRows);
      setCurrentDocEntry(payment.docEntry || row.docEntry || null);
      setJournalRemarks(payment.journalRemarks || `Outgoing Payments - ${payment.businessPartnerCode || payment.code}`);
      setRemarks(payment.remarks || "");
      const hasPaymentOnAccount = postedAccountRows.length > 0 || Number(payment.paymentOnAccountAmount || 0) > 0;
      setPaymentOnAccount(hasPaymentOnAccount);
      setPaymentOnAccountAmount(money(hasPaymentOnAccount ? payment.paymentOnAccountAmount || postedAccountTotal || payment.totalAmount : 0));
      setSuccessMessage(`Outgoing payment ${payment.documentNo || payment.code} loaded in view mode.`);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Outgoing payment could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!requestedDocEntry || routedDocumentRef.current === requestedDocEntry) return;
    routedDocumentRef.current = requestedDocEntry;
    handleOutgoingPaymentSelect({ docEntry: requestedDocEntry });
  }, [requestedDocEntry]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    const selectedSeries =
      documentSeries.find((series) => series.code === header.seriesCode) ||
      documentSeries.find((series) => series.isDefault) ||
      documentSeries[0] ||
      {};
    setHeader((current) => createInitialHeader(current.branch, current.transactionNumber, selectedSeries));
    setInvoices([]);
    setAccountRows([]);
    setCurrentDocEntry(null);
    setPaymentOnAccount(false);
    setPaymentOnAccountAmount("0.00");
    setPaymentMeans(createDefaultPaymentMeans({ currency: header.docCurrency || "INR" }));
    setAccountDistributionRule("");
    setAccountLocation("");
    setWtTaxAmount("");
    setRemarks("");
    setJournalRemarks("");
    setLoadError("");
    setSuccessMessage("");
  };

  const clearDraftAfterPost = (message) => {
    const selectedSeries =
      documentSeries.find((series) => series.code === header.seriesCode) ||
      documentSeries.find((series) => series.isDefault) ||
      documentSeries[0] ||
      {};
    setHeader((current) => ({
      ...createInitialHeader(current.branch, current.transactionNumber, selectedSeries),
      bpType: current.bpType,
      seriesCode: current.seriesCode || selectedSeries.code || "",
      seriesName: current.seriesName || selectedSeries.name || "",
      branch: current.branch,
      branchRegNo: current.branchRegNo,
      cashAccount: current.cashAccount,
      cashAccountName: current.cashAccountName,
    }));
    setInvoices([]);
    setAccountRows([]);
    setCurrentDocEntry(null);
    setPaymentOnAccount(header.bpType === "Account");
    setPaymentOnAccountAmount("0.00");
    setAccountDistributionRule("");
    setAccountLocation("");
    setWtTaxAmount("");
    setRemarks("");
    setJournalRemarks("");
    setLoadError("");
    setSuccessMessage(message);
  };

  const addInSequence = () => {
    if (isFoundDocument) return;
    setSuccessMessage("");
    setInvoices((current) => {
      const nextIndex = current.findIndex((invoice) => !invoice.selected && !invoice.blocked);
      if (nextIndex < 0) return current;

      return current.map((invoice, index) =>
        index === nextIndex
          ? {
              ...invoice,
              selected: true,
              totalPayment: calculateDiscountedPayment(invoice),
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

  const openPaymentMeans = () => {
    if (isFoundDocument) return;
    setPaymentMeans((current) => {
      const paid = paymentMeansTotal(current);
      if (paid > 0) return current;
      return createDefaultPaymentMeans({
        currency: header.docCurrency || "INR",
        amount: totalAmountDue,
      });
    });
    setPaymentMeansOpen(true);
  };

  const getPostingPaymentMeans = (payableTotal) => {
    const paid = paymentMeansTotal(paymentMeans);
    const nextMeans = paid > 0
      ? paymentMeans
      : createDefaultPaymentMeans({
          currency: header.docCurrency || "INR",
          amount: payableTotal,
        });
    const nextPaid = paymentMeansTotal(nextMeans);

    if (Math.abs(nextPaid - payableTotal) > 0.01) {
      setLoadError("Payment Means paid amount must match Total Amount Due.");
      setPaymentMeans(nextMeans);
      setPaymentMeansOpen(true);
      return null;
    }

    setPaymentMeans(nextMeans);
    return nextMeans;
  };

  const handleOk = async () => {
    setLoadError("");
    setSuccessMessage("");

    if (isFoundDocument) {
      setLoadError("Found outgoing payments are display-only, like SAP B1.");
      return;
    }

    const isAccountPayment = header.bpType === "Account";

    if (!header.businessPartnerCode) {
      setLoadError(
        isAccountPayment
          ? "Select a G/L Account in the contents grid before adding the outgoing payment."
          : "Select a business partner before adding the outgoing payment.",
      );
      if (!isAccountPayment) openBusinessPartnerLookup({ clearMessages: false });
      return;
    }

    const resolvedAccount = isAccountPayment ? await resolveAccountCode(header.businessPartnerCode) : null;
    if (isAccountPayment && !resolvedAccount) return;
    const postingHeader = resolvedAccount
      ? {
          ...header,
          businessPartnerCode: resolvedAccount.code,
          businessPartnerName: resolvedAccount.name,
          controlAccount: resolvedAccount.code,
          controlAccountName: resolvedAccount.name,
        }
      : header;

    const payableInvoiceTotal = isAccountPayment ? 0 : getPayableInvoiceTotal();
    const accountPaymentAmount = parseAmount(paymentOnAccountAmount);
    const payableTotal = payableInvoiceTotal + (isAccountPayment || paymentOnAccount ? accountPaymentAmount : 0);

    if (payableTotal <= 0) {
      setLoadError(isAccountPayment ? "Enter an Amount in the account contents row before posting." : "Select at least one document or enter a Payment on Account amount.");
      return;
    }

    const postingPaymentMeans = getPostingPaymentMeans(payableTotal);
    if (!postingPaymentMeans) return;

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
      header: postingHeader,
      invoices: payableInvoices,
      paymentOnAccount: {
        enabled: isAccountPayment || paymentOnAccount,
        amount: paymentOnAccountAmount,
        remarks,
        distributionRule: accountDistributionRule,
        location: accountLocation,
      },
      wtTaxAmount,
      paymentMeans: postingPaymentMeans,
      remarks,
      journalRemarks,
    };

    setPosting(true);
    try {
      const response = await submitOutgoingPayment(payload);
      const docNo = response?.doc_num || response?.DocNum;
      clearDraftAfterPost(
        docNo
          ? `Outgoing payment posted to SAP. Doc No: ${docNo}.`
          : "Outgoing payment posted to SAP.",
      );
    } catch (error) {
      setLoadError(getErrorMessage(error, "Outgoing payment submission failed."));
    } finally {
      setPosting(false);
    }
  };

  const branchName = branches.find((branch) => branch.code === header.branch)?.name || "";
  const getRuleName = (code) => distributionRules.find((rule) => String(rule.code) === String(code))?.name || "";
  const getLocationName = (code) => locations.find((location) => String(location.code) === String(code))?.name || "";
  const findDistributionRules = async (query = "") => {
    const term = String(query || "").trim().toLowerCase();
    if (!term) return distributionRules;
    return distributionRules.filter((rule) =>
      `${rule.code} ${rule.name}`.toLowerCase().includes(term),
    );
  };
  const isCustomer = header.bpType === "Customer";
  const isVendor = header.bpType === "Vendor";
  const isAccount = header.bpType === "Account";
  const draftAccountRow = {
    id: "account-draft",
    accountCode: header.businessPartnerCode || header.controlAccount,
    accountName: header.businessPartnerName || header.controlAccountName,
    remarks,
    amount: paymentOnAccountAmount,
    distributionRule: accountDistributionRule,
    location: accountLocation,
    branch: header.branch,
    isDraft: true,
  };
  const displayAccountRows = accountRows.length
    ? accountRows
    : isAccount
      ? [draftAccountRow]
      : [];
  const showAccountContentGrid = isAccount;
  const partnerLookupTitle = isVendor ? "Vendors" : isAccount ? "G/L Accounts" : "Business Partners";
  const partnerAddressLabel = isVendor ? "Pay To" : "Bill To";

  return (
    <div className="po-page sap-document-page ip-payments-page">
      <div className="po-toolbar">
        <span className="po-toolbar__title">Outgoing Payments{isFoundDocument ? ` - #${header.documentNumber}` : ""}</span>
        <button type="button" className="po-btn" onClick={openFind}>Find</button>
        <button type="button" className="po-btn po-btn--primary" onClick={handleOk} disabled={posting || isFoundDocument}>
          {posting ? "Posting..." : "OK"}
        </button>
        <button type="button" className="po-btn" onClick={resetForm} disabled={posting}>Cancel</button>
        <button type="button" className="po-btn" onClick={deselectAll} disabled={posting || isFoundDocument}>Deselect All</button>
        <button type="button" className="po-btn" onClick={selectAll} disabled={posting || isFoundDocument}>Select All</button>
        <button type="button" className="po-btn" onClick={addInSequence} disabled={posting || isFoundDocument}>Add in Sequence</button>
      </div>
      <span className="sap-hidden-lookup">
        <SapLookupField
          value=""
          onChange={() => {}}
          onSelect={handleOutgoingPaymentSelect}
          fetchOptions={searchOutgoingPayments}
          title="Outgoing Payments"
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

      <fieldset className={`sap-window sap-readonly-fieldset${isFoundDocument ? " sap-window--readonly" : ""}`} disabled={isFoundDocument}>
        <div className="sap-header-area">
          <div className="sap-header-left">
            <div className="sap-bp-row">
              <div>
                {isAccount ? (
                  <>
                    <FieldRow label="To Order of">
                      <input value={header.toOrderOf} onChange={(event) => updateHeader("toOrderOf", event.target.value)} />
                    </FieldRow>
                    <FieldRow label="Pay To">
                      <textarea className="sap-account-pay-to" value={header.payToText} onChange={(event) => updateHeader("payToText", event.target.value)} />
                    </FieldRow>
                  </>
                ) : (
                  <>
                    <FieldRow label="Code">
                      <SapLookupField
                        value={header.businessPartnerCode}
                        onChange={(value) => updateHeader("businessPartnerCode", value)}
                        onSelect={handleBusinessPartnerSelect}
                        fetchOptions={(query) => searchOutgoingPaymentBusinessPartners(query, header.bpType)}
                        title={partnerLookupTitle}
                        columns={sapBusinessPartnerLookupColumns}
                        triggerOpen={bpLookupTrigger}
                      />
                    </FieldRow>
                    <FieldRow label="Name">
                      <input value={header.businessPartnerName} onChange={(event) => updateHeader("businessPartnerName", event.target.value)} />
                    </FieldRow>
                  <FieldRow label={partnerAddressLabel}>
                    <div className="sap-bill-to">
                      <select value={header.billToCode} onChange={(event) => updateHeader("billToCode", event.target.value)}>
                        <option value={header.billToCode}>{header.billToCode || partnerAddressLabel}</option>
                      </select>
                      <textarea value={header.billToAddress} onChange={(event) => updateHeader("billToAddress", event.target.value)} />
                    </div>
                  </FieldRow>
                  </>
                )}
              </div>

              <div className="sap-radio-stack">
                {["Vendor", "Customer", "Account"].map((type) => (
                  <label key={type}>
                    <input
                      type="radio"
                      name="op-bp-type"
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
            {isAccount ? (
              <FieldRow label="Doc. Currency">
                <select value={header.docCurrency} onChange={(event) => updateHeader("docCurrency", event.target.value)}>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </FieldRow>
            ) : null}
            {isVendor ? (
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
          <div className="sap-mid-left">
            <label className="sap-match-address">
              <input
                type="checkbox"
                checked={displayMatchingBillingAddress}
                onChange={(event) => setDisplayMatchingBillingAddress(event.target.checked)}
              />
              <span>Display Invoices with matching Billing Address</span>
            </label>
            <FieldRow label="Branch">
              <select value={header.branch} onChange={(event) => changeBranch(event.target.value)}>
                <option value="">Branch</option>
                {branches.map((branch) => (
                  <option key={branch.code} value={branch.code}>{branch.code} - {branch.name}</option>
                ))}
              </select>
            </FieldRow>
          </div>
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

        <section className={`sap-grid-wrap${showAccountContentGrid ? " sap-grid-wrap--account" : ""}`}>
          {showAccountContentGrid ? (
            <table className="sap-grid sap-account-grid">
              <thead>
                <tr>
                  <th>#</th>
                  <th>G/L Account</th>
                  <th>Account Name</th>
                  <th>Doc. Remarks</th>
                  <th>Amount</th>
                  <th>Distr. Rule</th>
                  <th>Loc.</th>
                </tr>
              </thead>
              <tbody>
                {displayAccountRows.map((row, index) => {
                  const isDraftRow = row.isDraft && !isFoundDocument;
                  return (
                    <tr key={row.id || `${row.accountCode}-${index}`}>
                      <td className="sap-cell--readonly">{index + 1}</td>
                      <td className={isDraftRow ? "sap-cell--editable" : "sap-cell--readonly"}>
                        {isDraftRow ? (
                          <SapLookupField
                            value={row.accountCode}
                            onChange={(value) =>
                              setHeader((current) => ({
                                ...current,
                                businessPartnerCode: value,
                                controlAccount: value,
                                businessPartnerName: "",
                                controlAccountName: "",
                              }))
                            }
                            onBlur={() => resolveAccountCode(row.accountCode)}
                            onSelect={handleAccountSelect}
                            fetchOptions={searchOutgoingPaymentControlAccounts}
                            title="G/L Accounts"
                            columns={[{ label: "Code", key: "code" }, { label: "Name", key: "name" }]}
                          />
                        ) : (
                          <span className="sap-link-cell">{row.accountCode}</span>
                        )}
                      </td>
                      <td className="sap-cell--readonly">{row.accountName}</td>
                      <td className={isDraftRow ? "sap-cell--editable" : "sap-cell--readonly"}>
                        {isDraftRow ? (
                          <input className="sap-account-text-input" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                        ) : row.remarks}
                      </td>
                      <td className={isDraftRow ? "sap-money sap-cell--editable" : "sap-money sap-cell--readonly"}>
                        {isDraftRow ? (
                          <input
                            className="sap-cell-input"
                            value={paymentOnAccountAmount}
                            onChange={(event) => {
                              setPaymentOnAccount(true);
                              setPaymentOnAccountAmount(event.target.value);
                            }}
                            onBlur={() => setPaymentOnAccountAmount(money(parseAmount(paymentOnAccountAmount)))}
                          />
                        ) : `INR ${money(row.amount)}`}
                      </td>
                      <td className={isDraftRow ? "sap-cell--editable" : "sap-cell--readonly"}>
                        {isDraftRow ? (
                          <select value={accountDistributionRule} onChange={(event) => setAccountDistributionRule(event.target.value)}>
                            <option value=""></option>
                            {distributionRules.map((rule) => (
                              <option key={rule.code} value={rule.code}>{rule.code} - {rule.name}</option>
                            ))}
                          </select>
                        ) : row.distributionRule ? `${row.distributionRule}${getRuleName(row.distributionRule) ? ` - ${getRuleName(row.distributionRule)}` : ""}` : ""}
                      </td>
                      <td className={isDraftRow ? "sap-cell--editable" : "sap-cell--readonly"}>
                        {isDraftRow ? (
                          <select value={accountLocation} onChange={(event) => setAccountLocation(event.target.value)}>
                            <option value=""></option>
                            {locations.map((location) => (
                              <option key={location.code} value={location.code}>{location.code} - {location.name}</option>
                            ))}
                          </select>
                        ) : row.location ? `${row.location}${getLocationName(row.location) ? ` - ${getLocationName(row.location)}` : ""}` : (row.branch ? `${row.branch} - ${branchName}` : branchName)}
                      </td>
                    </tr>
                  );
                })}
                {Array.from({ length: Math.max(3, 5 - displayAccountRows.length) }).map((_, index) => (
                  <tr key={`account-blank-${index}`} className="sap-blank-row">
                    {Array.from({ length: 7 }).map((__, colIndex) => <td key={colIndex}></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
          <table className="sap-grid">
            <thead>
              <tr>
                <th>Selected</th>
                <th>Document No.</th>
                <th>Installment</th>
                <th>Document Type</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>*</th>
                <th>Overdue Days</th>
                <th>Total</th>
                <th>WTax Amount</th>
                <th>Balance Due</th>
                <th>Blocked</th>
                <th>Cash Discount %</th>
                <th>Total Rounding Amount</th>
                <th>Total Payment</th>
                <th>Distr. Rule</th>
                <th>Payment Order Run</th>
                <th>Branch</th>
                <th>Blanket Agreement</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="19" className="sap-empty">Loading open invoices...</td></tr>
              ) : invoices.length ? (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className={invoice.selected ? "is-selected" : ""}>
                    <td className="sap-cell--editable"><input type="checkbox" checked={Boolean(invoice.selected)} onChange={(event) => toggleInvoice(invoice.id, event.target.checked)} /></td>
                    <td className="sap-cell--readonly">
                      <button type="button" className="sap-doc-arrow" onClick={() => openInvoiceDocument(invoice)}>→</button>
                      <span className="sap-link-cell">{invoice.documentNo}</span>
                    </td>
                    <td className="sap-cell--readonly">{invoice.installment || "1 of 1"}</td>
                    <td className="sap-cell--readonly">{invoice.documentType === "A/P Invoice" ? "IN" : invoice.documentType}</td>
                    <td className="sap-cell--readonly">{formatSapDate(invoice.date)}</td>
                    <td className="sap-cell--readonly">{formatSapDate(invoice.dueDate)}</td>
                    <td className="sap-cell--readonly">*</td>
                    <td className="sap-cell--readonly">{invoice.overdueDays}</td>
                    <td className="sap-money sap-cell--readonly">{money(invoice.total)}</td>
                    <td className="sap-money sap-cell--readonly">0.00</td>
                    <td className="sap-money sap-cell--readonly">{money(invoice.balanceDue)}</td>
                    <td className="sap-cell--editable"><input type="checkbox" /></td>
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
                    <td className="sap-cell--editable">
                      <SapLookupField
                        value={invoice.distributionRule || ""}
                        onChange={(value) => changeDistributionRule(invoice.id, value)}
                        onSelect={(row) => changeDistributionRule(invoice.id, row.code)}
                        fetchOptions={findDistributionRules}
                        title="Distribution Rules"
                        columns={[{ label: "Code", key: "code" }, { label: "Name", key: "name" }]}
                      />
                    </td>
                    <td className="sap-cell--readonly"><input type="checkbox" checked={Boolean(invoice.paymentOrderRun)} readOnly /></td>
                    <td className="sap-cell--readonly">{invoice.branchDisplay || (invoice.branch ? `${invoice.branch} - ${invoice.branchName || branchName}` : "")}</td>
                    <td className="sap-cell--readonly">{header.blanketAgreement}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="19" className="sap-empty">
                    {isAccount
                      ? "Account payment mode does not display BP invoices. Use Payment on Account."
                      : isCustomer
                        ? "Customer mode does not display vendor A/P invoices."
                        : header.businessPartnerCode
                          ? `No open invoices found${header.branch ? ` for branch ${header.branch} - ${branchName}` : ""}.`
                          : "Choose a vendor to display invoices."}
                  </td>
                </tr>
              )}
              {Array.from({ length: Math.max(4, 8 - invoices.length) }).map((_, index) => (
                <tr key={`blank-${index}`} className="sap-blank-row">
                  {Array.from({ length: 19 }).map((__, colIndex) => <td key={colIndex}></td>)}
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </section>

        <div className="sap-payment-row">
          <div className="sap-payment-on-account">
            <label>
              <input type="checkbox" checked={isAccount || paymentOnAccount} disabled={isAccount} onChange={(event) => setPaymentOnAccount(event.target.checked)} />
              <span>Payment on Account</span>
            </label>
            <input
              value={paymentOnAccountAmount}
              disabled={!isAccount && !paymentOnAccount}
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
                  fetchOptions={searchOutgoingPaymentControlAccounts}
                  title="G/L Accounts"
                  columns={[{ label: "Code", key: "code" }, { label: "Name", key: "name" }]}
                />
              </FieldRow>
            ) : null}
            <FieldRow label="Cash Account">
              <SapLookupField
                value={header.cashAccount}
                onChange={(value) => updateHeader("cashAccount", value)}
                onSelect={(row) =>
                  setHeader((current) => ({ ...current, cashAccount: row.code, cashAccountName: row.name }))
                }
                fetchOptions={searchOutgoingPaymentCashAccounts}
                title="Cash Accounts"
                columns={[{ label: "Code", key: "code" }, { label: "Name", key: "name" }]}
              />
            </FieldRow>
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
              <div className="sap-amount-with-button">
                <input value={`INR ${money(totalAmountDue)}`} readOnly />
                <button type="button" onClick={openPaymentMeans} disabled={isFoundDocument}>...</button>
              </div>
            </FieldRow>
            <FieldRow label="Open Balance">
              <input value={openBalance ? `INR ${money(openBalance)}` : ""} readOnly />
            </FieldRow>
          </div>
        </div>
      </fieldset>
      <PaymentMeansModal
        open={paymentMeansOpen}
        value={paymentMeans}
        totalAmountDue={totalAmountDue}
        onChange={setPaymentMeans}
        onClose={() => setPaymentMeansOpen(false)}
        lookupAccounts={searchOutgoingPaymentControlAccounts}
        AccountLookupField={SapLookupField}
      />
    </div>
  );
}

