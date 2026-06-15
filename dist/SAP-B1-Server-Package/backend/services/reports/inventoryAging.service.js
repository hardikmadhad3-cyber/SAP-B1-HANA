const db = require("../dbService");

const normalizeText = (value) => String(value || "").trim();
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const tableColumnsCache = new Map();

const quoteIdentifier = (columnName) => `[${String(columnName).replace(/]/g, "]]")}]`;
const columnExpression = (alias, columnName) => `${alias}.${quoteIdentifier(columnName)}`;

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
};

const tableExists = async (tableName, options = {}) => {
  const rows = await queryRows(
    `
      SELECT TOP 1 TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: normalizeText(tableName).toUpperCase() },
    options,
  );

  return rows.length > 0;
};

const getTableColumns = async (tableName, options = {}) => {
  const normalized = normalizeText(tableName).toUpperCase();
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
  if (!(await tableExists(tableName, options))) return "";

  const columns = await getTableColumns(tableName, options);
  return candidates.find((column) => columns.has(normalizeText(column).toUpperCase())) || "";
};

const parseSapDate = (value) => {
  const text = normalizeText(value);
  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return text;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearPart = Number(match[3]);
  const year = yearPart < 100 ? 2000 + yearPart : yearPart;

  if (!day || !month || day > 31 || month > 12) {
    return text;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
};

const buildRangeCondition = (columnSql, fromValue, toValue, params, prefix) => {
  const from = normalizeText(fromValue);
  const to = normalizeText(toValue);
  const clauses = [];

  if (from && to) {
    params[`${prefix}From`] = from;
    params[`${prefix}To`] = to;
    clauses.push(`${columnSql} BETWEEN @${prefix}From AND @${prefix}To`);
  } else if (from) {
    params[`${prefix}From`] = from;
    clauses.push(`${columnSql} >= @${prefix}From`);
  } else if (to) {
    params[`${prefix}To`] = to;
    clauses.push(`${columnSql} <= @${prefix}To`);
  }

  return clauses;
};

const appendPropertyFilter = (whereClauses, propertyFilter = {}) => {
  if (propertyFilter.ignoreProperties !== false) return;

  const selectedNumbers = (propertyFilter.selectedPropertyNumbers || [])
    .map(Number)
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= 64);
  if (!selectedNumbers.length) return;

  const selectedSet = new Set(selectedNumbers);
  const operator = propertyFilter.linkMode === "or" ? " OR " : " AND ";
  whereClauses.push(`(${selectedNumbers.map((number) => `ISNULL(I.QryGroup${number}, 'N') = 'Y'`).join(operator)})`);

  if (propertyFilter.exactlyMatch) {
    const unselected = [];
    for (let number = 1; number <= 64; number += 1) {
      if (!selectedSet.has(number)) {
        unselected.push(`ISNULL(I.QryGroup${number}, 'N') <> 'Y'`);
      }
    }
    whereClauses.push(`(${unselected.join(" AND ")})`);
  }
};

const numericExpression = (expression, type = "BIGINT") =>
  `CASE WHEN ISNUMERIC(CAST(${expression} AS NVARCHAR(100))) = 1 THEN CAST(${expression} AS ${type}) ELSE 0 END`;

const getMovementDefinition = async (options = {}) => {
  const useValuationLog = await tableExists("OIVL", options);
  const tableName = useValuationLog ? "OIVL" : "OINM";

  if (!(await tableExists(tableName, options))) {
    const error = new Error("Inventory aging data was not found. SAP B1 tables OIVL/OINM are unavailable in the selected company database.");
    error.status = 500;
    throw error;
  }

  const [
    dateColumn,
    warehouseColumn,
    inQtyColumn,
    outQtyColumn,
    valueColumn,
    calcPriceColumn,
    priceColumn,
    transSeqColumn,
    descriptionColumn,
  ] = await Promise.all([
    firstExistingColumn(tableName, ["DocDate", "TaxDate", "RefDate", "CreateDate"], options),
    firstExistingColumn(tableName, ["LocCode", "Warehouse", "WhsCode"], options),
    firstExistingColumn(tableName, ["InQty", "DebitQty"], options),
    firstExistingColumn(tableName, ["OutQty", "CreditQty"], options),
    firstExistingColumn(tableName, ["TransValue", "TransVal", "Balance"], options),
    firstExistingColumn(tableName, ["CalcPrice", "Cost", "Price"], options),
    firstExistingColumn(tableName, ["Price", "CalcPrice"], options),
    firstExistingColumn(tableName, ["TransSeq", "TransNum", "LogInstanc"], options),
    firstExistingColumn(tableName, ["Dscription", "ItemName"], options),
  ]);

  if (!dateColumn) {
    const error = new Error(`No usable date column was found in SAP B1 table ${tableName}.`);
    error.status = 500;
    throw error;
  }

  return {
    sourceTable: tableName,
    sourceLabel: useValuationLog ? "OIVL" : "OINM",
    dateColumn,
    warehouseColumn,
    inQtyColumn,
    outQtyColumn,
    valueColumn,
    calcPriceColumn,
    priceColumn,
    transSeqColumn,
    descriptionColumn,
  };
};

const getLookups = async (options = {}) => {
  const [hasLocations, hasGroups] = await Promise.all([
    tableExists("OLCT", options),
    tableExists("OITB", options),
  ]);

  const [warehouses, locations, itemGroups] = await Promise.all([
    queryRows(`
      SELECT WhsCode, ISNULL(WhsName, '') AS WhsName,
             CAST(ISNULL([Location], 0) AS NVARCHAR(50)) AS LocationCode
      FROM OWHS
      ORDER BY WhsCode
    `, {}, options),
    hasLocations
      ? queryRows(`
        SELECT CAST(Code AS NVARCHAR(50)) AS LocationCode, ISNULL([Location], '') AS LocationName
        FROM OLCT
        ORDER BY [Location], Code
      `, {}, options)
      : [],
    hasGroups
      ? queryRows(`
        SELECT ItmsGrpCod, ISNULL(ItmsGrpNam, '') AS ItmsGrpNam
        FROM OITB
        ORDER BY ItmsGrpNam, ItmsGrpCod
      `, {}, options)
      : [],
  ]);

  const locationByCode = new Map(locations.map((row) => [row.LocationCode || "", row.LocationName || ""]));

  return {
    warehouses: warehouses.map((row) => ({
      code: row.WhsCode || "",
      name: row.WhsName || "",
      locationCode: row.LocationCode || "0",
      locationName: locationByCode.get(row.LocationCode || "0") || row.LocationCode || "General",
    })),
    locations: locations.map((row) => ({
      code: row.LocationCode || "",
      name: row.LocationName || row.LocationCode || "General",
    })),
    itemGroups: [
      { code: "*", name: "All" },
      ...itemGroups.map((row) => ({
        code: String(row.ItmsGrpCod ?? ""),
        name: row.ItmsGrpNam || String(row.ItmsGrpCod ?? ""),
      })),
    ],
  };
};

const normalizeIntervals = (intervals = []) => {
  const cleaned = (Array.isArray(intervals) ? intervals : [])
    .slice(0, 12)
    .map((interval, index) => {
      const explicitFrom = normalizeText(interval?.from);
      const explicitTo = normalizeText(interval?.to);
      const days = toNumber(interval?.days);

      if (explicitFrom !== "" || explicitTo !== "") {
        const from = explicitFrom === "" ? 0 : Math.max(0, Math.floor(toNumber(explicitFrom)));
        const to = explicitTo === "" ? null : Math.max(from, Math.floor(toNumber(explicitTo)));
        return { index: index + 1, days: to === null ? "" : to - from + 1, from, to };
      }

      if (days > 0) {
        return { index: index + 1, days: Math.floor(days), from: null, to: null };
      }

      return null;
    })
    .filter(Boolean);

  if (!cleaned.length) {
    return [
      { index: 1, days: 30, from: 0, to: 30 },
      { index: 2, days: 30, from: 31, to: 60 },
      { index: 3, days: 30, from: 61, to: 90 },
      { index: 4, days: 30, from: 91, to: 120 },
      { index: 5, days: "", from: 121, to: null },
    ];
  }

  let nextFrom = 0;
  const normalized = cleaned.map((interval, index) => {
    if (interval.from !== null) {
      nextFrom = interval.to === null ? interval.from : interval.to + 1;
      return { ...interval, index: index + 1 };
    }

    const from = nextFrom;
    const to = from + Math.max(1, Number(interval.days || 1)) - 1;
    nextFrom = to + 1;
    return { index: index + 1, days: interval.days, from, to };
  });

  const last = normalized[normalized.length - 1];
  if (last && last.to !== null) {
    normalized.push({ index: normalized.length + 1, days: "", from: last.to + 1, to: null });
  }

  return normalized;
};

const getAgeDays = (reportDate, layerDate) => {
  const report = new Date(`${reportDate}T00:00:00`);
  const layer = new Date(layerDate);
  if (Number.isNaN(report.getTime()) || Number.isNaN(layer.getTime())) return 0;
  return Math.max(0, Math.floor((report.getTime() - layer.getTime()) / MS_PER_DAY));
};

const findIntervalIndex = (intervals, ageDays) => {
  const match = intervals.find((interval) =>
    ageDays >= interval.from && (interval.to === null || ageDays <= interval.to),
  );
  return match ? match.index - 1 : Math.max(0, intervals.length - 1);
};

const buildIntervalBucket = () => ({ quantity: 0, value: 0 });

const getReport = async (criteria = {}, options = {}) => {
  const reportDate = parseSapDate(criteria.reportDate) || new Date().toISOString().slice(0, 10);
  const movementDefinition = await getMovementDefinition(options);
  const intervals = normalizeIntervals(criteria.intervals);
  const params = { reportDate };
  const whereClauses = ["1 = 1"];

  const dateSql = columnExpression("T0", movementDefinition.dateColumn);
  const warehouseSql = movementDefinition.warehouseColumn
    ? columnExpression("T0", movementDefinition.warehouseColumn)
    : "''";
  const inQtySql = movementDefinition.inQtyColumn
    ? `ISNULL(${columnExpression("T0", movementDefinition.inQtyColumn)}, 0)`
    : "0";
  const outQtySql = movementDefinition.outQtyColumn
    ? `ISNULL(${columnExpression("T0", movementDefinition.outQtyColumn)}, 0)`
    : "0";
  const itemDescriptionSql = movementDefinition.descriptionColumn
    ? columnExpression("T0", movementDefinition.descriptionColumn)
    : "''";
  const calcPriceSql = movementDefinition.calcPriceColumn
    ? `ISNULL(${columnExpression("T0", movementDefinition.calcPriceColumn)}, 0)`
    : movementDefinition.priceColumn
      ? `ISNULL(${columnExpression("T0", movementDefinition.priceColumn)}, 0)`
      : "ISNULL(S.AvgPrice, I.AvgPrice)";
  const transValueSql = movementDefinition.valueColumn
    ? `ISNULL(${columnExpression("T0", movementDefinition.valueColumn)}, 0)`
    : `((${inQtySql}) - (${outQtySql})) * (${calcPriceSql})`;
  const transSeqSql = movementDefinition.transSeqColumn
    ? numericExpression(columnExpression("T0", movementDefinition.transSeqColumn), "BIGINT")
    : "0";

  whereClauses.push(`CAST(${dateSql} AS DATE) <= CAST(@reportDate AS DATE)`);
  whereClauses.push(...buildRangeCondition("T0.ItemCode", criteria.itemFrom, criteria.itemTo, params, "item"));

  const groupCode = normalizeText(criteria.groupCode);
  if (groupCode && !["*", "all"].includes(groupCode.toLowerCase())) {
    params.groupCode = groupCode;
    whereClauses.push("CAST(I.ItmsGrpCod AS NVARCHAR(50)) = @groupCode");
  }

  appendPropertyFilter(whereClauses, criteria.propertyFilter);

  if (criteria.includeWarehouses) {
    whereClauses.push(...buildRangeCondition(warehouseSql, criteria.includeWarehouseFrom, criteria.includeWarehouseTo, params, "includeWhs"));
  }

  if (criteria.excludeWarehouses) {
    buildRangeCondition(warehouseSql, criteria.excludeWarehouseFrom, criteria.excludeWarehouseTo, params, "excludeWhs")
      .forEach((clause) => whereClauses.push(`NOT (${clause})`));
  }

  const rows = await queryRows(
    `
      SELECT TOP 50000
        CAST(${dateSql} AS DATE) AS MovementDate,
        ${transSeqSql} AS SortSeq,
        T0.ItemCode,
        ISNULL(I.ItemName, ${itemDescriptionSql}) AS ItemName,
        ISNULL(I.InvntryUom, '') AS InventoryUom,
        ISNULL(${warehouseSql}, '') AS WhsCode,
        ISNULL(W.WhsName, '') AS WhsName,
        CAST(ISNULL(${inQtySql}, 0) AS DECIMAL(19, 6)) AS InQty,
        CAST(ISNULL(${outQtySql}, 0) AS DECIMAL(19, 6)) AS OutQty,
        CAST((${inQtySql}) - (${outQtySql}) AS DECIMAL(19, 6)) AS Quantity,
        CAST(${transValueSql} AS DECIMAL(19, 6)) AS TransValue,
        CAST(CASE
          WHEN ABS((${inQtySql}) - (${outQtySql})) > 0.000001
            THEN ABS((${transValueSql}) / NULLIF((${inQtySql}) - (${outQtySql}), 0))
          ELSE ${calcPriceSql}
        END AS DECIMAL(19, 6)) AS DocumentUnitCost,
        CAST(ISNULL(S.AvgPrice, I.AvgPrice) AS DECIMAL(19, 6)) AS CurrentUnitCost
      FROM ${movementDefinition.sourceTable} T0
      LEFT JOIN OITM I
        ON I.ItemCode = T0.ItemCode
      LEFT JOIN OITW S
        ON S.ItemCode = T0.ItemCode
        AND S.WhsCode = ${warehouseSql}
      LEFT JOIN OITB G
        ON G.ItmsGrpCod = I.ItmsGrpCod
      LEFT JOIN OWHS W
        ON W.WhsCode = ${warehouseSql}
      WHERE ${whereClauses.join("\n        AND ")}
      ORDER BY T0.ItemCode, ISNULL(${warehouseSql}, ''), CAST(${dateSql} AS DATE), ${transSeqSql}
    `,
    params,
    options,
  );

  const itemMap = new Map();
  rows.forEach((row) => {
    const key = `${row.ItemCode || ""}\u0001${row.WhsCode || ""}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        itemCode: row.ItemCode || "",
        itemName: row.ItemName || "",
        inventoryUom: row.InventoryUom || "",
        whsCode: row.WhsCode || "",
        whsName: row.WhsName || "",
        currentUnitCost: toNumber(row.CurrentUnitCost),
        closingQuantity: 0,
        layers: [],
      });
    }

    const item = itemMap.get(key);
    const quantity = toNumber(row.Quantity);
    item.closingQuantity += quantity;
    if (toNumber(row.InQty) > 0) {
      const layerQuantity = toNumber(row.InQty);
      item.layers.push({
        date: row.MovementDate,
        sortSeq: toNumber(row.SortSeq),
        quantity: layerQuantity,
        unitCost: toNumber(row.DocumentUnitCost),
      });
    }
  });

  const issueStrategy = criteria.issueStrategy === "fifo" ? "fifo" : "lifo";
  const valuation = criteria.valuation === "current" ? "current" : "document";
  const reportRows = [];

  itemMap.forEach((item) => {
    if (item.closingQuantity <= 0.000001) return;

    const buckets = intervals.map(buildIntervalBucket);
    const sortedLayers = [...item.layers].sort((left, right) => {
      const dateCompare = new Date(left.date) - new Date(right.date);
      const seqCompare = left.sortSeq - right.sortSeq;
      const forward = dateCompare || seqCompare;
      return issueStrategy === "fifo" ? -forward : forward;
    });

    let remainingQuantity = item.closingQuantity;
    sortedLayers.forEach((layer) => {
      if (remainingQuantity <= 0.000001) return;

      const layerQuantity = Math.min(layer.quantity, remainingQuantity);
      const unitCost = valuation === "current" ? item.currentUnitCost : layer.unitCost;
      const bucketIndex = findIntervalIndex(intervals, getAgeDays(reportDate, layer.date));
      buckets[bucketIndex].quantity += layerQuantity;
      buckets[bucketIndex].value += layerQuantity * unitCost;
      remainingQuantity -= layerQuantity;
    });

    if (remainingQuantity > 0.000001) {
      const bucketIndex = findIntervalIndex(intervals, 0);
      buckets[bucketIndex].quantity += remainingQuantity;
      buckets[bucketIndex].value += remainingQuantity * item.currentUnitCost;
    }

    reportRows.push({
      itemCode: item.itemCode,
      itemName: item.itemName,
      inventoryUom: item.inventoryUom,
      whsCode: item.whsCode,
      whsName: item.whsName,
      closingQuantity: item.closingQuantity,
      totalValue: buckets.reduce((sum, bucket) => sum + bucket.value, 0),
      buckets,
    });
  });

  reportRows.sort((left, right) =>
    String(left.itemCode).localeCompare(String(right.itemCode)) ||
    String(left.whsCode).localeCompare(String(right.whsCode)),
  );

  return {
    reportTitle: "Inventory Aging Report",
    generatedAt: new Date().toISOString(),
    sourceTable: movementDefinition.sourceLabel,
    totalRows: reportRows.length,
    criteria: {
      reportDate,
      issueStrategy,
      valuation,
    },
    intervals,
    rows: reportRows.map((row, index) => ({ ...row, rowNo: index + 1 })),
  };
};

module.exports = {
  getLookups,
  getReport,
  normalizeIntervals,
};
