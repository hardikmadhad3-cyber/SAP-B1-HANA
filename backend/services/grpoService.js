const sapService = require('./sapService');
const grpoDb = require('./grpoDbService');
const purchaseOrderDb = require('./purchaseOrderDbService');
const { getDocumentFreightCharges } = require('./freightChargesDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');
const { getUdfDefinitions } = require('./udfMetadataService');
const { applyUdfValues } = require('./udfPayloadUtils');
const { buildGRPODocumentLine } = require('./grpoPayloadUtils');

// ───────── HELPERS ─────────

const formatDateForSAP = (value) => {
  if (!value) return null;
  return String(value).split('T')[0];
};

const getUdfDefinitionsByKey = async (tableId) => {
  const definitions = await getUdfDefinitions(tableId);
  return new Map(definitions.map((field) => [field.key, field]));
};

// ───────── REFERENCE DATA (USING ODBC) ─────────

const getReferenceData = async (companyId) => {
  try {
    const data = await grpoDb.getReferenceData();
    return data;
  } catch (error) {
    return {
      company: '',
      company_state: '',
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
      ship_to_addresses: [],
      bill_to_addresses: [],
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
    const result = await grpoDb.getVendorDetails(vendorCode);
    return result;
  } catch (error) {
    console.error('[GRPO Service] Failed to load vendor details:', error);
    throw error;
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

// ───────── GRPO LIST (USING ODBC) ─────────

const getGRPOList = async ({
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
    const result = await grpoDb.getGRPOList({
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
      grpos: [],
      pagination: {
        page: Math.max(1, Number(page) || 1),
        pageSize: Math.min(200, Math.max(1, Number(pageSize) || 25)),
        totalCount: 0,
        totalPages: 1,
      },
    };
  }
};

// ───────── GET SINGLE GRPO (USING ODBC) ─────────

const getGRPO = async (docEntry) => {
  try {
    const result = await grpoDb.getGRPO(docEntry);
    return result;
  } catch (error) {
    throw new Error(`Failed to load GRPO: ${error.message}`);
  }
};

// ───────── DOCUMENT SERIES (USING ODBC) ─────────

const getDocumentSeries = async () => {
  try {
    const result = await grpoDb.getDocumentSeries();
    return result;
  } catch (error) {
    return { series: [] };
  }
};

const getNextNumber = async (series) => {
  try {
    const result = await grpoDb.getNextNumber(series);
    return result;
  } catch (error) {
    return { nextNumber: null };
  }
};

// ───────── STATE FROM WAREHOUSE (USING ODBC) ─────────

const getStateFromWarehouse = async (whsCode) => {
  try {
    const result = await grpoDb.getStateFromWarehouse(whsCode);
    return result;
  } catch (error) {
    return { state: '' };
  }
};

// ───────── OPEN PURCHASE ORDERS (USING ODBC) ─────────

const getOpenPurchaseOrders = async (vendorCode = null) => {
  try {
    const result = await grpoDb.getOpenPurchaseOrders(vendorCode);
    return result;
  } catch (error) {
    return { orders: [] };
  }
};

const getPurchaseOrderForCopy = async (docEntry) => {
  try {
    const result = await grpoDb.getPurchaseOrderForCopy(docEntry);
    return result;
  } catch (error) {
    throw new Error(`Failed to load Purchase Order: ${error.message}`);
  }
};

const getBatchesByItem = async (itemCode, whsCode) => {
  try {
    const result = await grpoDb.getBatchesByItem(itemCode, whsCode);
    return result;
  } catch (error) {
    return { batches: [] };
  }
};

const getNextBatchNumber = async ({ prefix = 'JKL' } = {}) => {
  try {
    return await grpoDb.getNextBatchNumber({ prefix });
  } catch (error) {
    const normalizedPrefix = String(prefix || 'JKL').trim().toUpperCase() || 'JKL';
    const year = String(new Date().getFullYear()).slice(-2);
    return { prefix: normalizedPrefix, nextBatchNumber: `${normalizedPrefix}${year}0001`, previousBatchNumber: '' };
  }
};

// ───────── SUBMIT GRPO (USING SERVICE LAYER) ─────────

const submitGRPO = async (payload) => {
  try {
    const { company_id, header, lines, header_udfs } = payload;
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
     
    const lineUdfDefinitionsByKey = await getUdfDefinitionsByKey('PDN1');

    // Build SAP Service Layer payload
    const sapPayload = {
      CardCode: header.vendor,
      DocDate: formatDateForSAP(header.postingDate),
      DocDueDate: formatDateForSAP(header.deliveryDate || header.postingDate),
      TaxDate: formatDateForSAP(header.documentDate),
      Comments: header.otherInstruction || '',
      JournalMemo: header.journalRemark || '',
      NumAtCard: header.salesContractNo || '',
      DocCurrency: header.currency || 'INR',
      DiscountPercent: header.discount ? parseFloat(header.discount) : 0,
      DocumentAdditionalExpenses: documentAdditionalExpenses,
      DocumentLines: lines
        .filter(l => l.itemNo && l.itemNo.trim())
        .map(l => buildGRPODocumentLine(l, lineUdfDefinitionsByKey)),
    };
   
    // Add optional fields
    if (header.series) sapPayload.Series = parseInt(header.series);
    if (header.branch) sapPayload.BPL_IDAssignedToInvoice = parseInt(header.branch);
    const contactPersonCode = Number(header.contactPerson);
    if (Number.isFinite(contactPersonCode)) sapPayload.ContactPersonCode = contactPersonCode;
    if (header.shipToCode) sapPayload.ShipToCode = header.shipToCode;
    if (header.payToCode) sapPayload.PayToCode = header.payToCode;
    if (header.shipToAddress || header.shipTo) sapPayload.Address = header.shipToAddress || header.shipTo;
    if (header.payToAddress || header.payTo) sapPayload.Address2 = header.payToAddress || header.payTo;
    if (header.paymentTerms) sapPayload.PaymentGroupCode = parseInt(header.paymentTerms);
    if (header.salesEmployee !== '' && header.salesEmployee != null) sapPayload.SalesPersonCode = parseInt(header.salesEmployee, 10);
    if (header.freight) sapPayload.TotalExpenses = parseFloat(header.freight);

    const headerUdfDefinitionsByKey = await getUdfDefinitionsByKey('OPDN');
    applyUdfValues(sapPayload, {
      ...header_udfs,
      ...(header.buyerLocation !== undefined ? { U_ShipLocation: header.buyerLocation } : {}),
    }, null, headerUdfDefinitionsByKey);

   

    // Post to SAP Service Layer
    const response = await sapService.request({
      method: 'POST',
      url: '/PurchaseDeliveryNotes',
      data: sapPayload,
    });


    return {
      success: true,
      message: 'Goods Receipt PO created successfully.',
      doc_entry: response.data.DocEntry,
      doc_num: response.data.DocNum,
    };
  } catch (error) {
    console.error('[GRPO] Submit failed:', error.message);
    if (error.response?.data) {
      console.error('[GRPO] SAP error response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};

// ───────── UPDATE GRPO (USING SERVICE LAYER) ─────────

const updateGRPO = async (docEntry, payload) => {
  try {
    const { header, lines, header_udfs } = payload;
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);

    const sapPayload = {
      Comments: header.otherInstruction || '',
      JournalMemo: header.journalRemark || '',
      DiscountPercent: header.discount ? parseFloat(header.discount) : 0,
      DocumentAdditionalExpenses: documentAdditionalExpenses,
    };

    if (header.freight) sapPayload.TotalExpenses = parseFloat(header.freight);
    if (header.shipToCode) sapPayload.ShipToCode = header.shipToCode;
    if (header.payToCode) sapPayload.PayToCode = header.payToCode;
    if (header.shipToAddress || header.shipTo) sapPayload.Address = header.shipToAddress || header.shipTo;
    if (header.payToAddress || header.payTo) sapPayload.Address2 = header.payToAddress || header.payTo;

    const headerUdfDefinitionsByKey = await getUdfDefinitionsByKey('OPDN');
    applyUdfValues(sapPayload, {
      ...header_udfs,
      ...(header.buyerLocation !== undefined ? { U_ShipLocation: header.buyerLocation } : {}),
    }, null, headerUdfDefinitionsByKey);

    await sapService.request({
      method: 'PATCH',
      url: `/PurchaseDeliveryNotes(${docEntry})`,
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Goods Receipt PO updated successfully.',
      doc_entry: docEntry,
    };
  } catch (error) {
    throw error;
  }
};

// ───────── EXPORTS ─────────

const getItemsForModal = async () => {
  try {
    const result = await grpoDb.getItemsForModal();
    return { items: result };
  } catch (error) {
    throw new Error('Failed to fetch items: ' + error.message);
  }
};

const getFreightCharges = async (docEntry) => {
  try {
    const freightCharges = await getDocumentFreightCharges('PDN3', docEntry);
    return { freightCharges };
  } catch (_error) {
    return { freightCharges: [] };
  }
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getVendorFilterOptions,
  getGRPOList,
  getGRPO,
  submitGRPO,
  updateGRPO,
  getDocumentSeries,
  getNextNumber,
  getStateFromWarehouse,
  getOpenPurchaseOrders,
  getPurchaseOrderForCopy,
  getBatchesByItem,
  getNextBatchNumber,
  getItemsForModal,
  getFreightCharges,
};
