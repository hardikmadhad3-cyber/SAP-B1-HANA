const db = require("../dbService");

const normalizeText = (value) => String(value || "").trim();

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
};

const buildRangeCondition = (column, fromValue, toValue, params, prefix) => {
  const from = normalizeText(fromValue);
  const to = normalizeText(toValue);
  if (from && to) {
    params[`${prefix}From`] = from;
    params[`${prefix}To`] = to;
    return `${column} BETWEEN @${prefix}From AND @${prefix}To`;
  }
  if (from) {
    params[`${prefix}From`] = from;
    return `${column} >= @${prefix}From`;
  }
  if (to) {
    params[`${prefix}To`] = to;
    return `${column} <= @${prefix}To`;
  }
  return "";
};

const appendPropertyFilter = (where, propertyFilter = {}) => {
  if (propertyFilter.ignoreProperties !== false) return;
  const selected = (propertyFilter.selectedPropertyNumbers || [])
    .map(Number)
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= 64);
  if (!selected.length) return;

  const operator = propertyFilter.linkMode === "or" ? " OR " : " AND ";
  where.push(`(${selected.map((number) => `ISNULL(I.QryGroup${number}, 'N') = 'Y'`).join(operator)})`);

  if (propertyFilter.exactlyMatch) {
    const selectedSet = new Set(selected);
    const unselected = Array.from({ length: 64 }, (_, index) => index + 1)
      .filter((number) => !selectedSet.has(number))
      .map((number) => `ISNULL(I.QryGroup${number}, 'N') <> 'Y'`);
    where.push(`(${unselected.join(" AND ")})`);
  }
};

const getLookups = async (options = {}) => {
  const [warehouses, locations, priceLists] = await Promise.all([
    queryRows(`
      SELECT WhsCode, ISNULL(WhsName, '') AS WhsName,
             CAST(ISNULL([Location], 0) AS NVARCHAR(50)) AS LocationCode
      FROM OWHS
      ORDER BY WhsCode
    `, {}, options),
    queryRows(`
      SELECT CAST(Code AS NVARCHAR(50)) AS LocationCode, ISNULL([Location], '') AS LocationName
      FROM OLCT
      ORDER BY Location, Code
    `, {}, options),
    queryRows(`
      SELECT ListNum, ISNULL(ListName, '') AS ListName
      FROM OPLN
      ORDER BY ListNum
    `, {}, options),
  ]);

  return {
    warehouses: warehouses.map((row) => ({
      code: row.WhsCode || "",
      name: row.WhsName || "",
      locationCode: row.LocationCode || "0",
    })),
    locations: locations.map((row) => ({
      code: row.LocationCode || "",
      name: row.LocationName || "",
    })),
    priceSources: [
      ...priceLists.map((row) => ({
        value: `priceList:${Number(row.ListNum)}`,
        label: row.ListName || `Price List ${String(row.ListNum).padStart(2, "0")}`,
      })),
      { value: "lastPurchase", label: "Last Purchase Price" },
      { value: "lastEvaluated", label: "Last Evaluated Price" },
    ],
  };
};

