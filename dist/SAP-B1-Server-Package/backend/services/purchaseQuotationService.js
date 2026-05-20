const sapService = require('./sapService');
const purchaseQuotationDb = require('./purchaseQuotationDbService');
const { getDocumentFreightCharges } = require('./freightChargesDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');

// ───────── HELPERS ─────────

const formatDateForInput = (value) => {
  if (!value) return '';
  return String(value).split('T')[0];
};

const formatDocumentStatus = (value) => {
  const normalized = String(value || '').trim();
  if (normalized === 'bost_Open') return 'Open';
  if (normalized === 'bost_Close') return 'Closed';
  if (normalized === 'bost_Paid') return 'Paid';
  return normalized;
};

// ───────── REFERENCE DATA (USING ODBC) ─────────

const getReferenceData = async (companyId) => {
  try {
    // Use ODBC/Direct SQL for GET operations
    const data = await purchaseQuotationDb.getReferenceData();
    return data;
  } catch (error) {
    // Return empty structure with warnings
    return {
      company: '',
      vendors: [],
      items: [],
      warehouses: [],
      warehouse_addresses: [],
      payment_terms: [],
      shipping_types: [],
      branches: [],
      tax_codes: [],
      uom_groups: [],
      contacts: [],
      pay_to_addresses: [],
      company_address: {},
      decimal_settings: {
        QtyDec: 2,
        PriceDec: 2,
        SumDec: 2,
        RateDec: 2,
        PercentDec: 2
      },
      warnings: [`Failed to load reference data: ${error.message}`],
    };
  }
};

// ───────── VENDOR DETAILS (USING ODBC) ─────────

const getVendorDetails = async (vendorCode) => {
  try {
    // Use ODBC/Direct SQL for GET operations
    const data = await purchaseQuotationDb.getVendorDetails(vendorCode);
    return data;
  } catch (error) {
    return {
      contacts: [],
      pay_to_addresses: [],
    };
  }
};

// ───────── PURCHASE ORDER LIST (USING ODBC) ─────────

const getPurchaseQuotationList = async ({
  query = '',
  openOnly = false,
  docNum = '',
  vendorCode = '',
  vendorName = '',
  status = '',
  postingDateFrom = '',
  postingDateTo = '',
  page = 1,
  pageSize = 25,
} = {}) => {
  try {
    const result = await purchaseQuotationDb.getPurchaseQuotationList({
      query,
      openOnly,
      docNum,
      vendorCode,
      vendorName,
      status,
      postingDateFrom,
      postingDateTo,
      page,
      pageSize,
    });
    return result;
  } catch (error) {
    return {
      quotations: [],
      pagination: {
        page: Math.max(1, Number(page) || 1),
        pageSize: Math.min(200, Math.max(1, Number(pageSize) || 25)),
        totalCount: 0,
        totalPages: 1,
      },
    };
  }
};

const getVendorFilterOptions = async ({
  query = '',
  vendorCode = '',
  vendorName = '',
  top,
  display = 'code',
} = {}) => {
  try {
    const rows = await purchaseQuotationDb.searchVendors({
      query,
      cardCode: vendorCode,
      cardName: vendorName,
      top,
      sortBy: display === 'name' ? 'name' : 'code',
    });

    return {
      options: rows.map((row) => ({
        code: display === 'name'
          ? String(row.CardName || '').trim()
          : String(row.CardCode || '').trim(),
        name: display === 'name'
          ? String(row.CardCode || '').trim()
          : String(row.CardName || '').trim(),
      })).filter((option) => option.code),
    };
  } catch (_error) {
    return { options: [] };
  }
};

// ───────── GET SINGLE ORDER (USING ODBC) ─────────

const getPurchaseQuotation = async (docEntry) => {
  try {
    const result = await purchaseQuotationDb.getPurchaseQuotation(docEntry);
    return result;
  } catch (error) {
    throw error;
  }
};

// ───────── DOCUMENT SERIES (USING ODBC) ─────────

const getDocumentSeries = async ({ branch, targetDate } = {}) => {
  try {
    const normalizedBranch =
      branch === '' || branch == null || Number.isNaN(Number(branch))
        ? null
        : Number(branch);
    const normalizedTargetDate = String(targetDate || '').trim() || null;
    const result = await purchaseQuotationDb.getDocumentSeries(normalizedBranch, normalizedTargetDate);
    return result;
  } catch (error) {
    return { series: [] };
  }
};

const getNextNumber = async (series) => {
  try {
    const result = await purchaseQuotationDb.getNextNumber(series);
    return result;
  } catch (error) {
    return { nextNumber: null };
  }
};

// ───────── STATE FROM ADDRESS (USING ODBC) ─────────

const getStateFromAddress = async (vendorCode, addressCode) => {
  try {
    const result = await purchaseQuotationDb.getStateFromAddress(vendorCode, addressCode);
    return result;
  } catch (error) {
    return { state: '' };
  }
};

const getStateFromWarehouse = async (whsCode) => {
  try {
    const result = await purchaseQuotationDb.getStateFromWarehouse(whsCode);
    return result;
  } catch (error) {
    return { state: '' };
  }
};

