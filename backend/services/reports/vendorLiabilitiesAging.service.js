const db = require("../dbService");

const DOCUMENT_TYPES = {
  18: { label: "A/P Invoice", prefix: "PU" },
  19: { label: "A/P Credit Memo", prefix: "PC" },
  46: { label: "Outgoing Payment", prefix: "PS" },
  30: { label: "Journal Entry", prefix: "JE" },
};

const text = (value) => String(value || "").trim();
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const queryRows = async (sql, params = {}) => {
  const result = await db.query(sql, params);
  return result.recordset || result || [];
};

const parseDate = (value) => {
  const normalized = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return normalized;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  return `${year}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
};

const appendRange = (clauses, column, from, to, params, prefix) => {
  if (text(from)) {
    params[`${prefix}From`] = text(from);
    clauses.push(`${column} >= @${prefix}From`);
  }
  if (text(to)) {
    params[`${prefix}To`] = text(to);
    clauses.push(`${column} <= @${prefix}To`);
  }
};

const appendDateRange = (clauses, column, from, to, params, prefix) => {
  if (text(from)) {
    params[`${prefix}From`] = parseDate(from);
    clauses.push(`CAST(${column} AS DATE) >= CAST(@${prefix}From AS DATE)`);
  }
  if (text(to)) {
    params[`${prefix}To`] = parseDate(to);
    clauses.push(`CAST(${column} AS DATE) <= CAST(@${prefix}To AS DATE)`);
  }
};

const appendPropertyFilter = (clauses, propertyFilter = {}) => {
  if (propertyFilter.ignoreProperties !== false) return;
  const selected = (propertyFilter.selectedPropertyNumbers || []).map(Number)
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64);
  if (!selected.length) return;
  const selectedSet = new Set(selected);
  const operator = propertyFilter.linkMode === "or" ? " OR " : " AND ";
  clauses.push(`(${selected.map((value) => `ISNULL(BP.QryGroup${value}, 'N') = 'Y'`).join(operator)})`);
  if (propertyFilter.exactlyMatch) {
    const unselected = Array.from({ length: 64 }, (_, index) => index + 1)
      .filter((value) => !selectedSet.has(value))
      .map((value) => `ISNULL(BP.QryGroup${value}, 'N') <> 'Y'`);
    clauses.push(`(${unselected.join(" AND ")})`);
  }
};

const appendIn = (clauses, column, values, params, prefix) => {
  const normalized = [...new Set((values || []).map(text).filter(Boolean))];
  if (!normalized.length) return;
  clauses.push(`${column} IN (${normalized.map((value, index) => {
    params[`${prefix}${index}`] = value;
    return `@${prefix}${index}`;
  }).join(", ")})`);
};

const normalizeIntervals = (values = []) => {
  const result = (Array.isArray(values) ? values : []).slice(0, 4).map(number)
    .filter((value, index, array) => value > 0 && (index === 0 || value > array[index - 1]));
  return result.length === 4 ? result : [30, 60, 90, 120];
};

const bucketIndex = (days, intervals) => {
  const found = intervals.findIndex((limit) => days <= limit);
  return found === -1 ? intervals.length : found;
};

const getLookups = async () => {
  const [groups, accounts, employees, properties, currencyRows] = await Promise.all([
    queryRows(`
      SELECT DISTINCT CAST(G.GroupCode AS NVARCHAR(50)) AS code, ISNULL(G.GroupName, '') AS name
      FROM OCRG G INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
      WHERE BP.CardType = 'S' ORDER BY name
    `),
    queryRows(`
      SELECT DISTINCT A.AcctCode AS code, ISNULL(A.FormatCode, A.AcctCode) AS formatCode, ISNULL(A.AcctName, '') AS name
      FROM OACT A INNER JOIN OCRD BP ON BP.DebPayAcct = A.AcctCode
      WHERE BP.CardType = 'S' ORDER BY A.AcctCode
    `),
    queryRows(`SELECT SlpCode AS code, ISNULL(SlpName, '') AS name FROM OSLP WHERE Active = 'Y' ORDER BY SlpName`),
    queryRows(`SELECT GroupCode AS number, ISNULL(GroupName, '') AS name FROM OCQG ORDER BY GroupCode`),
    queryRows(`SELECT TOP 1 MainCurncy AS localCurrency, SysCurrncy AS systemCurrency FROM OADM`),
  ]);
  return {
    vendorGroups: [{ code: "All", name: "All" }, ...groups],
    controlAccounts: accounts,
    buyers: employees,
    properties,
    currencies: currencyRows[0] || { localCurrency: "LC", systemCurrency: "SC" },
  };
};

const getReport = async (criteria = {}) => {
  const agingDate = parseDate(criteria.agingDate) || new Date().toISOString().slice(0, 10);
  const intervals = normalizeIntervals(criteria.intervals);
  const params = { agingDate };
  const clauses = ["BP.CardType = 'S'", "CAST(L.RefDate AS DATE) <= CAST(@agingDate AS DATE)"];
  appendRange(clauses, "BP.CardCode", criteria.codeFrom, criteria.codeTo, params, "code");
  appendDateRange(clauses, "L.RefDate", criteria.postingDateFrom, criteria.postingDateTo, params, "posting");
  appendDateRange(clauses, "L.DueDate", criteria.dueDateFrom, criteria.dueDateTo, params, "due");
  appendDateRange(clauses, "L.TaxDate", criteria.documentDateFrom, criteria.documentDateTo, params, "document");
  appendPropertyFilter(clauses, criteria.propertyFilter);
  if (text(criteria.vendorGroup).toLowerCase() !== "all") {
    params.vendorGroup = text(criteria.vendorGroup);
    clauses.push("CAST(BP.GroupCode AS NVARCHAR(50)) = @vendorGroup");
  }
  if (criteria.controlAccountsEnabled) {
    appendIn(clauses, "L.Account", criteria.selectedAccountCodes, params, "account");
  }
  if (!criteria.displayReconciled && !criteria.displayZeroBalance) {
    clauses.push("(ABS(ISNULL(L.BalDueDeb, 0) - ISNULL(L.BalDueCred, 0)) > 0.000001 OR ABS(ISNULL(L.BalScDeb, 0) - ISNULL(L.BalScCred, 0)) > 0.000001 OR ABS(ISNULL(L.BalFcDeb, 0) - ISNULL(L.BalFcCred, 0)) > 0.000001)");
  }
  const ageColumn = criteria.ageBy === "posting" ? "L.RefDate" : criteria.ageBy === "document" ? "L.TaxDate" : "L.DueDate";
  const rows = await queryRows(`
    SELECT TOP 5000
      BP.CardCode, ISNULL(BP.CardName, '') AS CardName, ISNULL(BP.Currency, '') AS BpCurrency,
      ISNULL(S.SlpCode, -1) AS SlpCode, ISNULL(S.SlpName, 'No Buyer') AS SlpName,
      L.TransId, L.TransType, ISNULL(L.CreatedBy, 0) AS SourceDocEntry,
      ISNULL(L.BaseRef, CAST(L.TransId AS NVARCHAR(50))) AS BaseRef,
      ISNULL(L.Ref2, '') AS BpReference, ISNULL(BP.PymCode, '') AS PaymentMethodCode,
      L.RefDate, L.DueDate, L.TaxDate, ${ageColumn} AS AgeDate,
      L.Account, ISNULL(A.FormatCode, L.Account) AS AccountCode, ISNULL(A.AcctName, '') AS AccountName,
      CAST(ISNULL(L.BalDueDeb, 0) - ISNULL(L.BalDueCred, 0) AS DECIMAL(19, 6)) AS LocalBalance,
      CAST(ISNULL(L.BalScDeb, 0) - ISNULL(L.BalScCred, 0) AS DECIMAL(19, 6)) AS SystemBalance,
      CAST(ISNULL(L.BalFcDeb, 0) - ISNULL(L.BalFcCred, 0) AS DECIMAL(19, 6)) AS ForeignBalance,
      ISNULL(L.FCCurrency, '') AS ForeignCurrency
    FROM JDT1 L
    INNER JOIN OCRD BP ON BP.CardCode = L.ShortName
    LEFT JOIN OSLP S ON S.SlpCode = BP.SlpCode
    LEFT JOIN OACT A ON A.AcctCode = L.Account
    WHERE ${clauses.join("\n      AND ")}
    ORDER BY BP.CardCode, ${ageColumn}, L.TransId
  `, params);

  const resultRows = rows.map((row, index) => {
    const ageDate = row.AgeDate || row.DueDate || row.RefDate;
    const rawDaysOutstanding = Math.floor((new Date(`${agingDate}T00:00:00`) - new Date(ageDate)) / 86400000);
    const daysOutstanding = Math.max(0, rawDaysOutstanding);
    let balance = number(row.LocalBalance);
    let currency = "LC";
    if (criteria.displayCurrency === "system") {
      balance = number(row.SystemBalance);
      currency = "SC";
    } else if (criteria.displayCurrency === "foreign") {
      balance = number(row.ForeignBalance);
      currency = row.ForeignCurrency || "FC";
    } else if (criteria.displayCurrency === "businessPartner" && text(row.BpCurrency) && row.BpCurrency !== "##") {
      balance = number(row.ForeignBalance) || number(row.LocalBalance);
      currency = row.BpCurrency;
    }
    const buckets = Array(intervals.length + 1).fill(0);
    const futureRemit = rawDaysOutstanding < 0 ? balance : 0;
    if (!futureRemit) buckets[bucketIndex(daysOutstanding, intervals)] = balance;
    const definition = DOCUMENT_TYPES[Number(row.TransType)] || { label: "Transaction", prefix: "TR" };
    return {
      rowNo: index + 1,
      vendorCode: row.CardCode || "",
      vendorName: row.CardName || "",
      buyerCode: String(row.SlpCode ?? ""),
      buyerName: row.SlpName || "No Buyer",
      transId: number(row.TransId),
      transType: number(row.TransType),
      sourceDocEntry: number(row.SourceDocEntry),
      documentType: definition.label,
      documentPrefix: definition.prefix,
      documentNumber: row.BaseRef || String(row.TransId || ""),
      installmentNumber: 1,
      blanketAgreementNumber: "",
      bpReferenceNumber: row.BpReference || "",
      paymentMethodCode: row.PaymentMethodCode || "",
      postingDate: row.RefDate,
      dueDate: row.DueDate,
      documentDate: row.TaxDate,
      daysOutstanding,
      accountCode: row.AccountCode || row.Account || "",
      accountName: row.AccountName || "",
      balance,
      futureRemit,
      currency,
      buckets,
    };
  }).filter((row) => (
    (!criteria.ignoreFutureRemit || !row.futureRemit)
    && (criteria.displayZeroBalance || criteria.displayReconciled || Math.abs(row.balance) > 0.000001)
  ));

  return {
    reportTitle: "Vendor Liabilities Aging",
    generatedAt: new Date().toISOString(),
    agingDate,
    ageBy: criteria.ageBy || "due",
    displayCurrency: criteria.displayCurrency || "local",
    groupBy: criteria.groupBy || "vendor",
    intervals,
    rows: resultRows,
  };
};

module.exports = { getLookups, getReport, normalizeIntervals };
