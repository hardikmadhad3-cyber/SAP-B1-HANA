const sapService = require('./sapService');
const purchaseOrderDb = require('./purchaseOrderDbService');
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
    const data = await purchaseOrderDb.getReferenceData();
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
    const data = await purchaseOrderDb.getVendorDetails(vendorCode);
    return data;
  } catch (error) {
    return {
      contacts: [],
      pay_to_addresses: [],
    };
  }
};

// ───────── PURCHASE ORDER LIST (USING ODBC) ─────────

const getPurchaseOrderList = async ({
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
    // Use ODBC for reading list
    const result = await purchaseOrderDb.getPurchaseOrderList({
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
      orders: [],
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
    const rows = await purchaseOrderDb.searchVendors({
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

const getPurchaseOrder = async (docEntry) => {
  try {
    // Use ODBC for reading single order
    const result = await purchaseOrderDb.getPurchaseOrder(docEntry);
    return result;
  } catch (error) {
    throw error;
  }
};

// ───────── DOCUMENT SERIES (USING ODBC) ─────────

const getDocumentSeries = async () => {
  try {
    const result = await purchaseOrderDb.getDocumentSeries();
    return result;
  } catch (error) {
    return { series: [] };
  }
};

const getNextNumber = async (series) => {
  try {
    const result = await purchaseOrderDb.getNextNumber(series);
    return result;
  } catch (error) {
    return { nextNumber: null };
  }
};

// ───────── STATE FROM ADDRESS (USING ODBC) ─────────

const getStateFromAddress = async (vendorCode, addressCode) => {
  try {
    const result = await purchaseOrderDb.getStateFromAddress(vendorCode, addressCode);
    return result;
  } catch (error) {
    return { state: '' };
  }
};

const getStateFromWarehouse = async (whsCode) => {
  try {
    const result = await purchaseOrderDb.getStateFromWarehouse(whsCode);
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
    .map((line) => {
      const documentLine = cleanObject({
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
      });

      const hasBaseLink =
        line.baseEntry != null &&
        line.baseEntry !== '' &&
        line.baseType != null &&
        line.baseType !== '' &&
        line.baseLine != null &&
        line.baseLine !== '';

      if (hasBaseLink) {
        documentLine.BaseEntry = parseInt(line.baseEntry, 10);
        documentLine.BaseType = parseInt(line.baseType, 10);
        documentLine.BaseLine = parseInt(line.baseLine, 10);
      }

      return documentLine;
    });

const buildPurchaseOrderPayload = ({ header = {}, lines = [], header_udfs = {}, freightCharges = [] }) =>
  cleanObject({
    CardCode: header.vendor,
    NumAtCard: header.salesContractNo,
    DocDate: header.postingDate || header.documentDate,
    DocDueDate: header.deliveryDate || header.postingDate || header.documentDate,
    TaxDate: header.documentDate || header.postingDate,
    // Series for auto-numbering - only include if explicitly provided and valid
    ...(header.series && Number(header.series) > 0 ? { Series: Number(header.series) } : {}),
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

const validatePurchaseOrderPayload = async ({ header = {}, lines = [] }) => {
  const vendorCode = String(header.vendor || '').trim();
  if (!vendorCode) {
    throw new Error('Vendor is required before submitting the purchase order.');
  }

  const itemCodes = Array.from(
    new Set(
      lines
        .map((line) => String(line.itemNo || '').trim())
        .filter(Boolean)
    )
  );

  if (!itemCodes.length) {
    throw new Error('At least one item line is required before submitting the purchase order.');
  }
};

const submitPurchaseOrder = async (payload) => {
  await validatePurchaseOrderPayload(payload);
  const purchaseOrderPayload = buildPurchaseOrderPayload(payload);

  const response = await sapService.request({
    method: 'post',
    url: '/PurchaseOrders',
    data: purchaseOrderPayload,
  });

  return {
    message: 'Purchase order posted successfully.',
    doc_num: response.data?.DocNum,
    doc_entry: response.data?.DocEntry,
    sap_response: response.data,
  };
};

// ───────── UPDATE ORDER (USING SERVICE LAYER) ─────────

const updatePurchaseOrder = async (docEntry, payload) => {
  await validatePurchaseOrderPayload(payload);
  const purchaseOrderPayload = buildPurchaseOrderPayload(payload);

  const response = await sapService.request({
    method: 'patch',
    url: `/PurchaseOrders(${docEntry})`,
    data: purchaseOrderPayload,
  });

  return {
    message: 'Purchase order updated successfully.',
    doc_num: response.data?.DocNum,
    doc_entry: docEntry,
    sap_response: response.data,
  };
};

// ───────── EXPORTS ─────────

const getItemsForModal = async () => {
  try {
    const result = await purchaseOrderDb.getItemsForModal();
    return { items: result };
  } catch (error) {
    throw new Error('Failed to fetch items: ' + error.message);
  }
};

const getFreightCharges = async (docEntry) => {
  try {
    const freightCharges = await getDocumentFreightCharges('POR3', docEntry);
    return { freightCharges };
  } catch (_error) {
    return { freightCharges: [] };
  }
};

const getOpenPurchaseQuotations = async (vendorCode = null) => {
  try {
    const purchaseQuotationDb = require('./purchaseQuotationDbService');
    const documents = await purchaseQuotationDb.getOpenPurchaseQuotations(vendorCode);
    return { documents };
  } catch (_error) {
    return { documents: [] };
  }
};

const getPurchaseQuotationForCopy = async (docEntry) => {
  const purchaseQuotationDb = require('./purchaseQuotationDbService');
  return purchaseQuotationDb.getPurchaseQuotationForCopy(docEntry);
};

const getOpenPurchaseRequests = async (vendorCode = null) => {
  try {
    const purchaseRequestService = require('./purchaseRequestService');
    return await purchaseRequestService.getOpenPurchaseRequests(vendorCode);
  } catch (_error) {
    return { documents: [] };
  }
};

const getPurchaseRequestForCopy = async (docEntry) => {
  const purchaseRequestService = require('./purchaseRequestService');
  return purchaseRequestService.getPurchaseRequestForCopy(docEntry);
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getVendorFilterOptions,
  getPurchaseOrderList,
  getPurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getStateFromWarehouse,
  getOpenPurchaseQuotations,
  getPurchaseQuotationForCopy,
  getOpenPurchaseRequests,
  getPurchaseRequestForCopy,
  getItemsForModal,
  getFreightCharges,
};
