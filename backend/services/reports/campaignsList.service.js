const db = require("../dbService");

const CAMPAIGN_TYPE_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Email", label: "Email" },
  { value: "Fax", label: "Fax" },
  { value: "Letter", label: "Letter" },
  { value: "Phone", label: "Phone" },
  { value: "Web", label: "Web" },
  { value: "Other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Open", label: "Open" },
  { value: "Closed", label: "Closed" },
  { value: "Canceled", label: "Canceled" },
];

const TARGET_GROUP_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Customer", label: "Customer" },
  { value: "Vendor", label: "Vendor" },
  { value: "Lead", label: "Lead" },
  { value: "Contact Person", label: "Contact Person" },
];

const RESPONSE_TYPE_OPTIONS = [
  { value: "Interested", label: "Interested in Campaign" },
  { value: "Not Interested", label: "Not Interested in Campaign" },
];

const DOCUMENT_TYPE_OPTIONS = [
  { key: "opportunities", label: "Sales Opportunities", table: "OOPR" },
  { key: "quotations", label: "Sales Quotations", table: "OQUT" },
  { key: "orders", label: "Sales Orders", table: "ORDR" },
  { key: "deliveries", label: "Deliveries", table: "ODLN" },
  { key: "arInvoices", label: "A/R Invoices", table: "OINV" },
  { key: "withoutLinkedDocument", label: "Without Linked Document", table: "" },
];

const CAMPAIGN_TABLE_CANDIDATES = ["OCPN", "OCMP"];

const text = (value) => String(value || "").trim();

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
};

const tableCache = new Map();
const columnCache = new Map();

