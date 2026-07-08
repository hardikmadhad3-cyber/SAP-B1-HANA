const db = require("../dbService");

const normalizeText = (value) => String(value || "").trim();

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
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

const getPropertyNumbers = (propertyFilter = {}) => {
  if (propertyFilter?.ignoreProperties) return [];
  if (!Array.isArray(propertyFilter?.selectedPropertyNumbers)) return [];

  return propertyFilter.selectedPropertyNumbers
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64);
};

const appendPropertyFilter = (whereClauses, propertyFilter = {}, alias = "I") => {
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
    whereClauses.push(`(${unselectedClauses.join(" AND ")})`);
  }
};

const BOM_TYPE_LABELS = {
  A: "Assembly",
  P: "Production",
  S: "Sales",
  T: "Template",
};

const normalizeBomType = (value) => {
  const raw = normalizeText(value);
  if (!raw || raw.toLowerCase() === "all") return "All";

  const byServiceLayer = {
    iAssemblyTree: "A",
    iProductionTree: "P",
    iSalesTree: "S",
    iTemplateTree: "T",
  };

  return byServiceLayer[raw] || raw.toUpperCase().slice(0, 1);
};

const getBillOfMaterialsReport = async (criteria = {}, options = {}) => {
  const params = {};
  const whereClauses = ["1 = 1"];
  const itemFrom = normalizeText(criteria.itemFrom);
  const itemTo = normalizeText(criteria.itemTo);
  const groupCode = normalizeText(criteria.groupCode);
  const bomType = normalizeBomType(criteria.bomType);

  whereClauses.push(...buildRangeCondition("H.Code", itemFrom, itemTo, params, "item"));

  if (groupCode && groupCode !== "*" && groupCode.toLowerCase() !== "all") {
    params.groupCode = groupCode;
    whereClauses.push("CAST(I.ItmsGrpCod AS NVARCHAR(50)) = @groupCode");
  }

  if (bomType !== "All") {
    params.bomType = bomType;
    whereClauses.push("H.TreeType = @bomType");
  }

  appendPropertyFilter(whereClauses, criteria.propertyFilter, "I");

  const rows = await queryRows(
    `
      SELECT TOP 5000
        ROW_NUMBER() OVER (ORDER BY H.Code) AS RowNo,
        H.Code AS ItemCode,
        COALESCE(NULLIF(H.Name, ''), NULLIF(I.ItemName, ''), '') AS ItemDescription,
        COALESCE(NULLIF(I.InvntryUom, ''), NULLIF(U.UomCode, ''), NULLIF(U.UomName, ''), '') AS UoM,
        CAST(ISNULL(H.Qauntity, 1) AS DECIMAL(19, 6)) AS Quantity,
        ISNULL(H.ToWH, '') AS WarehouseCode,
        ISNULL(W.WhsName, '') AS WarehouseName,
        CAST(ISNULL(P.Price, 0) AS DECIMAL(19, 6)) AS Price,
        ISNULL(NULLIF(P.Currency, ''), NULLIF(PL.PrimCurr, ''), '') AS Currency,
        1 AS Depth,
        ISNULL(H.TreeType, '') AS BomTypeCode,
        CAST('' AS NVARCHAR(50)) AS RouteSequence,
        CAST('' AS NVARCHAR(50)) AS RouteStage,
        CAST('' AS NVARCHAR(200)) AS StageDescription
      FROM OITT H
      LEFT JOIN OITM I
        ON I.ItemCode = H.Code
      LEFT JOIN OUOM U
        ON U.UomEntry = I.IUoMEntry
      LEFT JOIN OWHS W
        ON W.WhsCode = H.ToWH
      LEFT JOIN OPLN PL
        ON PL.ListNum = H.PriceList
      LEFT JOIN ITM1 P
        ON P.ItemCode = H.Code
       AND P.PriceList = H.PriceList
      WHERE ${whereClauses.join("\n        AND ")}
      ORDER BY H.Code
    `,
    params,
    options,
  );

  return {
    reportTitle: "Bill of Materials Report",
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    criteria: {
      itemFrom,
      itemTo,
      groupCode: groupCode || "All",
      bomType,
    },
    rows: rows.map((row, index) => ({
      rowNo: Number(row.RowNo || index + 1),
      itemCode: row.ItemCode || "",
      itemDescription: row.ItemDescription || "",
      uom: row.UoM || "",
      quantity: Number(row.Quantity || 0),
      whse: row.WarehouseCode || "",
      warehouseName: row.WarehouseName || "",
      price: Number(row.Price || 0),
      currency: row.Currency || "",
      depth: Number(row.Depth || 1),
      bomTypeCode: row.BomTypeCode || "",
      bomType: BOM_TYPE_LABELS[row.BomTypeCode] || row.BomTypeCode || "",
      routeSequence: row.RouteSequence || "",
      routeStage: row.RouteStage || "",
      stageDescription: row.StageDescription || "",
    })),
  };
};

module.exports = {
  getBillOfMaterialsReport,
};
