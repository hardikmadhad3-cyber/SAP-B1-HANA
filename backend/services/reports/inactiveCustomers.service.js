const db = require("../dbService");

const text = (value) => String(value || "").trim();

const queryRows = async (sql, params = {}) => {
  const result = await db.query(sql, params);
  return result.recordset || result || [];
};

const parseDate = (value) => {
  const normalized = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return normalized;

  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  return `${year}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
};

const appendRange = (clauses, column, from, to, params, prefix) => {
  if (text(from)) {
    params[`${prefix}From`] = text(from);
    clauses.push(`${column} >= @${prefix}From`);
  }

  if (text(to)) {
    params[`${prefix}To`] = text(to);
    clauses.push(`${column} <= @${prefix}To`);
  }
};

const appendPropertyFilter = (clauses, propertyFilter = {}) => {
  if (propertyFilter.ignoreProperties !== false) return;

  const selected = (propertyFilter.selectedPropertyNumbers || [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64);

  if (!selected.length) return;

  const selectedSet = new Set(selected);
  const operator = propertyFilter.linkMode === "or" ? " OR " : " AND ";
  clauses.push(`(${selected.map((value) => `ISNULL(BP.QryGroup${value}, 'N') = 'Y'`).join(operator)})`);

  if (propertyFilter.exactlyMatch) {
    const unselected = Array.from({ length: 64 }, (_, index) => index + 1)
      .filter((value) => !selectedSet.has(value))
      .map((value) => `ISNULL(BP.QryGroup${value}, 'N') <> 'Y'`);
    clauses.push(`(${unselected.join(" AND ")})`);
  }
};

const normalizeDocumentTypes = (documentTypes = {}) => {
  const normalized = {
    salesQuotations: documentTypes.salesQuotations !== false,
    orders: documentTypes.orders !== false,
    deliveryNotes: documentTypes.deliveryNotes !== false,
    arInvoices: documentTypes.arInvoices !== false,
  };

  return Object.values(normalized).some(Boolean)
    ? normalized
    : {
      salesQuotations: true,
      orders: true,
      deliveryNotes: true,
      arInvoices: true,
    };
};

const buildActivityChecks = (documentTypes) => {
  const checks = [];

  if (documentTypes.salesQuotations) {
    checks.push(`
      EXISTS (
        SELECT 1
        FROM OQUT D
        WHERE D.CardCode = BP.CardCode
          AND CAST(D.DocDate AS DATE) >= CAST(@dateFrom AS DATE)
      )
    `);
  }

  if (documentTypes.orders) {
    checks.push(`
      EXISTS (
        SELECT 1
        FROM ORDR D
        WHERE D.CardCode = BP.CardCode
          AND CAST(D.DocDate AS DATE) >= CAST(@dateFrom AS DATE)
      )
    `);
  }

  if (documentTypes.deliveryNotes) {
    checks.push(`
      EXISTS (
        SELECT 1
        FROM ODLN D
        WHERE D.CardCode = BP.CardCode
          AND CAST(D.DocDate AS DATE) >= CAST(@dateFrom AS DATE)
      )
    `);
  }

  if (documentTypes.arInvoices) {
    checks.push(`
      EXISTS (
        SELECT 1
        FROM OINV D
        WHERE D.CardCode = BP.CardCode
          AND CAST(D.DocDate AS DATE) >= CAST(@dateFrom AS DATE)
      )
    `);
  }

  return checks;
};

const getLookups = async () => {
  const [groups, properties] = await Promise.all([
    queryRows(`
      SELECT DISTINCT CAST(G.GroupCode AS NVARCHAR(50)) AS code, ISNULL(G.GroupName, '') AS name
      FROM OCRG G
      INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
      WHERE BP.CardType = 'C'
      ORDER BY name, code
    `),
    queryRows(`
      SELECT GroupCode AS number, ISNULL(GroupName, '') AS name
      FROM OCQG
      ORDER BY GroupCode
    `),
  ]);

  return {
    customerGroups: [...groups, { code: "All", name: "All" }],
    properties: properties.length
      ? properties
      : Array.from({ length: 64 }, (_, index) => ({
        number: index + 1,
        name: `Business Partners Property ${index + 1}`,
      })),
  };
};

const getReport = async (criteria = {}) => {
  const dateFrom = parseDate(criteria.dateFrom) || new Date().toISOString().slice(0, 10);
  const documentTypes = normalizeDocumentTypes(criteria.documentTypes);
  const params = { dateFrom };
  const clauses = ["BP.CardType = 'C'"];

  appendRange(clauses, "BP.CardCode", criteria.codeFrom, criteria.codeTo, params, "code");
  appendPropertyFilter(clauses, criteria.propertyFilter);

  if (text(criteria.customerGroup).toLowerCase() !== "all") {
    params.customerGroup = text(criteria.customerGroup);
    clauses.push("CAST(BP.GroupCode AS NVARCHAR(50)) = @customerGroup");
  }

  const activityChecks = buildActivityChecks(documentTypes);
  clauses.push(`NOT (${activityChecks.join("\n        OR ")})`);

  const rows = await queryRows(`
    SELECT TOP 5000
      ROW_NUMBER() OVER (ORDER BY BP.CardCode) AS rowNo,
      BP.CardCode AS customerCode,
      ISNULL(BP.CardName, '') AS bpName,
      ISNULL(BP.Phone1, '') AS telephone1,
      ISNULL(BP.Phone2, '') AS telephone2,
      CAST(BP.GroupCode AS NVARCHAR(50)) AS customerGroupCode,
      ISNULL(G.GroupName, '') AS customerGroupName
    FROM OCRD BP
    LEFT JOIN OCRG G ON G.GroupCode = BP.GroupCode
    WHERE ${clauses.join("\n      AND ")}
    ORDER BY BP.CardCode
  `, params);

  return {
    reportTitle: "Inactive Customers",
    generatedAt: new Date().toISOString(),
    dateFrom,
    documentTypes,
    rows: rows.map((row, index) => ({
      rowNo: Number(row.rowNo || index + 1),
      customerCode: row.customerCode || "",
      bpName: row.bpName || "",
      telephone1: row.telephone1 || "",
      telephone2: row.telephone2 || "",
      customerGroupCode: row.customerGroupCode || "",
      customerGroupName: row.customerGroupName || "",
    })),
  };
};

module.exports = { getLookups, getReport };