// ───────── CREATE ORDER (USING SERVICE LAYER) ─────────

const toNumberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const cleanObject = (value) => {
  if (Array.isArray(value)) {
    return value
      .map(cleanObject)
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      const cleanedValue = cleanObject(nestedValue);
      const isEmptyObject =
        cleanedValue &&
        typeof cleanedValue === 'object' &&
        !Array.isArray(cleanedValue) &&
        Object.keys(cleanedValue).length === 0;

      if (
        cleanedValue === undefined ||
        cleanedValue === null ||
        cleanedValue === '' ||
        isEmptyObject
      ) {
        return acc;
      }

      acc[key] = cleanedValue;
      return acc;
    }, {});
  }

  return value;
};

const buildDocumentLines = (lines = []) =>
  lines
    .filter((line) => String(line.itemNo || '').trim())
    .map((line) =>
      cleanObject({
        ItemCode: line.itemNo,
        ItemDescription: line.itemDescription,
        Quantity: toNumberOrUndefined(line.quantity),
        UnitPrice: toNumberOrUndefined(line.unitPrice),
        Price: toNumberOrUndefined(line.unitPrice),
        DiscountPercent: toNumberOrUndefined(line.stdDiscount),
        TaxCode: line.taxCode,
        WarehouseCode: line.whse,
        UoMCode: line.uomCode,
        ...(line.udf || {}),
      })
    );

const buildPurchaseQuotationPayload = ({ header = {}, lines = [], header_udfs = {}, freightCharges = [] }) =>
  cleanObject({
    CardCode: header.vendor,
    NumAtCard: header.salesContractNo,
    DocDate: header.postingDate || header.documentDate,
    DocDueDate: header.deliveryDate || header.postingDate || header.documentDate,
    RequriedDate: header.requiredDate || header.deliveryDate || header.postingDate || header.documentDate,
    TaxDate: header.documentDate || header.postingDate,
    // Series for auto-numbering - only include if explicitly provided and valid
    ...(header.series && Number(header.series) > 0 ? { Series: Number(header.series) } : {}),
    BPLId: header.branch ? Number(header.branch) : undefined,
    BPL_IDAssignedToInvoice: header.branch ? Number(header.branch) : undefined,
    DocCurrency: header.currency || 'INR',
    PaymentGroupCode: header.paymentTerms ? Number(header.paymentTerms) : undefined,
    SalesPersonCode: header.salesEmployee !== '' && header.salesEmployee != null ? toNumberOrUndefined(header.salesEmployee) : undefined,
    Comments: header.otherInstruction,
    JournalMemo: header.journalRemark,
    Confirmed: header.confirmed ? 'tYES' : 'tNO',
    DiscountPercent: toNumberOrUndefined(header.discount),
    ...header_udfs,
    DocumentAdditionalExpenses: buildDocumentAdditionalExpenses(freightCharges),
    DocumentLines: buildDocumentLines(lines),
  });

const validatePurchaseQuotationPayload = async ({ header = {}, lines = [] }) => {
  const vendorCode = String(header.vendor || '').trim();
  if (!vendorCode) {
    throw new Error('Vendor is required before submitting the purchase quotation.');
  }

  const itemCodes = Array.from(
    new Set(
      lines
        .map((line) => String(line.itemNo || '').trim())
        .filter(Boolean)
    )
  );

  if (!itemCodes.length) {
    throw new Error('At least one item line is required before submitting the purchase quotation.');
  }
};

const submitPurchaseQuotation = async (payload) => {
  await validatePurchaseQuotationPayload(payload);
  const purchaseQuotationPayload = buildPurchaseQuotationPayload(payload);

  const response = await sapService.request({
    method: 'post',
    url: '/PurchaseQuotations',
    data: purchaseQuotationPayload,
  });

  return {
    message: 'Purchase quotation posted successfully.',
    doc_num: response.data?.DocNum,
    doc_entry: response.data?.DocEntry,
    sap_response: response.data,
  };
};

// ───────── UPDATE ORDER (USING SERVICE LAYER) ─────────

const updatePurchaseQuotation = async (docEntry, payload) => {
  await validatePurchaseQuotationPayload(payload);
  const purchaseQuotationPayload = buildPurchaseQuotationPayload(payload);

  const response = await sapService.request({
    method: 'patch',
    url: `/PurchaseQuotations(${docEntry})`,
    data: purchaseQuotationPayload,
  });

  return {
    message: 'Purchase quotation updated successfully.',
    doc_num: response.data?.DocNum,
    doc_entry: docEntry,
    sap_response: response.data,
  };
};

const getFreightCharges = async (docEntry) => {
  try {
    const freightCharges = await getDocumentFreightCharges('PQT3', docEntry);
    return { freightCharges };
  } catch (_error) {
    return { freightCharges: [] };
  }
};

// ───────── EXPORTS ─────────

module.exports = {
  getReferenceData,
  getVendorDetails,
  getVendorFilterOptions,
  getPurchaseQuotationList,
  getPurchaseQuotation,
  submitPurchaseQuotation,
  updatePurchaseQuotation,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getStateFromWarehouse,
  getFreightCharges,
};
