const db = require("../dbService");

const normalizeText = (value) => String(value || "").trim();
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const tableColumnsCache = new Map();

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
};

const getTableColumns = async (tableName, options = {}) => {
  const normalized = normalizeText(tableName).toUpperCase();
  if (!normalized) return new Set();

  const cacheKey = `${normalizeText(options.databaseName)}:${normalized}`;
  if (tableColumnsCache.has(cacheKey)) {
    return tableColumnsCache.get(cacheKey);
  }

  const rows = await queryRows(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: normalized },
    options,
  );

  const columns = new Set(rows.map((row) => normalizeText(row.COLUMN_NAME).toUpperCase()));
  tableColumnsCache.set(cacheKey, columns);
  return columns;
};

const firstExistingColumn = async (tableName, candidates, options = {}) => {
  const columns = await getTableColumns(tableName, options);
  return candidates.find((column) => columns.has(normalizeText(column).toUpperCase())) || "";
};

const buildRangeCondition = (columnExpression, fromValue, toValue, params, prefix) => {
  const clauses = [];
  const from = normalizeText(fromValue);
  const to = normalizeText(toValue);

  if (from && to) {
    params[`${prefix}From`] = from;
    params[`${prefix}To`] = to;
    clauses.push(`${columnExpression} BETWEEN @${prefix}From AND @${prefix}To`);
  } else if (from) {
    params[`${prefix}From`] = from;
    clauses.push(`${columnExpression} = @${prefix}From`);
  } else if (to) {
    params[`${prefix}To`] = to;
    clauses.push(`${columnExpression} = @${prefix}To`);
  }

  return clauses;
};

const buildNumericRangeCondition = (columnExpression, fromValue, toValue, params, prefix) => {
  const clauses = [];
  const hasFrom = normalizeText(fromValue) !== "";
  const hasTo = normalizeText(toValue) !== "";

  if (hasFrom && hasTo) {
    params[`${prefix}From`] = toNumber(fromValue);
    params[`${prefix}To`] = toNumber(toValue);
    clauses.push(`CAST(ISNULL(${columnExpression}, 0) AS DECIMAL(19, 6)) BETWEEN @${prefix}From AND @${prefix}To`);
  } else if (hasFrom) {
    params[`${prefix}From`] = toNumber(fromValue);
    clauses.push(`CAST(ISNULL(${columnExpression}, 0) AS DECIMAL(19, 6)) = @${prefix}From`);
  } else if (hasTo) {
    params[`${prefix}To`] = toNumber(toValue);
    clauses.push(`CAST(ISNULL(${columnExpression}, 0) AS DECIMAL(19, 6)) = @${prefix}To`);
  }

  return clauses;
};

const getPropertyNumbers = (propertyFilter = {}) => {
  if (propertyFilter?.ignoreProperties) return [];
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

const buildExpandedCriteriaCondition = (criterion, fieldMap, params, index) => {
  const field = normalizeText(criterion?.field);
  const fromValue = normalizeText(criterion?.from);
  const toValue = normalizeText(criterion?.to);

  if (!field || (!fromValue && !toValue)) return [];

  if (field === "tolerance") {
    if (!fieldMap.tolerance) return [];
    return buildNumericRangeCondition(`T0.${fieldMap.tolerance}`, fromValue, toValue, params, `expanded${index}`);
  }

  if (field === "preferredVendor") {
    return buildRangeCondition("ISNULL(T0.CardCode, '')", fromValue, toValue, params, `expanded${index}`);
  }

  if (field === "productGroup") {
    return buildRangeCondition("ISNULL(T1.ItmsGrpNam, '')", fromValue, toValue, params, `expanded${index}`);
  }

  if (field === "webUserCode") {
    if (!fieldMap.webUserCode) return [];
    return buildRangeCondition(`ISNULL(T0.${fieldMap.webUserCode}, '')`, fromValue, toValue, params, `expanded${index}`);
  }

  if (field === "webUser") {
    if (!fieldMap.webUser) return [];
    return buildRangeCondition(`ISNULL(T0.${fieldMap.webUser}, '')`, fromValue, toValue, params, `expanded${index}`);
  }

  return [];
};

const formatYesNo = (value, defaultValue = "Yes") => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === "N" || normalized === "TNO" || normalized === "NO") return "No";
  if (normalized === "Y" || normalized === "TYES" || normalized === "YES") return "Yes";
  return defaultValue;
};

