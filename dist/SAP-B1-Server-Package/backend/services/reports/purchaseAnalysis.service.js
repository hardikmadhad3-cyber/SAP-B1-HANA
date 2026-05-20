const db = require("../../db/odbc");

const DOCUMENT_CONFIG = {
  invoices: {
    key: "invoices",
    headerTable: "OPCH",
    lineTable: "PCH1",
    countLabel: "A/P Invoice",
    totalLabel: "Total A/P Invoice",
    titleLabel: "A/P Invoice",
  },
  orders: {
    key: "orders",
    headerTable: "OPOR",
    lineTable: "POR1",
    countLabel: "Purchase Order",
    totalLabel: "Total Purchase Order",
    titleLabel: "Purchase Order",
  },
  goodsReceiptPO: {
    key: "goodsReceiptPO",
    headerTable: "OPDN",
    lineTable: "PDN1",
    countLabel: "Goods Receipt PO",
    totalLabel: "Total Goods Receipt PO",
    titleLabel: "Goods Receipt PO",
  },
};

const CREDIT_MEMO_CONFIG = {
  headerTable: "ORPC",
  lineTable: "RPC1",
  countLabel: "A/P Credit Memo",
  titleLabel: "A/P Credit Memo",
};

const tableColumnsCache = new Map();
const tableExistsCache = new Map();

const queryRows = async (sql, params = {}) => {
  const result = await db.query(sql, params);
  return result.recordset || result || [];
};

const normalizeText = (value) => String(value || "").trim();
const normalizeCode = (value, fallback = "") => {
  const text = normalizeText(value);
  return text || fallback;
};
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUARTER_LABELS = ["I", "II", "III", "IV"];
const PURCHASE_DOCUMENT_PREFIXES = {
  invoices: "PU",
  orders: "PO",
  goodsReceiptPO: "GRPO",
  creditMemo: "AP CM",
};

const formatPeriodLabel = (dateValue, reportPeriod) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  if (reportPeriod === "annual") return String(year);
  if (reportPeriod === "monthly") {
    return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${year} Q${quarter}`;
};

const getPeriodKey = (dateValue, reportPeriod) => formatPeriodLabel(dateValue, reportPeriod);

const buildLike = (value) => `%${normalizeText(value)}%`;

const getTableExists = async (tableName) => {
  const normalized = normalizeText(tableName).toUpperCase();
  if (!normalized) return false;
  if (tableExistsCache.has(normalized)) return tableExistsCache.get(normalized);

  const rows = await queryRows(
    `
      SELECT 1 AS present
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: normalized }
  );
  const exists = rows.length > 0;
  tableExistsCache.set(normalized, exists);
  return exists;
};

const getTableColumns = async (tableName) => {
  const normalized = normalizeText(tableName).toUpperCase();
  if (!normalized) return new Set();
  if (tableColumnsCache.has(normalized)) return tableColumnsCache.get(normalized);

  const rows = await queryRows(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: normalized }
  );

  const columns = new Set(rows.map((row) => String(row.COLUMN_NAME || "").toUpperCase()));
  tableColumnsCache.set(normalized, columns);
  return columns;
};

const hasColumn = async (tableName, columnName) => {
  const columns = await getTableColumns(tableName);
  return columns.has(String(columnName || "").trim().toUpperCase());
};

const firstExistingColumn = async (tableName, candidates = []) => {
  for (const candidate of candidates) {
    if (await hasColumn(tableName, candidate)) return candidate;
  }
  return null;
};

const buildPropertyCondition = (alias, mode, properties = []) => {
  if (mode === "Ignore" || !properties.length) return "";
  const conditions = properties.map((propertyNumber) => `ISNULL(${alias}.QryGroup${propertyNumber}, 'N') = 'Y'`);
  if (!conditions.length) return "";
  return mode === "Include selected"
    ? ` AND (${conditions.join(" OR ")})`
    : ` AND NOT (${conditions.join(" OR ")})`;
};

const buildRangeCondition = (alias, columnName, range = {}, params = {}, paramPrefix = "range") => {
  const clauses = [];
  const fromValue = normalizeText(range.codeFrom);
  const toValue = normalizeText(range.codeTo);

  if (fromValue && toValue) {
    params[`${paramPrefix}From`] = fromValue;
    params[`${paramPrefix}To`] = toValue;
    clauses.push(`${alias}.${columnName} BETWEEN @${paramPrefix}From AND @${paramPrefix}To`);
  } else if (fromValue) {
    params[`${paramPrefix}From`] = fromValue;
    clauses.push(`${alias}.${columnName} = @${paramPrefix}From`);
  } else if (toValue) {
    params[`${paramPrefix}To`] = toValue;
    clauses.push(`${alias}.${columnName} = @${paramPrefix}To`);
  }

  return clauses;
};

