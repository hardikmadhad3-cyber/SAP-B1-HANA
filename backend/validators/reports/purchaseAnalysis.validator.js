const VALID_TABS = new Set(["customers", "items", "salesEmployees"]);
const VALID_PERIODS = new Set(["annual", "monthly", "quarterly"]);
const VALID_DOCUMENT_TYPES = new Set(["invoices", "orders", "goodsReceiptPO"]);
const VALID_DISPLAY_MODES = new Set(["individual", "group"]);
const VALID_TOTAL_TYPES = new Set([
  "none",
  "totalByCustomer",
  "totalBySalesEmployee",
  "totalByBlanketAgreement",
]);
const VALID_PROPERTY_MODES = new Set(["Ignore", "Include selected", "Exclude selected"]);

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const normalizeText = (value) => String(value || "").trim();
const normalizeBool = (value) => value === true || value === "true" || value === 1 || value === "1";

const normalizeDate = (value) => {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const normalizeRange = (value = {}) => ({
  codeFrom: normalizeText(value.codeFrom),
  codeTo: normalizeText(value.codeTo),
});

const normalizeProperties = (value = {}) => ({
  group: normalizeText(value.group) || "All",
  propertiesMode: VALID_PROPERTY_MODES.has(value.propertiesMode) ? value.propertiesMode : "Ignore",
  properties: Array.isArray(value.properties)
    ? value.properties.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 64)
    : [],
});

const validateDateFilters = (dateFilters = {}) => {
  const normalized = {
    postingDate: {
      enabled: normalizeBool(dateFilters.postingDate?.enabled),
      from: normalizeDate(dateFilters.postingDate?.from),
      to: normalizeDate(dateFilters.postingDate?.to),
    },
    dueDate: {
      enabled: normalizeBool(dateFilters.dueDate?.enabled),
      from: normalizeDate(dateFilters.dueDate?.from),
      to: normalizeDate(dateFilters.dueDate?.to),
    },
    documentDate: {
      enabled: normalizeBool(dateFilters.documentDate?.enabled),
      from: normalizeDate(dateFilters.documentDate?.from),
      to: normalizeDate(dateFilters.documentDate?.to),
    },
  };

  const enabledKeys = Object.keys(normalized).filter((key) => normalized[key].enabled);
  if (!enabledKeys.length) {
    throw createValidationError("At least one date criterion must be selected");
  }

  enabledKeys.forEach((key) => {
    const filter = normalized[key];
    if (!filter.from || !filter.to || filter.from > filter.to) {
      throw createValidationError("Enter valid date range");
    }
  });

  return normalized;
};

const sanitizePurchaseAnalysisPayload = (payload = {}) => {
  const tab = VALID_TABS.has(payload.tab) ? payload.tab : "";
  const reportPeriod = VALID_PERIODS.has(payload.reportPeriod) ? payload.reportPeriod : "";
  const documentType = VALID_DOCUMENT_TYPES.has(payload.documentType) ? payload.documentType : "";

  if (!tab || !reportPeriod || !documentType) {
    throw createValidationError("Invalid selection criteria");
  }

  const customer = {
    ...normalizeRange(payload.customer),
    ...normalizeProperties(payload.customer),
  };

  const item = {
    ...normalizeRange(payload.item),
    ...normalizeProperties(payload.item),
    secondarySelection: normalizeBool(payload.item?.secondarySelection),
    secondaryFilters: {
      customer: normalizeRange(payload.item?.secondaryFilters?.customer),
      salesEmployee: normalizeRange(payload.item?.secondaryFilters?.salesEmployee),
      warehouse: normalizeRange(payload.item?.secondaryFilters?.warehouse),
    },
  };

  const salesEmployee = {
    ...normalizeRange(payload.salesEmployee),
    includeInactive: normalizeBool(payload.salesEmployee?.includeInactive),
  };

  const detailContext = payload.detailContext
    ? {
        entityCode: normalizeText(payload.detailContext.entityCode),
        entityName: normalizeText(payload.detailContext.entityName),
        periodKey: normalizeText(payload.detailContext.periodKey),
        secondaryCode: normalizeText(payload.detailContext.secondaryCode),
      }
    : null;

  const displayMode = VALID_DISPLAY_MODES.has(payload.displayMode) ? payload.displayMode : "individual";
  const totalType = VALID_TOTAL_TYPES.has(payload.totalType)
    ? payload.totalType
    : tab === "items"
      ? "none"
      : "totalByCustomer";

  return {
    tab,
    reportPeriod,
    documentType,
    displayMode,
    totalType,
    dateFilters: validateDateFilters(payload.dateFilters),
    customer,
    item,
    salesEmployee,
    displaySystemCurrency: normalizeBool(payload.displaySystemCurrency),
    detailContext,
  };
};

module.exports = {
  sanitizePurchaseAnalysisPayload,
};
