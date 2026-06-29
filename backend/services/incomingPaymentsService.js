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
  const sapMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (sapMatch) return `${sapMatch[1]}-${sapMatch[2]}-${sapMatch[3]}`;

  const shortMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (shortMatch) {
    const [, day, month, year] = shortMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month}-${day}`;
  }

  return raw;
};

const cleanObject = (source = {}) => {
  const target = { ...source };
  Object.keys(target).forEach((key) => {
    if (target[key] === undefined || target[key] === "" || target[key] == null || Number.isNaN(target[key])) {
      delete target[key];
    }
  });
  return target;
};

const toOptionalNumber = (value) => {
  if (value === undefined || value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getPaymentMeansAmount = (paymentMeans = {}) =>
  parseAmount(paymentMeans.cash?.amount) +
  parseAmount(paymentMeans.transfer?.amount) +
  parseAmount(paymentMeans.cheque?.amount) +
  parseAmount(paymentMeans.creditCard?.amount);

const buildPaymentMeansPayload = async ({ paymentMeans = {}, dueAmount = 0, fallbackCashAccount = "" } = {}) => {
  const totalDue = Number(dueAmount || 0);
  const enteredAmount = getPaymentMeansAmount(paymentMeans);
  const normalizedMeans = enteredAmount > 0
    ? paymentMeans
    : {
        cash: {
          account: fallbackCashAccount,
          amount: totalDue,
        },
      };
  const totalPaid = getPaymentMeansAmount(normalizedMeans);

  if (Math.abs(totalPaid - totalDue) > 0.01) {
    throw new Error("Payment Means paid amount must match Total Amount Due.");
  }

  const cashAmount = parseAmount(normalizedMeans.cash?.amount);
  const transferAmount = parseAmount(normalizedMeans.transfer?.amount);
  const chequeAmount = parseAmount(normalizedMeans.cheque?.amount);
  const cardAmount = parseAmount(normalizedMeans.creditCard?.amount);
  const result = {};

  if (cashAmount > 0) {
    const account = String(normalizedMeans.cash?.account || fallbackCashAccount || "").trim();
    if (!account) throw new Error("Cash G/L Account is required in Payment Means.");
    result.CashAccount = account;
    result.CashSum = Number(cashAmount.toFixed(2));
  }

  if (transferAmount > 0) {
    const account = String(normalizedMeans.transfer?.account || "").trim();
    if (!account) throw new Error("Bank Transfer G/L Account is required in Payment Means.");
    result.TransferAccount = account;
    result.TransferSum = Number(transferAmount.toFixed(2));
    result.TransferDate = toSapDate(normalizedMeans.transfer?.date) || toSapDate(new Date().toISOString().slice(0, 10));
    if (normalizedMeans.transfer?.reference) result.TransferReference = String(normalizedMeans.transfer.reference).trim();
  }

  if (chequeAmount > 0) {
    const cheque = normalizedMeans.cheque || {};
    result.PaymentChecks = [cleanObject({
      DueDate: toSapDate(cheque.dueDate) || toSapDate(new Date().toISOString().slice(0, 10)),
      CheckNumber: toOptionalNumber(cheque.checkNumber),
      CheckSum: Number(chequeAmount.toFixed(2)),
      CheckAccount: String(cheque.account || fallbackCashAccount || "").trim() || undefined,
      BankCode: String(cheque.bankCode || "").trim() || undefined,
      CountryCode: String(cheque.country || "").trim() || undefined,
    })];
  }

  if (cardAmount > 0) {
    const card = normalizedMeans.creditCard || {};
    result.PaymentCreditCards = [cleanObject({
      CreditCard: toOptionalNumber(card.cardName),
      CreditAcct: String(card.account || fallbackCashAccount || "").trim() || undefined,
      CreditCardNumber: String(card.cardNumber || "").trim() || undefined,
      CardValidUntil: toSapDate(card.validUntil) || undefined,
      OwnerIdNum: String(card.idNumber || "").trim() || undefined,
      OwnerPhone: String(card.telephone || "").trim() || undefined,
      PaymentMethodCode: String(card.paymentMethod || "").trim() || undefined,
      NumOfPayments: toOptionalNumber(card.noOfPayments) || 1,
      VoucherNum: String(card.voucherNo || "").trim() || undefined,
      CreditSum: Number(cardAmount.toFixed(2)),
    })];
  }

  return result;
};

const queryBusinessPartnerRows = (cardType, trimmed, { validForColumn = "validFor", frozenForColumn = "frozenFor" } = {}) =>
  queryRows(`
    SELECT
      T0.CardCode,
      T0.CardName,
      T0.Currency,
      T0.Balance,
      T0.CardType,
      T0.${validForColumn} AS ValidFor,
      T0.${frozenForColumn} AS FrozenFor,
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
    LEFT JOIN CRD1 T1
      ON T1.CardCode = T0.CardCode
      AND T1.AdresType = 'B'
      AND T1.LineNum = (
        SELECT MIN(TX.LineNum)
        FROM CRD1 TX
        WHERE TX.CardCode = T0.CardCode
          AND TX.AdresType = 'B'
          AND (COALESCE(T0.BillToDef, '') = '' OR TX.Address = T0.BillToDef)
      )
    WHERE T0.CardType = @cardType
      AND ISNULL(T0.${frozenForColumn}, 'N') <> 'Y'
      AND (@query = ''
        OR T0.CardCode LIKE @like
        OR T0.CardName LIKE @like)
    ORDER BY T0.CardName, T0.CardCode
  `, { cardType, query: trimmed, like: `%${trimmed}%` });

const queryBasicBusinessPartnerRows = (cardType, trimmed) =>
  queryRows(`
    SELECT TOP 200
      T0.CardCode,
      T0.CardName,
      T0.Currency,
      T0.Balance,
      T0.CardType,
      '' AS ValidFor,
      'N' AS FrozenFor,
      T0.DebPayAcct,
      T0.BillToDef,
      T0.Address,
      T0.CntctPrsn,
      '' AS AddressCode,
      '' AS AddressBuilding,
      '' AS AddressStreet,
      '' AS AddressBlock,
      '' AS AddressCity,
      '' AS AddressZipCode,
      '' AS AddressState,
      '' AS AddressCountry,
      '' AS GstRegistrationNumber
    FROM OCRD T0
    WHERE T0.CardType = @cardType
      AND (@query = ''
        OR T0.CardCode LIKE @like
        OR T0.CardName LIKE @like)
    ORDER BY T0.CardName, T0.CardCode
  `, { cardType, query: trimmed, like: `%${trimmed}%` });

const searchBusinessPartners = async (query = "", bpType = "Customer") => {
  const trimmed = String(query || "").trim();
  const cardType = String(bpType || "").toLowerCase() === "vendor" ? "S" : "C";
  let rows;
  try {
    rows = await queryBusinessPartnerRows(cardType, trimmed);
  } catch (error) {
    console.warn("[IncomingPaymentsService] BP lookup using validFor/frozenFor failed:", error.message);
    try {
      rows = await queryBusinessPartnerRows(cardType, trimmed, { validForColumn: "ValidFor", frozenForColumn: "FrozenFor" });
    } catch (fallbackError) {
      console.warn("[IncomingPaymentsService] BP lookup using ValidFor/FrozenFor failed:", fallbackError.message);
      rows = await queryBasicBusinessPartnerRows(cardType, trimmed);
    }
  }

  return rows.map((row) => ({
    code: row.CardCode,
    name: row.CardName,
    currency: row.Currency || "",
    controlAccount: row.DebPayAcct || "",
    billToCode: row.BillToDef || row.AddressCode || "",
    billToAddress: formatAddress(row) || row.Address || "",
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
  const configured = String(env.incomingPaymentCashAccount || "").trim();
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
    WHERE T0.ObjectCode = '24'
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

const searchIncomingPayments = async (query = "") => {
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
    FROM ORCT
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
    billToAddress: row.Address || "",
    referenceNumber: row.CounterRef || "",
    transactionNumber: row.TransId ? String(row.TransId) : "",
    branch: row.BPLId ? String(row.BPLId) : "",
    journalRemarks: row.JrnlMemo || "",
    totalAmount: toNumber(row.DocTotal),
    paymentOnAccountAmount: toNumber(row.NoDocSum),
  }));
};

const getIncomingPaymentByDocEntry = async (docEntry) => {
  const docEntryNumber = Number(docEntry || 0);
  if (!docEntryNumber) {
    throw new Error("Incoming payment DocEntry is required.");
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
      T0.NoDocSum
    FROM ORCT T0
    WHERE T0.DocEntry = @docEntry
  `, { docEntry: docEntryNumber });

  const header = headerRows[0];
  if (!header) {
    throw new Error("Incoming payment was not found.");
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
    FROM RCT2 T1
    LEFT JOIN OINV T2 ON T2.DocEntry = T1.DocEntry AND T1.InvType = 13
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
    FROM RCT4 T1
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
    billToAddress: header.Address || "",
    referenceNumber: header.CounterRef || "",
    transactionNumber: header.TransId ? String(header.TransId) : "",
    branch: header.BPLId ? String(header.BPLId) : "",
    journalRemarks: header.JrnlMemo || "",
    remarks: header.Comments || "",
    totalAmount: toNumber(header.DocTotal),
    paymentOnAccountAmount: toNumber(header.NoDocSum),
    invoices: invoiceRows.map((row, index) => ({
      id: `posted-${row.BaseDocEntry || index}-${index}`,
      docEntry: row.BaseDocEntry,
      documentNo: String(row.DocNum || row.BaseDocEntry || ""),
      installment: row.InstId ? String(row.InstId) : "1",
      documentType: row.InvType === 13 ? "A/R Invoice" : String(row.InvType || ""),
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
    FROM OINV T0
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
    documentType: "A/R Invoice",
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

const createIncomingPayment = async (payload = {}) => {
  const header = payload.header || {};
  const invoices = Array.isArray(payload.invoices) ? payload.invoices : [];
  const paymentOnAccount = payload.paymentOnAccount || {};

  const cardCode = String(header.businessPartnerCode || "").trim();
  const defaultCashAccount = String(header.cashAccount || await getDefaultCashAccount()).trim();
  if (!cardCode) {
    throw new Error("Business Partner is required.");
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
  const dueAmount = appliedTotal + paymentOnAccountAmount;
  const isAccountPayment = header.bpType === "Account";

  if (dueAmount <= 0) {
    throw new Error("Incoming payment amount must be greater than zero.");
  }

  if (isAccountPayment && paymentOnAccountAmount <= 0) {
    throw new Error("Payment on Account amount is required for Account incoming payments.");
  }
  if (isAccountPayment) {
    await assertPostableAccount(cardCode);
  }

  const paymentMeansPayload = await buildPaymentMeansPayload({
    paymentMeans: payload.paymentMeans || {},
    dueAmount,
    fallbackCashAccount: defaultCashAccount,
  });

  const sapPayload = {
    DocType: header.bpType === "Vendor" ? "rSupplier" : isAccountPayment ? "rAccount" : "rCustomer",
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
    ...paymentMeansPayload,
    PaymentInvoices: !isAccountPayment && selectedInvoices.length
      ? selectedInvoices.map((invoice) => ({
          DocEntry: Number(invoice.docEntry),
          InvoiceType: "it_Invoice",
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

  console.log("[IncomingPaymentsService] SAP Incoming Payment payload:", JSON.stringify(sapPayload, null, 2));

  const response = await sapService.request({
    method: "post",
    url: "/IncomingPayments",
    data: sapPayload,
  });

  console.log("[IncomingPaymentsService] SAP Incoming Payment response:", JSON.stringify(response.data, null, 2));

  return {
    message: "Incoming payment created successfully",
    doc_num: response.data?.DocNum,
    doc_entry: response.data?.DocEntry,
    DocNum: response.data?.DocNum,
    DocEntry: response.data?.DocEntry,
    sapPayload,
  };
};

module.exports = {
  createIncomingPayment,
  getReferenceData,
  getOpenInvoices,
  getIncomingPaymentByDocEntry,
  lookupCashAccounts,
  lookupControlAccounts,
  searchIncomingPayments,
  searchBusinessPartners,
};