const appendDateConditions = (whereClauses, params, filters) => {
  if (filters.postingDate.enabled) {
    params.postingFrom = filters.postingDate.from;
    params.postingTo = filters.postingDate.to;
    whereClauses.push("H.DocDate BETWEEN @postingFrom AND @postingTo");
  }
  if (filters.dueDate.enabled) {
    params.dueFrom = filters.dueDate.from;
    params.dueTo = filters.dueDate.to;
    whereClauses.push("H.DocDueDate BETWEEN @dueFrom AND @dueTo");
  }
  if (filters.documentDate.enabled) {
    params.documentFrom = filters.documentDate.from;
    params.documentTo = filters.documentDate.to;
    whereClauses.push("H.TaxDate BETWEEN @documentFrom AND @documentTo");
  }
};

const resolveGroupingDate = (row, criteria) => {
  if (criteria.dateFilters.postingDate.enabled) return row.postingDate;
  if (criteria.dateFilters.documentDate.enabled) return row.documentDate;
  if (criteria.dateFilters.dueDate.enabled) return row.dueDate;
  return row.postingDate || row.documentDate || row.dueDate;
};

const getCompanyCurrencies = async () => {
  try {
    const rows = await queryRows(`
      SELECT TOP 1
        CompnyName,
        MainCurncy,
        SysCurrncy
      FROM OADM
    `);
    return {
      companyName: rows[0]?.CompnyName || "SAP B1",
      localCurrency: rows[0]?.MainCurncy || "INR",
      systemCurrency: rows[0]?.SysCurrncy || rows[0]?.MainCurncy || "INR",
    };
  } catch (_error) {
    return { companyName: "SAP B1", localCurrency: "INR", systemCurrency: "INR" };
  }
};

