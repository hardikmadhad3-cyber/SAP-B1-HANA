const sapService = require('./sapService');
const arInvoiceDb = require('./arInvoiceDbService');
const salesOrderDb = require('./salesOrderDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');
const { getUdfDefinitions } = require('./udfMetadataService');
const { applyUdfValues, isBlankUdfValue, normalizeUdfValue } = require('./udfPayloadUtils');

const normalizeBranchId = (branch) => {
  const normalized = String(branch || '').trim();
  return normalized === '' ? -1 : Number(normalized);
};

const isUdfValuePresent = (value) => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

const addIfPresent = (target, key, value) => {
  if (!isUdfValuePresent(value)) return;
  target[key] = value;
};

const normalizeOptionalNumber = (value) => {
  if (!isUdfValuePresent(value)) return undefined;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
};

const parseLineNumber = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const yesNo = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['y', 'yes', 'true', '1', 'tyes'].includes(normalized) ? 'tYES' : 'tNO';
};

const buildWithholdingTaxData = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row?.code || row?.WTCode || '').trim())
    .map((row) => ({
      WTCode: String(row.code || row.WTCode || '').trim(),
      TaxableAmount: parseLineNumber(row.taxableAmount, 0),
      WTAmount: parseLineNumber(row.wtaxAmount || row.WTAmount, 0),
      Category: 'I',
    }));

const getLineTotal = (line = {}) => {
  const total = normalizeOptionalNumber(line.total ?? line.totalLC ?? line.LineTotal);
  return total !== undefined && total > 0 ? total : undefined;
};

const getLineUnitPrice = (line = {}) => {
  const total = getLineTotal(line);
  const quantity = parseLineNumber(line.quantity, 0);
  const discount = parseLineNumber(line.stdDiscount ?? line.discountPercent, 0);
  const discountFactor = 1 - discount / 100;

  if (total !== undefined && quantity > 0 && discountFactor > 0) {
    return total / quantity / discountFactor;
  }

  return parseLineNumber(line.unitPrice, 0);
};

const getUdfDefinitionsByKey = async (tableId) => {
  const definitions = await getUdfDefinitions(tableId);
  return new Map(definitions.map((field) => [field.key, field]));
};

const getAllowedUdfKeys = async (tableId) => {
  const definitions = await getUdfDefinitions(tableId);
  return new Set(definitions.map((field) => field.key));
};

