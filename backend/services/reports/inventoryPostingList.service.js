const db = require("../dbService");

const normalizeText = (value) => String(value || "").trim();
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const tableColumnsCache = new Map();

const DOCUMENT_TYPES = {
  delivery: { label: "Delivery", transTypes: [15], prefix: "DN" },
  return: { label: "Return", transTypes: [16], prefix: "RE" },
  arInvoice: { label: "A/R Invoice", transTypes: [13], prefix: "IN" },
  arCreditMemo: { label: "A/R Credit Memo", transTypes: [14], prefix: "CN" },
  goodsReceiptPO: { label: "Goods Receipt PO", transTypes: [20], prefix: "PU" },
  goodsReturn: { label: "Goods Return", transTypes: [21], prefix: "GR" },
  apInvoice: { label: "A/P Invoice", transTypes: [18], prefix: "PU" },
  apCreditMemo: { label: "A/P Credit Memo", transTypes: [19], prefix: "PC" },
  goodsReceipt: { label: "Goods Receipt", transTypes: [59], prefix: "IN" },
  goodsIssue: { label: "Goods Issue", transTypes: [60], prefix: "IN" },
  inventoryTransfer: { label: "Inventory Transfer", transTypes: [67], prefix: "IM" },
  inventoryOpeningBalance: { label: "Inventory Opening Balance", transTypes: [310000001], prefix: "OB" },
  inventoryPosting: { label: "Inventory Posting", transTypes: [10000071], prefix: "IP" },
  inventoryRevaluation: { label: "Inventory Revaluation", transTypes: [162], prefix: "MR" },
  receiptFromProduction: { label: "Receipt from Production", transTypes: [59], prefix: "IN" },
  issueForProduction: { label: "Issue for Production", transTypes: [60], prefix: "IN" },
};

const TRANS_TYPE_LABELS = Object.values(DOCUMENT_TYPES).reduce((map, type) => {
  type.transTypes.forEach((transType) => {
    if (!map.has(transType)) {
      map.set(transType, { label: type.label, prefix: type.prefix });
    }
  });
  return map;
}, new Map());

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

const buildDateRangeCondition = (columnSql, fromValue, toValue, params, prefix) => {
  const from = parseSapDate(fromValue);
  const to = parseSapDate(toValue);
  const clauses = [];

  if (from) {
    params[`${prefix}From`] = from;
    clauses.push(`CAST(${columnSql} AS DATE) >= CAST(@${prefix}From AS DATE)`);
  }

  if (to) {
    params[`${prefix}To`] = to;
    clauses.push(`CAST(${columnSql} AS DATE) <= CAST(@${prefix}To AS DATE)`);
  }

  return clauses;
};