const buildDocumentRowQuery = async (config, criteria, factor = 1) => {
  const lineTable = config.lineTable;
  const headerTable = config.headerTable;

  const lineTotalSystemColumn = await firstExistingColumn(lineTable, ["TotalSumSy", "LineTotalSy"]);
  const openAmountColumn = await firstExistingColumn(lineTable, ["OpenSum", "OpenCreQty"]);
  const openAmountSystemColumn = await firstExistingColumn(lineTable, ["OpenSumSy", "OpenCreQtySy"]);
  const grossProfitColumn = await firstExistingColumn(lineTable, ["GrssProfit", "GrossProfit"]);
  const grossProfitSystemColumn = await firstExistingColumn(lineTable, ["GrssProfitSC", "GrossProfitSC", "GrssProfitSy"]);
  const costColumn = await firstExistingColumn(lineTable, ["StockPrice", "GrossBuyPr"]);
  const lineVatColumn = await firstExistingColumn(lineTable, ["VatSum"]);
  const headerOpenAmountColumn = await firstExistingColumn(headerTable, ["OpenBal", "OpenSum"]);
  const headerOpenAmountSystemColumn = await firstExistingColumn(headerTable, ["OpenBalSys", "OpenSumSy"]);
  const headerDocTotalSystemColumn = await firstExistingColumn(headerTable, ["DocTotalSy", "DocTotalSC"]);
  const headerVatSystemColumn = await firstExistingColumn(headerTable, ["VatSumSy", "VatSumSC"]);
  const hasPaidToDateColumn = await hasColumn(headerTable, "PaidToDate");
  const hasActiveSalesEmployeeColumn = await hasColumn("OSLP", "Active");
  const hasAgreementColumn = await hasColumn(headerTable, "AgrNo");
  const hasCanceledColumn = await hasColumn(headerTable, "CANCELED");

  const lineTotalSystemExpr = lineTotalSystemColumn
    ? `ISNULL(L.${lineTotalSystemColumn}, 0)`
    : `ISNULL(L.LineTotal, 0) * CASE WHEN ISNULL(H.DocRate, 0) = 0 THEN 1 ELSE H.DocRate END`;
  const openAmountExpr = openAmountColumn
    ? `ISNULL(L.${openAmountColumn}, 0)`
    : `ISNULL(L.OpenQty, 0) * ISNULL(L.Price, 0) * (1 - (ISNULL(L.DiscPrcnt, 0) / 100.0))`;
  const openAmountSystemExpr = openAmountSystemColumn
    ? `ISNULL(L.${openAmountSystemColumn}, 0)`
    : `${openAmountExpr} * CASE WHEN ISNULL(H.DocRate, 0) = 0 THEN 1 ELSE H.DocRate END`;
  const grossProfitExpr = grossProfitColumn
    ? `ISNULL(L.${grossProfitColumn}, 0)`
    : `ISNULL(L.LineTotal, 0) - (ISNULL(L.Quantity, 0) * ${costColumn ? `ISNULL(L.${costColumn}, ISNULL(I.AvgPrice, 0))` : "ISNULL(I.AvgPrice, 0)"})`;
  const grossProfitSystemExpr = grossProfitSystemColumn
    ? `ISNULL(L.${grossProfitSystemColumn}, 0)`
    : `${grossProfitExpr} * CASE WHEN ISNULL(H.DocRate, 0) = 0 THEN 1 ELSE H.DocRate END`;
  const lineTaxExpr = lineVatColumn ? `ISNULL(L.${lineVatColumn}, 0)` : "0";
  const headerOpenExpr = hasPaidToDateColumn
    ? `CASE
         WHEN ISNULL(H.DocStatus, 'O') <> 'O' THEN 0
         WHEN ISNULL(H.DocTotal, 0) - ISNULL(H.PaidToDate, 0) < 0 THEN 0
         ELSE ISNULL(H.DocTotal, 0) - ISNULL(H.PaidToDate, 0)
       END`
    : headerOpenAmountColumn
      ? `ISNULL(H.${headerOpenAmountColumn}, 0)`
      : "0";
  const headerOpenSystemExpr = headerOpenAmountSystemColumn
    ? `ISNULL(H.${headerOpenAmountSystemColumn}, 0)`
    : `${headerOpenExpr} * CASE WHEN ISNULL(H.DocRate, 0) = 0 THEN 1 ELSE H.DocRate END`;
  const headerDocTotalExpr = "ISNULL(H.DocTotal, 0)";
  const headerDocTotalSystemExpr = headerDocTotalSystemColumn
    ? `ISNULL(H.${headerDocTotalSystemColumn}, 0)`
    : `${headerDocTotalExpr} * CASE WHEN ISNULL(H.DocRate, 0) = 0 THEN 1 ELSE H.DocRate END`;
  const headerVatExpr = "ISNULL(H.VatSum, 0)";
  const headerVatSystemExpr = headerVatSystemColumn
    ? `ISNULL(H.${headerVatSystemColumn}, 0)`
    : `${headerVatExpr} * CASE WHEN ISNULL(H.DocRate, 0) = 0 THEN 1 ELSE H.DocRate END`;
  const cancelStatusExpr = hasCanceledColumn ? "ISNULL(H.CANCELED, 'N')" : "'N'";
  const signedFactorExpr = `(${factor} * CASE WHEN ${cancelStatusExpr} = 'C' THEN -1 ELSE 1 END)`;

  const params = {};
  const whereClauses = ["1 = 1"];

  appendDateConditions(whereClauses, params, criteria.dateFilters);

  if (criteria.tab === "customers" || criteria.tab === "items") {
    whereClauses.push(...buildRangeCondition("H", "CardCode", criteria.customer, params, "customerCode"));
    if (criteria.customer.group && criteria.customer.group !== "All") {
      params.customerGroup = criteria.customer.group;
      whereClauses.push("(CAST(C.GroupCode AS NVARCHAR(50)) = @customerGroup OR CG.GroupName = @customerGroup)");
    }
    whereClauses.push(`1 = 1 ${buildPropertyCondition("C", criteria.customer.propertiesMode, criteria.customer.properties)}`);
  }

  if (criteria.tab === "items") {
    whereClauses.push(...buildRangeCondition("L", "ItemCode", criteria.item, params, "itemCode"));
    if (criteria.item.group && criteria.item.group !== "All") {
      params.itemGroup = criteria.item.group;
      whereClauses.push("(CAST(I.ItmsGrpCod AS NVARCHAR(50)) = @itemGroup OR IG.ItmsGrpNam = @itemGroup)");
    }
    whereClauses.push(`1 = 1 ${buildPropertyCondition("I", criteria.item.propertiesMode, criteria.item.properties)}`);

    if (criteria.item.secondarySelection) {
      whereClauses.push(...buildRangeCondition("H", "CardCode", criteria.item.secondaryFilters.customer, params, "secondaryCustomer"));
      whereClauses.push(...buildRangeCondition("H", "SlpCode", criteria.item.secondaryFilters.salesEmployee, params, "secondarySalesEmployee"));
      whereClauses.push(...buildRangeCondition("L", "WhsCode", criteria.item.secondaryFilters.warehouse, params, "secondaryWarehouse"));
    }
  }

  if (criteria.tab === "salesEmployees") {
    whereClauses.push(...buildRangeCondition("H", "SlpCode", criteria.salesEmployee, params, "salesEmployee"));
  }

  if (!criteria.salesEmployee.includeInactive && hasActiveSalesEmployeeColumn) {
    whereClauses.push("(S.Active = 'Y' OR S.Active IS NULL)");
  }

  const sql = `
    SELECT
      '${config.key}' AS DocumentType,
      '${config.titleLabel}' AS DocumentLabel,
      ${signedFactorExpr} * ISNULL(L.Quantity, 0) AS Quantity,
      ${signedFactorExpr} * ISNULL(L.Price, 0) AS UnitPrice,
      ${signedFactorExpr} * ISNULL(L.LineTotal, 0) AS LineTotal,
      ${signedFactorExpr} * ${lineTotalSystemExpr} AS LineTotalSystem,
      ${signedFactorExpr} * ${grossProfitExpr} AS GrossProfit,
      ${signedFactorExpr} * ${grossProfitSystemExpr} AS GrossProfitSystem,
      ${signedFactorExpr} * ${openAmountExpr} AS OpenAmount,
      ${signedFactorExpr} * ${openAmountSystemExpr} AS OpenAmountSystem,
      ${signedFactorExpr} * ${lineTaxExpr} AS TaxAmount,
      ${signedFactorExpr} * ${headerOpenExpr} AS HeaderOpenAmount,
      ${signedFactorExpr} * ${headerOpenSystemExpr} AS HeaderOpenAmountSystem,
      ${signedFactorExpr} * ${headerDocTotalExpr} AS HeaderDocTotal,
      ${signedFactorExpr} * ${headerDocTotalSystemExpr} AS HeaderDocTotalSystem,
      ${signedFactorExpr} * ${headerVatExpr} AS HeaderVatAmount,
      ${signedFactorExpr} * ${headerVatSystemExpr} AS HeaderVatAmountSystem,
      H.DocEntry,
      H.DocNum,
      H.DocDate AS PostingDate,
      H.DocDueDate AS DueDate,
      H.TaxDate AS DocumentDateValue,
      H.CardCode,
      H.CardName,
      CAST(ISNULL(C.GroupCode, 0) AS NVARCHAR(50)) AS CustomerGroupCode,
      ISNULL(CG.GroupName, '') AS CustomerGroupName,
      ISNULL(H.SlpCode, -1) AS SalesEmployeeCode,
      ISNULL(S.SlpName, '') AS SalesEmployeeName,
      ISNULL(L.ItemCode, '') AS ItemCode,
      ISNULL(L.Dscription, '') AS ItemDescription,
      CAST(ISNULL(I.ItmsGrpCod, 0) AS NVARCHAR(50)) AS ItemGroupCode,
      ISNULL(IG.ItmsGrpNam, '') AS ItemGroupName,
      ISNULL(L.WhsCode, '') AS WarehouseCode,
      ISNULL(H.DocCur, '') AS DocumentCurrency,
      ISNULL(H.DocRate, 1) AS DocRate,
      ISNULL(H.DiscPrcnt, 0) AS HeaderDiscountPercent,
      ISNULL(L.DiscPrcnt, 0) AS LineDiscountPercent,
      ISNULL(H.Series, 0) AS Series,
      ${cancelStatusExpr} AS CancelStatus,
      ${hasAgreementColumn ? "CAST(ISNULL(H.AgrNo, 0) AS NVARCHAR(50))" : "''"} AS BlanketAgreementCode,
      ${hasAgreementColumn ? "CAST(ISNULL(H.AgrNo, 0) AS NVARCHAR(50))" : "''"} AS BlanketAgreementName
    FROM ${headerTable} H
    INNER JOIN ${lineTable} L ON H.DocEntry = L.DocEntry
    LEFT JOIN OCRD C ON C.CardCode = H.CardCode
    LEFT JOIN OCRG CG ON CG.GroupCode = C.GroupCode
    LEFT JOIN OSLP S ON S.SlpCode = H.SlpCode
    LEFT JOIN OITM I ON I.ItemCode = L.ItemCode
    LEFT JOIN OITB IG ON IG.ItmsGrpCod = I.ItmsGrpCod
    WHERE ${whereClauses.join("\n      AND ")}
  `;

  return { sql, params };
};

