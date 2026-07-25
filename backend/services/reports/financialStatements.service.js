const db = require("../dbService");

const GROUP_NAMES = {
  1: "Assets",
  2: "Liabilities",
  3: "Equity",
  4: "Revenue",
  5: "Expenditure",
};

const REPORT_GROUPS = {
  "balance-sheet": [1, 2, 3],
  "trial-balance": [1, 2, 3, 4, 5],
  "profit-and-loss-statement": [4, 5],
};

const REPORT_TITLES = {
  "balance-sheet": "Balance Sheet",
  "trial-balance": "Trial Balance",
  "profit-and-loss-statement": "Profit and Loss Statement",
  "cash-flow": "Cash Flow",
  "cash-flow-reference-report": "Cash Flow Reference Report",
  "statement-of-cash-flows": "Statement of Cash Flows",
  "business-assessment-report": "Business Assessment Report",
};

const JOURNAL_DOCUMENT_TYPES = {
  13: "A/R Invoice",
  14: "A/R Credit Memo",
  15: "Delivery",
  16: "Returns",
  17: "Sales Order",
  18: "A/P Invoice",
  19: "A/P Credit Memo",
  20: "Goods Receipt PO",
  21: "Goods Return",
  22: "Purchase Order",
  23: "Sales Quotation",
  24: "Incoming Payment",
  30: "Journal Entry",
  46: "Outgoing Payment",
  59: "Goods Receipt",
  60: "Goods Issue",
  67: "Inventory Transfer",
  203: "A/R Down Payment",
  204: "A/P Down Payment",
  1250000001: "Inventory Transfer Request",
  234000031: "Return Request",
  234000032: "Goods Return Request",
};

const CASH_FLOW_DOCUMENT_TYPES = [
  { key: "purchaseOrders", label: "Purchase Orders", transType: 22, table: "OPOR", direction: "outgoing", defaultSelected: false, amountMode: "total" },
  { key: "goodsReceiptPo", label: "Goods Receipt PO", transType: 20, table: "OPDN", direction: "outgoing", defaultSelected: false, amountMode: "total" },
  { key: "goodsReturnRequest", label: "Goods Return Request", transType: 234000032, table: "OPRR", direction: "incoming", defaultSelected: false, amountMode: "total" },
  { key: "goodsReturn", label: "Goods Return", transType: 21, table: "ORPD", direction: "incoming", defaultSelected: false, amountMode: "total" },
  { key: "apDownPayment", label: "A/P Down Payment", transType: 204, table: "ODPO", direction: "outgoing", defaultSelected: true, amountMode: "open" },
  { key: "apInvoices", label: "A/P Invoices", transType: 18, table: "OPCH", direction: "outgoing", defaultSelected: true, amountMode: "open" },
  { key: "apCreditMemos", label: "A/P Credit Memos", transType: 19, table: "ORPC", direction: "incoming", defaultSelected: true, amountMode: "open" },
  { key: "salesOrders", label: "Sales Orders", transType: 17, table: "ORDR", direction: "incoming", defaultSelected: false, amountMode: "total" },
  { key: "deliveries", label: "Deliveries", transType: 15, table: "ODLN", direction: "incoming", defaultSelected: false, amountMode: "total" },
  { key: "returnRequest", label: "Return Request", transType: 234000031, table: "ORRR", direction: "outgoing", defaultSelected: false, amountMode: "total" },
  { key: "returns", label: "Returns", transType: 16, table: "ORDN", direction: "outgoing", defaultSelected: false, amountMode: "total" },
  { key: "arDownPayment", label: "A/R Down Payment", transType: 203, table: "ODPI", direction: "incoming", defaultSelected: true, amountMode: "open" },
  { key: "arInvoices", label: "A/R Invoices", transType: 13, table: "OINV", direction: "incoming", defaultSelected: true, amountMode: "open" },
  { key: "arCreditMemos", label: "A/R Credit Memos", transType: 14, table: "ORIN", direction: "outgoing", defaultSelected: true, amountMode: "open" },
];

const CASH_FLOW_SECURITY_LEVELS = [
  { key: "cashAccounts", label: "Cash Accounts" },
  { key: "credit", label: "Credit" },
  { key: "checks", label: "Checks" },
  { key: "customerLiabilities", label: "Customer Liabilities" },
  { key: "debtsToVendors", label: "Debts to Vendors" },
];

const TEMPLATE_FALLBACKS = {
  "balance-sheet": [{ code: "standard", name: "Standard" }],
  "profit-and-loss-statement": [{ code: "standard", name: "Standard" }],
  "statement-of-cash-flows": [
    { code: "defaultCashFlow", name: "Default cash flow" },
    { code: "defaultDirect", name: "Default cash flow report (direct method)" },
    { code: "Temp001", name: "Temp001" },
  ],
  "business-assessment-report": [
    { code: "standard", name: "Standard" },
    { code: "pnl", name: "P & L" },
  ],
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
};

const safeQueryRows = async (sql, params = {}, options = {}) => {
  try {
    return await queryRows(sql, params, options);
  } catch (_error) {
    return [];
  }
};

