const db = require("../dbService");

const STATUS_LABELS = {
  P: "Planned",
  R: "Released",
  L: "Closed",
  C: "Cancelled",
};

const TYPE_LABELS = {
  S: "Standard",
  P: "Special",
  D: "Disassembly",
};

const normalizeText = (value) => String(value || "").trim();

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
};

const formatDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const getStatusClause = (status, params) => {
  const normalized = normalizeText(status).toLowerCase();
  if (normalized === "planned") return "H.Status = 'P'";
  if (normalized === "released") return "H.Status = 'R'";
  if (normalized === "all") return "H.Status IN ('P', 'R', 'L', 'C')";

  params.openStatusPlanned = "P";
  params.openStatusReleased = "R";
  return "H.Status IN (@openStatusPlanned, @openStatusReleased)";
};

const getProductionOpenItemsReport = async (criteria = {}, options = {}) => {
  const params = {};
  const whereClauses = [getStatusClause(criteria.status, params)];
  const query = normalizeText(criteria.query);

  if (query) {
    params.query = `%${query}%`;
    whereClauses.push(
      "(CAST(H.DocNum AS NVARCHAR(50)) LIKE @query OR ISNULL(H.ItemCode, '') LIKE @query OR ISNULL(H.ProdName, '') LIKE @query)",
    );
  }

  const rows = await queryRows(
    `
      SELECT TOP 5000
        H.DocEntry,
        H.DocNum,
        H.Series,
        ISNULL(S.SeriesName, CAST(H.Series AS NVARCHAR(50))) AS SeriesName,
        H.Type,
        H.Status,
        ISNULL(H.ItemCode, '') AS ProductNo,
        ISNULL(H.ProdName, '') AS ProductDescription,
        CAST(ISNULL(H.PlannedQty, 0) AS DECIMAL(19, 3)) AS PlannedQuantity,
        H.PostDate AS OrderDate,
        H.StartDate,
        H.DueDate
      FROM OWOR H
      LEFT JOIN NNM1 S
        ON S.Series = H.Series
       AND S.ObjectCode = '202'
      WHERE ${whereClauses.join("\n        AND ")}
      ORDER BY H.DocNum
    `,
    params,
    options,
  );

  return {
    reportTitle: "Open Items List",
    documentType: "production_orders",
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    columns: [
      { key: "docNo", label: "Doc. No." },
      { key: "selected", label: "Select" },
      { key: "docSeries", label: "Doc. Series" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "productNo", label: "Product No." },
      { key: "productDescription", label: "Product Description" },
      { key: "plannedQuantity", label: "Planned Quantity" },
      { key: "orderDate", label: "Order Date" },
      { key: "startDate", label: "Start Date" },
      { key: "dueDate", label: "Due Date" },
    ],
    rows: rows.map((row, index) => ({
      rowNo: index + 1,
      docEntry: row.DocEntry,
      docNo: row.DocNum != null ? String(row.DocNum) : "",
      selected: false,
      docSeries: row.SeriesName || "",
      typeCode: row.Type || "",
      type: TYPE_LABELS[row.Type] || row.Type || "",
      statusCode: row.Status || "",
      status: STATUS_LABELS[row.Status] || row.Status || "",
      productNo: row.ProductNo || "",
      productDescription: row.ProductDescription || "",
      plannedQuantity: Number(row.PlannedQuantity || 0),
      orderDate: formatDate(row.OrderDate),
      startDate: formatDate(row.StartDate),
      dueDate: formatDate(row.DueDate),
    })),
  };
};

module.exports = {
  getProductionOpenItemsReport,
};
