const db = require("./dbService");
const env = require("../config/env");
const masterDataDbService = require("./masterDataDbService");
const sapService = require("./sapService");

const queryRows = async (sql, params = {}) => {
  const result = await db.query(sql, params);
  return result.recordset || [];
};

const toDateString = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const toNumber = (value) => Number(value || 0);

const formatAddress = (row = {}) =>
  [
    row.AddressBuilding,
    row.AddressStreet,
    row.AddressBlock,
    [row.AddressCity, row.AddressZipCode].filter(Boolean).join(" "),
    row.AddressState,
    row.AddressCountry,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n");

const parseAmount = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/^INR\s*/i, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toSapDate = (value) => {
  if (!value) return undefined;
  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const shortMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (shortMatch) {
    const [, day, month, year] = shortMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month}-${day}`;
  }

  return raw;
};

const searchBusinessPartners = async (query = "", bpType = "Vendor") => {
  const trimmed = String(query || "").trim();
  const normalizedType = String(bpType || "").toLowerCase();
  const cardType = normalizedType === "customer" ? "C" : "S";
  const rows = await queryRows(`
    SELECT
      T0.CardCode,
      T0.CardName,
      T0.Currency,
      T0.Balance,
      T0.CardType,
      T0.ValidFor,
      T0.FrozenFor,
      T0.DebPayAcct,
      T0.BillToDef,
      T0.Address,
      T0.CntctPrsn,
      T1.Address AS AddressCode,
      T1.Building AS AddressBuilding,
      T1.Street AS AddressStreet,
      T1.Block AS AddressBlock,
      T1.City AS AddressCity,
      T1.ZipCode AS AddressZipCode,
      T1.State AS AddressState,
      T1.Country AS AddressCountry,
      T1.GSTRegnNo AS GstRegistrationNumber
    FROM OCRD T0
    OUTER APPLY (
      SELECT TOP 1
        Address,
        Building,
        Street,
        Block,
        City,
        ZipCode,
        State,
        Country,
        GSTRegnNo
      FROM CRD1
      WHERE CardCode = T0.CardCode
        AND AdresType = 'B'
        AND (ISNULL(T0.BillToDef, '') = '' OR Address = T0.BillToDef)
      ORDER BY CASE WHEN Address = T0.BillToDef THEN 0 ELSE 1 END, LineNum
    ) T1
    WHERE T0.CardType = @cardType
      AND T0.frozenFor <> 'Y'
      AND (@query = ''
        OR T0.CardCode LIKE @like
        OR T0.CardName LIKE @like)
    ORDER BY T0.CardName, T0.CardCode
  `, { cardType, query: trimmed, like: `%${trimmed}%` });

  return rows.map((row) => ({
    code: row.CardCode,
    name: row.CardName,
    currency: row.Currency || "",
    controlAccount: row.DebPayAcct || "",
    payToCode: row.BillToDef || row.AddressCode || "",
    payToAddress: formatAddress(row) || row.Address || "",
    contactPerson: row.CntctPrsn || "",
    balance: toNumber(row.Balance),
    bpType: row.CardType === "S" ? "Vendor" : row.CardType === "C" ? "Customer" : "Lead",
    active: row.ValidFor === "N" || row.FrozenFor === "Y" ? "No" : "Yes",
    inactive: row.FrozenFor === "Y" ? "Yes" : "No",
    billToBlock: row.AddressBlock || "",
    billToBuilding: row.AddressBuilding || "",
    gstRegistrationNumber: row.GstRegistrationNumber || "",
  }));
};

const lookupControlAccounts = async (query = "") => {
  const trimmed = String(query || "").trim();
  const rows = await queryRows(`
    SELECT TOP 100 AcctCode, AcctName
    FROM OACT
    WHERE Postable = 'Y'
      AND ISNULL(FrozenFor, 'N') <> 'Y'
      AND (@query = ''
        OR AcctCode LIKE @like
        OR AcctName LIKE @like)
    ORDER BY AcctCode
  `, { query: trimmed, like: `%${trimmed}%` });
  return rows.map((row) => ({
    code: row.AcctCode,
    name: row.AcctName,
  }));
};

const assertPostableAccount = async (accountCode = "") => {
  const rows = await queryRows(`
    SELECT TOP 1 AcctCode, AcctName, Postable, FrozenFor
    FROM OACT
    WHERE AcctCode = @accountCode
  `, { accountCode });
  const account = rows[0];
  if (!account) {
    throw new Error(`G/L Account ${accountCode} was not found.`);
  }
  if (account.Postable !== "Y") {
    throw new Error(`G/L Account ${accountCode} is a title account. Select a posting G/L account, same as SAP B1.`);
  }
  if (account.FrozenFor === "Y") {
    throw new Error(`G/L Account ${accountCode} is frozen. Select an active posting G/L account.`);
  }
};

const lookupCashAccounts = async (query = "") => {
  const trimmed = String(query || "").trim();
  const rows = await queryRows(`
    SELECT TOP 100 AcctCode, AcctName
    FROM OACT
    WHERE Postable = 'Y'
      AND ISNULL(FrozenFor, 'N') <> 'Y'
      AND ISNULL(CashBox, 'N') = 'Y'
      AND (@query = ''
        OR AcctCode LIKE @like
        OR AcctName LIKE @like)
    ORDER BY AcctCode
  `, { query: trimmed, like: `%${trimmed}%` });

  return rows.map((row) => ({
    code: row.AcctCode,
    name: row.AcctName,
  }));
};

const lookupPaymentMeansAccounts = async (query = "") => {
  const trimmed = String(query || "").trim();
  const rows = await queryRows(`
    SELECT TOP 100 AcctCode, AcctName
    FROM OACT
    WHERE Postable = 'Y'
      AND ISNULL(FrozenFor, 'N') <> 'Y'
      AND (@query = ''
        OR AcctCode LIKE @like
        OR AcctName LIKE @like)
      AND (
        AcctName LIKE '%cash%'
        OR AcctName LIKE '%bank%'
        OR AcctName LIKE '%current%'
      )
    ORDER BY
      CASE
        WHEN AcctName LIKE '%cash%' THEN 0
        WHEN AcctName LIKE '%bank%' THEN 1
        ELSE 2
      END,
      AcctCode
  `, { query: trimmed, like: `%${trimmed}%` });

  return rows.map((row) => ({
    code: row.AcctCode,
    name: row.AcctName,
  }));
};

const getDefaultCashAccount = async () => {
  const configured = String(env.outgoingPaymentCashAccount || env.incomingPaymentCashAccount || "").trim();
  if (configured) return configured;

  const cashBoxRows = await lookupCashAccounts("");
  if (cashBoxRows[0]?.code) return cashBoxRows[0].code;

  const paymentMeansRows = await lookupPaymentMeansAccounts("");
  return paymentMeansRows[0]?.code || "";
};

const getPaymentSeries = async () => {
  const rows = await queryRows(`
    SELECT
      T0.Series,
      T0.SeriesName,
      T0.Indicator,
      T0.NextNumber,
      CASE
        WHEN T1.AbsEntry IS NOT NULL THEN 1
        ELSE 0
      END AS IsCurrentPeriod
    FROM NNM1 T0
    LEFT JOIN OFPR T1
      ON T1.Indicator = T0.Indicator
      AND CONVERT(date, GETDATE()) BETWEEN T1.F_RefDate AND T1.T_RefDate
    WHERE T0.ObjectCode = '46'
      AND T0.Locked = 'N'
    ORDER BY
      CASE WHEN T1.AbsEntry IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN ISNULL(T0.Indicator, '') <> '' THEN 0 ELSE 1 END,
      T0.Series
  `);

  return rows.map((row, index) => ({
    code: String(row.Series || ""),
    name: row.Indicator || row.SeriesName || String(row.Series || ""),
    seriesName: row.SeriesName || "",
    indicator: row.Indicator || "",
    nextNumber: row.NextNumber ? String(row.NextNumber) : "",
    isDefault: row.IsCurrentPeriod === 1 || index === 0,
  }));
};

const searchOutgoingPayments = async (query = "") => {
  const trimmed = String(query || "").trim();
  const rows = await queryRows(`
    SELECT TOP 100
      DocEntry,
      DocNum,
      DocDate,
      TaxDate,
      CardCode,
      CardName,
      Address,
      CounterRef,
      TransId,
      BPLId,
      JrnlMemo,
      DocTotal,
      NoDocSum
    FROM OVPM
    WHERE Canceled <> 'Y'
      AND (@query = ''
        OR CAST(DocNum AS NVARCHAR(30)) LIKE @like
        OR CardCode LIKE @like
        OR CardName LIKE @like
        OR ISNULL(CounterRef, '') LIKE @like)
    ORDER BY DocDate DESC, DocNum DESC
  `, { query: trimmed, like: `%${trimmed}%` });

  return rows.map((row) => ({
    code: String(row.DocNum || ""),
    docEntry: row.DocEntry,
    documentNo: String(row.DocNum || ""),
    postingDate: toDateString(row.DocDate),
    dueDate: toDateString(row.DocDate),
    documentDate: toDateString(row.TaxDate || row.DocDate),
    businessPartnerCode: row.CardCode || "",
    businessPartnerName: row.CardName || "",
    payToAddress: row.Address || "",
    referenceNumber: row.CounterRef || "",
    transactionNumber: row.TransId ? String(row.TransId) : "",
    branch: row.BPLId ? String(row.BPLId) : "",
    journalRemarks: row.JrnlMemo || "",
    totalAmount: toNumber(row.DocTotal),
    paymentOnAccountAmount: toNumber(row.NoDocSum),
  }));
};

const getOutgoingPaymentByDocEntry = async (docEntry) => {
  const docEntryNumber = Number(docEntry || 0);
  if (!docEntryNumber) {
    throw new Error("Outgoing payment DocEntry is required.");
  }

  const headerRows = await queryRows(`
    SELECT TOP 1
      T0.DocEntry,
      T0.DocNum,
      T0.DocDate,
      T0.TaxDate,
      T0.CardCode,
      T0.CardName,
      T0.Address,
      T0.CounterRef,
      T0.TransId,
      T0.BPLId,
      T0.JrnlMemo,
      T0.Comments,
      T0.DocTotal,
      T0.NoDocSum,
      T0.CashAcct
    FROM OVPM T0
    WHERE T0.DocEntry = @docEntry
  `, { docEntry: docEntryNumber });

  const header = headerRows[0];
  if (!header) {
    throw new Error("Outgoing payment was not found.");
  }

  const invoiceRows = await queryRows(`
    SELECT
      T1.DocEntry AS BaseDocEntry,
      T1.InvType,
      T1.InstId,
      T1.SumApplied,
      T2.DocNum,
      T2.DocDate,
      T2.DocDueDate,
      T2.DocTotal,
      T2.DocTotal - T2.PaidToDate AS BalanceDue,
      T2.DocCur,
      T2.Project,
      T2.PaymentRef,
      T2.BPLId,
      T3.BPLName
    FROM VPM2 T1
    LEFT JOIN OPCH T2 ON T2.DocEntry = T1.DocEntry AND T1.InvType = 18
    LEFT JOIN OBPL T3 ON T3.BPLId = T2.BPLId
    WHERE T1.DocNum = @docEntry
    ORDER BY T1.DocEntry, T1.InvType, T1.InstId
  `, { docEntry: docEntryNumber });

  const accountRows = await queryRows(`
    SELECT
      T1.AcctCode,
      T2.AcctName,
      T1.Descrip,
      T1.SumApplied,
      T1.OcrCode,
      T1.LocCode
    FROM VPM4 T1
    LEFT JOIN OACT T2 ON T2.AcctCode = T1.AcctCode
    WHERE T1.DocNum = @docEntry
    ORDER BY T1.AcctCode, T1.Descrip
  `, { docEntry: docEntryNumber });

  return {
    code: String(header.DocNum || ""),
    docEntry: header.DocEntry,
    documentNo: String(header.DocNum || ""),
    postingDate: toDateString(header.DocDate),
    dueDate: toDateString(header.DocDate),
    documentDate: toDateString(header.TaxDate || header.DocDate),
    businessPartnerCode: header.CardCode || "",
    businessPartnerName: header.CardName || "",
    payToAddress: header.Address || "",
    referenceNumber: header.CounterRef || "",
    transactionNumber: header.TransId ? String(header.TransId) : "",
    branch: header.BPLId ? String(header.BPLId) : "",
    journalRemarks: header.JrnlMemo || "",
    remarks: header.Comments || "",
    totalAmount: toNumber(header.DocTotal),
    paymentOnAccountAmount: toNumber(header.NoDocSum),
    cashAccount: header.CashAcct || "",
    invoices: invoiceRows.map((row, index) => ({
      id: `posted-${row.BaseDocEntry || index}-${index}`,
      docEntry: row.BaseDocEntry,
      documentNo: String(row.DocNum || row.BaseDocEntry || ""),
      installment: row.InstId ? String(row.InstId) : "1",
      documentType: row.InvType === 18 ? "A/P Invoice" : String(row.InvType || ""),
      date: toDateString(row.DocDate),
      dueDate: toDateString(row.DocDueDate),
      total: toNumber(row.DocTotal || row.SumApplied),
      balanceDue: toNumber(row.BalanceDue),
      totalPayment: toNumber(row.SumApplied),
      distributionRule: row.Project || "",
      overdueDays: 0,
      paymentOrderRun: row.PaymentRef || "",
      branch: row.BPLId ? String(row.BPLId) : "",
      branchName: row.BPLName || "",
      branchDisplay: row.BPLId ? `${row.BPLId} - ${row.BPLName || ""}`.trim() : "",
      currency: row.DocCur || "",
      selected: true,
      cashDiscountPercent: "0.00",
    })),
    accountRows: accountRows.map((row, index) => ({
      id: `account-${row.AcctCode || index}-${index}`,
      accountCode: row.AcctCode || "",
      accountName: row.AcctName || "",
      remarks: row.Descrip || "",
      amount: toNumber(row.SumApplied),
      distributionRule: row.OcrCode || "",
      location: row.LocCode != null ? String(row.LocCode) : "",
      branch: header.BPLId ? String(header.BPLId) : "",
    })),
  };
};

const getReferenceData = async () => {
  const [branches, series, defaultCashAccount, distributionRules, locations] = await Promise.all([
    masterDataDbService.lookupBusinessPlaces(),
    getPaymentSeries(),
    getDefaultCashAccount(),
    masterDataDbService.lookupDistributionRules(),
    masterDataDbService.lookupWarehouseLocations(),
  ]);
  const defaultSeries = series.find((item) => item.isDefault) || series[0] || null;

  return {
    branches,
    series,
    defaultSeriesCode: defaultSeries?.code || "",
    defaultSeriesName: defaultSeries?.name || "",
    nextDocumentNumber: defaultSeries?.nextNumber || "",
    nextTransactionNumber: defaultSeries?.nextNumber || "",
    defaultCashAccount,
    distributionRules: (distributionRules || []).map((rule) => ({
      code: String(rule.code || rule.FactorCode || rule.OcrCode || ""),
      name: rule.name || rule.FactorDescription || rule.OcrName || "",
    })).filter((rule) => rule.code),
    locations,
  };
};

const getOpenInvoices = async (cardCode, branch = "") => {
  if (!cardCode) return [];
  const branchId = Number(branch || 0);

  const rows = await queryRows(`
    SELECT TOP 200
      T0.DocEntry,
      T0.DocNum,
      T0.DocDate,
      T0.DocDueDate,
      T0.DocTotal,
      T0.DocTotal - T0.PaidToDate AS BalanceDue,
      T0.DocCur,
      T0.BPLId,
      T0.NumAtCard,
      T0.Project,
      T0.PaymentRef,
      T0.JrnlMemo,
      T0.CtlAccount,
      T1.BPLName,
      DATEDIFF(DAY, T0.DocDueDate, GETDATE()) AS OverdueDays
    FROM OPCH T0
    LEFT JOIN OBPL T1 ON T1.BPLId = T0.BPLId
    WHERE T0.CardCode = @cardCode
      AND (@branchId = 0 OR T0.BPLId = @branchId)
      AND T0.DocStatus = 'O'
      AND T0.CANCELED <> 'Y'
      AND (T0.DocTotal - T0.PaidToDate) > 0
    ORDER BY T0.DocDueDate, T0.DocNum
  `, { cardCode, branchId });

  return rows.map((row) => ({
    id: String(row.DocEntry),
    docEntry: row.DocEntry,
    documentNo: String(row.DocNum || ""),
    installment: "1",
    documentType: "A/P Invoice",
    date: toDateString(row.DocDate),
    dueDate: toDateString(row.DocDueDate),
    total: toNumber(row.DocTotal),
    balanceDue: toNumber(row.BalanceDue),
    totalPayment: toNumber(row.BalanceDue),
    distributionRule: row.Project || "",
    overdueDays: Math.max(0, toNumber(row.OverdueDays)),
    paymentOrderRun: row.PaymentRef || "",
    branch: row.BPLId ? String(row.BPLId) : "",
    branchName: row.BPLName || "",
    branchDisplay: row.BPLId ? `${row.BPLId} - ${row.BPLName || ""}`.trim() : "",
    reference: row.NumAtCard || "",
    controlAccount: row.CtlAccount || "",
    currency: row.DocCur || "",
    journalMemo: row.JrnlMemo || "",
  }));
};

const createOutgoingPayment = async (payload = {}) => {
  const header = payload.header || {};
  const invoices = Array.isArray(payload.invoices) ? payload.invoices : [];
  const paymentOnAccount = payload.paymentOnAccount || {};

  const cardCode = String(header.businessPartnerCode || "").trim();
  const cashAccount = String(header.cashAccount || await getDefaultCashAccount()).trim();
  if (!cardCode) {
    throw new Error("Vendor, customer, or account code is required.");
  }
  if (!cashAccount) {
    throw new Error("Cash Account is required for SAP Outgoing Payments. Select a cash account or set OUTGOING_PAYMENT_CASH_ACCOUNT in backend/.env.");
  }

  const selectedInvoices = invoices
    .map((invoice) => ({
      ...invoice,
      appliedAmount: parseAmount(invoice.totalPayment),
      balanceDue: parseAmount(invoice.balanceDue),
    }))
    .filter((invoice) => Number(invoice.docEntry) > 0 && invoice.appliedAmount > 0);

  const overAppliedInvoice = selectedInvoices.find(
    (invoice) => invoice.balanceDue > 0 && invoice.appliedAmount - invoice.balanceDue > 0.01,
  );
  if (overAppliedInvoice) {
    throw new Error(`Payment amount is greater than invoice amount for document ${overAppliedInvoice.documentNo || overAppliedInvoice.docEntry}.`);
  }

  const paymentOnAccountAmount = paymentOnAccount.enabled ? parseAmount(paymentOnAccount.amount) : 0;
  const accountDistributionRule = String(paymentOnAccount.distributionRule || paymentOnAccount.distRule || "").trim();
  const accountLocation = String(paymentOnAccount.location || paymentOnAccount.loc || paymentOnAccount.locCode || "").trim();
  const accountLocationCode = Number(accountLocation);
  const appliedTotal = selectedInvoices.reduce((sum, invoice) => sum + invoice.appliedAmount, 0);
  const cashSum = appliedTotal + paymentOnAccountAmount;
  const isAccountPayment = header.bpType === "Account";
  const isCustomerPayment = header.bpType === "Customer";

  if (cashSum <= 0) {
    throw new Error("Outgoing payment amount must be greater than zero.");
  }

  if (isAccountPayment && paymentOnAccountAmount <= 0) {
    throw new Error("Payment on Account amount is required for Account outgoing payments.");
  }
  if (isAccountPayment) {
    await assertPostableAccount(cardCode);
  }

  const sapPayload = {
    DocType: isCustomerPayment ? "rCustomer" : isAccountPayment ? "rAccount" : "rSupplier",
    CardCode: isAccountPayment ? undefined : cardCode,
    DocDate: toSapDate(header.postingDate),
    DueDate: toSapDate(header.dueDate || header.postingDate),
    TaxDate: toSapDate(header.documentDate || header.postingDate),
    VatDate: toSapDate(header.documentDate || header.postingDate),
    DocCurrency: isAccountPayment ? header.docCurrency || undefined : selectedInvoices.find((invoice) => invoice.currency)?.currency || undefined,
    PaymentType: "bopt_None",
    Series: header.seriesCode && header.seriesCode !== "Manual" ? Number(header.seriesCode) : undefined,
    DocNum: header.seriesCode === "Manual" && header.documentNumber ? Number(header.documentNumber) : undefined,
    BPLID: Number(header.branch) > 0 ? Number(header.branch) : undefined,
    CounterReference: header.referenceNumber || undefined,
    ControlAccount: !isAccountPayment ? header.controlAccount || undefined : undefined,
    Remarks: payload.remarks || undefined,
    JournalRemarks: payload.journalRemarks || undefined,
    CashAccount: cashAccount,
    CashSum: Number(cashSum.toFixed(2)),
    PaymentInvoices: !isAccountPayment && selectedInvoices.length
      ? selectedInvoices.map((invoice) => ({
          DocEntry: Number(invoice.docEntry),
          InvoiceType: isCustomerPayment ? "it_Invoice" : "it_PurchaseInvoice",
          SumApplied: Number(invoice.appliedAmount.toFixed(2)),
          DiscountPercent: parseAmount(invoice.cashDiscountPercent),
          DistributionRule: String(invoice.distributionRule || "").trim() || undefined,
        }))
      : undefined,
    PaymentAccounts: isAccountPayment
      ? [{
          AccountCode: cardCode,
          SumPaid: Number(paymentOnAccountAmount.toFixed(2)),
          GrossAmount: Number(paymentOnAccountAmount.toFixed(2)),
          Decription: paymentOnAccount.remarks || payload.remarks || undefined,
          ProfitCenter: accountDistributionRule || undefined,
          LocationCode: accountLocation && Number.isFinite(accountLocationCode) ? accountLocationCode : undefined,
        }]
      : undefined,
  };

  Object.keys(sapPayload).forEach((key) => {
    if (sapPayload[key] === undefined || sapPayload[key] === "") delete sapPayload[key];
  });

  console.log("[OutgoingPaymentsService] SAP Outgoing Payment payload:", JSON.stringify(sapPayload, null, 2));

  const response = await sapService.request({
    method: "post",
    url: "/VendorPayments",
    data: sapPayload,
  });

  console.log("[OutgoingPaymentsService] SAP Outgoing Payment response:", JSON.stringify(response.data, null, 2));

  return {
    message: "Outgoing payment created successfully",
    doc_num: response.data?.DocNum,
    doc_entry: response.data?.DocEntry,
    DocNum: response.data?.DocNum,
    DocEntry: response.data?.DocEntry,
    sapPayload,
  };
};

module.exports = {
  createOutgoingPayment,
  getReferenceData,
  getOpenInvoices,
  getOutgoingPaymentByDocEntry,
  lookupCashAccounts,
  lookupControlAccounts,
  searchOutgoingPayments,
  searchBusinessPartners,
};
