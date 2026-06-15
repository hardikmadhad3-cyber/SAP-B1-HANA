const db = require("../dbService");

const ACCOUNT_GROUPS = [
  { groupMask: 1, name: "Asset" },
  { groupMask: 2, name: "Liability" },
  { groupMask: 3, name: "Equity" },
  { groupMask: 4, name: "Revenue" },
  { groupMask: 5, name: "Expenditure" },
];

const DOCUMENT_TYPES = {
  13: { label: "A/R Invoice", prefix: "IN" },
  14: { label: "A/R Credit Memo", prefix: "CN" },
  15: { label: "Delivery", prefix: "DN" },
  17: { label: "Sales Order", prefix: "SO" },
  18: { label: "A/P Invoice", prefix: "PU" },
  19: { label: "A/P Credit Memo", prefix: "PC" },
  20: { label: "Goods Receipt PO", prefix: "PD" },
  22: { label: "Purchase Order", prefix: "PO" },
  23: { label: "Sales Quotation", prefix: "SQ" },
  24: { label: "Incoming Payment", prefix: "RC" },
  30: { label: "Journal Entry", prefix: "JE" },
  46: { label: "Outgoing Payment", prefix: "PS" },
  59: { label: "Goods Receipt", prefix: "GR" },
  60: { label: "Goods Issue", prefix: "GI" },
  67: { label: "Inventory Transfer", prefix: "IM" },
  1250000001: { label: "Inventory Transfer Request", prefix: "TR" },
};

const normalizeText = (value) => String(value || "").trim();
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
};

const appendInClause = (clauses, columnSql, values, params, prefix) => {
  const normalized = [...new Set((values || []).map(normalizeText).filter(Boolean))];
  if (!normalized.length) return;

  const placeholders = normalized.map((value, index) => {
    const key = `${prefix}${index}`;
    params[key] = value;
    return `@${key}`;
  });
  clauses.push(`${columnSql} IN (${placeholders.join(", ")})`);
};

const appendNumberInClause = (clauses, columnSql, values, params, prefix) => {
  const normalized = [...new Set((values || []).map(Number).filter((value) => Number.isInteger(value)))];
  if (!normalized.length) return;

  const placeholders = normalized.map((value, index) => {
    const key = `${prefix}${index}`;
    params[key] = value;
    return `@${key}`;
  });
  clauses.push(`${columnSql} IN (${placeholders.join(", ")})`);
};

const appendRange = (clauses, columnSql, fromValue, toValue, params, prefix) => {
  const from = normalizeText(fromValue);
  const to = normalizeText(toValue);
  if (from) {
    params[`${prefix}From`] = from;
    clauses.push(`${columnSql} >= @${prefix}From`);
  }
  if (to) {
    params[`${prefix}To`] = to;
    clauses.push(`${columnSql} <= @${prefix}To`);
  }
};

const appendDateRange = (clauses, columnSql, range, params, prefix) => {
  if (!range?.enabled) return;
  const from = normalizeText(range.from);
  const to = normalizeText(range.to);
  if (from) {
    params[`${prefix}From`] = from;
    clauses.push(`CAST(${columnSql} AS DATE) >= CAST(@${prefix}From AS DATE)`);
  }
  if (to) {
    params[`${prefix}To`] = to;
    clauses.push(`CAST(${columnSql} AS DATE) <= CAST(@${prefix}To AS DATE)`);
  }
};