const fetchBaseRows = async (criteria) => {
  const config = DOCUMENT_CONFIG[criteria.documentType];
  const queries = [await buildDocumentRowQuery(config, criteria, 1)];

  if (
    criteria.documentType === "invoices" &&
    await getTableExists(CREDIT_MEMO_CONFIG.headerTable) &&
    await getTableExists(CREDIT_MEMO_CONFIG.lineTable)
  ) {
    queries.push(await buildDocumentRowQuery(
      { ...CREDIT_MEMO_CONFIG, key: "creditMemo" },
      criteria,
      -1
    ));
  }

  const results = await Promise.all(queries.map(({ sql, params }) => queryRows(sql, params)));

  return results.flat().map((row) => ({
    documentType: row.DocumentType,
    documentLabel: row.DocumentLabel,
    docEntry: row.DocEntry,
    docNum: row.DocNum,
    postingDate: row.PostingDate,
    dueDate: row.DueDate,
    documentDate: row.DocumentDateValue,
    customerCode: normalizeCode(row.CardCode),
    customerName: normalizeCode(row.CardName),
    customerGroupCode: normalizeCode(row.CustomerGroupCode),
    customerGroupName: normalizeCode(row.CustomerGroupName),
    salesEmployeeCode: normalizeCode(row.SalesEmployeeCode, "-1"),
    salesEmployeeName: normalizeCode(row.SalesEmployeeName, "Unassigned"),
    itemCode: normalizeCode(row.ItemCode),
    itemName: normalizeCode(row.ItemDescription),
    itemGroupCode: normalizeCode(row.ItemGroupCode),
    itemGroupName: normalizeCode(row.ItemGroupName),
    warehouseCode: normalizeCode(row.WarehouseCode),
    documentCurrency: normalizeCode(row.DocumentCurrency),
    docRate: toNumber(row.DocRate) || 1,
    quantity: toNumber(row.Quantity),
    unitPrice: toNumber(row.UnitPrice),
    lineTotal: toNumber(row.LineTotal),
    lineTotalSystem: toNumber(row.LineTotalSystem),
    grossProfit: toNumber(row.GrossProfit),
    grossProfitSystem: toNumber(row.GrossProfitSystem),
    openAmount: toNumber(row.OpenAmount),
    openAmountSystem: toNumber(row.OpenAmountSystem),
    taxAmount: toNumber(row.TaxAmount),
    headerOpenAmount: toNumber(row.HeaderOpenAmount),
    headerOpenAmountSystem: toNumber(row.HeaderOpenAmountSystem),
    headerDocTotal: toNumber(row.HeaderDocTotal),
    headerDocTotalSystem: toNumber(row.HeaderDocTotalSystem),
    headerVatAmount: toNumber(row.HeaderVatAmount),
    headerVatAmountSystem: toNumber(row.HeaderVatAmountSystem),
    cancelStatus: normalizeCode(row.CancelStatus, "N"),
    blanketAgreementCode: normalizeCode(row.BlanketAgreementCode),
    blanketAgreementName: normalizeCode(row.BlanketAgreementName),
  }));
};