const getItemListReport = async (criteria = {}, options = {}) => {
  const [toleranceColumn, webUserCodeColumn, webUserColumn, wtaxColumn, vatColumn] = await Promise.all([
    firstExistingColumn("OITM", ["ToleranDay", "ToleranceDays"], options),
    firstExistingColumn("OITM", ["U_WEBUSERCODE"], options),
    firstExistingColumn("OITM", ["U_WEBUSER"], options),
    firstExistingColumn("OITM", ["WTLiable", "WTaxLiable"], options),
    firstExistingColumn("OITM", ["VATLiable"], options),
  ]);

  const params = {};
  const whereClauses = ["1 = 1"];
  const itemFrom = normalizeText(criteria.itemFrom);
  const itemTo = normalizeText(criteria.itemTo);
  const groupCode = normalizeText(criteria.groupCode);

  whereClauses.push(...buildRangeCondition("T0.ItemCode", itemFrom, itemTo, params, "item"));

  if (groupCode && groupCode !== "*" && groupCode.toLowerCase() !== "all") {
    if (groupCode.toLowerCase() === "none") {
      whereClauses.push("T0.ItmsGrpCod IS NULL");
    } else {
      params.groupCode = groupCode;
      whereClauses.push("CAST(T0.ItmsGrpCod AS NVARCHAR(50)) = @groupCode");
    }
  }

  if (criteria.hideNoStock !== false) {
    whereClauses.push("ISNULL(T0.OnHand, 0) <> 0");
  }

  appendPropertyFilter(whereClauses, criteria.propertyFilter, "T0");

  if (criteria.expandedSelection !== false && Array.isArray(criteria.expandedCriteria)) {
    const fieldMap = {
      tolerance: toleranceColumn,
      webUserCode: webUserCodeColumn,
      webUser: webUserColumn,
    };
    criteria.expandedCriteria.forEach((criterion, index) => {
      whereClauses.push(...buildExpandedCriteriaCondition(criterion, fieldMap, params, index));
    });
  }

  const toleranceSelect = toleranceColumn
    ? `CAST(ISNULL(T0.${toleranceColumn}, 0) AS DECIMAL(19, 3)) AS ToleranceDays`
    : "CAST(0 AS DECIMAL(19, 3)) AS ToleranceDays";
  const wtaxSelect = wtaxColumn ? `T0.${wtaxColumn} AS WTaxLiableRaw` : "'Y' AS WTaxLiableRaw";
  const vatSelect = vatColumn ? `T0.${vatColumn} AS VatLiableRaw` : "'Y' AS VatLiableRaw";
  const webUserCodeSelect = webUserCodeColumn ? `T0.${webUserCodeColumn} AS WebUserCode` : "'' AS WebUserCode";
  const webUserSelect = webUserColumn ? `T0.${webUserColumn} AS WebUser` : "'' AS WebUser";

  const rows = await queryRows(
    `
      SELECT TOP 5000
        ROW_NUMBER() OVER (ORDER BY T0.ItemCode) AS RowNo,
        T0.ItemCode,
        ISNULL(T0.ItemName, '') AS ItemName,
        CAST(ISNULL(T0.OnHand, 0) AS DECIMAL(19, 3)) AS InStock,
        ISNULL(T0.CodeBars, '') AS BarCode,
        ${wtaxSelect},
        ${vatSelect},
        CAST(ISNULL(T0.ItmsGrpCod, 0) AS NVARCHAR(50)) AS GroupCode,
        ISNULL(T1.ItmsGrpNam, '') AS GroupName,
        ISNULL(M.FirmName, 'No Manufacturer') AS ManufacturerName,
        ISNULL(T0.TreeType, '') AS ItemTreeType,
        CASE WHEN B.Code IS NULL THEN 0 ELSE 1 END AS HasBOM,
        ISNULL(B.TreeType, '') AS BOMTreeType,
        ISNULL(T0.CardCode, '') AS PreferredVendorCode,
        ISNULL(V.CardName, '') AS PreferredVendorName,
        ${toleranceSelect},
        ${webUserCodeSelect},
        ${webUserSelect}
      FROM OITM T0
      LEFT JOIN OITB T1
        ON T1.ItmsGrpCod = T0.ItmsGrpCod
      LEFT JOIN OMRC M
        ON M.FirmCode = T0.FirmCode
      LEFT JOIN OITT B
        ON B.Code = T0.ItemCode
      LEFT JOIN OCRD V
        ON V.CardCode = T0.CardCode
      WHERE ${whereClauses.join("\n        AND ")}
      ORDER BY T0.ItemCode
    `,
    params,
    options,
  );

  return {
    reportTitle: "List of Items",
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    criteria: {
      itemFrom,
      itemTo,
      groupCode: groupCode || "*",
      hideNoStock: criteria.hideNoStock !== false,
    },
    columns: [
      { key: "rowNo", label: "#" },
      { key: "itemCode", label: "Item No." },
      { key: "itemName", label: "Item Description" },
      { key: "inStock", label: "In Stock" },
      { key: "barCode", label: "Bar Code" },
      { key: "groupName", label: "Item Group" },
      { key: "manufacturerName", label: "Manufacturer" },
      { key: "wTaxLiable", label: "WTax Liable" },
      { key: "preferredVendor", label: "Preferred Vendor" },
      { key: "toleranceDays", label: "Tolerance Days" },
    ],
    rows: rows.map((row, index) => ({
      rowNo: Number(row.RowNo || index + 1),
      itemCode: row.ItemCode || "",
      itemName: row.ItemName || "",
      inStock: Number(row.InStock || 0),
      barCode: row.BarCode || "",
      wTaxLiable: formatYesNo(row.WTaxLiableRaw),
      vatLiable: formatYesNo(row.VatLiableRaw),
      groupCode: row.GroupCode || "",
      groupName: row.GroupName || "",
      manufacturerName: row.ManufacturerName || "No Manufacturer",
      itemTreeType: row.ItemTreeType || "",
      hasBOM: Boolean(row.HasBOM),
      bomTreeType: row.BOMTreeType || "",
      preferredVendorCode: row.PreferredVendorCode || "",
      preferredVendorName: row.PreferredVendorName || "",
      preferredVendor: row.PreferredVendorCode
        ? `${row.PreferredVendorCode}${row.PreferredVendorName ? ` - ${row.PreferredVendorName}` : ""}`
        : "",
      toleranceDays: Number(row.ToleranceDays || 0),
      webUserCode: row.WebUserCode || "",
      webUser: row.WebUser || "",
    })),
  };
};

module.exports = {
  getItemListReport,
};