const getPropertyNumbers = (propertyFilter = {}) => {
  if (propertyFilter.ignoreProperties !== false) return [];
  return (propertyFilter.selectedPropertyNumbers || [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64);
};

const appendPropertyFilter = (clauses, propertyFilter = {}) => {
  const selected = getPropertyNumbers(propertyFilter);
  if (!selected.length) return;

  const selectedSet = new Set(selected);
  const operator = propertyFilter.linkMode === "or" ? " OR " : " AND ";
  clauses.push(`(${selected.map((number) => `ISNULL(BP.QryGroup${number}, 'N') = 'Y'`).join(operator)})`);

  if (propertyFilter.exactlyMatch) {
    const unselected = [];
    for (let number = 1; number <= 64; number += 1) {
      if (!selectedSet.has(number)) {
        unselected.push(`ISNULL(BP.QryGroup${number}, 'N') <> 'Y'`);
      }
    }
    clauses.push(`(${unselected.join(" AND ")})`);
  }
};

const normalizeGroupMasks = (values = []) => {
  const normalized = (Array.isArray(values) && values.length ? values : ACCOUNT_GROUPS.map((group) => group.groupMask))
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
  return [...new Set(normalized)].sort((left, right) => left - right);
};

const getCurrencyExpressions = (displayCurrency) => {
  if (displayCurrency === "system") {
    return { debit: "ISNULL(L.SYSDeb, 0)", credit: "ISNULL(L.SYSCred, 0)" };
  }
  if (displayCurrency === "foreign") {
    return { debit: "ISNULL(L.FCDebit, 0)", credit: "ISNULL(L.FCCredit, 0)" };
  }
  return { debit: "ISNULL(L.Debit, 0)", credit: "ISNULL(L.Credit, 0)" };
};

const getLookups = async (options = {}) => {
  const [accountRows, customerGroups, vendorGroups] = await Promise.all([
    queryRows(
      `
        SELECT
          T0.AcctCode,
          ISNULL(T0.FormatCode, T0.AcctCode) AS FormatCode,
          ISNULL(T0.AcctName, '') AS AcctName,
          CAST(ISNULL(T0.GroupMask, 0) AS INT) AS GroupMask,
          ISNULL(T0.Postable, 'Y') AS Postable,
          CASE
            WHEN ISNULL(T0.LocManTran, 'N') = 'Y'
              OR EXISTS (SELECT 1 FROM OCRD BP WHERE BP.DebPayAcct = T0.AcctCode)
            THEN 1 ELSE 0
          END AS IsControlAccount
        FROM OACT T0
        WHERE T0.GroupMask BETWEEN 1 AND 5
        ORDER BY T0.GroupMask, T0.AcctCode
      `,
      {},
      options,
    ),
    queryRows(
      `
        SELECT DISTINCT CAST(G.GroupCode AS NVARCHAR(50)) AS code, ISNULL(G.GroupName, '') AS name
        FROM OCRG G
        INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
        WHERE BP.CardType = 'C'
        ORDER BY name
      `,
      {},
      options,
    ),
    queryRows(
      `
        SELECT DISTINCT CAST(G.GroupCode AS NVARCHAR(50)) AS code, ISNULL(G.GroupName, '') AS name
        FROM OCRG G
        INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
        WHERE BP.CardType = 'S'
        ORDER BY name
      `,
      {},
      options,
    ),
  ]);

  const accounts = accountRows.map((row) => ({
    code: row.AcctCode || "",
    formatCode: row.FormatCode || row.AcctCode || "",
    name: row.AcctName || "",
    groupMask: Number(row.GroupMask || 0),
    postable: row.Postable || "Y",
    isControlAccount: Boolean(row.IsControlAccount),
  }));

  return {
    accountGroups: ACCOUNT_GROUPS.map((group) => ({ ...group, code: String(group.groupMask) })),
    accounts,
    controlAccounts: accounts.filter((account) => account.isControlAccount),
    customerGroups: [{ code: "All", name: "All" }, ...customerGroups],
    vendorGroups: [{ code: "All", name: "All" }, ...vendorGroups],
  };
};

const getReport = async (criteria = {}, options = {}) => {
  const params = {};
  const selectionClauses = [];
  const resultClauses = [];
  const entityClauses = [];
  const includeBusinessPartners = criteria.includeBusinessPartners !== false;
  const includeAccounts = criteria.includeAccounts !== false;

  if (includeBusinessPartners) {
    const bpClauses = ["BP.CardCode IS NOT NULL"];
    appendRange(bpClauses, "BP.CardCode", criteria.bpCodeFrom, criteria.bpCodeTo, params, "bpCode");
    if (normalizeText(criteria.customerGroup).toLowerCase() !== "all" && normalizeText(criteria.customerGroup)) {
      params.customerGroup = normalizeText(criteria.customerGroup);
      bpClauses.push("(BP.CardType <> 'C' OR CAST(BP.GroupCode AS NVARCHAR(50)) = @customerGroup)");
    }
    if (normalizeText(criteria.vendorGroup).toLowerCase() !== "all" && normalizeText(criteria.vendorGroup)) {
      params.vendorGroup = normalizeText(criteria.vendorGroup);
      bpClauses.push("(BP.CardType <> 'S' OR CAST(BP.GroupCode AS NVARCHAR(50)) = @vendorGroup)");
    }
    appendPropertyFilter(bpClauses, criteria.propertyFilter);
    entityClauses.push(`(${bpClauses.join(" AND ")})`);
  }

  if (includeAccounts) {
    const accountClauses = ["A.AcctCode IS NOT NULL"];
    appendNumberInClause(accountClauses, "A.GroupMask", normalizeGroupMasks(criteria.selectedAccountGroupMasks), params, "groupMask");
    entityClauses.push(`(${accountClauses.join(" AND ")})`);
  }

  if (!entityClauses.length) return { reportTitle: "General Ledger", rows: [], totals: {} };
  selectionClauses.push(`(${entityClauses.join(" OR ")})`);
  if (criteria.controlAccountsOnly) {
    if ((criteria.selectedControlAccountCodes || []).length) {
      appendInClause(selectionClauses, "L.Account", criteria.selectedControlAccountCodes, params, "controlAccount");
    } else {
      selectionClauses.push("(ISNULL(A.LocManTran, 'N') = 'Y' OR EXISTS (SELECT 1 FROM OCRD ControlBP WHERE ControlBP.DebPayAcct = L.Account))");
    }
  }

  const postingRange = criteria.dateRanges?.postingDate || {};
  if (postingRange.enabled && normalizeText(postingRange.to)) {
    params.runningPostingTo = normalizeText(postingRange.to);
    selectionClauses.push("CAST(L.RefDate AS DATE) <= CAST(@runningPostingTo AS DATE)");
  }
  if (postingRange.enabled && criteria.openingBalanceForPeriod === false && normalizeText(postingRange.from)) {
    params.runningPostingFrom = normalizeText(postingRange.from);
    selectionClauses.push("CAST(L.RefDate AS DATE) >= CAST(@runningPostingFrom AS DATE)");
  }

  appendDateRange(resultClauses, "R.PostingDate", postingRange, params, "postingDate");
  appendDateRange(resultClauses, "R.DueDate", criteria.dateRanges?.dueDate, params, "dueDate");
  appendDateRange(resultClauses, "R.DocumentDate", criteria.dateRanges?.documentDate, params, "documentDate");

  const { debit, credit } = getCurrencyExpressions(criteria.displayCurrency);
  const entityCodeExpression = includeBusinessPartners
    ? "CASE WHEN BP.CardCode IS NOT NULL THEN L.ShortName ELSE L.Account END"
    : "L.Account";
  const entityNameExpression = includeBusinessPartners
    ? "CASE WHEN BP.CardCode IS NOT NULL THEN BP.CardName ELSE A.AcctName END"
    : "A.AcctName";
  const entityTypeExpression = includeBusinessPartners
    ? "CASE WHEN BP.CardCode IS NOT NULL THEN 'bp' ELSE 'account' END"
    : "'account'";
  const cardTypeExpression = includeBusinessPartners ? "ISNULL(BP.CardType, '')" : "''";
  const rows = await queryRows(
    `
      WITH LedgerBase AS (
        SELECT
          L.TransId,
          L.Line_ID AS LineId,
          L.RefDate AS PostingDate,
          L.DueDate,
          L.TaxDate AS DocumentDate,
          ISNULL(H.Series, 0) AS SeriesCode,
          ISNULL(S.SeriesName, '') AS SeriesName,
          ISNULL(H.Number, H.TransId) AS JournalNumber,
          ISNULL(H.TransType, 30) AS TransType,
          ISNULL(H.CreatedBy, 0) AS CreatedBy,
          ISNULL(H.BaseRef, '') AS BaseRef,
          ISNULL(L.LineMemo, H.Memo) AS Remarks,
          ISNULL(H.Memo, '') AS HeaderRemarks,
          L.Account AS AccountCode,
          ISNULL(A.AcctName, '') AS AccountName,
          ${entityCodeExpression} AS EntityCode,
          COALESCE(${entityNameExpression}, ${entityCodeExpression}, '') AS EntityName,
          ${entityTypeExpression} AS EntityType,
          ${cardTypeExpression} AS CardType,
          ISNULL(L.ContraAct, '') AS OffsetCode,
          COALESCE(OffsetBP.CardName, OffsetAccount.AcctName, '') AS OffsetName,
          CASE WHEN OffsetBP.CardCode IS NOT NULL THEN 'bp' ELSE 'account' END AS OffsetType,
          CAST(${debit} AS DECIMAL(19, 2)) AS Debit,
          CAST(${credit} AS DECIMAL(19, 2)) AS Credit
        FROM JDT1 L
        INNER JOIN OJDT H ON H.TransId = L.TransId
        LEFT JOIN OACT A ON A.AcctCode = L.Account
        LEFT JOIN OCRD BP ON BP.CardCode = L.ShortName
        LEFT JOIN OACT OffsetAccount ON OffsetAccount.AcctCode = L.ContraAct
        LEFT JOIN OCRD OffsetBP ON OffsetBP.CardCode = L.ContraAct
        LEFT JOIN NNM1 S ON S.Series = H.Series
        WHERE ${selectionClauses.join("\n          AND ")}
      ),
      RunningLedger AS (
        SELECT
          B.*,
          SUM(B.Debit - B.Credit) OVER (
            PARTITION BY B.EntityCode
            ORDER BY B.PostingDate, B.TransId, B.LineId
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS CumulativeBalance
        FROM LedgerBase B
      )
      SELECT TOP 20000 R.*
      FROM RunningLedger R
      ${resultClauses.length ? `WHERE ${resultClauses.join("\n        AND ")}` : ""}
      ORDER BY R.EntityCode, R.PostingDate, R.TransId, R.LineId
    `,
    params,
    options,
  );

  let mappedRows = rows.map((row, index) => {
    const transType = Number(row.TransType || 30);
    const documentType = DOCUMENT_TYPES[transType] || { label: `Transaction ${transType}`, prefix: "TR" };
    const documentNumber = normalizeText(row.BaseRef) || normalizeText(row.CreatedBy) || normalizeText(row.TransId);
    return {
      rowNo: index + 1,
      transId: Number(row.TransId || 0),
      lineId: Number(row.LineId || 0),
      postingDate: row.PostingDate,
      dueDate: row.DueDate,
      documentDate: row.DocumentDate,
      series: row.SeriesName || String(row.SeriesCode || ""),
      journalNumber: Number(row.JournalNumber || 0),
      transType,
      documentTypeLabel: documentType.label,
      sourceDocEntry: transType === 30 ? 0 : Number(row.CreatedBy || 0),
      documentNumber,
      formattedDocumentNumber: documentNumber ? `${documentType.prefix} ${documentNumber}` : "",
      remarks: row.Remarks || "",
      headerRemarks: row.HeaderRemarks || "",
      accountCode: row.AccountCode || "",
      accountName: row.AccountName || "",
      entityCode: row.EntityCode || "",
      entityName: row.EntityName || "",
      entityType: row.EntityType || "account",
      cardType: row.CardType || "",
      offsetCode: row.OffsetCode || "",
      offsetName: row.OffsetName || "",
      offsetType: row.OffsetType || "account",
      debit: toNumber(row.Debit),
      credit: toNumber(row.Credit),
      cumulativeBalance: toNumber(row.CumulativeBalance),
    };
  });

  if (criteria.hideZeroBalancedAccounts) {
    const endingBalanceByEntity = new Map();
    mappedRows.forEach((row) => endingBalanceByEntity.set(row.entityCode, row.cumulativeBalance));
    mappedRows = mappedRows.filter((row) => Math.abs(endingBalanceByEntity.get(row.entityCode) || 0) >= 0.005);
  }
  mappedRows = mappedRows.map((row, index) => ({ ...row, rowNo: index + 1 }));

  return {
    reportTitle: "General Ledger",
    generatedAt: new Date().toISOString(),
    displayCurrency: criteria.displayCurrency || "local",
    rows: mappedRows,
    totals: {
      rowCount: mappedRows.length,
      debit: mappedRows.reduce((sum, row) => sum + row.debit, 0),
      credit: mappedRows.reduce((sum, row) => sum + row.credit, 0),
    },
  };
};

module.exports = {
  getLookups,
  getReport,
};