const buildNumericRangeCondition = (columnSql, fromValue, toValue, params, prefix) => {
  const hasFrom = normalizeText(fromValue) !== "";
  const hasTo = normalizeText(toValue) !== "";
  const clauses = [];

  if (hasFrom) {
    params[`${prefix}From`] = toNumber(fromValue);
    clauses.push(`CAST(ISNULL(${columnSql}, 0) AS DECIMAL(19, 6)) >= @${prefix}From`);
  }

  if (hasTo) {
    params[`${prefix}To`] = toNumber(toValue);
    clauses.push(`CAST(ISNULL(${columnSql}, 0) AS DECIMAL(19, 6)) <= @${prefix}To`);
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
  const clauses = selectedNumbers.map((number) => `ISNULL(${alias}.QryGroup${number}, 'N') = 'Y'`);
  const operator = propertyFilter.linkMode === "or" ? " OR " : " AND ";
  whereClauses.push(`(${clauses.join(operator)})`);

  if (propertyFilter.exactlyMatch) {
    const unselected = [];
    for (let index = 1; index <= 64; index += 1) {
      if (!selectedSet.has(index)) {
        unselected.push(`ISNULL(${alias}.QryGroup${index}, 'N') <> 'Y'`);
      }
    }
    whereClauses.push(`(${unselected.join(" AND ")})`);
  }
};

const appendInClause = (whereClauses, columnSql, values, params, prefix) => {
  const normalizedValues = [...new Set((values || []).map(normalizeText).filter(Boolean))];
  if (!normalizedValues.length) return;

  const placeholders = normalizedValues.map((value, index) => {
    const key = `${prefix}${index}`;
    params[key] = value;
    return `@${key}`;
  });

  whereClauses.push(`${columnSql} IN (${placeholders.join(", ")})`);
};

const getSelectedDocumentTransTypes = (documentTypes = {}) => {
  const selected = Object.entries(documentTypes || {})
    .filter(([, enabled]) => Boolean(enabled))
    .flatMap(([key]) => DOCUMENT_TYPES[key]?.transTypes || []);

  return [...new Set(selected)];
};

const buildExpandedConditions = async (criteria, params, options = {}) => {
  const general = criteria?.expanded?.generalParameters || {};
  const [baseRefColumn, ref2Column, dueDateColumn, salesEmployeeColumn, projectColumn, batchColumn, priceColumn, cardCodeColumn] = await Promise.all([
    firstExistingColumn("OINM", ["BASE_REF", "BaseRef", "Ref1"], options),
    firstExistingColumn("OINM", ["Ref2", "Reference2"], options),
    firstExistingColumn("OINM", ["DocDueDate", "DueDate"], options),
    firstExistingColumn("OINM", ["SlpCode"], options),
    firstExistingColumn("OINM", ["PrjCode", "Project"], options),
    firstExistingColumn("OINM", ["BatchNum", "Batch"], options),
    firstExistingColumn("OINM", ["CalcPrice", "Price"], options),
    firstExistingColumn("OINM", ["CardCode"], options),
  ]);

  const conditions = [];
  const paramRows = [
    { key: "reference", type: "text", column: baseRefColumn ? columnExpression("T0", baseRefColumn) : "" },
    { key: "reference2", type: "text", column: ref2Column ? columnExpression("T0", ref2Column) : "" },
    { key: "quantityReceived", type: "number", column: "T0.InQty" },
    { key: "quantityReleased", type: "number", column: "T0.OutQty" },
    { key: "price", type: "number", column: priceColumn ? columnExpression("T0", priceColumn) : "" },
    { key: "dueDate", type: "date", column: dueDateColumn ? columnExpression("T0", dueDateColumn) : "" },
    { key: "salesEmployee", type: "text", column: salesEmployeeColumn ? `CAST(${columnExpression("T0", salesEmployeeColumn)} AS NVARCHAR(50))` : "" },
    { key: "project", type: "text", column: projectColumn ? columnExpression("T0", projectColumn) : "" },
    { key: "batch", type: "text", column: batchColumn ? columnExpression("T0", batchColumn) : "" },
    { key: "itemCode", type: "text", column: "T0.ItemCode" },
    { key: "bpCode", type: "text", column: cardCodeColumn ? columnExpression("T0", cardCodeColumn) : "" },
  ];

  paramRows.forEach((definition) => {
    const row = general[definition.key];
    if (!row?.enabled || !definition.column) return;

    if (definition.type === "number") {
      conditions.push(...buildNumericRangeCondition(definition.column, row.from, row.to, params, `expanded_${definition.key}`));
      return;
    }

    if (definition.type === "date") {
      conditions.push(...buildDateRangeCondition(definition.column, row.from, row.to, params, `expanded_${definition.key}`));
      return;
    }

    conditions.push(...buildRangeCondition(`ISNULL(${definition.column}, '')`, row.from, row.to, params, `expanded_${definition.key}`));
  });

  return conditions;
};

const documentMetaForTransType = (transType) =>
  TRANS_TYPE_LABELS.get(Number(transType)) || { label: `Transaction ${transType || ""}`, prefix: "TR" };

const formatDocumentNumber = (row) => {
  const meta = documentMetaForTransType(row.TransType);
  const number = normalizeText(row.BaseRef) || normalizeText(row.CreatedBy) || normalizeText(row.TransNum);
  return number ? `${meta.prefix} ${number}` : "";
};

const getInventoryPostingListLookups = async (options = {}) => {
  const [bpGroups, resources, salesEmployees, projects] = await Promise.all([
    queryRows(`
      SELECT TOP 500 GroupCode, GroupName, GroupType
      FROM OCRG
      ORDER BY GroupType, GroupName, GroupCode
    `, {}, options),
    tableExists("ORSC", options)
      .then((exists) => exists ? queryRows(`
        SELECT TOP 500 ResCode, ResName
        FROM ORSC
        ORDER BY ResCode
      `, {}, options) : []),
    queryRows(`
      SELECT TOP 500 SlpCode, SlpName
      FROM OSLP
      ORDER BY CASE WHEN SlpCode = -1 THEN 0 ELSE 1 END, SlpName
    `, {}, options),
    tableExists("OPRJ", options)
      .then((exists) => exists ? queryRows(`
        SELECT TOP 500 PrjCode, PrjName
        FROM OPRJ
        ORDER BY PrjCode
      `, {}, options) : []),
  ]);

  return {
    bpGroups: bpGroups.map((row) => ({
      code: String(row.GroupCode ?? ""),
      name: row.GroupName || "",
      type: row.GroupType || "",
    })),
    resources: resources.map((row) => ({ code: row.ResCode || "", name: row.ResName || "" })),
    salesEmployees: salesEmployees.map((row) => ({ code: String(row.SlpCode ?? ""), name: row.SlpName || "" })),
    projects: projects.map((row) => ({ code: row.PrjCode || "", name: row.PrjName || "" })),
  };
};

const getInventoryPostingList = async (criteria = {}, options = {}) => {
  if (!(await tableExists("OINM", options))) {
    const error = new Error("Inventory posting data table OINM was not found in the selected company database.");
    error.status = 500;
    throw error;
  }

  const [baseRefColumn, docLineColumn, descriptionColumn, priceColumn, transNumColumn, cardCodeColumn, salesEmployeeColumn, projectColumn] = await Promise.all([
    firstExistingColumn("OINM", ["BASE_REF", "BaseRef", "Ref1"], options),
    firstExistingColumn("OINM", ["DocLineNum", "DocLine"], options),
    firstExistingColumn("OINM", ["Dscription", "ItemName"], options),
    firstExistingColumn("OINM", ["CalcPrice", "Price"], options),
    firstExistingColumn("OINM", ["TransNum", "TransSeq"], options),
    firstExistingColumn("OINM", ["CardCode"], options),
    firstExistingColumn("OINM", ["SlpCode"], options),
    firstExistingColumn("OINM", ["PrjCode", "Project"], options),
  ]);

  const params = {};
  const whereClauses = ["1 = 1"];
  const itemFrom = normalizeText(criteria.itemFrom);
  const itemTo = normalizeText(criteria.itemTo);
  const groupCode = normalizeText(criteria.groupCode);
  const activeSelectionTab = normalizeText(criteria.activeSelectionTab) || "items";

  whereClauses.push(...buildRangeCondition("T0.ItemCode", itemFrom, itemTo, params, "item"));

  if (groupCode && groupCode !== "*" && groupCode.toLowerCase() !== "all") {
    if (groupCode.toLowerCase() === "none") {
      whereClauses.push("I.ItmsGrpCod IS NULL");
    } else {
      params.groupCode = groupCode;
      whereClauses.push("CAST(I.ItmsGrpCod AS NVARCHAR(50)) = @groupCode");
    }
  }

  if (criteria.hideNoStock) {
    whereClauses.push("ISNULL(I.OnHand, 0) <> 0");
  }

  if (criteria.hideTransWithoutQtyChange) {
    whereClauses.push("(ISNULL(T0.InQty, 0) <> 0 OR ISNULL(T0.OutQty, 0) <> 0)");
  }

  if (criteria.dateEnabled !== false) {
    whereClauses.push(...buildDateRangeCondition("T0.DocDate", criteria.dateFrom, criteria.dateTo, params, "postingDate"));
  }

  appendPropertyFilter(whereClauses, criteria.propertyFilter);

  if (activeSelectionTab === "resources") {
    whereClauses.push(...buildRangeCondition("T0.ItemCode", criteria.resourceSelection?.codeFrom, criteria.resourceSelection?.codeTo, params, "resource"));
  }

  if (activeSelectionTab === "bp" && cardCodeColumn) {
    const bp = criteria.bpSelection || {};
    whereClauses.push(...buildRangeCondition(columnExpression("T0", cardCodeColumn), bp.codeFrom, bp.codeTo, params, "bp"));
    appendPropertyFilter(whereClauses, bp.propertyFilter, "BP");

    const customerGroup = normalizeText(bp.customerGroup);
    const vendorGroup = normalizeText(bp.vendorGroup);
    const groupConditions = [];
    if (customerGroup && !["*", "all"].includes(customerGroup.toLowerCase())) {
      if (customerGroup.toLowerCase() === "none") groupConditions.push("(BP.CardType = 'C' AND BP.GroupCode IS NULL)");
      else {
        params.customerGroup = customerGroup;
        groupConditions.push("(BP.CardType = 'C' AND CAST(BP.GroupCode AS NVARCHAR(50)) = @customerGroup)");
      }
    }
    if (vendorGroup && !["*", "all"].includes(vendorGroup.toLowerCase())) {
      if (vendorGroup.toLowerCase() === "none") groupConditions.push("(BP.CardType = 'S' AND BP.GroupCode IS NULL)");
      else {
        params.vendorGroup = vendorGroup;
        groupConditions.push("(BP.CardType = 'S' AND CAST(BP.GroupCode AS NVARCHAR(50)) = @vendorGroup)");
      }
    }
    if (groupConditions.length) whereClauses.push(`(${groupConditions.join(" OR ")})`);
  }

  if (activeSelectionTab === "other" && criteria.otherSelection?.selectedValues?.length) {
    const otherColumns = {
      warehouseCode: "T0.Warehouse",
      location: "CAST(W.Location AS NVARCHAR(50))",
      receiptQuantity: "CAST(ISNULL(T0.InQty, 0) AS NVARCHAR(50))",
      issueQuantity: "CAST(ISNULL(T0.OutQty, 0) AS NVARCHAR(50))",
      document: baseRefColumn ? columnExpression("T0", baseRefColumn) : "",
      salesEmployee: salesEmployeeColumn ? `CAST(${columnExpression("T0", salesEmployeeColumn)} AS NVARCHAR(50))` : "",
      projectCode: projectColumn ? columnExpression("T0", projectColumn) : "",
    };
    const otherColumn = otherColumns[criteria.otherSelection.by];
    if (otherColumn) appendInClause(whereClauses, otherColumn, criteria.otherSelection.selectedValues, params, "other");
  }

  const selectedTransTypes = getSelectedDocumentTransTypes(criteria.expanded?.documentTypes);
  if (selectedTransTypes.length) {
    appendInClause(whereClauses, "CAST(T0.TransType AS NVARCHAR(30))", selectedTransTypes.map(String), params, "transType");
  }

  const selectedWarehouseCodes = criteria.locationSelection?.warehouseCodes || [];
  appendInClause(whereClauses, "T0.Warehouse", selectedWarehouseCodes, params, "whs");

  const selectedLocationCodes = criteria.locationSelection?.locationCodes || [];
  appendInClause(whereClauses, "CAST(W.Location AS NVARCHAR(50))", selectedLocationCodes, params, "loc");

  const warehouse = criteria.warehouseSelection || {};
  if (warehouse.mode === "warehouse") {
    if (warehouse.includeEnabled) {
      whereClauses.push(...buildRangeCondition("T0.Warehouse", warehouse.includeFrom, warehouse.includeTo, params, "includeWhs"));
    }
    if (warehouse.excludeEnabled) {
      const excludeClauses = buildRangeCondition("T0.Warehouse", warehouse.excludeFrom, warehouse.excludeTo, params, "excludeWhs");
      excludeClauses.forEach((clause) => whereClauses.push(`NOT (${clause})`));
    }
  }

  whereClauses.push(...(await buildExpandedConditions(criteria, params, options)));

  const baseRefSelect = baseRefColumn ? `${columnExpression("T0", baseRefColumn)} AS BaseRef` : "'' AS BaseRef";
  const docLineSelect = docLineColumn ? `${columnExpression("T0", docLineColumn)} AS DocLineNum` : "0 AS DocLineNum";
  const descriptionSelect = descriptionColumn ? `${columnExpression("T0", descriptionColumn)} AS Dscription` : "'' AS Dscription";
  const priceSelect = priceColumn ? `CAST(ISNULL(${columnExpression("T0", priceColumn)}, 0) AS DECIMAL(19, 6)) AS PriceAfterDisc` : "CAST(0 AS DECIMAL(19, 6)) AS PriceAfterDisc";
  const transNumSelect = transNumColumn ? `${columnExpression("T0", transNumColumn)} AS TransNum` : "0 AS TransNum";
  const cardCodeSelect = cardCodeColumn ? `${columnExpression("T0", cardCodeColumn)} AS CardCode` : "'' AS CardCode";

  const rows = await queryRows(
    `
      WITH MovementRows AS (
        SELECT TOP 5000
          ${transNumSelect},
          T0.TransType,
          T0.CreatedBy,
          ${baseRefSelect},
          ${docLineSelect},
          T0.DocDate AS PostingDate,
          T0.ItemCode,
          ISNULL(I.ItemName, ${descriptionSelect.replace(" AS Dscription", "")}) AS ItemName,
          ${descriptionSelect},
          T0.Warehouse AS WhsCode,
          ISNULL(W.WhsName, '') AS WhsName,
          CAST(ISNULL(W.Location, 0) AS NVARCHAR(50)) AS LocationCode,
          ISNULL(L.Location, '') AS LocationName,
          ${cardCodeSelect},
          ISNULL(BP.CardName, '') AS CardName,
          CAST(ISNULL(T0.InQty, 0) AS DECIMAL(19, 6)) AS RecQty,
          CAST(ISNULL(T0.OutQty, 0) AS DECIMAL(19, 6)) AS IssQty,
          ${priceSelect},
          ISNULL(I.InvntryUom, '') AS InventoryUom
        FROM OINM T0
        LEFT JOIN OITM I
          ON I.ItemCode = T0.ItemCode
        LEFT JOIN OWHS W
          ON W.WhsCode = T0.Warehouse
        LEFT JOIN OLCT L
          ON L.Code = W.Location
        LEFT JOIN OCRD BP
          ON BP.CardCode = ${cardCodeColumn ? columnExpression("T0", cardCodeColumn) : "''"}
        WHERE ${whereClauses.join("\n          AND ")}
        ORDER BY T0.ItemCode, T0.DocDate, ${transNumColumn ? columnExpression("T0", transNumColumn) : "T0.CreatedBy"}
      )
      SELECT
        *,
        SUM(RecQty - IssQty) OVER (
          PARTITION BY ItemCode
          ORDER BY PostingDate, TransNum, CreatedBy, DocLineNum
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS Balance
      FROM MovementRows
      ORDER BY ItemCode, PostingDate, TransNum, CreatedBy, DocLineNum
    `,
    params,
    options,
  );

  return {
    reportTitle: "Inventory Posting List",
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    criteria: {
      itemFrom,
      itemTo,
      activeSelectionTab,
      groupCode: groupCode || "*",
      dateFrom: parseSapDate(criteria.dateFrom),
      dateTo: parseSapDate(criteria.dateTo),
    },
    rows: rows.map((row, index) => {
      const documentMeta = documentMetaForTransType(row.TransType);
      return {
        rowNo: index + 1,
        postingDate: row.PostingDate,
        document: formatDocumentNumber(row),
        documentType: documentMeta.label,
        documentTransType: Number(row.TransType || 0),
        documentDocEntry: Number(row.CreatedBy || 0),
        documentNumber: row.BaseRef || "",
        documentTransNum: Number(row.TransNum || 0),
        docRow: Number(row.DocLineNum || 0) + 1,
        whsCode: row.WhsCode || "",
        whsName: row.WhsName || "",
        locationCode: row.LocationCode || "",
        locationName: row.LocationName || "",
        itemCode: row.ItemCode || "",
        itemName: row.ItemName || row.Dscription || "",
        glBpCode: row.CardCode || "",
        glBpName: row.CardName || "",
        recQty: Number(row.RecQty || 0),
        issQty: Number(row.IssQty || 0),
        inventoryUom: row.InventoryUom || "",
        priceAfterDisc: Number(row.PriceAfterDisc || 0),
        balance: Number(row.Balance || 0),
      };
    }),
  };
};

module.exports = {
  DOCUMENT_TYPES,
  getInventoryPostingListLookups,
  getInventoryPostingList,
};
