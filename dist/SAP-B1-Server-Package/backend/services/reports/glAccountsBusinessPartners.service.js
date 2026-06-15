const db = require("../dbService");

const ACCOUNT_GROUPS = [
  { groupMask: 1, label: "Asset" },
  { groupMask: 2, label: "Liability" },
  { groupMask: 3, label: "Equity" },
  { groupMask: 4, label: "Revenue" },
  { groupMask: 5, label: "Expenditure" },
];

const normalizeText = (value) => String(value || "").trim();

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
};

const buildLike = (value) => `%${normalizeText(value)}%`;

const getPropertyNumbers = (propertyFilter = {}) => {
  if (propertyFilter?.ignoreProperties !== false) return [];
  if (!Array.isArray(propertyFilter?.selectedPropertyNumbers)) return [];

  return propertyFilter.selectedPropertyNumbers
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64);
};

const appendPropertyFilter = (whereClauses, propertyFilter = {}, alias = "T0") => {
  const selectedNumbers = getPropertyNumbers(propertyFilter);
  if (!selectedNumbers.length) return;

  const selectedSet = new Set(selectedNumbers);
  const selectedClauses = selectedNumbers.map((number) => `ISNULL(${alias}.QryGroup${number}, 'N') = 'Y'`);
  const linkOperator = propertyFilter.linkMode === "or" ? " OR " : " AND ";

  whereClauses.push(`(${selectedClauses.join(linkOperator)})`);

  if (propertyFilter.exactlyMatch) {
    const unselectedClauses = [];
    for (let index = 1; index <= 64; index += 1) {
      if (!selectedSet.has(index)) {
        unselectedClauses.push(`ISNULL(${alias}.QryGroup${index}, 'N') <> 'Y'`);
      }
    }
    if (unselectedClauses.length) {
      whereClauses.push(`(${unselectedClauses.join(" AND ")})`);
    }
  }
};

const appendBpCodeRange = (whereClauses, params, codeFrom, codeTo) => {
  const from = normalizeText(codeFrom);
  const to = normalizeText(codeTo);

  if (from) {
    params.bpCodeFrom = from;
    whereClauses.push("T0.CardCode >= @bpCodeFrom");
  }

  if (to) {
    params.bpCodeTo = to;
    whereClauses.push("T0.CardCode <= @bpCodeTo");
  }
};

const buildCardTypeCondition = (cardType, groupCode, paramName, params) => {
  const normalizedGroup = normalizeText(groupCode) || "All";

  if (normalizedGroup.toLowerCase() === "all") {
    return `T0.CardType = '${cardType}'`;
  }

  if (normalizedGroup.toLowerCase() === "none") {
    return `(T0.CardType = '${cardType}' AND ISNULL(T0.GroupCode, 0) = 0)`;
  }

  params[paramName] = normalizedGroup;
  return `(T0.CardType = '${cardType}' AND CAST(T0.GroupCode AS NVARCHAR(50)) = @${paramName})`;
};