const resolveAmountForDisplay = (row, field, displaySystemCurrency) => {
  const localValue = toNumber(row[field]);
  const systemValue = toNumber(row[`${field}System`]);
  if (displaySystemCurrency) return systemValue || localValue;
  return localValue;
};

const resolveHeaderNetAmount = (row, displaySystemCurrency) => {
  const grossAmount = displaySystemCurrency
    ? toNumber(row.headerDocTotalSystem) || toNumber(row.headerDocTotal)
    : toNumber(row.headerDocTotal);
  const vatAmount = displaySystemCurrency
    ? toNumber(row.headerVatAmountSystem) || toNumber(row.headerVatAmount)
    : toNumber(row.headerVatAmount);
  return grossAmount - vatAmount;
};

const resolveHeaderNetOpenAmount = (row, displaySystemCurrency) => {
  const grossAmount = displaySystemCurrency
    ? toNumber(row.headerDocTotalSystem) || toNumber(row.headerDocTotal)
    : toNumber(row.headerDocTotal);
  const openGrossAmount = displaySystemCurrency
    ? toNumber(row.headerOpenAmountSystem) || toNumber(row.headerOpenAmount)
    : toNumber(row.headerOpenAmount);
  const netAmount = resolveHeaderNetAmount(row, displaySystemCurrency);

  if (Math.abs(grossAmount) < 0.000001) return 0;
  return openGrossAmount * (Math.abs(netAmount) / Math.abs(grossAmount));
};

const normalizePurchaseSalesEmployee = (value) => {
  const text = normalizeText(value);
  if (!text || text === "Unassigned") return "-No Sales Employee / Buyer-";
  return text;
};

const getPurchaseDocumentReference = (row) => {
  const prefix = PURCHASE_DOCUMENT_PREFIXES[row.documentType] || row.documentLabel || "Doc";
  return `${prefix} ${row.docNum}`;
};

const buildChartSeriesFromDocuments = (documents, primaryField, secondaryField, primaryLabel, secondaryLabel) => {
  const monthly = MONTH_LABELS.map((label) => ({ label, primary: 0, secondary: 0 }));
  const quarterly = QUARTER_LABELS.map((label) => ({ label, primary: 0, secondary: 0 }));

  documents.forEach((document) => {
    const date = document.postingDate instanceof Date ? document.postingDate : new Date(document.postingDate);
    if (Number.isNaN(date.getTime())) return;
    const monthIndex = date.getMonth();
    const quarterIndex = Math.floor(monthIndex / 3);
    const primaryValue = toNumber(document[primaryField]);
    const secondaryValue = toNumber(document[secondaryField]);

    monthly[monthIndex].primary += primaryValue;
    monthly[monthIndex].secondary += secondaryValue;
    quarterly[quarterIndex].primary += primaryValue;
    quarterly[quarterIndex].secondary += secondaryValue;
  });

  return {
    primaryLabel,
    secondaryLabel,
    monthly,
    quarterly,
  };
};

const buildPurchaseDocumentSummaries = (rows, criteria) => {
  const documents = new Map();

  rows.forEach((row) => {
    const documentKey = `${row.documentType}:${row.docEntry}`;
    if (!documents.has(documentKey)) {
      const amount = resolveHeaderNetAmount(row, criteria.displaySystemCurrency);
      documents.set(documentKey, {
        key: documentKey,
        docEntry: row.docEntry,
        documentNo: row.docNum,
        documentRef: getPurchaseDocumentReference(row),
        postingDate: row.postingDate,
        dueDate: row.dueDate,
        documentDate: row.documentDate,
        documentType: row.documentLabel,
        installmentLabel: "1 of 1",
        salesEmployee: normalizePurchaseSalesEmployee(row.salesEmployeeName),
        customerCode: row.customerCode,
        customerName: row.customerName,
        purchasedAmount: amount,
        appliedAmount: amount,
        openAmount: resolveHeaderNetOpenAmount(row, criteria.displaySystemCurrency),
        agreementNo: row.blanketAgreementName || row.blanketAgreementCode || "",
        quantity: 0,
        lineTotal: 0,
        itemCount: 0,
      });
    }

    const bucket = documents.get(documentKey);
    bucket.quantity += row.quantity;
    bucket.lineTotal += resolveAmountForDisplay(row, "lineTotal", criteria.displaySystemCurrency);
    bucket.itemCount += 1;
  });

  return [...documents.values()].sort((left, right) => {
    const dateDelta = new Date(left.postingDate || 0).getTime() - new Date(right.postingDate || 0).getTime();
    if (dateDelta !== 0) return dateDelta;
    return toNumber(left.documentNo) - toNumber(right.documentNo);
  });
};