const getReport = async (criteria = {}, options = {}) => {
  const params = {};
  const itemWhere = ["ISNULL(I.InvntItem, 'N') = 'Y'"];
  const stockWhere = ["1 = 1"];

  const itemRange = buildRangeCondition("I.ItemCode", criteria.itemFrom, criteria.itemTo, params, "item");
  const vendorRange = buildRangeCondition("ISNULL(I.CardCode, '')", criteria.vendorFrom, criteria.vendorTo, params, "vendor");
  if (itemRange) itemWhere.push(itemRange);
  if (vendorRange) itemWhere.push(vendorRange);

  const groupCode = normalizeText(criteria.groupCode);
  if (groupCode && groupCode !== "*" && groupCode.toLowerCase() !== "all") {
    params.groupCode = groupCode;
    itemWhere.push("CAST(I.ItmsGrpCod AS NVARCHAR(50)) = @groupCode");
  }
  appendPropertyFilter(itemWhere, criteria.propertyFilter);

  const selectionMode = criteria.selectionMode === "location" ? "location" : "warehouse";
  const selectedLocations = Array.isArray(criteria.selectedLocationCodes)
    ? criteria.selectedLocationCodes.map(normalizeText).filter(Boolean)
    : [];
  if (selectionMode === "location" && selectedLocations.length) {
    selectedLocations.forEach((code, index) => {
      params[`location${index}`] = code;
    });
    stockWhere.push(`CAST(ISNULL(W.[Location], 0) AS NVARCHAR(50)) IN (${selectedLocations.map((_, index) => `@location${index}`).join(", ")})`);
  }

  if (selectionMode === "warehouse") {
    const includeRange = buildRangeCondition("S.WhsCode", criteria.includeWarehouseFrom, criteria.includeWarehouseTo, params, "includeWhs");
    const excludeRange = buildRangeCondition("S.WhsCode", criteria.excludeWarehouseFrom, criteria.excludeWarehouseTo, params, "excludeWhs");
    if (criteria.includeWarehouses !== false && includeRange) stockWhere.push(includeRange);
    if (criteria.excludeWarehouses === true && excludeRange) stockWhere.push(`NOT (${excludeRange})`);
  }

  const warehouseRows = await queryRows(`
    SELECT DISTINCT W.WhsCode, ISNULL(W.WhsName, '') AS WhsName
    FROM OWHS W
    WHERE ${selectionMode === "location" && selectedLocations.length
      ? `CAST(ISNULL(W.[Location], 0) AS NVARCHAR(50)) IN (${selectedLocations.map((_, index) => `@location${index}`).join(", ")})`
      : "1 = 1"}
      ${selectionMode === "warehouse" && criteria.includeWarehouses !== false && (criteria.includeWarehouseFrom || criteria.includeWarehouseTo)
        ? `AND ${buildRangeCondition("W.WhsCode", criteria.includeWarehouseFrom, criteria.includeWarehouseTo, params, "displayWhs")}`
        : ""}
      ${selectionMode === "warehouse" && criteria.excludeWarehouses === true && (criteria.excludeWarehouseFrom || criteria.excludeWarehouseTo)
        ? `AND NOT (${buildRangeCondition("W.WhsCode", criteria.excludeWarehouseFrom, criteria.excludeWarehouseTo, params, "displayExcludeWhs")})`
        : ""}
    ORDER BY W.WhsCode
  `, params, options);

  const priceSource = normalizeText(criteria.priceSource) || "lastPurchase";
  let priceJoin = "";
  let priceExpression = "CAST(ISNULL(I.LastPurPrc, 0) AS DECIMAL(19, 6))";
  if (priceSource === "lastEvaluated") {
    priceExpression = "CAST(ISNULL(I.AvgPrice, 0) AS DECIMAL(19, 6))";
  } else if (priceSource.startsWith("priceList:")) {
    params.priceList = Number(priceSource.split(":")[1]) || 1;
    priceJoin = "LEFT JOIN ITM1 P ON P.ItemCode = I.ItemCode AND P.PriceList = @priceList";
    priceExpression = "CAST(ISNULL(P.Price, 0) AS DECIMAL(19, 6))";
  }

  const rows = await queryRows(`
    SELECT TOP 5000
      I.ItemCode,
      ISNULL(I.ItemName, '') AS ItemName,
      ISNULL(I.InvntryUom, '') AS Uom,
      ${priceExpression} AS Price,
      S.WhsCode,
      CAST(ISNULL(S.OnHand, 0) AS DECIMAL(19, 6)) AS InStock,
      CAST(ISNULL(S.IsCommited, 0) AS DECIMAL(19, 6)) AS Committed,
      CAST(ISNULL(S.OnOrder, 0) AS DECIMAL(19, 6)) AS Ordered
    FROM OITM I
    INNER JOIN OITW S ON S.ItemCode = I.ItemCode
    INNER JOIN OWHS W ON W.WhsCode = S.WhsCode
    ${priceJoin}
    WHERE ${itemWhere.join("\n      AND ")}
      AND ${stockWhere.join("\n      AND ")}
    ORDER BY I.ItemCode, S.WhsCode
  `, params, options);

  const itemMap = new Map();
  rows.forEach((row) => {
    if (!itemMap.has(row.ItemCode)) {
      itemMap.set(row.ItemCode, {
        itemCode: row.ItemCode || "",
        itemName: row.ItemName || "",
        uom: row.Uom || "",
        price: Number(row.Price || 0),
        inStock: {},
        committed: {},
        ordered: {},
        totals: { inStock: 0, committed: 0, ordered: 0 },
      });
    }
    const item = itemMap.get(row.ItemCode);
    const whsCode = row.WhsCode || "";
    item.inStock[whsCode] = Number(row.InStock || 0);
    item.committed[whsCode] = Number(row.Committed || 0);
    item.ordered[whsCode] = Number(row.Ordered || 0);
    item.totals.inStock += Number(row.InStock || 0);
    item.totals.committed += Number(row.Committed || 0);
    item.totals.ordered += Number(row.Ordered || 0);
  });

  let reportRows = [...itemMap.values()];
  if (criteria.hideNoStock === true) {
    reportRows = reportRows.filter((row) => row.totals.inStock !== 0);
  }

  return {
    reportTitle: "Inventory in Warehouse Report",
    generatedAt: new Date().toISOString(),
    warehouses: warehouseRows.map((row) => ({ code: row.WhsCode || "", name: row.WhsName || "" })),
    rows: reportRows,
    totalRows: reportRows.length,
    displayMode: criteria.displayMode === "detailed" ? "detailed" : "normal",
    priceSource,
  };
};

module.exports = { getLookups, getReport };