const normalizeUdfAlias = (value) =>
  String(value || '')
    .replace(/^U_/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

const resolveUdfOptionValue = (field, value) => {
  const text = String(value ?? '').trim();
  if (!text || !Array.isArray(field?.options) || !field.options.length) return text;

  const normalizedText = text.toLowerCase();
  const byValue = field.options.find((option) => String(option.value || '').trim().toLowerCase() === normalizedText);
  if (byValue) return String(byValue.value);

  const byLabel = field.options.find((option) => String(option.label || '').trim().toLowerCase() === normalizedText);
  if (byLabel) return String(byLabel.value);

  return text;
};

const DOCUMENT_TYPE_CODE_BY_LABEL = {
  gsttaxinvoice: 'INV',
  taxinvoice: 'INV',
  billofsupply: 'BIL',
  gstdebitmemo: 'DBN',
  debitmemo: 'DBN',
};

const resolveDocumentTypeCode = (value) => {
  const text = String(value ?? '').trim();
  return DOCUMENT_TYPE_CODE_BY_LABEL[normalizeUdfAlias(text)] || text;
};

const setKnownUdfValue = (target, definitionsByKey, aliases, value) => {
  if (value === undefined) return;

  const normalizedAliases = aliases.map(normalizeUdfAlias);
  const matchedKey = Array.from(definitionsByKey.keys()).find((key) => normalizedAliases.includes(normalizeUdfAlias(key)));
  if (!matchedKey) return;
  if (isBlankUdfValue(value)) {
    target[matchedKey] = null;
    return;
  }

  const resolvedValue = resolveUdfOptionValue(definitionsByKey.get(matchedKey), value);
  target[matchedKey] = normalizeUdfAlias(matchedKey) === 'doctype'
    ? resolveDocumentTypeCode(resolvedValue)
    : resolvedValue;

  const normalizedValue = normalizeUdfValue(value, definitionsByKey.get(matchedKey), matchedKey);
  if (normalizedValue !== undefined) target[matchedKey] = normalizedValue;

};

// ───────── REFERENCE DATA (USING ODBC) ─────────

const getReferenceData = async (companyId) => {
  try {
    // Use ODBC/Direct SQL for GET operations
    const data = await arInvoiceDb.getReferenceData();
    if (data.customers && !data.vendors) {
      data.vendors = data.customers;
      delete data.customers;
      console.warn("⚠️ AR Invoice service normalized customers->vendors");
    }
    console.log("✅ AR Invoice reference data loaded:", data.vendors?.length || 0, "vendors");
    console.log("🔍 AR Invoice refData keys:", Object.keys(data));
    return data;
  } catch (error) {
    console.error('[AR Invoice Service] Failed to load reference data via ODBC:', error);
    return {
      company: '',
      vendors: [],
      contacts: [],
      pay_to_addresses: [],
      items: [],
      warehouses: [],
      warehouse_addresses: [],
      payment_terms: [],
      shipping_types: [],
      branches: [],
      tax_codes: [],
      withholding_tax_codes: [],
      uom_groups: [],
      decimal_settings: {
        QtyDec: 2,
        PriceDec: 2,
        SumDec: 2,
        RateDec: 2,
        PercentDec: 2
      },
      matrix_columns: [],
      line_field_metadata: { matrix_columns: [], sap_form: {} },
      udf_metadata: { header: [], rows: [] },
      warnings: [`Failed to load reference data: ${error.message}`],
    };
  }
};

// ───────── CUSTOMER DETAILS (USING ODBC) ─────────

const getCustomerDetails = async (customerCode) => {
  try {
    // Use ODBC/Direct SQL for GET operations
    const data = await arInvoiceDb.getCustomerDetails(customerCode);
    return data;
  } catch (error) {
    console.error('[AR Invoice Service] Failed to load customer details via ODBC:', error);
    return {
      customer: null,
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
      withholding_tax: { subject: false, defaultCode: '', allowedCodes: [] },
    };
  }
};

// ───────── AR INVOICE LIST (USING ODBC) ─────────

const getCustomerFilterOptions = async ({
  query = '',
  customerCode = '',
  customerName = '',
  top,
  display = 'code',
} = {}) => {
  try {
    const rows = await salesOrderDb.searchCustomers({
      query,
      cardCode: customerCode,
      cardName: customerName,
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

const getARInvoiceList = async ({
  query = '',
  openOnly = false,
  docNum = '',
  customerCode = '',
  customerName = '',
  sellerCode = '',
  sellerName = '',
  status = '',
  postingDateFrom = '',
  postingDateTo = '',
  page = 1,
  pageSize = 25,
} = {}) => {
  try {
    const result = await arInvoiceDb.getARInvoiceList({
      query,
      openOnly,
      docNum,
      customerCode,
      customerName,
      sellerCode,
      sellerName,
      status,
      postingDateFrom,
      postingDateTo,
      page,
      pageSize,
    });
    return result;
  } catch (error) {
    console.error('[AR Invoice Service] Failed to load AR invoice list via ODBC:', error);
    return {
      ar_invoices: [],
      pagination: {
        page: Math.max(1, Number(page) || 1),
        pageSize: Math.min(200, Math.max(1, Number(pageSize) || 25)),
        totalCount: 0,
        totalPages: 1,
      },
    };
  }
};

// ───────── GET SINGLE INVOICE (USING ODBC) ─────────

const getARInvoice = async (docEntry) => {
  try {
    // Use ODBC for reading single invoice
    const result = await arInvoiceDb.getARInvoice(docEntry);
    return result;
  } catch (error) {
    console.error('[AR Invoice Service] Failed to load AR invoice via ODBC:', error);
    throw error;
  }
};

// ───────── CREATE INVOICE (USING SERVICE LAYER) ─────────

const submitARInvoice = async (payload) => {
  try {
    console.log("🔥 [ARInvoiceService] RECEIVED AR INVOICE PAYLOAD:", JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.header) {
      throw new Error('Header is required');
    }
    
    console.log("🔍 [ARInvoiceService] Header vendor:", payload.header.vendor);
    console.log("🔍 [ARInvoiceService] Header customerCode:", payload.header.customerCode);
    
    // Use vendor or customerCode (frontend sends vendor)
    const customerCode = payload.header.vendor || payload.header.customerCode || payload.header.customer;
    
    if (!customerCode) {
      throw new Error('Customer code is required');
    }
    
    console.log("🔍 [ARInvoiceService] Using customer code:", customerCode);
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
    const [allowedHeaderUdfs, allowedLineUdfs, headerUdfDefinitionsByKey] = await Promise.all([
      getAllowedUdfKeys('OINV'),
      getAllowedUdfKeys('INV1'),
      getUdfDefinitionsByKey('OINV'),
    ]);

    // Transform payload to SAP format
    const sapPayload = {
      CardCode: String(customerCode).trim(),

      // Series for auto-numbering - only include if explicitly provided and valid
      ...(payload.header.series && Number(payload.header.series) > 0 ? { Series: Number(payload.header.series) } : {}),

      DocDate: payload.header.postingDate || payload.header.documentDate,
      DocDueDate: payload.header.deliveryDate || payload.header.dueDate,
      TaxDate: payload.header.documentDate || payload.header.postingDate,

      ContactPersonCode: payload.header.contactPerson ? Number(payload.header.contactPerson) : undefined,
      SalesPersonCode:
        payload.header.salesEmployee != null &&
        String(payload.header.salesEmployee).trim() !== '' &&
        String(payload.header.salesEmployee) !== '-1'
          ? Number(payload.header.salesEmployee)
          : undefined,

      // Branch mapping
      BPLId: normalizeBranchId(payload.header.branch),
      BPL_IDAssignedToInvoice: normalizeBranchId(payload.header.branch),

      PaymentGroupCode: payload.header.paymentTerms ? Number(payload.header.paymentTerms) : undefined,

      // Customer reference
      NumAtCard: payload.header.salesContractNo || payload.header.customerRefNo || undefined,

      // Comments
      Comments: payload.header.otherInstruction || payload.header.comments || undefined,
      DocumentAdditionalExpenses: documentAdditionalExpenses,

      DocumentLines: payload.lines.map((l, index) => {
        console.log(`🔍 [ARInvoiceService] Processing line ${index}:`, l);
        const warehouseCode = String(l.whse || l.warehouse || '').trim();

        const line = {
          ItemCode: l.itemNo,
          Quantity: Number(l.quantity),
          UnitPrice: getLineUnitPrice(l),
          TaxCode: l.taxCode || undefined,
          MeasureUnit: l.uomCode || undefined,
          WTLiable: yesNo(l.wTaxLiable ?? l.wtaxLiable),
          AccountCode: l.glAccount || undefined,
          CostingCode: l.distRule || undefined,
          COGSCostingCode: l.cogsDistRule || l.distRule || undefined,
          CountryOrg: l.countryOfOrigin || undefined,
        };

        if (warehouseCode) {
          line.WarehouseCode = warehouseCode;
        }

        // Add discount if present
        if (l.stdDiscount && Number(l.stdDiscount) > 0) {
          line.DiscountPercent = Number(l.stdDiscount);
        } else if (l.discountPercent && Number(l.discountPercent) > 0) {
          line.DiscountPercent = Number(l.discountPercent);
        }

        // Base document integration
        if (l.baseType && l.baseEntry && l.baseLine !== undefined) {
          line.BaseType = Number(l.baseType);
          line.BaseEntry = Number(l.baseEntry);
          line.BaseLine = Number(l.baseLine);
        }

        console.log(`🔍 [ARInvoiceService] Transformed line ${index}:`, line);
        applyUdfValues(line, l.udf, allowedLineUdfs);
        return line;
      })
    };

    addIfPresent(sapPayload, 'ShipToCode', payload.header.shipToCode);
    addIfPresent(sapPayload, 'PayToCode', payload.header.billToCode || payload.header.payToCode);
    addIfPresent(sapPayload, 'TransportationCode', normalizeOptionalNumber(payload.header.shippingType));
    addIfPresent(sapPayload, 'PaymentMethod', payload.header.paymentMethod);
    addIfPresent(sapPayload, 'DocumentsOwner', normalizeOptionalNumber(payload.header.ownerCode));
    if (payload.header.confirmed != null) {
      sapPayload.Confirmed = payload.header.confirmed ? 'tYES' : 'tNO';
    }
    if (allowedHeaderUdfs.has('U_PlaceOfSupply')) {
      addIfPresent(sapPayload, 'U_PlaceOfSupply', payload.header.placeOfSupply);
    }
    const withholdingTaxData = buildWithholdingTaxData(payload.withholdingTaxRows);
    if (withholdingTaxData.length) {
      sapPayload.WithholdingTaxDataWTXCollection = withholdingTaxData;
    }

    console.log("🔥 [ARInvoiceService] SAP AR INVOICE PAYLOAD:", JSON.stringify(sapPayload, null, 2));

    applyUdfValues(sapPayload, payload.header_udfs, allowedHeaderUdfs, headerUdfDefinitionsByKey);
    setKnownUdfValue(sapPayload, headerUdfDefinitionsByKey, ['TransactionType', 'TransType', 'DocumentType', 'DocType'], payload.header.transactionType);
    setKnownUdfValue(sapPayload, headerUdfDefinitionsByKey, ['Indicator'], payload.header.indicator);

    // Use Service Layer for POST operations - Invoices endpoint
    const response = await sapService.request({
      method: 'post',
      url: '/Invoices',
      data: sapPayload,
    });

    console.log("✅ [ARInvoiceService] SAP AR INVOICE RESPONSE:", JSON.stringify(response.data, null, 2));

    return {
      message: 'AR Invoice created successfully',
      doc_num: response.data?.DocNum,
      doc_entry: response.data?.DocEntry,
      DocNum: response.data?.DocNum,
      DocEntry: response.data?.DocEntry,
    };
  } catch (error) {
    console.error('❌ [ARInvoiceService] Failed to create AR invoice:', error);
    console.error('❌ [ARInvoiceService] Error details:', error.response?.data);
    console.error('❌ [ARInvoiceService] Error stack:', error.stack);

    // Extract meaningful error message from SAP
    let errorMessage = 'AR Invoice submission failed.';
    if (error.response?.data?.error?.message?.value) {
      errorMessage = error.response.data.error.message.value;
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Create a new error with the SAP message
    const sapError = new Error(errorMessage);
    sapError.response = error.response;
    throw sapError;
  }
};

// ───────── UPDATE INVOICE (USING SERVICE LAYER) ─────────

const updateARInvoice = async (docEntry, payload) => {
  try {
    console.log("🔥 [ARInvoiceService] UPDATING AR INVOICE:", docEntry, JSON.stringify(payload, null, 2));

    // Use vendor or customerCode (frontend sends vendor)
    const customerCode = payload.header.vendor || payload.header.customerCode || payload.header.customer;
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
    const [allowedHeaderUdfs, allowedLineUdfs, headerUdfDefinitionsByKey] = await Promise.all([
      getAllowedUdfKeys('OINV'),
      getAllowedUdfKeys('INV1'),
      getUdfDefinitionsByKey('OINV'),
    ]);

    // Transform payload to SAP format (similar to submit)
    const sapPayload = {
      CardCode: String(customerCode).trim(),
      DocDate: payload.header.postingDate || payload.header.documentDate,
      DocDueDate: payload.header.deliveryDate || payload.header.dueDate,
      TaxDate: payload.header.documentDate || payload.header.postingDate,
      ContactPersonCode: payload.header.contactPerson ? Number(payload.header.contactPerson) : undefined,
      SalesPersonCode:
        payload.header.salesEmployee != null &&
        String(payload.header.salesEmployee).trim() !== '' &&
        String(payload.header.salesEmployee) !== '-1'
          ? Number(payload.header.salesEmployee)
          : undefined,
      PaymentGroupCode: payload.header.paymentTerms ? Number(payload.header.paymentTerms) : undefined,
      NumAtCard: payload.header.salesContractNo || payload.header.customerRefNo || undefined,
      Comments: payload.header.otherInstruction || payload.header.comments || undefined,
      DocumentAdditionalExpenses: documentAdditionalExpenses,

      DocumentLines: payload.lines.map((l) => {
        const warehouseCode = String(l.whse || l.warehouse || '').trim();
        const line = {
          ItemCode: l.itemNo,
          Quantity: Number(l.quantity),
          UnitPrice: getLineUnitPrice(l),
          TaxCode: l.taxCode || undefined,
          MeasureUnit: l.uomCode || undefined,
          WTLiable: yesNo(l.wTaxLiable ?? l.wtaxLiable),
          AccountCode: l.glAccount || undefined,
          CostingCode: l.distRule || undefined,
          COGSCostingCode: l.cogsDistRule || l.distRule || undefined,
          CountryOrg: l.countryOfOrigin || undefined,
          DiscountPercent: l.stdDiscount ? Number(l.stdDiscount) : (l.discountPercent ? Number(l.discountPercent) : 0),
          BaseType: l.baseType ? Number(l.baseType) : undefined,
          BaseEntry: l.baseEntry ? Number(l.baseEntry) : undefined,
          BaseLine: l.baseLine !== undefined ? Number(l.baseLine) : undefined,
        };
        if (warehouseCode) {
          line.WarehouseCode = warehouseCode;
        }
        applyUdfValues(line, l.udf, allowedLineUdfs);
        return line;
      })
    };

    addIfPresent(sapPayload, 'ShipToCode', payload.header.shipToCode);
    addIfPresent(sapPayload, 'PayToCode', payload.header.billToCode || payload.header.payToCode);
    addIfPresent(sapPayload, 'TransportationCode', normalizeOptionalNumber(payload.header.shippingType));
    addIfPresent(sapPayload, 'PaymentMethod', payload.header.paymentMethod);
    addIfPresent(sapPayload, 'DocumentsOwner', normalizeOptionalNumber(payload.header.ownerCode));
    if (payload.header.confirmed != null) {
      sapPayload.Confirmed = payload.header.confirmed ? 'tYES' : 'tNO';
    }
    if (allowedHeaderUdfs.has('U_PlaceOfSupply')) {
      addIfPresent(sapPayload, 'U_PlaceOfSupply', payload.header.placeOfSupply);
    }
    const withholdingTaxData = buildWithholdingTaxData(payload.withholdingTaxRows);
    if (withholdingTaxData.length) {
      sapPayload.WithholdingTaxDataWTXCollection = withholdingTaxData;
    }

    applyUdfValues(sapPayload, payload.header_udfs, allowedHeaderUdfs, headerUdfDefinitionsByKey);
    setKnownUdfValue(sapPayload, headerUdfDefinitionsByKey, ['TransactionType', 'TransType', 'DocumentType', 'DocType'], payload.header.transactionType);
    setKnownUdfValue(sapPayload, headerUdfDefinitionsByKey, ['Indicator'], payload.header.indicator);

    // Use Service Layer for PATCH operations
    const response = await sapService.request({
      method: 'patch',
      url: `/Invoices(${docEntry})`,
      data: sapPayload,
    });

    console.log("✅ [ARInvoiceService] AR INVOICE UPDATED:", response.data);

    return {
      message: 'AR Invoice updated successfully',
      doc_num: response.data?.DocNum,
      doc_entry: response.data?.DocEntry,
    };
  } catch (error) {
    console.error('❌ [ARInvoiceService] Failed to update AR invoice:', error);
    console.error('❌ [ARInvoiceService] Error details:', error.response?.data);
    throw error;
  }
};

// ───────── DOCUMENT SERIES ─────────

const getDocumentSeries = async (targetDate = null, transactionType = '', branch = '') => {
  try {
    const result = await arInvoiceDb.getDocumentSeries(targetDate, transactionType, branch);
    return { series: result };
  } catch (error) {
    console.error('[AR Invoice Service] Failed to load document series:', error);
    return { series: [] };
  }
};

// ───────── NEXT NUMBER ─────────

const getNextNumber = async (series) => {
  try {
    const result = await arInvoiceDb.getNextNumber(series);
    return result;
  } catch (error) {
    console.error('[AR Invoice Service] Failed to get next number:', error);
    return { nextNumber: '' };
  }
};

// ───────── STATE FROM ADDRESS ─────────

const getStateFromAddress = async (cardCode, addressCode) => {
  try {
    const result = await arInvoiceDb.getStateFromAddress(cardCode, addressCode);
    return result;
  } catch (error) {
    console.error('[AR Invoice Service] Failed to get state from address:', error);
    return { state: '' };
  }
};

const getWarehouseState = async (whsCode) => {
  try {
    const result = await arInvoiceDb.getWarehouseState(whsCode);
    return result;
  } catch (error) {
    console.error('[AR Invoice Service] Failed to get warehouse state:', error);
    return { state: '' };
  }
};

const getBatchesByItem = async (itemCode, whsCode) => {
  try {
    const result = await arInvoiceDb.getBatchesByItem(itemCode, whsCode);
    return result;
  } catch (error) {
    console.error('[AR Invoice Service] Failed to get batches by item:', error);
    return { batches: [] };
  }
};

const getFreightCharges = async (docEntry) => {
  try {
    const result = await arInvoiceDb.getFreightCharges(docEntry);
    return { freightCharges: result };
  } catch (error) {
    console.error('[AR Invoice Service] Failed to get freight charges:', error);
    return { freightCharges: [] };
  }
};

const getItemsForModal = async () => {
  try {
    const items = await arInvoiceDb.getItemsForModal();
    return { items };
  } catch (error) {
    console.error('[AR Invoice] Failed to get items for modal:', error);
    return { items: [] };
  }
};
module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getARInvoiceList,
  getARInvoice,
  submitARInvoice,
  updateARInvoice,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getWarehouseState,
  getBatchesByItem,
  getFreightCharges,
  getItemsForModal,
  getOpenSalesOrders:      async (customerCode = null) => { 
    try { 
      return { documents: await arInvoiceDb.getOpenSalesOrders(customerCode) }; 
    } catch(e) { 
      return { documents: [] }; 
    } 
  },
  getSalesOrderForCopy:    async (d) => arInvoiceDb.getSalesOrderForCopy(d),
  getOpenDeliveries:       async (customerCode = null) => { 
    try { 
      return { documents: await arInvoiceDb.getOpenDeliveries(customerCode) }; 
    } catch(e) { 
      return { documents: [] }; 
    } 
  },
  getDeliveryForCopy:      async (d) => arInvoiceDb.getDeliveryForCopy(d),
  getOpenSalesQuotations:  async (customerCode = null) => { try { return { documents: await arInvoiceDb.getOpenSalesQuotations(customerCode) }; } catch(e) { return { documents: [] }; } },
  getSalesQuotationForCopy:async (d) => arInvoiceDb.getSalesQuotationForCopy(d),
};
