const sapService = require('./sapService');
const salesQuotationDb = require('./salesQuotationDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');
const { getUdfDefinitions } = require('./udfMetadataService');
const { normalizeUdfValue, normalizeUdfValues } = require('./udfPayloadUtils');

const normalizeBranchId = (branch) => {
  const normalized = String(branch || '').trim();
  return normalized === '' ? -1 : Number(normalized);
};

const hasValue = (value) => value !== '' && value !== null && value !== undefined;

const toNumberOrUndefined = (value) => {
  if (!hasValue(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const SALES_QUOTATION_LINE_UDF_MAPPINGS = [
  { sapField: 'U_SPLRBT', getValue: (line) => line.specialRebate },
  { sapField: 'U_COMPRC', getValue: (line) => line.commission },
  { sapField: 'U_S_BrokPerQty', getValue: (line) => line.sellerBrokeragePerQty },
  { sapField: 'U_Brok_Seller', getValue: (line) => line.sellerBrokerage },
  { sapField: 'U_Brok_Buyer', getValue: (line) => line.buyerBrokerage },
  { sapField: 'U_Buyer_Delivery', getValue: (line) => line.buyerDelivery },
  { sapField: 'U_Seller_Delivery', getValue: (line) => line.sellerDelivery },
  { sapField: 'U_Buyer_Payment_Terms', getValue: (line) => line.buyerPaymentTerms },
  { sapField: 'U_Seller_Payment_Terms', getValue: (line) => line.sellerPaymentTerms },
  { sapField: 'U_Buyer_Quality', getValue: (line) => line.buyerQuality },
  { sapField: 'U_Seller_Quality', getValue: (line) => line.sellerQuality },
  { sapField: 'U_Buyer_Price', getValue: (line) => line.buyerPrice },
  { sapField: 'U_Seller_Price', getValue: (line) => line.sellerPrice },
  { sapField: 'U_Buyer_SPINS', getValue: (line) => line.buyerSpecialInstruction },
  { sapField: 'U_Seller_SPINS', getValue: (line) => line.sellerSpecialInstruction },
  { sapField: 'U_Sel_Brok_AP', getValue: (line) => line.sellerBrokerageAmtPer },
  { sapField: 'U_Seller_Brok_Per', getValue: (line) => line.sellerBrokeragePercent },
  { sapField: 'U_Buyer_Bill_Disc', getValue: (line) => line.buyerBillDiscount },
  { sapField: 'U_Seller_Bill_Disc', getValue: (line) => line.sellerBillDiscount },
  { sapField: 'U_SELLTCODE', getValue: (line) => line.stcode },
  { sapField: 'U_S_Item', getValue: (line) => line.sellerItem },
  { sapField: 'U_S_Qty', getValue: (line) => line.sellerQty ?? line.quantity },
  { sapField: 'U_Freight_pur', getValue: (line) => line.freightPurchase },
  { sapField: 'U_Freight_sales', getValue: (line) => line.freightSales },
  { sapField: 'U_Fr_trans', getValue: (line) => line.freightProvider },
  { sapField: 'U_Fr_trans_name', getValue: (line) => line.freightProviderName },
  { sapField: 'U_BDNum', getValue: (line) => line.brokerageNumber },
];

const SALES_QUOTATION_LABEL_UDF_MAPPINGS = [
  { labels: ['Allow Procmnt. Doc.', 'Allow Procurement Doc'], getValue: (line) => (line.allowProcurementDoc ? 'Y' : '') },
  { labels: ['Sauda Node Ref', 'Sauda Nodh Ref', 'Sauda Nodh No'], getValue: (line) => line.saudaNodeRef },
  { labels: ['AP Inv DocKey'], getValue: (line) => line.apInvDocKey },
  { labels: ['AP Inv DocNum'], getValue: (line) => line.apInvDocNum },
  { labels: ['AP Inv LineNum'], getValue: (line) => line.apInvLineNum },
  { labels: ['Assessable Value'], getValue: (line) => line.assessableValue },
  { labels: ['BED Rate', 'BEDRATE'], getValue: (line) => line.bedRate },
  { labels: ['BED Amount', 'BEDAMOUNT'], getValue: (line) => line.bedAmount },
  { labels: ['RG23DNo', 'RG23DNO'], getValue: (line) => line.rg23dNo },
  { labels: ['HSN'], getValue: (line) => line.hsnCode },
  { labels: ['SAC'], getValue: (line) => line.sacCode },
];

const compactLabel = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const getSalesQuotationLineUdfMetadata = async () => {
  const definitions = await getUdfDefinitions('QUT1');
  return {
    keys: new Set(definitions.map((field) => String(field.key || '').trim())),
    labelToKey: definitions.reduce((acc, field) => {
      const key = compactLabel(field.label || field.key);
      if (key && field.key) acc[key] = field.key;
      return acc;
    }, {}),
  };
};

const getUdfDefinitionsByKey = async (tableId) => {
  const definitions = await getUdfDefinitions(tableId);
  return new Map(definitions.map((field) => [field.key, field]));
};

const buildValidatedLineUdfs = (line, udfMetadata) => {
  const availableUdfKeys = udfMetadata.keys || new Set();
  const udfs = {};

  Object.entries(line.udf || {}).forEach(([key, value]) => {
    if (availableUdfKeys.has(key)) {
      udfs[key] = normalizeUdfValue(value);
    }
  });

  SALES_QUOTATION_LINE_UDF_MAPPINGS.forEach(({ sapField, getValue }) => {
    if (!availableUdfKeys.has(sapField)) return;
    udfs[sapField] = normalizeUdfValue(getValue(line));
  });

  SALES_QUOTATION_LABEL_UDF_MAPPINGS.forEach(({ labels, getValue }) => {
    const sapField = labels.map((label) => udfMetadata.labelToKey?.[compactLabel(label)]).find(Boolean);
    if (!sapField || !availableUdfKeys.has(sapField) || udfs[sapField] !== undefined) return;
    udfs[sapField] = normalizeUdfValue(getValue(line));
  });

  return udfs;
};

const buildDocumentLines = async (lines = []) => {
  const udfMetadata = await getSalesQuotationLineUdfMetadata();
  return lines
    .filter((line) => String(line.itemNo || '').trim())
    .map((line) => {
      const documentLine = {
        ItemCode: line.itemNo,
        Quantity: toNumberOrUndefined(line.quantity),
        Price: toNumberOrUndefined(line.unitPrice),
        UnitPrice: toNumberOrUndefined(line.unitPrice),
        WarehouseCode: line.whse || '01',
        TaxCode: line.taxCode || undefined,
        MeasureUnit: line.uomCode || undefined,
        UoMCode: line.uomCode || undefined,
        DiscountPercent: toNumberOrUndefined(line.stdDiscount),
        CostingCode: line.distRule,
        COGSCostingCode: line.cogsDistRule,
        CountryOrg: line.countryOfOrigin,
        AgreementNo: toNumberOrUndefined(line.blanketAgreementNo),
        ...(line.baseType && line.baseEntry != null ? { BaseType: Number(line.baseType) } : {}),
        ...(line.baseEntry != null ? { BaseEntry: Number(line.baseEntry) } : {}),
        ...(line.baseLine != null ? { BaseLine: Number(line.baseLine) } : {}),
        ...buildValidatedLineUdfs(line, udfMetadata),
      };

      if (Array.isArray(line.batches) && line.batches.length > 0) {
        documentLine.BatchNumbers = line.batches.map((batch) => ({
          BatchNumber: batch.batchNumber,
          Quantity: Number(batch.quantity),
        }));
      }

      return Object.entries(documentLine).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') acc[key] = value;
        return acc;
      }, {});
    });
};

// ───────── HELPERS ─────────

const convertSalesEmployeeToCode = async (input, salesEmployees = []) => {
  if (!input || input === '-1' || input === -1 || String(input).trim() === '') return null;
  if (!isNaN(input) && Number(input) !== -1) return Number(input);

  const name = String(input).trim();
  const found = salesEmployees.find(emp =>
    String(emp.SlpName || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (found) return found.SlpCode;

  const escapedName = name.replace(/'/g, "''");
  try {
    const searchResult = await sapService.request({
      method: 'get',
      url: `/SalesPersons?$filter=SalesEmployeeName eq '${escapedName}'&$select=SalesEmployeeCode,SalesEmployeeName`,
    });
    if (searchResult.data?.value?.length > 0) return searchResult.data.value[0].SalesEmployeeCode;

    const createResult = await sapService.request({
      method: 'post',
      url: '/SalesPersons',
      data: { SalesEmployeeName: name, Active: 'tYES' },
    });
    return createResult.data?.SalesEmployeeCode;
  } catch (error) {
    throw new Error(`Sales Employee '${name}' could not be resolved: ${error.message}`);
  }
};

const convertOwnerToCode = async (input, owners = []) => {
  if (!input || String(input).trim() === '') return null;
  if (!isNaN(input)) return Number(input);

  const name = String(input).trim();
  const found = owners.find(owner => {
    const fullName = String(owner.FullName || '').trim().toLowerCase();
    return fullName === name.toLowerCase() ||
      String(owner.firstName || '').trim().toLowerCase() === name.toLowerCase();
  });
  if (found) return found.empID;

  try {
    const escapedName = name.replace(/'/g, "''");
    const searchResult = await sapService.request({
      method: 'get',
      url: `/EmployeesInfo?$filter=FirstName eq '${escapedName}'&$select=EmployeeID,FirstName,LastName`,
    });
    if (searchResult.data?.value?.length > 0) return searchResult.data.value[0].EmployeeID;
  } catch (error) {
    console.warn('⚠️ Owner lookup failed:', error.message);
  }
  return null;
};

// ───────── REFERENCE DATA ─────────

const getReferenceData = async (companyId) => {
  try {
    return await salesQuotationDb.getReferenceData();
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to load reference data:', error);
    return {
      company: '', customers: [], vendors: [], items: [],
      warehouses: [], warehouse_addresses: [], payment_terms: [],
      shipping_types: [], branches: [], tax_codes: [], uom_groups: [],
      contacts: [], pay_to_addresses: [], company_address: {},
      decimal_settings: { QtyDec: 2, PriceDec: 2, SumDec: 2, RateDec: 2, PercentDec: 2 },
      warnings: [`Failed to load reference data: ${error.message}`],
    };
  }
};

// ───────── CUSTOMER DETAILS ─────────

const getCustomerDetails = async (customerCode) => {
  try {
    return await salesQuotationDb.getCustomerDetails(customerCode);
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to load customer details:', error);
    return { contacts: [], bill_to_addresses: [], pay_to_addresses: [] };
  }
};

// ───────── LIST ─────────

const getSalesQuotationList = async ({
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
    return await salesQuotationDb.getSalesQuotationList({
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
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to load list:', error);
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

const getCustomerFilterOptions = async ({
  query = '',
  customerCode = '',
  customerName = '',
  top,
  display = 'code',
} = {}) => {
  try {
    const rows = await salesQuotationDb.searchCustomers({
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
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to load customer filter options:', error);
    return { options: [] };
  }
};

// ───────── GET SINGLE ─────────

const getSalesQuotation = async (docEntry) => {
  try {
    return await salesQuotationDb.getSalesQuotation(docEntry);
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to load quotation:', error);
    throw error;
  }
};

// ───────── CREATE (SERVICE LAYER) ─────────

const submitSalesQuotation = async (payload) => {
  try {
    const refData = await salesQuotationDb.getReferenceData();
    const salesEmployees = refData.sales_employees || [];
    const owners = refData.owners || [];

    let salesEmployeeInput = payload.header.salesEmployee;
    if (!salesEmployeeInput || salesEmployeeInput === '-1' || salesEmployeeInput === -1) {
      salesEmployeeInput = payload.header.purchaser;
    }

    const SlpCode = await convertSalesEmployeeToCode(salesEmployeeInput, salesEmployees);
    const OwnerCode = await convertOwnerToCode(payload.header.owner, owners);
    const Remarks = payload.header.otherInstruction || payload.header.remarks || '';
    const Freight = payload.header.freight ? Number(payload.header.freight) : 0;
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
    const documentLines = await buildDocumentLines(payload.lines);

    const sapPayload = {
      CardCode: payload.header.vendor.trim(),
      ...(payload.header.series && Number(payload.header.series) > 0
        ? { Series: Number(payload.header.series) } : {}),
      DocDate: payload.header.postingDate,
      DocDueDate: payload.header.deliveryDate,
      TaxDate: payload.header.documentDate,
      ContactPersonCode: payload.header.contactPerson ? Number(payload.header.contactPerson) : undefined,
      BPLId: normalizeBranchId(payload.header.branch),
      BPL_IDAssignedToInvoice: normalizeBranchId(payload.header.branch),
      PaymentGroupCode: payload.header.paymentTerms ? Number(payload.header.paymentTerms) : undefined,
      ...(SlpCode !== null && SlpCode !== undefined ? { SalesPersonCode: SlpCode } : {}),
      ...(OwnerCode !== null && OwnerCode !== undefined ? { DocumentsOwner: OwnerCode } : {}),
      ...(Remarks ? { Comments: Remarks } : {}),
      ...(Freight > 0 ? { TotalExpenses: Freight } : {}),
      DocumentAdditionalExpenses: documentAdditionalExpenses,
      NumAtCard: payload.header.customerRefNo || undefined,
      DocumentLines: documentLines,
    };

    if (payload.header.placeOfSupply) {
      sapPayload.U_PlaceOfSupply = payload.header.placeOfSupply;
    }

    // Add header UDFs if any
    if (payload.header_udfs && Object.keys(payload.header_udfs).length > 0) {
      const headerUdfDefinitionsByKey = await getUdfDefinitionsByKey('OQUT');
      Object.assign(sapPayload, normalizeUdfValues(payload.header_udfs, null, headerUdfDefinitionsByKey));
    }

    console.log('🔥 SAP Quotation Payload:', JSON.stringify(sapPayload, null, 2));

    const response = await sapService.request({
      method: 'post',
      url: '/Quotations',
      data: sapPayload,
    });

    return {
      message: 'Sales quotation created successfully',
      doc_num: response.data?.DocNum,
      doc_entry: response.data?.DocEntry,
      DocNum: response.data?.DocNum,
      DocEntry: response.data?.DocEntry,
    };
  } catch (error) {
    console.error('❌ SAP Quotation Error:', error.response?.data || error.message);
    let errorMessage = 'Sales quotation submission failed.';
    if (error.response?.data?.error?.message?.value) errorMessage = error.response.data.error.message.value;
    else if (error.response?.data?.error?.message) errorMessage = error.response.data.error.message;
    else if (error.message) errorMessage = error.message;
    const sapError = new Error(errorMessage);
    sapError.response = error.response;
    throw sapError;
  }
};

// ───────── UPDATE (SERVICE LAYER) ─────────

const updateSalesQuotation = async (docEntry, payload) => {
  try {
    const refData = await salesQuotationDb.getReferenceData();
    const salesEmployees = refData.sales_employees || [];
    const owners = refData.owners || [];

    let salesInput = payload.header.salesEmployee;
    if (!salesInput || salesInput === '-1' || salesInput === -1) {
      salesInput = payload.header.purchaser;
    }

    const SlpCode = await convertSalesEmployeeToCode(salesInput, salesEmployees);
    const OwnerCode = await convertOwnerToCode(payload.header.owner, owners);
    const Remarks = payload.header.otherInstruction || payload.header.remarks || '';
    const Freight = Number(payload.header.freight) || 0;
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
    const documentLines = await buildDocumentLines(payload.lines);

    const sapPayload = {
      CardCode: payload.header.vendor?.trim(),
      DocDate: payload.header.postingDate,
      DocDueDate: payload.header.deliveryDate,
      TaxDate: payload.header.documentDate,
      ContactPersonCode: payload.header.contactPerson ? Number(payload.header.contactPerson) : undefined,
      BPL_IDAssignedToInvoice: payload.header.branch ? Number(payload.header.branch) : undefined,
      PaymentGroupCode: payload.header.paymentTerms ? Number(payload.header.paymentTerms) : undefined,
      ...(SlpCode !== null && SlpCode !== undefined && { SalesPersonCode: SlpCode }),
      ...(OwnerCode !== null && OwnerCode !== undefined && { DocumentsOwner: OwnerCode }),
      ...(Remarks && { Comments: Remarks }),
      ...(Freight > 0 && { TotalExpenses: Freight }),
      DocumentAdditionalExpenses: documentAdditionalExpenses,
      DocumentLines: documentLines,
    };

    if (payload.header.placeOfSupply) {
      sapPayload.U_PlaceOfSupply = payload.header.placeOfSupply;
    }

    // Add header UDFs if any
    if (payload.header_udfs && Object.keys(payload.header_udfs).length > 0) {
      const headerUdfDefinitionsByKey = await getUdfDefinitionsByKey('OQUT');
      Object.assign(sapPayload, normalizeUdfValues(payload.header_udfs, null, headerUdfDefinitionsByKey));
    }

    await sapService.request({
      method: 'patch',
      url: `/Quotations(${docEntry})`,
      data: sapPayload,
    });

    return { message: 'Sales quotation updated successfully', doc_entry: docEntry };
  } catch (error) {
    console.error('❌ SAP Quotation Update Error:', error.response?.data || error.message);
    throw error;
  }
};

// ───────── DOCUMENT SERIES ─────────

const getDocumentSeries = async (targetDate = null) => {
  try {
    const series = await salesQuotationDb.getDocumentSeries(targetDate);
    return { series };
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to load document series:', error);
    return { series: [] };
  }
};

const getNextNumber = async (seriesParam) => {
  try {
    const series = Number(seriesParam);
    if (isNaN(series)) throw new Error('Invalid series number');
    return await salesQuotationDb.getNextNumber(series);
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to get next number:', error);
    throw error;
  }
};

const getStateFromAddress = async (cardCode, addressCode) => {
  try {
    return await salesQuotationDb.getStateFromAddress(cardCode, addressCode);
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to get state from address:', error);
    return { state: '' };
  }
};

const getItemsForModal = async () => {
  try {
    const items = await salesQuotationDb.getItemsForModal();
    return { items };
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to get items for modal:', error);
    return { items: [] };
  }
};

const getFreightCharges = async (docEntry) => {
  try {
    const freightCharges = await salesQuotationDb.getFreightCharges(docEntry);
    return { freightCharges };
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to get freight charges:', error);
    return { freightCharges: [] };
  }
};

// ───────── OPEN QUOTATIONS FOR COPY ─────────

const createLookupValue = async ({ field, value, description }) => {
  const fieldMap = {
    buyerQuality: 'U_Buyer_Quality',
    sellerQuality: 'U_Seller_Quality',
    buyerPrice: 'U_Buyer_Price',
    sellerPrice: 'U_Seller_Price',
  };

  const aliasId = fieldMap[String(field || '').trim()] || String(field || '').trim();
  if (!aliasId) {
    throw new Error('Lookup field is required.');
  }

  const option = await salesQuotationDb.createLookupValue(aliasId, value, description);
  const options = await salesQuotationDb.getLookupValues(aliasId);

  return { option, options };
};

const getOpenSalesQuotations = async (customerCode = '') => {
  try {
    const documents = await salesQuotationDb.getOpenSalesQuotations(customerCode);
    return { documents };
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to get open quotations:', error);
    return { documents: [] };
  }
};

const getSalesQuotationForCopy = async (docEntry) => {
  try {
    const quotation = await salesQuotationDb.getSalesQuotationForCopy(docEntry);
    return quotation;
  } catch (error) {
    console.error('[Sales Quotation Service] Failed to get quotation for copy:', error);
    throw error;
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getSalesQuotationList,
  getSalesQuotation,
  submitSalesQuotation,
  updateSalesQuotation,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getItemsForModal,
  getFreightCharges,
  createLookupValue,
  getOpenSalesQuotations,
  getSalesQuotationForCopy,
};