const getSummaryIdentity = (row, criteria) => {
  const basePeriodKey = getPeriodKey(resolveGroupingDate(row, criteria), criteria.reportPeriod);
  let entityCode = "";
  let entityName = "";
  let secondaryCode = "";
  let secondaryName = "";

  if (criteria.tab === "customers") {
    entityCode = row.customerCode;
    entityName = row.customerName;
    if (criteria.totalType === "totalByBlanketAgreement") {
      secondaryCode = row.blanketAgreementCode;
      secondaryName = row.blanketAgreementName || row.blanketAgreementCode;
    }
  } else if (criteria.tab === "items") {
    entityCode = row.itemCode;
    entityName = row.itemName;
    if (criteria.totalType === "totalByCustomer") {
      secondaryCode = row.customerCode;
      secondaryName = row.customerName;
    } else if (criteria.totalType === "totalBySalesEmployee") {
      secondaryCode = row.salesEmployeeCode;
      secondaryName = row.salesEmployeeName;
    }
  } else {
    entityCode = row.salesEmployeeCode;
    entityName = row.salesEmployeeName;
  }

  const keyParts = [entityCode || "_blank", secondaryCode || "", criteria.reportPeriod === "annual" ? "" : basePeriodKey];
  return {
    key: keyParts.join("::"),
    entityCode,
    entityName,
    secondaryCode,
    secondaryName,
    periodKey: criteria.reportPeriod === "annual" ? "" : basePeriodKey,
    periodLabel: criteria.reportPeriod === "annual" ? "" : basePeriodKey,
  };
};