const getBusinessPartnerRows = async (criteria = {}, options = {}) => {
  if (criteria.includeBusinessPartners === false) return [];

  const params = {};
  const whereClauses = ["1 = 1"];
  appendBpCodeRange(whereClauses, params, criteria.bpCodeFrom, criteria.bpCodeTo);
  appendPropertyFilter(whereClauses, criteria.propertyFilter, "T0");

  const cardTypeClauses = [
    buildCardTypeCondition("C", criteria.customerGroup, "customerGroup", params),
    buildCardTypeCondition("S", criteria.vendorGroup, "vendorGroup", params),
  ];

  if (criteria.displayLeads) {
    cardTypeClauses.push("T0.CardType = 'L'");
  }

  whereClauses.push(`(${cardTypeClauses.join(" OR ")})`);

  const rows = await queryRows(
    `
      SELECT TOP 5000
        ROW_NUMBER() OVER (ORDER BY T0.CardCode) AS RowNo,
        T0.CardCode,
        ISNULL(T0.CardName, '') AS CardName,
        ISNULL(T0.CardType, '') AS CardType,
        CAST(ISNULL(T0.GroupCode, 0) AS NVARCHAR(50)) AS GroupCode,
        ISNULL(T1.GroupName, '') AS GroupName,
        ISNULL(T0.Currency, '') AS Currency,
        CAST(ISNULL(T0.Balance, 0) AS DECIMAL(19, 2)) AS Balance
      FROM OCRD T0
      LEFT JOIN OCRG T1
        ON T1.GroupCode = T0.GroupCode
      WHERE ${whereClauses.join("\n        AND ")}
      ORDER BY T0.CardCode
    `,
    params,
    options,
  );

  const typeLabelMap = {
    C: "Customer",
    S: "Vendor",
    L: "Lead",
  };

  return rows.map((row) => ({
    rowNo: Number(row.RowNo || 0),
    bpCode: row.CardCode || "",
    bpName: row.CardName || "",
    cardType: row.CardType || "",
    cardTypeLabel: typeLabelMap[row.CardType] || row.CardType || "",
    groupCode: row.GroupCode || "",
    groupName: row.GroupName || "",
    currency: row.Currency || "",
    balance: Number(row.Balance || 0),
  }));
};

const normalizeAccountGroups = (values = []) => {
  const selected = Array.isArray(values) && values.length ? values : ACCOUNT_GROUPS.map((group) => group.groupMask);
  const normalized = selected
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);

  return [...new Set(normalized)].sort((left, right) => left - right);
};

const getAccountRows = async (criteria = {}, options = {}) => {
  if (criteria.includeGlAccounts === false) return [];

  const groupMasks = normalizeAccountGroups(criteria.selectedAccountGroupMasks);
  if (!groupMasks.length) return [];

  const rows = await queryRows(
    `
      SELECT TOP 5000
        ROW_NUMBER() OVER (ORDER BY T0.GroupMask, T0.AcctCode) AS RowNo,
        T0.AcctCode,
        ISNULL(T0.AcctName, '') AS AcctName,
        CAST(ISNULL(T0.GroupMask, 0) AS INT) AS GroupMask,
        ISNULL(T0.ActCurr, '') AS Currency,
        CAST(ISNULL(T0.CurrTotal, 0) AS DECIMAL(19, 2)) AS Balance,
        ISNULL(T0.Postable, '') AS Postable
      FROM OACT T0
      WHERE T0.GroupMask IN (${groupMasks.join(", ")})
      ORDER BY T0.GroupMask, T0.AcctCode
    `,
    {},
    options,
  );

  const labelByMask = new Map(ACCOUNT_GROUPS.map((group) => [group.groupMask, group.label]));

  return rows.map((row) => ({
    rowNo: Number(row.RowNo || 0),
    accountCode: row.AcctCode || "",
    accountName: row.AcctName || "",
    groupMask: Number(row.GroupMask || 0),
    groupName: labelByMask.get(Number(row.GroupMask || 0)) || "Other",
    currency: row.Currency || "",
    balance: Number(row.Balance || 0),
    isTitleAccount: row.Postable === "N",
  }));
};

const getAccountGroups = async (options = {}) => {
  const rows = await queryRows(
    `
      SELECT
        CAST(GroupMask AS INT) AS GroupMask,
        MIN(AcctCode) AS FirstAccountCode
      FROM OACT
      WHERE GroupMask BETWEEN 1 AND 5
      GROUP BY GroupMask
    `,
    {},
    options,
  );

  const codeByMask = new Map(
    rows.map((row) => [Number(row.GroupMask || 0), String(row.FirstAccountCode || "")]),
  );

  return ACCOUNT_GROUPS.map((group) => ({
    groupMask: group.groupMask,
    code: codeByMask.get(group.groupMask) || String(group.groupMask),
    name: group.label,
  }));
};