const tableExists = async (tableName, options = {}) => {
  const table = text(tableName).toUpperCase();
  if (!table) return false;

  const cacheKey = `${text(options.databaseName)}:${table}`;
  if (tableCache.has(cacheKey)) return tableCache.get(cacheKey);

  const rows = await queryRows(
    `
      SELECT 1 AS present
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: table },
    options,
  );
  const exists = rows.length > 0;
  tableCache.set(cacheKey, exists);
  return exists;
};

const getColumns = async (tableName, options = {}) => {
  const table = text(tableName).toUpperCase();
  if (!table) return new Set();

  const cacheKey = `${text(options.databaseName)}:${table}`;
  if (columnCache.has(cacheKey)) return columnCache.get(cacheKey);

  const rows = await queryRows(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: table },
    options,
  );
  const columns = new Set(rows.map((row) => text(row.COLUMN_NAME).toUpperCase()));
  columnCache.set(cacheKey, columns);
  return columns;
};

const firstColumn = async (tableName, candidates = [], options = {}) => {
  const columns = await getColumns(tableName, options);
  return candidates.find((candidate) => columns.has(text(candidate).toUpperCase())) || "";
};

const pickCampaignTable = async (options = {}) => {
  for (const tableName of CAMPAIGN_TABLE_CANDIDATES) {
    if (await tableExists(tableName, options)) return tableName;
  }
  return "";
};

const parseDate = (value) => {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return raw;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year.padStart(4, "0")}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
};

const buildRangeCondition = (columnExpression, fromValue, toValue, params, prefix) => {
  const clauses = [];
  const from = text(fromValue);
  const to = text(toValue);

  if (from && to) {
    params[`${prefix}From`] = from;
    params[`${prefix}To`] = to;
    clauses.push(`${columnExpression} BETWEEN @${prefix}From AND @${prefix}To`);
  } else if (from) {
    params[`${prefix}From`] = from;
    clauses.push(`${columnExpression} >= @${prefix}From`);
  } else if (to) {
    params[`${prefix}To`] = to;
    clauses.push(`${columnExpression} <= @${prefix}To`);
  }

  return clauses;
};

const buildDateRangeCondition = (columnExpression, fromValue, toValue, params, prefix) => {
  const clauses = [];
  const from = parseDate(fromValue);
  const to = parseDate(toValue);

  if (from) {
    params[`${prefix}From`] = from;
    clauses.push(`CAST(${columnExpression} AS DATE) >= CAST(@${prefix}From AS DATE)`);
  }

  if (to) {
    params[`${prefix}To`] = to;
    clauses.push(`CAST(${columnExpression} AS DATE) <= CAST(@${prefix}To AS DATE)`);
  }

  return clauses;
};

const appendPropertyFilter = (whereClauses, propertyFilter = {}, alias = "T0") => {
  if (propertyFilter?.ignoreProperties !== false) return;

  const selectedNumbers = Array.isArray(propertyFilter?.selectedPropertyNumbers)
    ? propertyFilter.selectedPropertyNumbers
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64)
    : [];

  if (!selectedNumbers.length) return;

  const selectedSet = new Set(selectedNumbers);
  const linkOperator = propertyFilter.linkMode === "or" ? " OR " : " AND ";
  whereClauses.push(`(${selectedNumbers.map((number) => `ISNULL(${alias}.QryGroup${number}, 'N') = 'Y'`).join(linkOperator)})`);

  if (propertyFilter.exactlyMatch) {
    const unselectedClauses = [];
    for (let number = 1; number <= 64; number += 1) {
      if (!selectedSet.has(number)) {
        unselectedClauses.push(`ISNULL(${alias}.QryGroup${number}, 'N') <> 'Y'`);
      }
    }
    whereClauses.push(`(${unselectedClauses.join(" AND ")})`);
  }
};

const selectedDocumentLabels = (selected = {}) => {
  const labels = DOCUMENT_TYPE_OPTIONS
    .filter((option) => option.key !== "withoutLinkedDocument")
    .filter((option) => selected?.[option.key])
    .map((option) => option.label);

  if (selected?.withoutLinkedDocument) labels.push("Without Linked Document");
  return labels;
};

const getLookups = async (options = {}) => {
  const [itemGroups, customerGroups, vendorGroups, itemProperties, bpProperties, owners] = await Promise.all([
    queryRows(
      `
        SELECT CAST(ItmsGrpCod AS NVARCHAR(50)) AS value, ISNULL(ItmsGrpNam, '') AS label
        FROM OITB
        ORDER BY ItmsGrpNam
      `,
      {},
      options,
    ).catch(() => []),
    queryRows(
      `
        SELECT DISTINCT CAST(G.GroupCode AS NVARCHAR(50)) AS value, ISNULL(G.GroupName, '') AS label
        FROM OCRG G
        INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
        WHERE BP.CardType = 'C'
        ORDER BY label
      `,
      {},
      options,
    ).catch(() => []),
    queryRows(
      `
        SELECT DISTINCT CAST(G.GroupCode AS NVARCHAR(50)) AS value, ISNULL(G.GroupName, '') AS label
        FROM OCRG G
        INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
        WHERE BP.CardType = 'S'
        ORDER BY label
      `,
      {},
      options,
    ).catch(() => []),
    queryRows(
      `
        SELECT GroupCode AS number, ISNULL(GroupName, '') AS name
        FROM OITG
        ORDER BY GroupCode
      `,
      {},
      options,
    ).catch(() => []),
    queryRows(
      `
        SELECT GroupCode AS number, ISNULL(GroupName, '') AS name
        FROM OCQG
        ORDER BY GroupCode
      `,
      {},
      options,
    ).catch(() => []),
    queryRows(
      `
        SELECT CAST(SlpCode AS NVARCHAR(50)) AS value, ISNULL(SlpName, '') AS label
        FROM OSLP
        ORDER BY SlpName
      `,
      {},
      options,
    ).catch(() => []),
  ]);

  return {
    itemGroups: [{ value: "All", label: "All" }, ...itemGroups.filter((row) => text(row.label))],
    customerGroups: [{ value: "All", label: "All" }, ...customerGroups.filter((row) => text(row.label))],
    vendorGroups: [{ value: "All", label: "All" }, ...vendorGroups.filter((row) => text(row.label))],
    itemProperties: itemProperties.length
      ? itemProperties
      : Array.from({ length: 64 }, (_, index) => ({ number: index + 1, name: `Items Property ${index + 1}` })),
    bpProperties: bpProperties.length
      ? bpProperties
      : Array.from({ length: 64 }, (_, index) => ({ number: index + 1, name: `Business Partners Property ${index + 1}` })),
    campaignTypes: CAMPAIGN_TYPE_OPTIONS,
    statuses: STATUS_OPTIONS,
    targetGroups: TARGET_GROUP_OPTIONS,
    owners: [{ value: "All", label: "All" }, ...owners.filter((row) => text(row.label))],
    responseTypes: RESPONSE_TYPE_OPTIONS,
    documentTypes: DOCUMENT_TYPE_OPTIONS.map(({ key, label }) => ({ key, label })),
  };
};

const getReport = async (criteria = {}, options = {}) => {
  const campaignTable = await pickCampaignTable(options);
  const documentLabels = selectedDocumentLabels(criteria.documents);

  if (!campaignTable) {
    return {
      reportTitle: "Campaigns List Report",
      generatedAt: new Date().toISOString(),
      columns: [],
      rows: [],
      totals: {},
      criteria: { ...criteria, documentLabels },
      warning: "Campaign tables were not found in this company database.",
    };
  }

  const [
    codeColumn,
    nameColumn,
    statusColumn,
    typeColumn,
    ownerColumn,
    targetGroupColumn,
    startDateColumn,
    endDateColumn,
    bpCodeColumn,
    itemCodeColumn,
  ] = await Promise.all([
    firstColumn(campaignTable, ["CpnNo", "CampaignNo", "CmpgnNo", "AbsEntry", "DocNum", "Code"], options),
    firstColumn(campaignTable, ["Name", "CpnName", "CampaignName", "Descr", "Description"], options),
    firstColumn(campaignTable, ["Status", "CpnStatus", "CampaignStatus"], options),
    firstColumn(campaignTable, ["Type", "CpnType", "CampaignType"], options),
    firstColumn(campaignTable, ["Owner", "OwnerCode", "SlpCode", "UserSign"], options),
    firstColumn(campaignTable, ["TargetGrp", "TargetGroup", "GroupType"], options),
    firstColumn(campaignTable, ["StartDate", "BeginDate", "FromDate"], options),
    firstColumn(campaignTable, ["EndDate", "FinishDate", "ToDate"], options),
    firstColumn(campaignTable, ["CardCode", "BPCode"], options),
    firstColumn(campaignTable, ["ItemCode", "ItemNo"], options),
  ]);

  const params = {};
  const where = ["1 = 1"];
  const joins = [];

  if (bpCodeColumn) {
    joins.push(`LEFT JOIN OCRD BP ON BP.CardCode = C.${bpCodeColumn}`);
    where.push(...buildRangeCondition("BP.CardCode", criteria.bpCodeFrom, criteria.bpCodeTo, params, "bpCode"));

    const bpGroup = text(criteria.bpGroup);
    if (bpGroup && bpGroup.toLowerCase() !== "all") {
      params.bpGroup = bpGroup;
      where.push("CAST(BP.GroupCode AS NVARCHAR(50)) = @bpGroup");
    }

    if (criteria.targetGroupType === "vendor") {
      where.push("BP.CardType = 'S'");
    } else {
      where.push("BP.CardType = 'C'");
    }

    appendPropertyFilter(where, criteria.bpPropertyFilter, "BP");
  }

  if (itemCodeColumn) {
    joins.push(`LEFT JOIN OITM I ON I.ItemCode = C.${itemCodeColumn}`);
    where.push(...buildRangeCondition("I.ItemCode", criteria.itemCodeFrom, criteria.itemCodeTo, params, "itemCode"));

    const itemGroup = text(criteria.itemGroup);
    if (itemGroup && itemGroup.toLowerCase() !== "all") {
      params.itemGroup = itemGroup;
      where.push("CAST(I.ItmsGrpCod AS NVARCHAR(50)) = @itemGroup");
    }

    appendPropertyFilter(where, criteria.itemPropertyFilter, "I");
  }

  if (codeColumn) {
    where.push(...buildRangeCondition(`CAST(C.${codeColumn} AS NVARCHAR(50))`, criteria.campaignNoFrom, criteria.campaignNoTo, params, "campaignNo"));
  }

  if (startDateColumn) {
    where.push(...buildDateRangeCondition(`C.${startDateColumn}`, criteria.startDateFrom, criteria.startDateTo, params, "startDate"));
  }

  if (endDateColumn) {
    where.push(...buildDateRangeCondition(`C.${endDateColumn}`, criteria.endDateFrom, criteria.endDateTo, params, "endDate"));
  }

  const campaignType = text(criteria.campaignType);
  if (typeColumn && campaignType && campaignType.toLowerCase() !== "all") {
    params.campaignType = campaignType;
    where.push(`CAST(C.${typeColumn} AS NVARCHAR(100)) = @campaignType`);
  }

  const status = text(criteria.status);
  if (statusColumn && status && status.toLowerCase() !== "all") {
    params.status = status;
    where.push(`CAST(C.${statusColumn} AS NVARCHAR(100)) = @status`);
  }

  const owner = text(criteria.owner);
  if (ownerColumn && owner && owner.toLowerCase() !== "all") {
    params.owner = owner;
    where.push(`CAST(C.${ownerColumn} AS NVARCHAR(100)) = @owner`);
  }

  const targetGroup = text(criteria.targetGroup);
  if (targetGroupColumn && targetGroup && targetGroup.toLowerCase() !== "all") {
    params.targetGroup = targetGroup;
    where.push(`CAST(C.${targetGroupColumn} AS NVARCHAR(100)) = @targetGroup`);
  }

  const selectExpression = (column, fallback = "''") => (column ? `C.${column}` : fallback);

  const rows = await queryRows(
    `
      SELECT TOP 5000
        ROW_NUMBER() OVER (ORDER BY ${selectExpression(codeColumn, "1")}) AS rowNo,
        CAST(${selectExpression(codeColumn)} AS NVARCHAR(50)) AS campaignNo,
        CAST(${selectExpression(nameColumn)} AS NVARCHAR(255)) AS campaignName,
        CAST(${selectExpression(statusColumn)} AS NVARCHAR(100)) AS status,
        CAST(${selectExpression(typeColumn)} AS NVARCHAR(100)) AS type,
        CAST(${selectExpression(ownerColumn)} AS NVARCHAR(100)) AS owner,
        CAST(${selectExpression(targetGroupColumn)} AS NVARCHAR(100)) AS targetGroup,
        ${startDateColumn ? `CONVERT(VARCHAR(10), C.${startDateColumn}, 23)` : "''"} AS startDate,
        ${endDateColumn ? `CONVERT(VARCHAR(10), C.${endDateColumn}, 23)` : "''"} AS endDate,
        CAST(${selectExpression(bpCodeColumn)} AS NVARCHAR(50)) AS bpCode
      FROM ${campaignTable} C
      ${joins.join("\n      ")}
      WHERE ${where.join("\n        AND ")}
      ORDER BY ${selectExpression(codeColumn, "1")}
    `,
    params,
    options,
  );

  return {
    reportTitle: "Campaigns List Report",
    generatedAt: new Date().toISOString(),
    criteria: { ...criteria, documentLabels },
    totals: {
      businessPartnersResponded: 0,
      leadsGenerated: 0,
      opportunities: 0,
      opportunitiesWon: 0,
      salesAmount: 0,
      grossProfit: 0,
    },
    rows: rows.map((row, index) => ({
      rowNo: Number(row.rowNo || index + 1),
      campaignNo: row.campaignNo || "",
      campaignName: row.campaignName || "",
      status: row.status || "",
      type: row.type || "",
      owner: row.owner || "",
      targetGroup: row.targetGroup || "",
      startDate: row.startDate || "",
      endDate: row.endDate || "",
      bpCode: row.bpCode || "",
      businessPartnersContacted: 0,
      document: documentLabels.join(", "),
      businessPartnersResponded: 0,
      salesAmount: 0,
      responsePercent: 0,
      grossProfit: 0,
      leadsGenerated: 0,
      grossProfitPercent: 0,
      opportunities: 0,
      opportunitiesWinRate: 0,
      opportunitiesWon: 0,
      totalSalesAmount: 0,
      totalGrossProfit: 0,
      totalGrossProfitPercent: 0,
    })),
  };
};

module.exports = {
  getLookups,
  getReport,
  RESPONSE_TYPE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
};