const buildSummaryRows = async (criteria) => {
  const companyCurrencies = await getCompanyCurrencies();
  const baseRows = await fetchBaseRows(criteria);
  const documentSummaries = buildPurchaseDocumentSummaries(baseRows, criteria);

  if (!baseRows.length) {
    return {
      mode: "summary",
      reportKind: "purchase",
      title: `Purchase Analysis by ${criteria.tab === "customers" ? "Supplier" : criteria.tab === "items" ? "Item" : "Sales Employee"} (${criteria.reportPeriod[0].toUpperCase()}${criteria.reportPeriod.slice(1)})`,
      documentLabel: DOCUMENT_CONFIG[criteria.documentType].countLabel,
      amountLabel: DOCUMENT_CONFIG[criteria.documentType].totalLabel,
      companyName: companyCurrencies.companyName,
      currencyCode: criteria.displaySystemCurrency ? companyCurrencies.systemCurrency : companyCurrencies.localCurrency,
      chartData: null,
      rows: [],
      totals: null,
      message: "No matching records found",
    };
  }

  const grouped = new Map();

  baseRows.forEach((row) => {
    const identity = getSummaryIdentity(row, criteria);
    const lineAmount = resolveAmountForDisplay(row, "lineTotal", criteria.displaySystemCurrency);
    const headerAmount = resolveHeaderNetAmount(row, criteria.displaySystemCurrency);
    const grossProfit = resolveAmountForDisplay(row, "grossProfit", criteria.displaySystemCurrency);
    const openAmount = resolveHeaderNetOpenAmount(row, criteria.displaySystemCurrency);
    const documentKey = `${row.documentType}:${row.docEntry}`;

    if (!grouped.has(identity.key)) {
      grouped.set(identity.key, {
        ...identity,
        documentKeys: new Set(),
        amountDocumentKeys: new Set(),
        openDocumentKeys: new Set(),
        documentCount: 0,
        totalAmount: 0,
        grossProfit: 0,
        openAmount: 0,
        quantity: 0,
      });
    }

    const bucket = grouped.get(identity.key);
    bucket.documentKeys.add(documentKey);
    if (criteria.tab === "items") {
      bucket.totalAmount += lineAmount;
    } else if (!bucket.amountDocumentKeys.has(documentKey)) {
      bucket.amountDocumentKeys.add(documentKey);
      bucket.totalAmount += headerAmount;
    }
    bucket.grossProfit += grossProfit;
    if (criteria.tab === "items") {
      bucket.openAmount += resolveAmountForDisplay(row, "openAmount", criteria.displaySystemCurrency);
    } else if (!bucket.openDocumentKeys.has(documentKey)) {
      bucket.openDocumentKeys.add(documentKey);
      bucket.openAmount += openAmount;
    }
    bucket.quantity += row.quantity;
  });

  const rows = [...grouped.values()]
    .map((bucket) => ({
      key: bucket.key,
      entityCode: bucket.entityCode,
      entityName: bucket.entityName,
      secondaryCode: bucket.secondaryCode,
      secondaryName: bucket.secondaryName,
      periodKey: bucket.periodKey,
      periodLabel: bucket.periodLabel,
      documentCount: bucket.documentKeys.size,
      totalAmount: bucket.totalAmount,
      grossProfit: bucket.grossProfit,
      grossProfitPct: bucket.totalAmount === 0 ? 0 : (bucket.grossProfit / bucket.totalAmount) * 100,
      openAmount: bucket.openAmount,
      quantity: bucket.quantity,
    }))
    .sort((left, right) => {
      const codeDelta = String(left.entityCode).localeCompare(String(right.entityCode));
      if (codeDelta !== 0) return codeDelta;
      if (left.secondaryCode || right.secondaryCode) {
        const secondaryDelta = String(left.secondaryCode || "").localeCompare(String(right.secondaryCode || ""));
        if (secondaryDelta !== 0) return secondaryDelta;
      }
      return String(left.periodKey || "").localeCompare(String(right.periodKey || ""));
    })
    .map((row, index) => ({ ...row, rowNo: index + 1 }));

  const totalAmount = rows.reduce((sum, row) => sum + row.totalAmount, 0);
  const totalGrossProfit = rows.reduce((sum, row) => sum + row.grossProfit, 0);
  const totalOpenAmount = rows.reduce((sum, row) => sum + row.openAmount, 0);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalDocumentCount = rows.reduce((sum, row) => sum + row.documentCount, 0);

  return {
    mode: "summary",
    reportKind: "purchase",
    title: `Purchase Analysis by ${criteria.tab === "customers" ? "Supplier" : criteria.tab === "items" ? "Item" : "Sales Employee"} (${criteria.reportPeriod[0].toUpperCase()}${criteria.reportPeriod.slice(1)})`,
    documentLabel: DOCUMENT_CONFIG[criteria.documentType].countLabel,
    amountLabel: DOCUMENT_CONFIG[criteria.documentType].totalLabel,
    companyName: companyCurrencies.companyName,
    currencyCode: criteria.displaySystemCurrency ? companyCurrencies.systemCurrency : companyCurrencies.localCurrency,
    chartData: buildChartSeriesFromDocuments(
      documentSummaries,
      "purchasedAmount",
      "openAmount",
      DOCUMENT_CONFIG[criteria.documentType].totalLabel,
      "Total Open PU"
    ),
    rows,
    totals: {
      documentCount: totalDocumentCount,
      totalAmount,
      grossProfit: totalGrossProfit,
      grossProfitPct: totalAmount === 0 ? 0 : (totalGrossProfit / totalAmount) * 100,
      openAmount: totalOpenAmount,
      quantity: totalQuantity,
    },
    message: "",
  };
};

const filterDetailRows = (rows, criteria, detailContext) => rows.filter((row) => {
  const identity = getSummaryIdentity(row, criteria);
  if (detailContext.entityCode && identity.entityCode !== detailContext.entityCode) return false;
  if (detailContext.secondaryCode && identity.secondaryCode !== detailContext.secondaryCode) return false;
  if (detailContext.periodKey && identity.periodKey !== detailContext.periodKey) return false;
  return true;
});

const buildDetailRows = async (criteria) => {
  const companyCurrencies = await getCompanyCurrencies();
  const allRows = await fetchBaseRows(criteria);
  const filteredRows = filterDetailRows(allRows, criteria, criteria.detailContext || {});
  const documentRows = buildPurchaseDocumentSummaries(filteredRows, criteria);

  if (!filteredRows.length) {
    return {
      mode: "detail",
      reportKind: "purchase",
      detailLayout: "sapDocument",
      title: "Purchase Analysis Detail",
      companyName: companyCurrencies.companyName,
      currencyCode: criteria.displaySystemCurrency ? companyCurrencies.systemCurrency : companyCurrencies.localCurrency,
      chartData: null,
      rows: [],
      totals: null,
      message: "No matching records found",
    };
  }

  const detailRows = documentRows.map((row, index) => ({
    rowNo: index + 1,
    docEntry: row.docEntry,
    documentNo: row.documentNo,
    documentRef: row.documentRef,
    installmentLabel: row.installmentLabel,
    postingDate: row.postingDate ? row.postingDate.toISOString().slice(0, 10) : "",
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
    customerCode: row.customerCode,
    customerName: row.customerName,
    salesEmployee: row.salesEmployee,
    purchasedAmount: row.purchasedAmount,
    appliedAmount: row.appliedAmount,
    agreementNo: row.agreementNo,
    periodLabel: getPeriodKey(resolveGroupingDate(row, criteria), criteria.reportPeriod),
  }));

  const totalPurchasedAmount = detailRows.reduce((sum, row) => sum + row.purchasedAmount, 0);
  const totalAppliedAmount = detailRows.reduce((sum, row) => sum + row.appliedAmount, 0);

  return {
    mode: "detail",
    reportKind: "purchase",
    detailLayout: "sapDocument",
    title: "Purchase Analysis Detailed Report",
    companyName: companyCurrencies.companyName,
    currencyCode: criteria.displaySystemCurrency ? companyCurrencies.systemCurrency : companyCurrencies.localCurrency,
    chartData: buildChartSeriesFromDocuments(
      documentRows,
      "purchasedAmount",
      "appliedAmount",
      "Purchased Amount",
      "Applied Amount"
    ),
    rows: detailRows,
    totals: {
      purchasedAmount: totalPurchasedAmount,
      appliedAmount: totalAppliedAmount,
    },
    message: "",
  };
};