const getBpGroups = async (cardType, options = {}) => {
  const rows = await queryRows(
    `
      SELECT DISTINCT
        CAST(T1.GroupCode AS NVARCHAR(50)) AS code,
        ISNULL(T1.GroupName, '') AS name
      FROM OCRG T1
      INNER JOIN OCRD T0
        ON T0.GroupCode = T1.GroupCode
      WHERE T0.CardType = @cardType
      ORDER BY name, code
    `,
    { cardType },
    options,
  );

  return [
    { code: "All", name: "All" },
    ...rows.map((row) => ({
      code: normalizeText(row.code),
      name: normalizeText(row.name) || normalizeText(row.code),
    })),
    { code: "None", name: "None" },
  ];
};

const getLookups = async (options = {}) => {
  const [customerGroups, vendorGroups, accountGroups] = await Promise.all([
    getBpGroups("C", options),
    getBpGroups("S", options),
    getAccountGroups(options),
  ]);

  return {
    customerGroups,
    vendorGroups,
    accountGroups,
  };
};

const getReport = async (criteria = {}, options = {}) => {
  const [businessPartners, glAccounts] = await Promise.all([
    getBusinessPartnerRows(criteria, options),
    getAccountRows(criteria, options),
  ]);

  const combinedRows = [
    ...businessPartners.map((row) => ({
      sourceType: "bp",
      code: row.bpCode,
      name: row.bpName,
      label: "Business Partner",
      currency: row.currency,
      balance: row.balance,
    })),
    ...glAccounts.map((row) => ({
      sourceType: "account",
      code: row.accountCode,
      name: row.accountName,
      label: row.groupName,
      currency: row.currency,
      balance: row.balance,
    })),
  ].map((row, index) => ({
    ...row,
    rowNo: index + 1,
  }));

  return {
    reportTitle: "G/L Accounts and Business Partners",
    generatedAt: new Date().toISOString(),
    totalBusinessPartners: businessPartners.length,
    totalGlAccounts: glAccounts.length,
    totalCombinedRows: combinedRows.length,
    criteria: {
      includeBusinessPartners: criteria.includeBusinessPartners !== false,
      includeGlAccounts: criteria.includeGlAccounts !== false,
      displayLeads: Boolean(criteria.displayLeads),
      bpCodeFrom: normalizeText(criteria.bpCodeFrom),
      bpCodeTo: normalizeText(criteria.bpCodeTo),
      customerGroup: normalizeText(criteria.customerGroup) || "All",
      vendorGroup: normalizeText(criteria.vendorGroup) || "All",
      selectedAccountGroupMasks: normalizeAccountGroups(criteria.selectedAccountGroupMasks),
    },
    businessPartners,
    glAccounts,
    combinedRows,
  };
};

const lookupBusinessPartners = async (query = "", options = {}) => {
  const hasQuery = Boolean(normalizeText(query));
  const rows = await queryRows(
    `
      SELECT TOP 200
        T0.CardCode AS CardCode,
        ISNULL(T0.CardName, '') AS CardName,
        ISNULL(T0.CardType, '') AS CardType,
        CAST(ISNULL(T0.GroupCode, 0) AS NVARCHAR(50)) AS GroupCode,
        ISNULL(T1.GroupName, '') AS GroupName,
        CAST(ISNULL(T0.Balance, 0) AS DECIMAL(19, 2)) AS Balance
      FROM OCRD T0
      LEFT JOIN OCRG T1
        ON T1.GroupCode = T0.GroupCode
      WHERE @hasQuery = 0
        OR T0.CardCode LIKE @query
        OR T0.CardName LIKE @query
      ORDER BY T0.CardCode
    `,
    { hasQuery: hasQuery ? 1 : 0, query: buildLike(query) },
    options,
  );

  return rows.map((row) => ({
    CardCode: row.CardCode || "",
    CardName: row.CardName || "",
    CardType: row.CardType || "",
    GroupCode: row.GroupCode || "",
    GroupName: row.GroupName || "",
    Balance: Number(row.Balance || 0),
  }));
};

module.exports = {
  getLookups,
  getReport,
  lookupBusinessPartners,
};
