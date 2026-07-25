import { exportReportAsPdf } from "./reportExportUtils";

const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

const formatCurrency = (currencyCode, value) => `${currencyCode} ${formatNumber(value)}`;

const formatDate = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year.slice(-2)}`;
};

const dateFilterLabels = {
  postingDate: "Posting Date",
  dueDate: "Due Date",
  documentDate: "Document Date",
};

const buildCriteriaRows = (criteria = {}) =>
  Object.entries(criteria?.dateFilters || {})
    .filter(([, filter]) => filter?.enabled)
    .map(([key, filter]) => ({
      label: dateFilterLabels[key] || key,
      from: formatDate(filter.from),
      to: formatDate(filter.to),
    }));

function buildSummaryColumns({
  result,
  tab,
  customerLabel = "Supplier",
  salesEmployeeLabel = "Sales Employee",
  openAmountLabel = "Total Open PU",
}) {
  const columns = [
    { label: "#", align: "center" },
    {
      label:
        tab === "customers"
          ? `${customerLabel} Code`
          : tab === "items"
            ? "Item Code"
            : `${salesEmployeeLabel} Code`,
      align: "left",
    },
    {
      label:
        tab === "customers"
          ? `${customerLabel} Name`
          : tab === "items"
            ? "Item Description"
            : `${salesEmployeeLabel} Name`,
      align: "left",
    },
  ];

  if (result.rows.some((row) => row.secondaryCode)) {
    columns.push({ label: "Grouping", align: "left" });
  }

  if (result.rows.some((row) => row.periodLabel)) {
    columns.push({ label: "Period", align: "left" });
  }

  if (tab === "items") {
    columns.push({ label: "Quantity", align: "right" });
  }

  columns.push(
    { label: result.documentLabel || "Documents", align: "right" },
    { label: result.amountLabel || "Amount", align: "right" },
    { label: openAmountLabel, align: "right" },
  );

  return columns;
}

function buildSummaryRows(result, tab) {
  return result.rows.map((row) => {
    const cells = [
      { value: row.rowNo, align: "center" },
      row.entityCode || "",
      row.entityName || "",
    ];

    if (result.rows.some((entry) => entry.secondaryCode)) {
      cells.push(row.secondaryCode ? `${row.secondaryCode} - ${row.secondaryName || ""}` : "");
    }

    if (result.rows.some((entry) => entry.periodLabel)) {
      cells.push(row.periodLabel || "");
    }

    if (tab === "items") {
      cells.push({ value: formatNumber(row.quantity), align: "right" });
    }

    cells.push(
      { value: row.documentCount ?? "", align: "right" },
      { value: formatCurrency(result.currencyCode, row.totalAmount), align: "right" },
      { value: formatCurrency(result.currencyCode, row.openAmount), align: "right" },
    );

    return cells;
  });
}

function buildSummaryFooter(result, tab) {
  if (!result?.totals) return [];

  const hasSecondary = result.rows.some((row) => row.secondaryCode);
  const hasPeriod = result.rows.some((row) => row.periodLabel);
  const leadingColSpan = 3 + (hasSecondary ? 1 : 0) + (hasPeriod ? 1 : 0);
  const footer = [{ value: "Total", colSpan: leadingColSpan }];

  if (tab === "items") {
    footer.push({ value: formatNumber(result.totals.quantity), align: "right" });
  }

  footer.push(
    { value: result.totals.documentCount ?? "", align: "right" },
    { value: formatCurrency(result.currencyCode, result.totals.totalAmount), align: "right" },
    { value: formatCurrency(result.currencyCode, result.totals.openAmount), align: "right" },
  );

  return footer;
}

function buildDetailColumns(result) {
  if (result.detailLayout === "sapDocument") {
    return [
      { label: "#", align: "center" },
      { label: "Document", align: "left" },
      { label: "Installment", align: "left" },
      { label: "Sales Employee", align: "left" },
      { label: "Posting Date", align: "left" },
      { label: "Due Date", align: "left" },
      { label: "Supplier Name", align: "left" },
      { label: result.chartData?.primaryLabel || "Purchased Amount", align: "right" },
      { label: result.chartData?.secondaryLabel || "Applied Amount", align: "right" },
      { label: "Agreement No.", align: "left" },
    ];
  }

  return [
    { label: "#", align: "center" },
    { label: "Document No", align: "left" },
    { label: "Posting Date", align: "left" },
    { label: "Supplier Code", align: "left" },
    { label: "Supplier Name", align: "left" },
    { label: "Item Code", align: "left" },
    { label: "Item Name", align: "left" },
    { label: "Quantity", align: "right" },
    { label: "Price", align: "right" },
    { label: "Line Total", align: "right" },
    { label: "Sales Employee", align: "left" },
  ];
}

function buildDetailRows(result) {
  if (result.detailLayout === "sapDocument") {
    return result.rows.map((row) => ([
      { value: row.rowNo, align: "center" },
      row.documentRef || "",
      row.installmentLabel || "",
      row.salesEmployee || "",
      formatDate(row.postingDate),
      formatDate(row.dueDate),
      row.customerName || "",
      { value: formatCurrency(result.currencyCode, row.purchasedAmount), align: "right" },
      { value: formatCurrency(result.currencyCode, row.appliedAmount), align: "right" },
      row.agreementNo || "",
    ]));
  }

  return result.rows.map((row) => ([
    { value: row.rowNo, align: "center" },
    row.documentNo || "",
    formatDate(row.postingDate),
    row.customerCode || "",
    row.customerName || "",
    row.itemCode || "",
    row.itemName || "",
    { value: formatNumber(row.quantity), align: "right" },
    { value: formatCurrency(result.currencyCode, row.price), align: "right" },
    { value: formatCurrency(result.currencyCode, row.lineTotal), align: "right" },
    row.salesEmployee || "",
  ]));
}

function buildDetailFooter(result) {
  if (!result?.totals) return [];

  if (result.detailLayout === "sapDocument") {
    return [
      { value: "Total", colSpan: 7 },
      { value: formatCurrency(result.currencyCode, result.totals.purchasedAmount), align: "right" },
      { value: formatCurrency(result.currencyCode, result.totals.appliedAmount), align: "right" },
      "",
    ];
  }

  return [
    { value: "Total", colSpan: 7 },
    { value: formatNumber(result.totals.quantity), align: "right" },
    "",
    { value: formatCurrency(result.currencyCode, result.totals.totalAmount), align: "right" },
    "",
  ];
}

export function exportPurchaseSummaryPdf({
  result,
  criteria,
  tab,
  customerLabel = "Supplier",
  salesEmployeeLabel = "Sales Employee",
  openAmountLabel = "Total Open PU",
}) {
  if (!result?.rows?.length) return;

  exportReportAsPdf({
    companyName: result.companyName || "SAP B1",
    reportTitle: result.title || "Purchase Analysis Report",
    documentLabel: result.documentLabel || "",
    criteriaRows: buildCriteriaRows(criteria),
    columns: buildSummaryColumns({ result, tab, customerLabel, salesEmployeeLabel, openAmountLabel }),
    rows: buildSummaryRows(result, tab),
    footer: buildSummaryFooter(result, tab),
    fileName: "purchase-analysis-summary",
  });
}

export function exportPurchaseDetailPdf({ result, criteria }) {
  if (!result?.rows?.length) return;

  exportReportAsPdf({
    companyName: result.companyName || "SAP B1",
    reportTitle: result.title || "Purchase Analysis Detailed Report",
    documentLabel: result.chartData?.primaryLabel || "Detailed Report",
    criteriaRows: buildCriteriaRows(criteria),
    columns: buildDetailColumns(result),
    rows: buildDetailRows(result),
    footer: buildDetailFooter(result),
    fileName: "purchase-analysis-detail",
  });
}