const getTableColumns = async (tableName, options = {}) => {
  const rows = await safeQueryRows(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `,
    { tableName },
    options,
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME || "").trim()).filter(Boolean));
};

const tableExists = async (tableName, options = {}) => {
  const rows = await safeQueryRows(
    `
      SELECT 1 AS found
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName
    `,
    { tableName },
    options,
  );
  return Boolean(rows[0]);
};

const appendInClause = (clauses, columnSql, values, params, prefix) => {
  const uniqueValues = [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
  if (!uniqueValues.length) return;
  const placeholders = uniqueValues.map((value, index) => {
    const key = `${prefix}${index}`;
    params[key] = value;
    return `@${key}`;
  });
  clauses.push(`${columnSql} IN (${placeholders.join(", ")})`);
};

const parseReportDate = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return raw;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  return `${year}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
};

const dateFromIso = (isoDate) => {
  const parsed = new Date(`${parseReportDate(isoDate)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isoFromDate = (date) => date.toISOString().slice(0, 10);

const monthsBetween = (fromDate, date) =>
  (date.getFullYear() - fromDate.getFullYear()) * 12 + (date.getMonth() - fromDate.getMonth());

const cashFlowBucketEndDate = (dateValue, fromValue, toValue, interval) => {
  const date = dateFromIso(dateValue);
  const fromDate = dateFromIso(fromValue);
  const toDate = dateFromIso(toValue);
  let periodEnd = date;

  if (interval === "weekly") {
    const diffDays = Math.max(0, Math.floor((date - fromDate) / 86400000));
    periodEnd = addDays(fromDate, Math.floor(diffDays / 7) * 7 + 6);
  } else if (interval === "monthly" || interval === "quarterly" || interval === "semiAnnual" || interval === "annual") {
    const monthsPerPeriod = interval === "quarterly" ? 3 : interval === "semiAnnual" ? 6 : interval === "annual" ? 12 : 1;
    const periodIndex = Math.max(0, Math.floor(monthsBetween(fromDate, date) / monthsPerPeriod));
    const start = new Date(fromDate.getFullYear(), fromDate.getMonth() + periodIndex * monthsPerPeriod, fromDate.getDate());
    periodEnd = new Date(start.getFullYear(), start.getMonth() + monthsPerPeriod, start.getDate() - 1);
  }

  return isoFromDate(periodEnd > toDate ? toDate : periodEnd);
};

const selectLookupRows = async (tableName, codeCandidates, nameCandidates, options = {}) => {
  const columns = await getTableColumns(tableName, options);
  const codeColumn = codeCandidates.find((column) => columns.has(column));
  const nameColumn = nameCandidates.find((column) => columns.has(column));
  if (!codeColumn || !nameColumn) return [];

  return safeQueryRows(
    `
      SELECT DISTINCT
        CAST([${codeColumn}] AS NVARCHAR(100)) AS code,
        CAST(ISNULL([${nameColumn}], [${codeColumn}]) AS NVARCHAR(254)) AS name
      FROM [${tableName}]
      WHERE [${codeColumn}] IS NOT NULL
      ORDER BY name
    `,
    {},
    options,
  );
};

const selectFinancialReportTemplates = async (options = {}) => {
  const tableName = "OFRT";
  const columns = await getTableColumns(tableName, options);
  const codeColumn = ["AbsId", "AbsEntry", "TemplateId", "Code"].find((column) => columns.has(column));
  const nameColumn = ["Name", "TemplateName", "Descr"].find((column) => columns.has(column));
  if (!codeColumn || !nameColumn) return [];

  const extraColumns = ["Category", "FRTType", "ReportType", "Type", "RptType", "TemplateType"]
    .filter((column) => columns.has(column));
  const extraSelect = extraColumns
    .map((column) => `CAST(ISNULL([${column}], '') AS NVARCHAR(100)) AS [${column}]`)
    .join(",\n        ");

  const rows = await safeQueryRows(
    `
      SELECT DISTINCT
        CAST([${codeColumn}] AS NVARCHAR(100)) AS code,
        CAST(ISNULL([${nameColumn}], [${codeColumn}]) AS NVARCHAR(254)) AS name
        ${extraSelect ? `,\n        ${extraSelect}` : ""}
      FROM [${tableName}]
      WHERE [${codeColumn}] IS NOT NULL
      ORDER BY name
    `,
    {},
    options,
  );

  return rows.map((row) => ({
    code: String(row.code || "").trim(),
    name: String(row.name || row.code || "").trim(),
    reportHint: extraColumns.map((column) => String(row[column] || "")).join(" ").trim(),
  })).filter((row) => row.code);
};

const templateText = (template) =>
  `${template?.code || ""} ${template?.name || ""} ${template?.reportHint || ""}`.toLowerCase();

const buildReportTemplateMap = (templates) => {
  const allTemplates = templates.length ? templates : TEMPLATE_FALLBACKS["balance-sheet"];
  const balanceSheetTemplates = allTemplates.filter((template) => {
    const text = templateText(template);
    return text === "standard" || text.includes("balance sheet") || text.includes("balancesheet");
  });
  const profitLossTemplates = allTemplates.filter((template) => {
    const text = templateText(template);
    return (
      text === "standard" ||
      text.includes("profit") ||
      text.includes("loss") ||
      text.includes("p & l") ||
      text.includes("p&l") ||
      text.includes("income statement")
    );
  });
  const statementCashFlowTemplates = templates.filter((template) => {
    const text = templateText(template);
    return text.includes("cash flow") || text.includes("cashflow") || text.includes("statement of cash");
  });
  const businessAssessmentTemplates = allTemplates.filter((template) => {
    const text = templateText(template);
    return (
      text === "standard" ||
      text.includes("business assessment") ||
      text.includes("profit") ||
      text.includes("loss") ||
      text.includes("p & l") ||
      text.includes("p&l")
    );
  });

  return {
    "balance-sheet": balanceSheetTemplates.length ? balanceSheetTemplates : allTemplates,
    "profit-and-loss-statement": profitLossTemplates.length ? profitLossTemplates : allTemplates,
    "statement-of-cash-flows": statementCashFlowTemplates.length
      ? statementCashFlowTemplates
      : TEMPLATE_FALLBACKS["statement-of-cash-flows"],
    "business-assessment-report": businessAssessmentTemplates.length
      ? businessAssessmentTemplates
      : TEMPLATE_FALLBACKS["business-assessment-report"],
  };
};

const selectPostingPeriods = async (options = {}) => {
  const columns = await getTableColumns("OFPR", options);
  if (!columns.size) return [];
  const codeColumn = ["Code", "PeriodCode", "Name"].find((column) => columns.has(column));
  const nameColumn = ["Name", "PeriodName", "Code"].find((column) => columns.has(column));
  const absColumn = ["AbsEntry", "AbsId"].find((column) => columns.has(column));
  const fromColumn = ["F_RefDate", "FromDate", "StartDate"].find((column) => columns.has(column));
  const toColumn = ["T_RefDate", "ToDate", "EndDate"].find((column) => columns.has(column));
  if (!codeColumn || !fromColumn || !toColumn) return [];

  const rows = await safeQueryRows(
    `
      SELECT TOP 180
        ${absColumn ? `CAST([${absColumn}] AS INT)` : "ROW_NUMBER() OVER (ORDER BY [${fromColumn}])"} AS periodNumber,
        CAST([${codeColumn}] AS NVARCHAR(100)) AS code,
        CAST(ISNULL([${nameColumn || codeColumn}], [${codeColumn}]) AS NVARCHAR(254)) AS name,
        CAST([${fromColumn}] AS DATE) AS dateFrom,
        CAST([${toColumn}] AS DATE) AS dateTo
      FROM OFPR
      WHERE [${codeColumn}] IS NOT NULL
        AND [${fromColumn}] IS NOT NULL
        AND [${toColumn}] IS NOT NULL
      ORDER BY [${fromColumn}] DESC
    `,
    {},
    options,
  );

  return rows.map((row) => ({
    periodNumber: Number(row.periodNumber || 0),
    code: String(row.code || "").trim(),
    name: String(row.name || row.code || "").trim(),
    dateFrom: parseReportDate(row.dateFrom),
    dateTo: parseReportDate(row.dateTo),
  })).filter((row) => row.code);
};

const getCompanyCurrencyInfo = async (options = {}) => {
  const rows = await safeQueryRows(
    `
      SELECT TOP 1
        ISNULL(MainCurncy, '') AS localCurrency,
        ISNULL(SysCurrncy, '') AS systemCurrency
      FROM OADM
    `,
    {},
    options,
  );

  return {
    localCurrency: String(rows[0]?.localCurrency || "").trim(),
    systemCurrency: String(rows[0]?.systemCurrency || "").trim(),
  };
};

const selectCashFlowAccounts = async (options = {}) => {
  const preferredRows = await safeQueryRows(
    `
      SELECT TOP 500
        A.AcctCode AS code,
        ISNULL(A.FormatCode, A.AcctCode) AS formatCode,
        ISNULL(A.AcctName, '') AS name
      FROM OACT A
      WHERE ISNULL(A.Postable, 'Y') = 'Y'
        AND ISNULL(A.FrozenFor, 'N') <> 'Y'
        AND ISNULL(A.CashBox, 'N') = 'Y'
      ORDER BY A.AcctCode
    `,
    {},
    options,
  );

  const rows = preferredRows.length ? preferredRows : await safeQueryRows(
    `
      SELECT TOP 500
        A.AcctCode AS code,
        ISNULL(A.FormatCode, A.AcctCode) AS formatCode,
        ISNULL(A.AcctName, '') AS name
      FROM OACT A
      WHERE ISNULL(A.Postable, 'Y') = 'Y'
        AND ISNULL(A.FrozenFor, 'N') <> 'Y'
        AND (
          A.AcctName LIKE '%cash%'
          OR A.AcctName LIKE '%bank%'
          OR A.AcctName LIKE '%current%'
        )
      ORDER BY
        CASE
          WHEN A.AcctName LIKE '%cash%' THEN 0
          WHEN A.AcctName LIKE '%bank%' THEN 1
          ELSE 2
        END,
        A.AcctCode
    `,
    {},
    options,
  );

  return rows.map((row) => ({
    code: String(row.code || "").trim(),
    formatCode: String(row.formatCode || row.code || "").trim(),
    name: String(row.name || "").trim(),
  })).filter((row) => row.code);
};

const resolveCurrencyCode = (displayCurrency, currencyInfo) => {
  if (displayCurrency === "system") return currencyInfo.systemCurrency || currencyInfo.localCurrency || "";
  if (displayCurrency === "foreign") return "FC";
  return currencyInfo.localCurrency || currencyInfo.systemCurrency || "";
};

const getLookups = async (options = {}) => {
  const [currencies, indexes, templates, currencyInfo, udfRows, customerGroups, vendorGroups, bpProperties, cashAccounts, postingPeriods] = await Promise.all([
    selectLookupRows("OCRN", ["CurrCode", "Currency", "Code"], ["CurrName", "CurrencyName", "Name"], options),
    selectLookupRows("OIDX", ["IdexCode", "IdxCode", "IndexCode", "Code", "AbsEntry"], ["IndexName", "IdxName", "Name"], options),
    selectFinancialReportTemplates(options),
    getCompanyCurrencyInfo(options),
    safeQueryRows(
      `
        SELECT
          CAST(COALESCE(NULLIF(AliasID, ''), CAST(FieldID AS NVARCHAR(20))) AS NVARCHAR(100)) AS code,
          CAST(ISNULL(Descr, AliasID) AS NVARCHAR(254)) AS name
        FROM CUFD
        WHERE TableID = 'OJDT'
        ORDER BY FieldID
      `,
      {},
      options,
    ),
    safeQueryRows(`
      SELECT DISTINCT CAST(G.GroupCode AS NVARCHAR(50)) AS code, ISNULL(G.GroupName, '') AS name
      FROM OCRG G INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
      WHERE BP.CardType = 'C'
      ORDER BY name
    `, {}, options),
    safeQueryRows(`
      SELECT DISTINCT CAST(G.GroupCode AS NVARCHAR(50)) AS code, ISNULL(G.GroupName, '') AS name
      FROM OCRG G INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
      WHERE BP.CardType = 'S'
      ORDER BY name
    `, {}, options),
    safeQueryRows(`
      SELECT GroupCode AS number, ISNULL(GroupName, '') AS name
      FROM OCQG
      ORDER BY GroupCode
    `, {}, options),
    selectCashFlowAccounts(options),
    selectPostingPeriods(options),
  ]);
  const reportTemplates = buildReportTemplateMap(templates);

  return {
    dateTypes: [
      { code: "postingDate", name: "Posting Date" },
      { code: "dueDate", name: "Due Date" },
      { code: "documentDate", name: "Document Date" },
    ],
    templates: reportTemplates["balance-sheet"] || TEMPLATE_FALLBACKS["balance-sheet"],
    financialStatementTemplates: templates,
    reportTemplates,
    postingPeriods,
    companyCurrency: currencyInfo,
    currencies,
    indexes,
    referenceFields: [
      "Ref. 1 (Header)", "Ref. 2 (Header)", "Ref. 3 (Header)",
      "Ref. 1 (BP Row)", "Ref. 1 (Row)", "Ref. 1 (All Rows)",
      "Ref. 2 (BP Row)", "Ref. 2 (Row)", "Ref. 2 (All Rows)",
      "Ref. 3 (BP Row)", "Ref. 3 (Row)", "Ref. 3 (All Rows)",
    ].map((name, index) => ({ code: String(index + 1), name })),
    userDefinedFields: udfRows,
    customerGroups,
    vendorGroups,
    bpProperties,
    trialBalanceTemplates: [
      { code: "trialBalance", name: "Trial Balance" },
      { code: "chartOfAccounts", name: "Chart of Accounts" },
    ],
    cashFlow: {
      cashAccounts,
      securityLevels: CASH_FLOW_SECURITY_LEVELS,
      documentTypes: CASH_FLOW_DOCUMENT_TYPES.map(({ key, label, defaultSelected }) => ({ key, label, defaultSelected })),
    },
    ruleOptions: [
      { code: "", name: "" },
      { code: "equal", name: "Equal" },
      { code: "notEqual", name: "Not Equal" },
      { code: "between", name: "Between" },
      { code: "contains", name: "Contains" },
    ],
  };
};

const currencyColumns = (displayCurrency) => {
  if (displayCurrency === "system") {
    return { debit: "ISNULL(L.SYSDeb, 0)", credit: "ISNULL(L.SYSCred, 0)" };
  }
  if (displayCurrency === "foreign") {
    return { debit: "ISNULL(L.FCDebit, 0)", credit: "ISNULL(L.FCCredit, 0)" };
  }
  return { debit: "ISNULL(L.Debit, 0)", credit: "ISNULL(L.Credit, 0)" };
};

const orientBalance = (groupMask, debit, credit) =>
  [2, 3, 4].includes(Number(groupMask)) ? credit - debit : debit - credit;

const makeGroupRow = (groupMask, values) => ({
  key: `group-${groupMask}`,
  accountCode: "",
  accountName: GROUP_NAMES[groupMask] || "Other",
  groupMask,
  level: 0,
  isTitle: true,
  isGroup: true,
  ...values,
});

const VALUE_KEYS = [
  "opening",
  "debit",
  "credit",
  "balance",
  "beginningOfYear",
  "currentPeriod",
  "currentYear",
  "currentBalance",
];

const rollUpTitleAccounts = (accounts) => {
  const childrenByFather = new Map();
  accounts.forEach((account) => {
    if (!account.fatherCode) return;
    const children = childrenByFather.get(account.fatherCode) || [];
    children.push(account);
    childrenByFather.set(account.fatherCode, children);
  });

  const completed = new Set();
  const visiting = new Set();
  const rollUp = (account) => {
    if (completed.has(account.key) || visiting.has(account.key)) return account;
    visiting.add(account.key);

    const children = childrenByFather.get(account.key) || [];
    if (account.isTitle && children.length) {
      VALUE_KEYS.forEach((key) => { account[key] = 0; });
      children.forEach((child) => {
        rollUp(child);
        VALUE_KEYS.forEach((key) => { account[key] += child[key]; });
      });
    }

    visiting.delete(account.key);
    completed.add(account.key);
    return account;
  };

  accounts.forEach(rollUp);
  return accounts;
};

const appendTextFilter = (clauses, column, filter, params, key) => {
  const rule = String(filter?.rule || "");
  const fromValue = String(filter?.fromValue || "").trim();
  const toValue = String(filter?.toValue || "").trim();
  if (!rule || !fromValue) return;
  params[`${key}From`] = fromValue;
  if (rule === "notEqual") clauses.push(`ISNULL(${column}, '') <> @${key}From`);
  else if (rule === "contains") {
    params[`${key}From`] = `%${fromValue}%`;
    clauses.push(`ISNULL(${column}, '') LIKE @${key}From`);
  }
  else if (rule === "between" && toValue) {
    params[`${key}To`] = toValue;
    clauses.push(`ISNULL(${column}, '') BETWEEN @${key}From AND @${key}To`);
  } else clauses.push(`ISNULL(${column}, '') = @${key}From`);
};

const appendPropertyFilter = (clauses, alias, propertyFilter = {}) => {
  if (propertyFilter.ignoreProperties !== false) return;
  const selected = (propertyFilter.selectedPropertyNumbers || [])
    .map(Number)
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= 64);
  if (!selected.length) return;
  const operator = propertyFilter.linkMode === "or" ? " OR " : " AND ";
  clauses.push(`(${selected.map((number) => `ISNULL(${alias}.QryGroup${number}, 'N') = 'Y'`).join(operator)})`);
  if (propertyFilter.exactlyMatch) {
    const selectedSet = new Set(selected);
    const unselected = Array.from({ length: 64 }, (_, index) => index + 1)
      .filter((number) => !selectedSet.has(number))
      .map((number) => `ISNULL(${alias}.QryGroup${number}, 'N') <> 'Y'`);
    clauses.push(`(${unselected.join(" AND ")})`);
  }
};

const normalizeCashFlowDocumentTypes = (documentTypes = {}) =>
  Object.fromEntries(CASH_FLOW_DOCUMENT_TYPES.map((type) => [
    type.key,
    Object.prototype.hasOwnProperty.call(documentTypes, type.key)
      ? Boolean(documentTypes[type.key])
      : Boolean(type.defaultSelected),
  ]));

const getSelectedCashAccountCodes = async (criteria = {}, options = {}) => {
  const explicit = [...new Set((criteria.selectedCashAccounts || [])
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
  if (explicit.length) return explicit;
  const cashAccounts = await selectCashFlowAccounts(options);
  return cashAccounts.map((account) => account.code);
};

const getCashOpeningBalance = async (dateFrom, accountCodes, options = {}) => {
  if (!accountCodes.length) return 0;
  const params = { dateFrom };
  const clauses = ["CAST(L.RefDate AS DATE) < CAST(@dateFrom AS DATE)"];
  appendInClause(clauses, "L.Account", accountCodes, params, "cashAccount");
  const rows = await safeQueryRows(
    `
      SELECT CAST(SUM(ISNULL(L.Debit, 0) - ISNULL(L.Credit, 0)) AS DECIMAL(19, 6)) AS Balance
      FROM JDT1 L
      WHERE ${clauses.join("\n        AND ")}
    `,
    params,
    options,
  );
  return toNumber(rows[0]?.Balance);
};

const getBpOpeningBalances = async (dateFrom, criteria = {}, options = {}) => {
  const params = { dateFrom };
  const clauses = ["CAST(L.DueDate AS DATE) < CAST(@dateFrom AS DATE)"];
  if (!criteria.displayFullyReconciledPostings) {
    clauses.push("ABS(ISNULL(L.BalDueDeb, 0) - ISNULL(L.BalDueCred, 0)) > 0.000001");
  }
  const rows = await safeQueryRows(
    `
      SELECT
        BP.CardType,
        CAST(SUM(ISNULL(L.BalDueDeb, 0) - ISNULL(L.BalDueCred, 0)) AS DECIMAL(19, 6)) AS Balance
      FROM JDT1 L
      INNER JOIN OCRD BP ON BP.CardCode = L.ShortName
      WHERE ${clauses.join("\n        AND ")}
      GROUP BY BP.CardType
    `,
    params,
    options,
  );
  const customerBalance = rows
    .filter((row) => row.CardType === "C")
    .reduce((sum, row) => sum + toNumber(row.Balance), 0);
  const vendorBalance = rows
    .filter((row) => row.CardType === "S")
    .reduce((sum, row) => sum + toNumber(row.Balance), 0);

  return {
    customerLiabilities: customerBalance,
    debtsToVendors: -vendorBalance,
  };
};

const getCashFlowDocumentRows = async (criteria = {}, options = {}) => {
  if (!criteria.addMarketingDocuments) return [];
  const selectedTypes = normalizeCashFlowDocumentTypes(criteria.cashFlowDocumentTypes);
  const dateFrom = parseReportDate(criteria.dateFrom);
  const dateTo = parseReportDate(criteria.dateTo);
  const allRows = [];

  for (const type of CASH_FLOW_DOCUMENT_TYPES.filter((item) => selectedTypes[item.key])) {
    if (!(await tableExists(type.table, options))) continue;
    const amountExpr = type.amountMode === "open"
      ? "CASE WHEN ISNULL(H.DocTotal, 0) - ISNULL(H.PaidToDate, 0) < 0 THEN 0 ELSE ISNULL(H.DocTotal, 0) - ISNULL(H.PaidToDate, 0) END"
      : "ISNULL(H.DocTotal, 0)";
    const rows = await safeQueryRows(
      `
      SELECT TOP 5000
          H.DocEntry,
          H.DocNum,
          H.CardCode,
          ISNULL(H.CardName, '') AS CardName,
          H.DocDueDate,
          H.DocDate,
          ISNULL(H.NumAtCard, '') AS Reference,
          ISNULL(H.Project, '') AS Project,
          ISNULL(H.Comments, '') AS Remarks,
          CAST(${amountExpr} AS DECIMAL(19, 6)) AS OpenAmount
        FROM ${type.table} H
        WHERE ISNULL(H.CANCELED, 'N') = 'N'
          AND ISNULL(H.DocStatus, 'O') = 'O'
          AND CAST(H.DocDueDate AS DATE) >= CAST(@dateFrom AS DATE)
          AND CAST(H.DocDueDate AS DATE) <= CAST(@dateTo AS DATE)
          AND ABS(${amountExpr}) > 0.000001
        ORDER BY H.DocDueDate, H.DocNum
      `,
      { dateFrom, dateTo },
      options,
    );

    rows.forEach((row) => {
      const amount = Math.abs(toNumber(row.OpenAmount));
      allRows.push({
        source: "marketing",
        dueDate: parseReportDate(row.DocDueDate),
        origin: type.label,
        transType: type.transType,
        reference: row.Reference || String(row.DocNum || row.DocEntry || ""),
        controlAccount: "",
        glAccountBpCode: row.CardCode || "",
        project: row.Project || "",
        blanketAgreement: "",
        remarks: row.CardName || row.Remarks || type.label,
        debit: type.direction === "incoming" ? amount : 0,
        credit: type.direction === "outgoing" ? amount : 0,
      });
    });
  }

  return allRows;
};

const getCashFlowJournalRows = async (criteria = {}, cashAccountCodes = [], options = {}) => {
  if (!criteria.addJournalVouchers) return [];
  const params = {
    dateFrom: parseReportDate(criteria.dateFrom),
    dateTo: parseReportDate(criteria.dateTo),
  };
  const clauses = [
    "ISNULL(L.TransType, 30) = 30",
    "CAST(L.DueDate AS DATE) >= CAST(@dateFrom AS DATE)",
    "CAST(L.DueDate AS DATE) <= CAST(@dateTo AS DATE)",
    "ABS(ISNULL(L.BalDueDeb, 0) - ISNULL(L.BalDueCred, 0)) > 0.000001",
  ];
  if (cashAccountCodes.length) {
    const cashParams = {};
    const cashClauses = [];
    appendInClause(cashClauses, "L.Account", cashAccountCodes, cashParams, "journalCashAccount");
    Object.assign(params, cashParams);
    clauses.push(`NOT (${cashClauses[0]})`);
  }

  const rows = await safeQueryRows(
    `
      SELECT TOP 5000
        L.TransId,
        L.Line_ID,
        L.DueDate,
        ISNULL(H.Number, L.TransId) AS JournalNumber,
        ISNULL(H.Memo, '') AS Memo,
        ISNULL(H.Ref1, '') AS Reference,
        L.Account,
        ISNULL(A.FormatCode, L.Account) AS AccountCode,
        ISNULL(A.AcctName, '') AS AccountName,
        ISNULL(L.Project, '') AS Project,
        CAST(ISNULL(L.BalDueDeb, 0) - ISNULL(L.BalDueCred, 0) AS DECIMAL(19, 6)) AS Balance
      FROM JDT1 L
      INNER JOIN OJDT H ON H.TransId = L.TransId
      LEFT JOIN OACT A ON A.AcctCode = L.Account
      WHERE ${clauses.join("\n        AND ")}
      ORDER BY L.DueDate, L.TransId, L.Line_ID
    `,
    params,
    options,
  );

  return rows.map((row) => {
    const balance = toNumber(row.Balance);
    return {
      source: "journal",
      dueDate: parseReportDate(row.DueDate),
      origin: "Journal Entry",
      transType: 30,
      reference: row.Reference || String(row.JournalNumber || row.TransId || ""),
      controlAccount: row.AccountCode || row.Account || "",
      glAccountBpCode: row.AccountCode || row.Account || "",
      project: row.Project || "",
      blanketAgreement: "",
      remarks: row.AccountName || row.Memo || "Journal Entry",
      debit: balance > 0 ? balance : 0,
      credit: balance < 0 ? Math.abs(balance) : 0,
    };
  });
};

const getProjectedPostingRows = (criteria = {}) => {
  const fromDate = parseReportDate(criteria.dateFrom);
  const toDate = parseReportDate(criteria.dateTo);
  return (criteria.projectedPostings || [])
    .map((row, index) => ({
      source: "projected",
      dueDate: parseReportDate(row.date),
      origin: "Projected Posting",
      transType: 0,
      reference: "",
      controlAccount: row.securityLevel || "",
      glAccountBpCode: "",
      project: row.project || "",
      blanketAgreement: "",
      remarks: row.description || `Projected Posting ${index + 1}`,
      debit: toNumber(row.incomingTotal),
      credit: toNumber(row.outgoingTotal),
    }))
    .filter((row) => row.dueDate && row.dueDate >= fromDate && row.dueDate <= toDate);
};

const buildCashFlowRows = (items, openingRows, criteria) => {
  const dateFrom = parseReportDate(criteria.dateFrom);
  const dateTo = parseReportDate(criteria.dateTo);
  const interval = criteria.timeInterval || "weekly";
  const rows = [];
  let runningBalance = openingRows.reduce((sum, row) => sum + row.amount, 0);

  rows.push({
    key: "ob",
    rowKind: "openingGroup",
    dueDate: "OB",
    remarks: "Opening Balance",
    debit: 0,
    credit: 0,
    total: runningBalance,
    balance: runningBalance,
  });
  openingRows.forEach((opening, index) => {
    rows.push({
      key: `ob-${opening.key}`,
      rowKind: "openingDetail",
      dueDate: "",
      origin: "",
      reference: "",
      controlAccount: "",
      glAccountBpCode: "",
      project: "",
      blanketAgreement: "",
      remarks: opening.label,
      accountName: "Security Level",
      debit: opening.amount > 0 ? opening.amount : 0,
      credit: opening.amount < 0 ? Math.abs(opening.amount) : 0,
      total: opening.amount,
      balance: "",
      rowNo: index + 1,
    });
  });

  const grouped = new Map();
  items.forEach((item) => {
    const bucket = cashFlowBucketEndDate(item.dueDate, dateFrom, dateTo, interval);
    if (!grouped.has(bucket)) grouped.set(bucket, []);
    grouped.get(bucket).push(item);
  });

  [...grouped.keys()].sort().forEach((bucket) => {
    const bucketItems = grouped.get(bucket);
    const debit = bucketItems.reduce((sum, row) => sum + toNumber(row.debit), 0);
    const credit = bucketItems.reduce((sum, row) => sum + toNumber(row.credit), 0);
    const total = debit - credit;
    runningBalance += total;
    rows.push({
      key: `bucket-${bucket}`,
      rowKind: "period",
      dueDate: bucket,
      origin: "",
      reference: "",
      controlAccount: "",
      glAccountBpCode: "",
      project: "",
      blanketAgreement: "",
      remarks: "",
      debit,
      credit,
      total,
      balance: runningBalance,
    });
    bucketItems.forEach((item, index) => {
      rows.push({
        ...item,
        key: `detail-${bucket}-${index}-${item.origin}-${item.reference}`,
        rowKind: "detail",
        total: toNumber(item.debit) - toNumber(item.credit),
        balance: "",
      });
    });
  });

  return rows.map((row, index) => ({ ...row, rowNo: row.rowNo || index + 1 }));
};

const getCashFlowReport = async (criteria = {}, options = {}) => {
  const dateFrom = parseReportDate(criteria.dateFrom);
  const dateTo = parseReportDate(criteria.dateTo);
  const cashAccountCodes = await getSelectedCashAccountCodes(criteria, options);
  const currencyInfo = await getCompanyCurrencyInfo(options);
  const [cashOpening, bpOpening, documentRows, journalRows] = await Promise.all([
    getCashOpeningBalance(dateFrom, cashAccountCodes, options),
    getBpOpeningBalances(dateFrom, criteria, options),
    getCashFlowDocumentRows(criteria, options),
    getCashFlowJournalRows(criteria, cashAccountCodes, options),
  ]);

  const openingRows = CASH_FLOW_SECURITY_LEVELS.map((level) => ({
    ...level,
    amount: level.key === "cashAccounts"
      ? cashOpening
      : level.key === "customerLiabilities"
        ? bpOpening.customerLiabilities
        : level.key === "debtsToVendors"
          ? -Math.abs(bpOpening.debtsToVendors)
          : 0,
  }));

  const projectedRows = getProjectedPostingRows(criteria);
  const rows = buildCashFlowRows([...documentRows, ...journalRows, ...projectedRows], openingRows, criteria);

  return {
    reportKey: "cash-flow",
    reportTitle: REPORT_TITLES["cash-flow"],
    displayCurrency: criteria.displayCurrency || "local",
    currencyCode: resolveCurrencyCode(criteria.displayCurrency, currencyInfo),
    localCurrency: currencyInfo.localCurrency,
    systemCurrency: currencyInfo.systemCurrency,
    dateFrom,
    dateTo,
    timeInterval: criteria.timeInterval || "weekly",
    selectedCashAccounts: cashAccountCodes,
    documentTypes: normalizeCashFlowDocumentTypes(criteria.cashFlowDocumentTypes),
    rows,
  };
};

const sqlStringLiteral = (value) => `'${String(value || "").replace(/'/g, "''")}'`;

const getPrimaryFormItemExpression = async (options = {}) => {
  const columns = await getTableColumns("JDT1", options);
  const directColumn = [
    "PrimaryFormItem",
    "PrimaryForm",
    "CashFlowLineItem",
    "CashFlowItem",
    "CfwItem",
    "CFWItem",
    "CFWId",
    "CfwId",
    "U_PrimaryFormItem",
    "U_PrimaryForm",
    "U_CashFlowItem",
  ].find((column) => columns.has(column));

  return directColumn ? `CAST(ISNULL(L.[${directColumn}], '') AS NVARCHAR(254))` : "''";
};

const getCashFlowRelevantExpression = async (cashAccountCodes = [], options = {}) => {
  const columns = await getTableColumns("OACT", options);
  const flagColumns = [
    "CashFlowRelevant",
    "CashFlowRel",
    "CfwRelevant",
    "CFWRelevant",
    "CashFlow",
    "CashBox",
  ].filter((column) => columns.has(column));
  const checks = flagColumns.map((column) =>
    `UPPER(CAST(ISNULL(A.[${column}], '') AS NVARCHAR(20))) IN ('Y', 'YES', 'TYES', '1', 'TRUE')`);
  const explicitCodes = [...new Set((cashAccountCodes || []).map((code) => String(code || "").trim()).filter(Boolean))];

  if (explicitCodes.length) {
    checks.push(`L.Account IN (${explicitCodes.map(sqlStringLiteral).join(", ")})`);
  }

  return checks.length ? `(${checks.join(" OR ")})` : "1 = 1";
};

const getCashFlowReferenceReport = async (criteria = {}, options = {}) => {
  const dateFrom = parseReportDate(criteria.dateFrom);
  const dateTo = parseReportDate(criteria.dateTo);
  const currencyInfo = await getCompanyCurrencyInfo(options);
  const cashAccountCodes = await getSelectedCashAccountCodes(criteria, options);
  const { debit, credit } = currencyColumns(criteria.displayCurrency || "local");
  const [primaryFormExpression, relevanceExpression] = await Promise.all([
    getPrimaryFormItemExpression(options),
    getCashFlowRelevantExpression(cashAccountCodes, options),
  ]);
  const unassignedOnly = criteria.cashFlowReferenceMode !== "all";

  const rows = await queryRows(
    `
        SELECT TOP 5000
        H.RefDate,
        ISNULL(H.TransType, L.TransType) AS TransType,
        H.TransId,
        ISNULL(H.Number, H.TransId) AS JournalNumber,
        COALESCE(U.USER_CODE, U.U_NAME, CAST(ISNULL(H.UserSign, '') AS NVARCHAR(50)), '') AS Creator,
        ISNULL(L.Line_ID, 0) AS LineId,
        COALESCE(NULLIF(L.ShortName, ''), L.Account, '') AS EntityCode,
        COALESCE(NULLIF(BP.CardName, ''), NULLIF(A.AcctName, ''), NULLIF(L.ShortName, ''), L.Account, '') AS EntityName,
        CAST(${debit} AS DECIMAL(19, 2)) AS Debit,
        CAST(${credit} AS DECIMAL(19, 2)) AS Credit,
        ${primaryFormExpression} AS PrimaryFormItem
      FROM JDT1 L
      INNER JOIN OJDT H ON H.TransId = L.TransId
      LEFT JOIN OACT A ON A.AcctCode = L.Account
      LEFT JOIN OCRD BP ON BP.CardCode = L.ShortName
      LEFT JOIN OUSR U ON U.USERID = H.UserSign
      WHERE CAST(H.RefDate AS DATE) >= CAST(@dateFrom AS DATE)
        AND CAST(H.RefDate AS DATE) <= CAST(@dateTo AS DATE)
        AND ${relevanceExpression}
        AND (ABS(${debit}) > 0.000001 OR ABS(${credit}) > 0.000001)
        ${unassignedOnly ? `AND NULLIF(LTRIM(RTRIM(${primaryFormExpression})), '') IS NULL` : ""}
      ORDER BY H.RefDate, H.TransId, L.Line_ID
    `,
    { dateFrom, dateTo },
    options,
  );

  const mappedRows = rows.map((row, index) => {
    const transType = Number(row.TransType || 30);
    return {
      key: `${row.TransId}-${row.LineId}-${index}`,
      rowNo: index + 1,
      date: parseReportDate(row.RefDate),
      type: JOURNAL_DOCUMENT_TYPES[transType] || `Transaction ${transType}`,
      transactionNumber: Number(row.TransId || row.JournalNumber || 0),
      journalNumber: Number(row.JournalNumber || 0),
      creator: String(row.Creator || "").trim(),
      entityCode: String(row.EntityCode || "").trim(),
      entityName: String(row.EntityName || "").trim(),
      debit: toNumber(row.Debit),
      credit: toNumber(row.Credit),
      primaryFormItem: String(row.PrimaryFormItem || "").trim(),
    };
  });

  return {
    reportKey: "cash-flow-reference-report",
    reportTitle: REPORT_TITLES["cash-flow-reference-report"],
    displayCurrency: criteria.displayCurrency || "local",
    currencyCode: resolveCurrencyCode(criteria.displayCurrency, currencyInfo),
    localCurrency: currencyInfo.localCurrency,
    systemCurrency: currencyInfo.systemCurrency,
    dateFrom,
    dateTo,
    cashFlowReferenceMode: unassignedOnly ? "unassigned" : "all",
    rows: mappedRows,
    totals: {
      rowCount: mappedRows.length,
      debit: mappedRows.reduce((sum, row) => sum + row.debit, 0),
      credit: mappedRows.reduce((sum, row) => sum + row.credit, 0),
    },
  };
};

const STATEMENT_CASH_FLOW_LAYOUT = [
  { key: "operating", label: "Cash Flow from Operating Activities", level: 0, style: "section-red" },
  { key: "cashReceivedCustomers", label: "Cash Received from Customers (+)", level: 1, children: ["customerInvoicePayments", "customerDownPayments", "supplierCreditNotes", "kotakBankCashFlow"] },
  { key: "customerInvoicePayments", label: "Payments for Invoices from Customers", level: 2, source: "customerInvoicePayments" },
  { key: "customerDownPayments", label: "Down Payments Received from Customers", level: 2, source: "customerDownPayments" },
  { key: "supplierCreditNotes", label: "Purchase Credit Notes Paid by Suppliers", level: 2, source: "supplierCreditNotes" },
  { key: "kotakBankCashFlow", label: "Kotak Bank cash flow", level: 2, source: "kotakBankCashFlow" },
  { key: "cashPaidSupplier", label: "Cash Paid to Supplier (-)", level: 1, children: ["supplierInvoicePayments", "supplierDownPayments", "customerCreditNotes"] },
  { key: "supplierInvoicePayments", label: "Payments for Invoices to Suppliers", level: 2, source: "supplierInvoicePayments" },
  { key: "supplierDownPayments", label: "Down Payments to Suppliers", level: 2, source: "supplierDownPayments" },
  { key: "customerCreditNotes", label: "Sales Credit Notes Paid to Customers", level: 2, source: "customerCreditNotes" },
  { key: "cashPaidUtilities", label: "Cash Paid for Rent/Electricity/Phones (-)", level: 1, children: ["rentPaid", "electricityPaid", "phonesPaid"] },
  { key: "rentPaid", label: "Cash Paid for Rent", level: 2, source: "rentPaid" },
  { key: "electricityPaid", label: "Cash Paid for Electricity", level: 2, source: "electricityPaid" },
  { key: "phonesPaid", label: "Cash Paid for Phones", level: 2, source: "phonesPaid" },
  { key: "cashPaidEmployees", label: "Cash Paid to Employees(-)", level: 1, children: ["employeePayments"] },
  { key: "employeePayments", label: "Payments to Employees, e.g. Wages", level: 2, source: "employeePayments" },
  { key: "otherOperating", label: "Other Operating Payments (+/-)", level: 1, children: ["otherOperatingPayments"] },
  { key: "otherOperatingPayments", label: "Other Operating Payments", level: 2, source: "otherOperatingPayments" },
  { key: "cashGeneratedOperations", label: "Cash Generated from Operations (Summary Line)", level: 1, style: "summary-blue", children: ["cashReceivedCustomers", "cashPaidSupplier", "cashPaidUtilities", "cashPaidEmployees", "otherOperating"] },
  { key: "lessTaxPaid", label: "Less Tax Paid (-)", level: 1, style: "summary-blue", children: ["corporateTaxPaid", "vatPaid"] },
  { key: "corporateTaxPaid", label: "Corporate Income Tax Paid", level: 2, source: "corporateTaxPaid" },
  { key: "vatPaid", label: "VAT Paid", level: 2, source: "vatPaid" },
  { key: "lessInterestPaid", label: "Less Interest Paid (-)", level: 1, style: "summary-blue", children: ["interestPaidOperating"] },
  { key: "interestPaidOperating", label: "Interest Paid - Operating Activities", level: 2, source: "interestPaidOperating" },
  { key: "netOperating", label: "Net Cash Flow from Operating Activities (Sum)", level: 1, style: "summary-blue", children: ["cashGeneratedOperations", "lessTaxPaid", "lessInterestPaid"] },
  { key: "investing", label: "Cash Flow from Investing Activities", level: 0, style: "section-red" },
  { key: "purchaseAssets", label: "Purchase of Non-Current Assets (Equipment) (-)", level: 1, children: ["fixedAssetsPurchasePayments"] },
  { key: "fixedAssetsPurchasePayments", label: "Payments for Purchase of Fixed Assets", level: 2, source: "fixedAssetsPurchasePayments" },
  { key: "purchaseSecurities", label: "Purchase of Securities (-)", level: 1, children: ["sharesPurchasePayments"] },
  { key: "sharesPurchasePayments", label: "Payments for Purchase of Shares/Obligations", level: 2, source: "sharesPurchasePayments" },
  { key: "saleAssets", label: "Sales of Non-Current Assets (+)", level: 1, children: ["fixedAssetsSalePayments"] },
  { key: "fixedAssetsSalePayments", label: "Payments from Sale of Fixed Assets", level: 2, source: "fixedAssetsSalePayments" },
  { key: "netInvesting", label: "Net Cash Flow from Investing Activities (Sum)", level: 1, style: "summary-blue", children: ["purchaseAssets", "purchaseSecurities", "saleAssets"] },
  { key: "financing", label: "Cash Flow from Financing Activities", level: 0, style: "section-red" },
  { key: "loansReceived", label: "Cash Received from Loans (+)", level: 1, source: "loansReceived" },
  { key: "loansPaid", label: "Cash Paid for Loans (-)", level: 1, source: "loansPaid" },
  { key: "netFinancing", label: "Net Cash Flow from Financing Activities (Sum)", level: 1, style: "summary-blue", children: ["loansReceived", "loansPaid"] },
  { key: "netChange", label: "Net Increase/Decrease in Cash and Cash Equivalents", level: 0, style: "summary-blue", children: ["netOperating", "netInvesting", "netFinancing"] },
  { key: "openingCash", label: "Cash and Cash Equivalents at Beginning of Period", level: 0, source: "openingCash" },
  { key: "closingCash", label: "Cash and Cash Equivalents at End of Period", level: 0, style: "summary-blue", children: ["openingCash", "netChange"] },
];

const emptyStatementBuckets = () => Object.fromEntries(
  [
    "customerInvoicePayments", "customerDownPayments", "supplierCreditNotes", "kotakBankCashFlow",
    "supplierInvoicePayments", "supplierDownPayments", "customerCreditNotes", "rentPaid",
    "electricityPaid", "phonesPaid", "employeePayments", "otherOperatingPayments",
    "corporateTaxPaid", "vatPaid", "interestPaidOperating", "fixedAssetsPurchasePayments",
    "sharesPurchasePayments", "fixedAssetsSalePayments", "loansReceived", "loansPaid", "openingCash",
  ].map((key) => [key, 0]),
);

const classifyStatementCashMovement = (row) => {
  const transType = Number(row.TransType || 0);
  const amount = toNumber(row.Amount);
  const text = `${row.Memo || ""} ${row.LineMemo || ""} ${row.AccountName || ""}`.toLowerCase();

  if (transType === 24 && amount > 0) return "customerInvoicePayments";
  if (transType === 203 && amount > 0) return "customerDownPayments";
  if (transType === 19 && amount > 0) return "supplierCreditNotes";
  if (transType === 46 && amount < 0) return "supplierInvoicePayments";
  if (transType === 204 && amount < 0) return "supplierDownPayments";
  if (transType === 14 && amount < 0) return "customerCreditNotes";
  if (text.includes("rent")) return "rentPaid";
  if (text.includes("electric")) return "electricityPaid";
  if (text.includes("phone") || text.includes("mobile") || text.includes("telephone")) return "phonesPaid";
  if (text.includes("wage") || text.includes("salary") || text.includes("employee")) return "employeePayments";
  if (text.includes("income tax") || text.includes("corporate tax")) return "corporateTaxPaid";
  if (text.includes("vat") || text.includes("gst") || text.includes("tax")) return "vatPaid";
  if (text.includes("interest")) return "interestPaidOperating";
  if (text.includes("fixed asset") || text.includes("equipment")) return amount < 0 ? "fixedAssetsPurchasePayments" : "fixedAssetsSalePayments";
  if (text.includes("share") || text.includes("security") || text.includes("obligation")) return "sharesPurchasePayments";
  if (text.includes("loan")) return amount > 0 ? "loansReceived" : "loansPaid";
  return "otherOperatingPayments";
};

const getStatementCashMovementBuckets = async (criteria = {}, options = {}) => {
  const dateFrom = parseReportDate(criteria.dateFrom);
  const dateTo = parseReportDate(criteria.dateTo);
  const dateColumn = criteria.dateType === "documentDate"
    ? "L.TaxDate"
    : criteria.dateType === "dueDate" ? "L.DueDate" : "L.RefDate";
  const buckets = emptyStatementBuckets();
  const cashAccountCodes = await getSelectedCashAccountCodes(criteria, options);
  buckets.openingCash = await getCashOpeningBalance(dateFrom, cashAccountCodes, options);
  if (!cashAccountCodes.length) return buckets;

  const params = { dateFrom, dateTo };
  const clauses = [
    `CAST(${dateColumn} AS DATE) >= CAST(@dateFrom AS DATE)`,
    `CAST(${dateColumn} AS DATE) <= CAST(@dateTo AS DATE)`,
  ];
  appendInClause(clauses, "L.Account", cashAccountCodes, params, "statementCashAccount");

  const rows = await safeQueryRows(
    `
      SELECT TOP 5000
        ISNULL(L.TransType, H.TransType) AS TransType,
        ISNULL(H.Memo, '') AS Memo,
        ISNULL(L.LineMemo, '') AS LineMemo,
        ISNULL(A.AcctName, '') AS AccountName,
        CAST(ISNULL(L.Debit, 0) - ISNULL(L.Credit, 0) AS DECIMAL(19, 6)) AS Amount
      FROM JDT1 L
      INNER JOIN OJDT H ON H.TransId = L.TransId
      LEFT JOIN OACT A ON A.AcctCode = L.ContraAct
      WHERE ${clauses.join("\n        AND ")}
        AND ABS(ISNULL(L.Debit, 0) - ISNULL(L.Credit, 0)) > 0.000001
    `,
    params,
    options,
  );

  rows.forEach((row) => {
    const key = classifyStatementCashMovement(row);
    buckets[key] = toNumber(buckets[key]) + toNumber(row.Amount);
  });

  return buckets;
};

const resolveStatementAmounts = (layout, sourceValues) => {
  const byKey = new Map(layout.map((row) => [row.key, { ...row }]));
  const resolving = new Set();
  const valueFor = (key) => {
    const row = byKey.get(key);
    if (!row || resolving.has(key)) return 0;
    resolving.add(key);
    let value = 0;
    if (row.source) value = toNumber(sourceValues[row.source]);
    else if (row.children) value = row.children.reduce((sum, childKey) => sum + valueFor(childKey), 0);
    row.amount = value;
    resolving.delete(key);
    return value;
  };
  layout.forEach((row) => valueFor(row.key));
  return byKey;
};

const getStatementCashFlowsReport = async (criteria = {}, options = {}) => {
  const actualCriteria = {
    ...criteria,
    dateFrom: criteria.dateFrom,
    dateTo: criteria.dateTo,
    dateType: criteria.actualDateType || criteria.dateType || "postingDate",
  };
  const previousCriteria = {
    ...criteria,
    dateFrom: criteria.previousDateFrom,
    dateTo: criteria.previousDateTo,
    dateType: criteria.previousDateType || criteria.dateType || "postingDate",
  };
  const [actualBuckets, previousBuckets, currencyInfo] = await Promise.all([
    getStatementCashMovementBuckets(actualCriteria, options),
    criteria.includePreviousPeriod && previousCriteria.dateFrom && previousCriteria.dateTo
      ? getStatementCashMovementBuckets(previousCriteria, options)
      : Promise.resolve(emptyStatementBuckets()),
    getCompanyCurrencyInfo(options),
  ]);
  const actualRows = resolveStatementAmounts(STATEMENT_CASH_FLOW_LAYOUT, actualBuckets);
  const previousRows = resolveStatementAmounts(STATEMENT_CASH_FLOW_LAYOUT, previousBuckets);

  let lineNo = 0;
  const rows = STATEMENT_CASH_FLOW_LAYOUT.map((definition, index) => {
    const showLineNo = definition.style !== "section-red";
    if (showLineNo) lineNo += 1;
    return {
      key: definition.key,
      rowNo: index + 1,
      lineNo: showLineNo ? lineNo : "",
      label: definition.label,
      level: definition.level,
      style: definition.style || "",
      actualPeriod: toNumber(actualRows.get(definition.key)?.amount),
      previousPeriod: criteria.includePreviousPeriod ? toNumber(previousRows.get(definition.key)?.amount) : null,
    };
  });

  return {
    reportKey: "statement-of-cash-flows",
    reportTitle: REPORT_TITLES["statement-of-cash-flows"],
    displayCurrency: criteria.displayCurrency || "local",
    currencyCode: resolveCurrencyCode(criteria.displayCurrency, currencyInfo),
    localCurrency: currencyInfo.localCurrency,
    systemCurrency: currencyInfo.systemCurrency,
    dateFrom: parseReportDate(criteria.dateFrom),
    dateTo: parseReportDate(criteria.dateTo),
    dateType: criteria.actualDateType || criteria.dateType || "postingDate",
    previousDateFrom: criteria.includePreviousPeriod ? parseReportDate(criteria.previousDateFrom) : "",
    previousDateTo: criteria.includePreviousPeriod ? parseReportDate(criteria.previousDateTo) : "",
    templateCode: criteria.templateCode || "",
    rows,
  };
};

const shiftDateByMonths = (isoDate, months) => {
  const date = dateFromIso(isoDate);
  date.setMonth(date.getMonth() + months);
  return isoFromDate(date);
};

const shiftDateByYears = (isoDate, years) => {
  const date = dateFromIso(isoDate);
  date.setFullYear(date.getFullYear() + years);
  return isoFromDate(date);
};

const getPeriodRangeForBusinessAssessment = async (criteria = {}, options = {}) => {
  const periodCode = String(criteria.periodCode || "").trim();
  if (periodCode) {
    const periods = await selectPostingPeriods(options);
    const selected = periods.find((period) => period.code === periodCode);
    if (selected?.dateFrom && selected?.dateTo) {
      return {
        periodCode: selected.code,
        periodName: selected.name,
        periodNumber: selected.periodNumber,
        dateFrom: selected.dateFrom,
        dateTo: selected.dateTo,
      };
    }
  }

  const dateFrom = parseReportDate(criteria.dateFrom);
  const dateTo = parseReportDate(criteria.dateTo);
  return {
    periodCode,
    periodName: periodCode,
    periodNumber: 0,
    dateFrom,
    dateTo,
  };
};

const getBusinessAssessmentActuals = async (dateFrom, dateTo, displayCurrency, options = {}) => {
  const { debit, credit } = currencyColumns(displayCurrency);
  const rows = await queryRows(
    `
      SELECT
        A.AcctCode,
        ISNULL(A.FormatCode, A.AcctCode) AS FormatCode,
        ISNULL(A.AcctName, '') AS AcctName,
        ISNULL(A.FatherNum, '') AS FatherNum,
        CAST(ISNULL(A.GroupMask, 0) AS INT) AS GroupMask,
        CAST(ISNULL(A.Levels, 1) AS INT) AS Levels,
        ISNULL(A.Postable, 'Y') AS Postable,
        CAST(SUM(CASE
          WHEN CAST(L.RefDate AS DATE) >= CAST(@dateFrom AS DATE)
           AND CAST(L.RefDate AS DATE) <= CAST(@dateTo AS DATE)
          THEN ${debit} ELSE 0 END) AS DECIMAL(19, 2)) AS Debit,
        CAST(SUM(CASE
          WHEN CAST(L.RefDate AS DATE) >= CAST(@dateFrom AS DATE)
           AND CAST(L.RefDate AS DATE) <= CAST(@dateTo AS DATE)
          THEN ${credit} ELSE 0 END) AS DECIMAL(19, 2)) AS Credit
      FROM OACT A
      LEFT JOIN JDT1 L ON L.Account = A.AcctCode
      WHERE A.GroupMask IN (4, 5)
      GROUP BY A.AcctCode, A.FormatCode, A.AcctName, A.FatherNum, A.GroupMask, A.Levels, A.Postable
      ORDER BY A.GroupMask, A.AcctCode
    `,
    { dateFrom, dateTo },
    options,
  );

  const accounts = rows.map((row) => ({
    key: String(row.AcctCode || "").trim(),
    accountCode: String(row.FormatCode || row.AcctCode || "").trim(),
    accountName: String(row.AcctName || "").trim(),
    fatherCode: String(row.FatherNum || "").trim(),
    groupMask: Number(row.GroupMask || 0),
    level: Math.max(1, Number(row.Levels || 1)),
    isTitle: row.Postable === "N",
    amount: orientBalance(Number(row.GroupMask || 0), toNumber(row.Debit), toNumber(row.Credit)),
  }));

  const byCode = new Map(accounts.map((account) => [account.key, account]));
  const childrenByFather = new Map();
  accounts.forEach((account) => {
    if (!account.fatherCode) return;
    const children = childrenByFather.get(account.fatherCode) || [];
    children.push(account);
    childrenByFather.set(account.fatherCode, children);
  });

  const visiting = new Set();
  const rollUp = (account) => {
    if (!account?.isTitle || visiting.has(account.key)) return toNumber(account?.amount);
    visiting.add(account.key);
    const children = childrenByFather.get(account.key) || [];
    account.amount = children.reduce((sum, child) => sum + rollUp(child), 0);
    visiting.delete(account.key);
    return account.amount;
  };
  accounts.forEach((account) => rollUp(byCode.get(account.key)));
  return accounts;
};

const getBusinessAssessmentReport = async (criteria = {}, options = {}) => {
  const selectedPeriod = await getPeriodRangeForBusinessAssessment(criteria, options);
  const dateFrom = selectedPeriod.dateFrom;
  const dateTo = selectedPeriod.dateTo;
  const reportMode = criteria.reportMode || "budgetComparison";
  const comparisonFrom = reportMode === "yearlyComparison"
    ? shiftDateByYears(dateFrom, -1)
    : shiftDateByMonths(dateFrom, -1);
  const comparisonTo = reportMode === "yearlyComparison"
    ? shiftDateByYears(dateTo, -1)
    : shiftDateByMonths(dateTo, -1);
  const [currentAccounts, comparisonAccounts, currencyInfo] = await Promise.all([
    getBusinessAssessmentActuals(dateFrom, dateTo, criteria.displayCurrency, options),
    reportMode === "budgetComparison"
      ? Promise.resolve([])
      : getBusinessAssessmentActuals(comparisonFrom, comparisonTo, criteria.displayCurrency, options),
    getCompanyCurrencyInfo(options),
  ]);
  const comparisonByCode = new Map(comparisonAccounts.map((account) => [account.key, account.amount]));
  const hideGlAccounts = Boolean(criteria.hideGlAccounts);
  const hideZeroBalance = criteria.hideZeroBalance !== false;
  const groupRows = [4, 5].map((groupMask) => {
    const groupAccounts = currentAccounts.filter((account) => account.groupMask === groupMask && !account.isTitle);
    const currentAmount = groupAccounts.reduce((sum, account) => sum + toNumber(account.amount), 0);
    const comparisonAmount = reportMode === "budgetComparison"
      ? 0
      : groupAccounts.reduce((sum, account) => sum + toNumber(comparisonByCode.get(account.key)), 0);
    return {
      key: `group-${groupMask}`,
      accountCode: "",
      accountName: GROUP_NAMES[groupMask] || "Other",
      groupMask,
      level: 0,
      isGroup: true,
      isTitle: true,
      currentAmount,
      comparisonAmount,
      variance: currentAmount - comparisonAmount,
      variancePercent: Math.abs(comparisonAmount) >= 0.005 ? ((currentAmount - comparisonAmount) / Math.abs(comparisonAmount)) * 100 : null,
    };
  });

  const detailRows = hideGlAccounts ? [] : currentAccounts
    .filter((account) => !account.isTitle)
    .map((account) => {
      const comparisonAmount = reportMode === "budgetComparison" ? 0 : toNumber(comparisonByCode.get(account.key));
      return {
        key: account.key,
        accountCode: account.accountCode,
        accountName: account.accountName,
        groupMask: account.groupMask,
        level: account.level,
        isGroup: false,
        isTitle: false,
        currentAmount: toNumber(account.amount),
        comparisonAmount,
        variance: toNumber(account.amount) - comparisonAmount,
        variancePercent: Math.abs(comparisonAmount) >= 0.005 ? ((toNumber(account.amount) - comparisonAmount) / Math.abs(comparisonAmount)) * 100 : null,
      };
    });

  const rows = [];
  groupRows.forEach((groupRow) => {
    const children = detailRows.filter((row) => row.groupMask === groupRow.groupMask);
    if (!hideZeroBalance || Math.abs(groupRow.currentAmount) >= 0.005 || Math.abs(groupRow.comparisonAmount) >= 0.005 || children.length) {
      rows.push(groupRow);
    }
    children
      .filter((row) => !hideZeroBalance || Math.abs(row.currentAmount) >= 0.005 || Math.abs(row.comparisonAmount) >= 0.005)
      .forEach((row) => rows.push(row));
  });

  return {
    reportKey: "business-assessment-report",
    reportTitle: REPORT_TITLES["business-assessment-report"],
    displayCurrency: criteria.displayCurrency || "local",
    currencyCode: resolveCurrencyCode(criteria.displayCurrency, currencyInfo),
    localCurrency: currencyInfo.localCurrency,
    systemCurrency: currencyInfo.systemCurrency,
    dateFrom,
    dateTo,
    comparisonDateFrom: reportMode === "budgetComparison" ? "" : comparisonFrom,
    comparisonDateTo: reportMode === "budgetComparison" ? "" : comparisonTo,
    periodCode: selectedPeriod.periodCode,
    periodName: selectedPeriod.periodName,
    templateCode: criteria.templateCode || "",
    reportMode,
    rows: rows.map((row, index) => ({ ...row, rowNo: index + 1 })),
  };
};

const getReport = async (reportKey, criteria = {}, options = {}) => {
  if (reportKey === "cash-flow") {
    return getCashFlowReport(criteria, options);
  }
  if (reportKey === "cash-flow-reference-report") {
    return getCashFlowReferenceReport(criteria, options);
  }
  if (reportKey === "statement-of-cash-flows") {
    return getStatementCashFlowsReport(criteria, options);
  }
  if (reportKey === "business-assessment-report") {
    return getBusinessAssessmentReport(criteria, options);
  }

  const selectedGroups = reportKey === "trial-balance"
    ? REPORT_GROUPS[reportKey].filter((group) => (criteria.selectedAccountGroups || []).includes(group))
    : REPORT_GROUPS[reportKey];
  if (!selectedGroups) {
    const error = new Error("This financial statement is not configured.");
    error.status = 404;
    throw error;
  }

  const dateFrom = String(criteria.dateFrom || "").trim();
  const dateTo = String(criteria.dateTo || "").trim();
  const fiscalYearFrom = String(criteria.fiscalYearFrom || dateFrom).trim();
  const { debit, credit } = currencyColumns(criteria.displayCurrency);
  const params = { dateFrom, dateTo, fiscalYearFrom };
  const dateColumn = criteria.dateType === "documentDate"
    ? "L.TaxDate"
    : criteria.dateType === "dueDate" ? "L.DueDate" : "L.RefDate";
  const lineClauses = [];
  const headerReferenceColumns = ["H.Ref1", "H.Ref2", "H.Ref3"];
  (criteria.referenceFilters || []).slice(0, 3).forEach((filter, index) => {
    appendTextFilter(lineClauses, headerReferenceColumns[index], filter, params, `ref${index}`);
  });
  (criteria.udfFilters || []).forEach((filter, index) => {
    const alias = String(filter?.fieldCode || "").replace(/^U_/, "");
    if (!/^[A-Za-z0-9_]+$/.test(alias)) return;
    appendTextFilter(lineClauses, `H.[U_${alias}]`, filter, params, `udf${index}`);
  });

  const rows = await queryRows(
    `
      SELECT
        A.AcctCode,
        ISNULL(A.FormatCode, A.AcctCode) AS FormatCode,
        ISNULL(A.AcctName, '') AS AcctName,
        ISNULL(A.FrgnName, '') AS FrgnName,
        ISNULL(A.ExportCode, '') AS ExportCode,
        ISNULL(A.FatherNum, '') AS FatherNum,
        CAST(ISNULL(A.GroupMask, 0) AS INT) AS GroupMask,
        CAST(ISNULL(A.Levels, 1) AS INT) AS Levels,
        ISNULL(A.Postable, 'Y') AS Postable,
        CAST(SUM(CASE
          WHEN CAST(${dateColumn} AS DATE) < CAST(@dateFrom AS DATE)
          THEN ${debit} ELSE 0 END) AS DECIMAL(19, 2)) AS OpeningDebit,
        CAST(SUM(CASE
          WHEN CAST(${dateColumn} AS DATE) < CAST(@dateFrom AS DATE)
          THEN ${credit} ELSE 0 END) AS DECIMAL(19, 2)) AS OpeningCredit,
        CAST(SUM(CASE
          WHEN CAST(${dateColumn} AS DATE) >= CAST(@dateFrom AS DATE)
            AND CAST(${dateColumn} AS DATE) <= CAST(@dateTo AS DATE)
          THEN ${debit} ELSE 0 END) AS DECIMAL(19, 2)) AS PeriodDebit,
        CAST(SUM(CASE
          WHEN CAST(${dateColumn} AS DATE) >= CAST(@dateFrom AS DATE)
            AND CAST(${dateColumn} AS DATE) <= CAST(@dateTo AS DATE)
          THEN ${credit} ELSE 0 END) AS DECIMAL(19, 2)) AS PeriodCredit,
        CAST(SUM(CASE
          WHEN CAST(${dateColumn} AS DATE) >= CAST(@fiscalYearFrom AS DATE)
            AND CAST(${dateColumn} AS DATE) <= CAST(@dateTo AS DATE)
          THEN ${debit} ELSE 0 END) AS DECIMAL(19, 2)) AS YearDebit,
        CAST(SUM(CASE
          WHEN CAST(${dateColumn} AS DATE) >= CAST(@fiscalYearFrom AS DATE)
            AND CAST(${dateColumn} AS DATE) <= CAST(@dateTo AS DATE)
          THEN ${credit} ELSE 0 END) AS DECIMAL(19, 2)) AS YearCredit,
        CAST(SUM(CASE
          WHEN CAST(${dateColumn} AS DATE) <= CAST(@dateTo AS DATE)
          THEN ${debit} ELSE 0 END) AS DECIMAL(19, 2)) AS ToDateDebit,
        CAST(SUM(CASE
          WHEN CAST(${dateColumn} AS DATE) <= CAST(@dateTo AS DATE)
          THEN ${credit} ELSE 0 END) AS DECIMAL(19, 2)) AS ToDateCredit
      FROM OACT A
      LEFT JOIN JDT1 L ON L.Account = A.AcctCode
      LEFT JOIN OJDT H ON H.TransId = L.TransId
      WHERE A.GroupMask IN (${selectedGroups.length ? selectedGroups.join(", ") : "0"})
        ${lineClauses.length ? `AND ${lineClauses.join("\n        AND ")}` : ""}
      GROUP BY A.AcctCode, A.FormatCode, A.AcctName, A.FrgnName, A.ExportCode, A.FatherNum, A.GroupMask, A.Levels, A.Postable
      ORDER BY A.GroupMask, A.AcctCode
    `,
    params,
    options,
  );
  const bpClauses = [];
  const bpFrom = String(criteria.bpFrom || "").trim();
  const bpTo = String(criteria.bpTo || "").trim();
  const customerGroup = String(criteria.customerGroup || "All").trim();
  const vendorGroup = String(criteria.vendorGroup || "All").trim();
  if (bpFrom) {
    params.bpFrom = bpFrom;
    bpClauses.push("BP.CardCode >= @bpFrom");
  }
  if (bpTo) {
    params.bpTo = bpTo;
    bpClauses.push("BP.CardCode <= @bpTo");
  }
  if (customerGroup !== "All") {
    if (customerGroup === "None") bpClauses.push("(BP.CardType <> 'C' OR BP.GroupCode IS NULL)");
    else {
      params.customerGroup = customerGroup;
      bpClauses.push("(BP.CardType <> 'C' OR CAST(BP.GroupCode AS NVARCHAR(50)) = @customerGroup)");
    }
  }
  if (vendorGroup !== "All") {
    if (vendorGroup === "None") bpClauses.push("(BP.CardType <> 'S' OR BP.GroupCode IS NULL)");
    else {
      params.vendorGroup = vendorGroup;
      bpClauses.push("(BP.CardType <> 'S' OR CAST(BP.GroupCode AS NVARCHAR(50)) = @vendorGroup)");
    }
  }
  appendPropertyFilter(bpClauses, "BP", criteria.propertyFilter);

  const businessPartnerRows = reportKey === "trial-balance" && criteria.includeBusinessPartners !== false
    ? await queryRows(
      `
        SELECT
          BP.CardCode,
          ISNULL(BP.CardName, '') AS CardName,
          ISNULL(BP.CardType, '') AS CardType,
          CAST(ISNULL(BP.GroupCode, 0) AS INT) AS GroupCode,
          ISNULL(G.GroupName, CASE WHEN BP.CardType = 'C' THEN 'Customers' ELSE 'Vendors' END) AS GroupName,
          CAST(SUM(CASE
            WHEN CAST(${dateColumn} AS DATE) < CAST(@dateFrom AS DATE)
            THEN ${debit} ELSE 0 END) AS DECIMAL(19, 2)) AS OpeningDebit,
          CAST(SUM(CASE
            WHEN CAST(${dateColumn} AS DATE) < CAST(@dateFrom AS DATE)
            THEN ${credit} ELSE 0 END) AS DECIMAL(19, 2)) AS OpeningCredit,
          CAST(SUM(CASE
            WHEN CAST(${dateColumn} AS DATE) >= CAST(@dateFrom AS DATE)
              AND CAST(${dateColumn} AS DATE) <= CAST(@dateTo AS DATE)
            THEN ${debit} ELSE 0 END) AS DECIMAL(19, 2)) AS PeriodDebit,
          CAST(SUM(CASE
            WHEN CAST(${dateColumn} AS DATE) >= CAST(@dateFrom AS DATE)
              AND CAST(${dateColumn} AS DATE) <= CAST(@dateTo AS DATE)
            THEN ${credit} ELSE 0 END) AS DECIMAL(19, 2)) AS PeriodCredit
        FROM OCRD BP
        LEFT JOIN JDT1 L ON L.ShortName = BP.CardCode
        LEFT JOIN OCRG G ON G.GroupCode = BP.GroupCode
        WHERE ${bpClauses.length ? bpClauses.join("\n          AND ") : "1 = 1"}
        GROUP BY BP.CardCode, BP.CardName, BP.CardType, BP.GroupCode, G.GroupName
        ORDER BY BP.CardType, BP.GroupCode, BP.CardCode
      `,
      params,
      options,
    )
    : [];

  const mappedAccounts = rows.map((row) => {
    const groupMask = Number(row.GroupMask || 0);
    const openingDebit = toNumber(row.OpeningDebit);
    const openingCredit = toNumber(row.OpeningCredit);
    const periodDebit = toNumber(row.PeriodDebit);
    const periodCredit = toNumber(row.PeriodCredit);
    const yearDebit = toNumber(row.YearDebit);
    const yearCredit = toNumber(row.YearCredit);
    const toDateDebit = toNumber(row.ToDateDebit);
    const toDateCredit = toNumber(row.ToDateCredit);

    return {
      key: row.AcctCode,
      accountCode: row.FormatCode || row.AcctCode || "",
      accountName: row.AcctName || "",
      foreignName: row.FrgnName || "",
      externalCode: row.ExportCode || "",
      fatherCode: row.FatherNum || "",
      groupMask,
      level: Math.max(1, Number(row.Levels || 1)),
      isTitle: row.Postable === "N",
      isGroup: false,
      entityType: "account",
      opening: orientBalance(groupMask, openingDebit, openingCredit),
      debit: periodDebit,
      credit: periodCredit,
      balance: orientBalance(groupMask, openingDebit + periodDebit, openingCredit + periodCredit),
      beginningOfYear: orientBalance(groupMask, toDateDebit - yearDebit, toDateCredit - yearCredit),
      currentPeriod: orientBalance(groupMask, periodDebit, periodCredit),
      currentYear: orientBalance(groupMask, yearDebit, yearCredit),
      currentBalance: orientBalance(groupMask, toDateDebit, toDateCredit),
    };
  });

  rollUpTitleAccounts(mappedAccounts);

  const visibleAccounts = mappedAccounts.filter((account) => {
    if (reportKey === "trial-balance" && criteria.includeGlAccounts === false) return false;
    if (!criteria.expanded && account.isTitle) return false;
    if (reportKey === "profit-and-loss-statement" && account.isTitle) return true;
    if (criteria.includeZeroBalance || (reportKey === "trial-balance" && criteria.hideZeroBalance === false && criteria.hideNoPostings === false)) return true;
    if (reportKey === "trial-balance") {
      const hasPosting = [account.opening, account.debit, account.credit].some((value) => Math.abs(value) >= 0.005);
      const hasBalance = Math.abs(account.balance) >= 0.005;
      return (!criteria.hideNoPostings || hasPosting) && (!criteria.hideZeroBalance || hasBalance);
    }
    const values = reportKey === "trial-balance"
      ? [account.opening, account.debit, account.credit, account.balance]
      : reportKey === "balance-sheet"
        ? [account.beginningOfYear, account.currentBalance]
        : [account.currentPeriod, account.currentYear];
    return values.some((value) => Math.abs(value) >= 0.005);
  });

  const outputRows = [];
  if (reportKey === "trial-balance") {
    const partners = businessPartnerRows
      .map((row) => {
        const opening = toNumber(row.OpeningDebit) - toNumber(row.OpeningCredit);
        const debitValue = toNumber(row.PeriodDebit);
        const creditValue = toNumber(row.PeriodCredit);
        return {
          key: `bp-${row.CardCode}`,
          entityCode: row.CardCode || "",
          accountCode: row.CardCode || "",
          accountName: row.CardName || "",
          cardType: row.CardType || "",
          bpGroupCode: Number(row.GroupCode || 0),
          bpGroupName: row.GroupName || (row.CardType === "C" ? "Customers" : "Vendors"),
          groupMask: 0,
          level: 1,
          isTitle: false,
          isGroup: false,
          entityType: "bp",
          opening,
          debit: debitValue,
          credit: creditValue,
          balance: opening + debitValue - creditValue,
        };
      })
      .filter((partner) => {
        if (criteria.includeZeroBalance || (criteria.hideZeroBalance === false && criteria.hideNoPostings === false)) return true;
        const hasPosting = [partner.opening, partner.debit, partner.credit].some((value) => Math.abs(value) >= 0.005);
        const hasBalance = Math.abs(partner.balance) >= 0.005;
        return (!criteria.hideNoPostings || hasPosting) && (!criteria.hideZeroBalance || hasBalance);
      });

    const partnerTypes = [
      { code: "C", label: "Customers" },
      { code: "S", label: "Vendors" },
      { code: "L", label: "Leads" },
    ];
    partnerTypes.forEach(({ code, label }) => {
      const typePartners = partners.filter((partner) => partner.cardType === code);
      if (!typePartners.length) return;
      outputRows.push({
        key: `bp-section-${code}`,
        accountCode: "",
        accountName: `${label}:`,
        level: 0,
        isTitle: true,
        isGroup: false,
        rowKind: "bpSection",
        entityType: "group",
      });

      const groups = new Map();
      typePartners.forEach((partner) => {
        const key = `${partner.bpGroupCode}:${partner.bpGroupName}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(partner);
      });
      groups.forEach((groupPartners, groupKey) => {
        const groupName = groupPartners[0]?.bpGroupName || label;
        const totals = groupPartners.reduce((sum, partner) => ({
          opening: sum.opening + partner.opening,
          debit: sum.debit + partner.debit,
          credit: sum.credit + partner.credit,
          balance: sum.balance + partner.balance,
        }), { opening: 0, debit: 0, credit: 0, balance: 0 });
        outputRows.push({
          key: `bp-group-${code}-${groupKey}`,
          accountCode: "",
          accountName: groupName,
          level: 1,
          isTitle: true,
          isGroup: false,
          rowKind: "bpGroupHeading",
          entityType: "group",
        });
        outputRows.push(...groupPartners.map((partner) => ({
          ...partner,
          level: 1,
          rowKind: "detail",
        })));
        outputRows.push({
          key: `bp-total-${code}-${groupKey}`,
          accountCode: "",
          accountName: `Total ${groupName}`,
          level: 1,
          isTitle: true,
          isGroup: true,
          rowKind: "bpSubtotal",
          entityType: "group",
          ...totals,
        });
      });
    });
  }

  selectedGroups.forEach((groupMask) => {
    const accounts = visibleAccounts.filter((account) => account.groupMask === groupMask);
    if (!accounts.length && !criteria.includeZeroBalance) return;

    const groupAccounts = mappedAccounts.filter(
      (account) => account.groupMask === groupMask && !account.isTitle,
    );
    const totals = groupAccounts.reduce((sum, account) => ({
      opening: sum.opening + account.opening,
      debit: sum.debit + account.debit,
      credit: sum.credit + account.credit,
      balance: sum.balance + account.balance,
      beginningOfYear: sum.beginningOfYear + account.beginningOfYear,
      currentPeriod: sum.currentPeriod + account.currentPeriod,
      currentYear: sum.currentYear + account.currentYear,
      currentBalance: sum.currentBalance + account.currentBalance,
    }), {
      opening: 0,
      debit: 0,
      credit: 0,
      balance: 0,
      beginningOfYear: 0,
      currentPeriod: 0,
      currentYear: 0,
      currentBalance: 0,
    });

    outputRows.push(makeGroupRow(groupMask, totals), ...accounts);
  });
  const currencyInfo = await getCompanyCurrencyInfo(options);

  return {
    reportKey,
    reportTitle: REPORT_TITLES[reportKey],
    displayCurrency: criteria.displayCurrency || "local",
    currencyCode: resolveCurrencyCode(criteria.displayCurrency, currencyInfo),
    localCurrency: currencyInfo.localCurrency,
    systemCurrency: currencyInfo.systemCurrency,
    dateFrom,
    dateTo,
    fiscalYearFrom,
    rows: outputRows.map((row, index) => ({ ...row, rowNo: index + 1 })),
  };
};

module.exports = { getLookups, getReport };