const getPurchaseAnalysis = async (criteria) => (
  criteria.detailContext ? buildDetailRows(criteria) : buildSummaryRows(criteria)
);

const lookupVendors = async (query = "") => {
  const hasQuery = Boolean(normalizeText(query));
  return queryRows(
    `
      SELECT TOP 100
        T0.CardCode AS code,
        T0.CardName AS name,
        CAST(ISNULL(T0.GroupCode, 0) AS NVARCHAR(50)) AS groupCode,
        ISNULL(T1.GroupName, '') AS groupName
      FROM OCRD T0
      LEFT JOIN OCRG T1 ON T1.GroupCode = T0.GroupCode
      WHERE T0.CardType = 'S'
        AND (
          @hasQuery = 0
          OR T0.CardCode LIKE @query
          OR T0.CardName LIKE @query
        )
      ORDER BY T0.CardCode
    `,
    { hasQuery: hasQuery ? 1 : 0, query: buildLike(query) }
  );
};

const lookupItems = async (query = "") => {
  const hasQuery = Boolean(normalizeText(query));
  return queryRows(
    `
      SELECT TOP 100
        T0.ItemCode AS code,
        T0.ItemName AS name,
        CAST(ISNULL(T0.ItmsGrpCod, 0) AS NVARCHAR(50)) AS groupCode,
        ISNULL(T1.ItmsGrpNam, '') AS groupName
      FROM OITM T0
      LEFT JOIN OITB T1 ON T1.ItmsGrpCod = T0.ItmsGrpCod
      WHERE (
        @hasQuery = 0
        OR T0.ItemCode LIKE @query
        OR T0.ItemName LIKE @query
      )
      ORDER BY T0.ItemCode
    `,
    { hasQuery: hasQuery ? 1 : 0, query: buildLike(query) }
  );
};

const lookupPurchasingEmployees = async (query = "", includeInactive = false) => {
  const hasQuery = Boolean(normalizeText(query));
  const activeColumn = await hasColumn("OSLP", "Active");
  const activeClause = includeInactive || !activeColumn ? "" : "AND ISNULL(T0.Active, 'Y') = 'Y'";

  return queryRows(
    `
      SELECT TOP 100
        CAST(T0.SlpCode AS NVARCHAR(50)) AS code,
        T0.SlpName AS name
      FROM OSLP T0
      WHERE (
        @hasQuery = 0
        OR CAST(T0.SlpCode AS NVARCHAR(50)) LIKE @query
        OR T0.SlpName LIKE @query
      )
      ${activeClause}
      ORDER BY T0.SlpCode
    `,
    { hasQuery: hasQuery ? 1 : 0, query: buildLike(query) }
  );
};

const lookupVendorGroups = async () => ([
  { code: "All", name: "All" },
  ...(await queryRows(`
    SELECT DISTINCT
      CAST(G.GroupCode AS NVARCHAR(50)) AS code,
      G.GroupName AS name
    FROM OCRG G
    INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
    WHERE BP.CardType = 'S'
    ORDER BY G.GroupName
  `)),
]);

const lookupItemGroups = async () => ([
  { code: "All", name: "All" },
  ...(await queryRows(`
    SELECT
      CAST(ItmsGrpCod AS NVARCHAR(50)) AS code,
      ItmsGrpNam AS name
    FROM OITB
    ORDER BY ItmsGrpNam
  `)),
]);

const lookupItemProperties = async () => {
  const rows = await queryRows(`
    SELECT
      ItmsTypCod,
      ItmsGrpNam
    FROM OITG
    ORDER BY ItmsTypCod
  `);

  const names = rows.reduce((acc, row) => {
    acc[Number(row.ItmsTypCod)] = row.ItmsGrpNam || `Property ${row.ItmsTypCod}`;
    return acc;
  }, {});

  return Array.from({ length: 64 }, (_, index) => ({
    number: index + 1,
    name: names[index + 1] || `Property ${index + 1}`,
  }));
};

const lookupVendorProperties = async () =>
  Array.from({ length: 64 }, (_, index) => ({
    number: index + 1,
    name: `Property ${index + 1}`,
  }));

module.exports = {
  getPurchaseAnalysis,
  lookupVendors,
  lookupItems,
  lookupPurchasingEmployees,
  lookupVendorGroups,
  lookupItemGroups,
  lookupVendorProperties,
  lookupItemProperties,
};
