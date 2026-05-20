const sapService = require('./sapService');
const grpoDb = require('./grpoDbService');
const purchaseOrderDb = require('./purchaseOrderDbService');
const { getDocumentFreightCharges } = require('./freightChargesDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');

// ───────── HELPERS ─────────

const formatDateForSAP = (value) => {
  if (!value) return null;
  return String(value).split('T')[0];
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
    return {
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
      bill_to_addresses: [],
      gstin: '',
      vendorState: '',
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

// ───────── SUBMIT GRPO (USING SERVICE LAYER) ─────────

const submitGRPO = async (payload) => {
  try {
    const { company_id, header, lines, header_udfs } = payload;
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
     
    // Build SAP Service Layer payload
    const sapPayload = {
      CardCode: header.vendor,
      DocDate: formatDateForSAP(header.postingDate),
      DocDueDate: formatDateForSAP(header.deliveryDate || header.postingDate),
      TaxDate: formatDateForSAP(header.documentDate),
      Comments: header.otherInstruction || '',
      JournalMemo: header.journalRemark || '',
      NumAtCard: header.salesContractNo || '',
      DiscountPercent: header.discount ? parseFloat(header.discount) : 0,
      DocumentAdditionalExpenses: documentAdditionalExpenses,
      DocumentLines: lines
        .filter(l => l.itemNo && l.itemNo.trim())
        .map(l => {
          const hasBaseDoc =
            l.baseEntry != null &&
            l.baseEntry !== '' &&
            l.baseType != null &&
            l.baseType !== '' &&
            l.baseLine != null &&
            l.baseLine !== '';

          const docLine = {
            Quantity: parseFloat(l.quantity) || 0,
            WarehouseCode: l.whse || '',
          };

          if (hasBaseDoc) {
            docLine.BaseEntry = parseInt(l.baseEntry, 10);
            docLine.BaseType = parseInt(l.baseType, 10);
            docLine.BaseLine = parseInt(l.baseLine, 10);
          } else {
            docLine.ItemCode = l.itemNo;
            docLine.Price = parseFloat(l.unitPrice) || 0;
            if (String(l.taxCode || '').trim()) {
              docLine.TaxCode = String(l.taxCode).trim();
            }
            if (l.uomCode) {
              docLine.UoMCode = l.uomCode;
            }
          }

          if (l.stdDiscount && Number(l.stdDiscount) > 0) {
            docLine.DiscountPercent = parseFloat(l.stdDiscount) || 0;
          }

          if (l.batchManaged && l.batches && l.batches.length > 0) {
            docLine.BatchNumbers = l.batches.map(b => ({
              BatchNumber: b.batchNumber,
              Quantity: parseFloat(b.quantity) || 0,
            }));
          }

          return docLine;
        }),
    };
   
    // Add optional fields
    if (header.series) sapPayload.Series = parseInt(header.series);
    if (header.branch) sapPayload.BPLId = parseInt(header.branch);
    if (header.paymentTerms) sapPayload.PaymentGroupCode = parseInt(header.paymentTerms);
    if (header.salesEmployee !== '' && header.salesEmployee != null) sapPayload.SalesPersonCode = parseInt(header.salesEmployee, 10);
    if (header.freight) sapPayload.TotalExpenses = parseFloat(header.freight);

    // Add header UDFs if any
    if (header_udfs && Object.keys(header_udfs).length > 0) {
      Object.keys(header_udfs).forEach(key => {
        if (header_udfs[key]) {
          sapPayload[key] = header_udfs[key];
        }
      });
    }

   

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

    // Add header UDFs if any
    if (header_udfs && Object.keys(header_udfs).length > 0) {
      Object.keys(header_udfs).forEach(key => {
        if (header_udfs[key]) {
          sapPayload[key] = header_udfs[key];
        }
      });
    }

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
  getItemsForModal,
  getFreightCharges,
};
