const sapService = require('./sapService');
const salesQuotationDb = require('./salesQuotationDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');
const { buildMarketingDocumentAddressPayload } = require('./documentAddressPayloadUtils');
const { getUdfDefinitions } = require('./udfMetadataService');
const { normalizeUdfValue, normalizeUdfValues, applyUdfsRobust } = require('./udfPayloadUtils');
const { buildDocumentSeriesPayload } = require('./documentSeriesPayloadUtils');

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

const toSapYesNo = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  return ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(normalized) ? 'tYES' : 'tNO';
};

const firstLineValueByAliases = (line = {}, aliases = []) => {
  for (const alias of aliases) {
    const value = line?.[alias] ?? line?.udf?.[alias];
    if (hasValue(value)) return value;
  }
  return undefined;
};

const SALES_QUOTATION_LINE_UDF_MAPPINGS = [
  { sapFields: ['U_PackingType', 'U_PACKINGTYPE', 'U_Packing_Type'], getValue: (line) => firstLineValueByAliases(line, ['U_PackingType', 'U_PACKINGTYPE', 'U_Packing_Type', 'U_PackingStatus', 'packingType']) },
  { sapFields: ['U_TAXCODE', 'U_TaxCode'], getValue: (line) => firstLineValueByAliases(line, ['U_TAXCODE', 'U_TaxCode', 'taxCodeRepeat', 'taxCode']) },
  { sapFields: ['U_PRICE', 'U_Price'], getValue: (line) => firstLineValueByAliases(line, ['U_PRICE', 'U_Price', 'price']) },
  { sapField: 'U_Required_Date', getValue: (line) => line.requiredDate },
  { sapField: 'U_ReqDate', getValue: (line) => line.requiredDate },
  { sapField: 'U_Quoted_Date', getValue: (line) => line.quotedDate },
  { sapField: 'U_QuoteDate', getValue: (line) => line.quotedDate },
  { sapField: 'U_Req_Qty', getValue: (line) => line.requiredQty },
  { sapField: 'U_ReqQty', getValue: (line) => line.requiredQty },
  { sapField: 'U_SPLRBT', getValue: (line) => firstLineValueByAliases(line, ['specialRebate', 'U_SPLRBT', 'U_SpecialRebate']) },
  { sapField: 'U_COMPRC', getValue: (line) => firstLineValueByAliases(line, ['commission', 'commision', 'U_COMPRC', 'U_Commision', 'U_Commission']) },
  { sapField: 'U_S_BrokPerQty', getValue: (line) => firstLineValueByAliases(line, ['sellerBrokeragePerQty', 'brokPerQty', 'U_S_BrokPerQty', 'U_S_BROKPERQTY']) },
  { sapField: 'U_Unit_Price', getValue: (line) => line.unitPriceUdf },
  { sapField: 'U_Brok_Seller', getValue: (line) => firstLineValueByAliases(line, ['sellerBrokerage', 'U_Brok_Seller', 'U_BROK_SELLER']) },
  { sapField: 'U_Brok_Buyer', getValue: (line) => firstLineValueByAliases(line, ['buyerBrokerage', 'U_Brok_Buyer', 'U_BROK_BUYER', 'U_Buyer_Brokerage']) },
  { sapField: 'U_Buyer_Delivery', getValue: (line) => firstLineValueByAliases(line, ['buyerDelivery', 'U_Buyer_Delivery', 'U_BUYER_DELIVERY']) },
  { sapField: 'U_Seller_Delivery', getValue: (line) => firstLineValueByAliases(line, ['sellerDelivery', 'U_Seller_Delivery', 'U_SELLER_DELIVERY']) },
  { sapField: 'U_Buyer_Payment_Terms', getValue: (line) => firstLineValueByAliases(line, ['buyerPaymentTerms', 'buyerTermsOfPayment', 'U_Buyer_Payment_Terms', 'U_BUYER_PAYMENT_TERMS']) },
  { sapField: 'U_Seller_Payment_Term', getValue: (line) => firstLineValueByAliases(line, ['sellerPaymentTerms', 'sellerPaymentTermsRepeat', 'sellerTermsOfPayment', 'U_Seller_Payment_Term', 'U_Seller_Payment_Terms', 'U_SELLER_PAYMENT_TERM', 'U_SELLER_PAYMENT_TERMS']) },
  { sapField: 'U_Seller_Payment_Terms', getValue: (line) => firstLineValueByAliases(line, ['sellerPaymentTerms', 'sellerPaymentTermsRepeat', 'sellerTermsOfPayment', 'U_Seller_Payment_Term', 'U_Seller_Payment_Terms', 'U_SELLER_PAYMENT_TERM', 'U_SELLER_PAYMENT_TERMS']) },
  { sapField: 'U_Buyer_Quality', getValue: (line) => firstLineValueByAliases(line, ['buyerQuality', 'U_Buyer_Quality', 'U_BUYER_QUALITY']) },
  { sapField: 'U_Seller_Quality', getValue: (line) => firstLineValueByAliases(line, ['sellerQuality', 'U_Seller_Quality', 'U_SELLER_QUALITY']) },
  { sapField: 'U_Buyer_Price', getValue: (line) => firstLineValueByAliases(line, ['buyerPrice', 'U_Buyer_Price', 'U_BUYER_PRICE']) },
  { sapField: 'U_Seller_Price', getValue: (line) => firstLineValueByAliases(line, ['sellerPrice', 'U_Seller_Price', 'U_SELLER_PRICE']) },
  { sapField: 'U_Buyer_SPINS', getValue: (line) => firstLineValueByAliases(line, ['buyerSpecialInstruction', 'deliverySpecialInstruction', 'U_Buyer_SPINS', 'U_BUYER_SPINS']) },
  { sapField: 'U_Seller_SPINS', getValue: (line) => firstLineValueByAliases(line, ['sellerSpecialInstruction', 'qtySpecialInstruction', 'U_Seller_SPINS', 'U_SELLER_SPINS']) },
  { sapField: 'U_Sel_Brok_AP', getValue: (line) => firstLineValueByAliases(line, ['sellerBrokerageAmtPer', 'sellerBrokerageAmountPer', 'U_Sel_Brok_AP', 'U_SEL_BROK_AP']) },
  { sapField: 'U_Seller_Brok_Per', getValue: (line) => firstLineValueByAliases(line, ['sellerBrokeragePercent', 'sellerBrokeragePercentage', 'U_Seller_Brok_Per', 'U_SELLER_BROK_PER']) },
  { sapField: 'U_Buyer_Bill_Disc', getValue: (line) => line.buyerBillDiscount },
  { sapField: 'U_Seller_Bill_Disc', getValue: (line) => line.sellerBillDiscount },
  { sapField: 'U_SELLTCODE', getValue: (line) => firstLineValueByAliases(line, ['stcode', 'STCODE', 'U_SELLTCODE', 'U_STCODE']) },
  { sapField: 'U_S_Item', getValue: (line) => firstLineValueByAliases(line, ['sellerItem', 'U_S_Item', 'U_S_ITEM', 'U_SItem']) },
  { sapField: 'U_S_Qty', getValue: (line) => firstLineValueByAliases(line, ['sellerQty', 'sellerQuantity', 'U_S_Qty', 'U_S_QTY']) },
  { sapFields: ['U_Fix_Brock_B', 'U_Fix_Brok_B', 'U_FIX_BROK_BUYER', 'U_FIXBROKBUYER'], getValue: (line) => firstLineValueByAliases(line, ['U_Fix_Brock_B', 'U_Fix_Brok_B', 'U_FIX_BROK_BUYER', 'U_FIXBROKBUYER', 'fixBrokBuyer']) },
  { sapFields: ['U_Fix_Brock_S', 'U_Fix_Brok_S', 'U_Fix_Brock_Seller', 'U_FIXBROCKSELLER', 'U_FIXBROKSELLER'], getValue: (line) => firstLineValueByAliases(line, ['U_Fix_Brock_S', 'U_Fix_Brok_S', 'U_Fix_Brock_Seller', 'U_FIXBROCKSELLER', 'U_FIXBROKSELLER', 'fixBrockSeller']) },
  { sapField: 'U_Freight_pur', getValue: (line) => line.freightPurchase },
  { sapField: 'U_Freight_sales', getValue: (line) => line.freightSales },
  { sapField: 'U_Fr_trans', getValue: (line) => line.freightProvider },
  { sapField: 'U_Fr_trans_name', getValue: (line) => line.freightProviderName },
  { sapField: 'U_BDNum', getValue: (line) => line.brokerageNumber },
];

const SALES_QUOTATION_LABEL_UDF_MAPPINGS = [
  { labels: ['Allow Procmnt. Doc.', 'Allow Procurement Doc'], getValue: (line) => (line.allowProcurementDoc ? 'Y' : '') },
  { labels: ['Required Date'], getValue: (line) => line.requiredDate },
  { labels: ['Quoted Date'], getValue: (line) => line.quotedDate },
  { labels: ['Required Qty.', 'Required Qty', 'Req Qty'], getValue: (line) => line.requiredQty },
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
  { labels: ['Unit Price'], getValue: (line) => line.unitPriceUdf },
  { labels: ['Seller - Terms of Payment'], getValue: (line) => line.sellerPaymentTerms },
  { labels: ['Document Created'], getValue: (line) => line.documentCreated },
];

const compactLabel = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const resolveAvailableUdfKey = (availableUdfKeys = new Set(), aliases = []) => {
  const availableKeys = Array.from(availableUdfKeys || []);
  for (const alias of aliases) {
    if (availableUdfKeys.has(alias)) return alias;

    const normalizedAlias = compactLabel(alias);
    const matchedKey = availableKeys.find((key) => compactLabel(key) === normalizedAlias);
    if (matchedKey) return matchedKey;
  }
  return '';
};

const getSalesQuotationLineUdfMetadata = async () => {
  const definitions = await getUdfDefinitions('QUT1');
  const keys = new Set(definitions.map((field) => String(field.key || '').trim()));
  if (keys.has('U_PACKINGTYPE') || keys.has('U_PACKING_TYPE')) {
    keys.add('U_PackingType');
  }

  return {
    keys,
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

  SALES_QUOTATION_LINE_UDF_MAPPINGS.forEach(({ sapField, sapFields, getValue }) => {
    const aliases = sapFields || [sapField];
    const resolvedSapField = resolveAvailableUdfKey(availableUdfKeys, aliases);
    if (!resolvedSapField) return;
    udfs[resolvedSapField] = normalizeUdfValue(getValue(line));
  });

  SALES_QUOTATION_LABEL_UDF_MAPPINGS.forEach(({ labels, getValue }) => {
    const sapField = labels.map((label) => udfMetadata.labelToKey?.[compactLabel(label)]).find(Boolean);
    if (!sapField || !availableUdfKeys.has(sapField) || udfs[sapField] !== undefined) return;
    udfs[sapField] = normalizeUdfValue(getValue(line));
  });

  return udfs;
};

const buildDocumentLines = async (lines = [], includeLineNum = false) => {
  const udfMetadata = await getSalesQuotationLineUdfMetadata();
  return lines
    .filter((line) => String(line.itemNo || '').trim())
    .map((line) => {
      const lineNum = line.lineNum ?? line.LineNum;
      const documentLine = {
        ...(includeLineNum && lineNum !== undefined && lineNum !== null && lineNum !== '' ? { LineNum: Number(lineNum) } : {}),
        ItemCode: line.itemNo,
        ItemDescription: line.itemDescription || undefined,
        Quantity: toNumberOrUndefined(line.quantity),
        Price: toNumberOrUndefined(line.unitPrice),
        UnitPrice: toNumberOrUndefined(line.unitPrice),
        WarehouseCode: line.whse || '01',
        TaxCode: line.taxCode || line.stcode || undefined,
        MeasureUnit: line.uomCode || undefined,
        UoMCode: line.uomCode || undefined,
        DiscountPercent: toNumberOrUndefined(line.stdDiscount),
        RequiredDate: line.requiredDate || undefined,
        ShipDate: line.quotedDate || undefined,
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
    throw error;
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
      ...buildDocumentSeriesPayload(payload.header),
      DocDate: payload.header.postingDate,
      DocDueDate: payload.header.deliveryDate,
      TaxDate: payload.header.documentDate,
      ContactPersonCode: payload.header.contactPerson ? Number(payload.header.contactPerson) : undefined,
      DocCurrency: payload.header.currency || undefined,
      BPLId: normalizeBranchId(payload.header.branch),
      BPL_IDAssignedToInvoice: normalizeBranchId(payload.header.branch),
      PaymentGroupCode: payload.header.paymentTerms ? Number(payload.header.paymentTerms) : undefined,
      ...(SlpCode !== null && SlpCode !== undefined ? { SalesPersonCode: SlpCode } : {}),
      ...(OwnerCode !== null && OwnerCode !== undefined ? { DocumentsOwner: OwnerCode } : {}),
      ...(Remarks ? { Comments: Remarks } : {}),
      ...(Freight > 0 ? { TotalExpenses: Freight } : {}),
      Rounding: toSapYesNo(payload.header.rounding),
      DocumentAdditionalExpenses: documentAdditionalExpenses,
      ...buildMarketingDocumentAddressPayload(payload.header),
      NumAtCard: payload.header.customerRefNo || undefined,
      DocumentLines: documentLines,
    };

    if (payload.header.placeOfSupply) {
      sapPayload.U_PlaceOfSupply = payload.header.placeOfSupply;
    }

    // Add header UDFs if any
    if (payload.header_udfs && Object.keys(payload.header_udfs).length > 0) {
      try {
        const headerUdfDefinitionsByKey = await getUdfDefinitionsByKey('OQUT');
        applyUdfsRobust(sapPayload, payload.header_udfs, headerUdfDefinitionsByKey, false);
        console.log('[Sales Quotation] Header UDFs applied successfully');
      } catch (error) {
        console.error('[Sales Quotation] Error applying header UDFs:', error.message);
        // Continue even if UDF processing fails - don't block document creation
      }
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
    // Log comprehensive error information for debugging
    console.error('❌ SAP Quotation Error:', {
      message: error.message,
      sapErrorData: error.response?.data,
      statusCode: error.response?.status,
      errorStack: error.stack,
    });

    // Extract meaningful error message
    let errorMessage = 'Sales quotation submission failed.';
    if (error.response?.data?.error?.message?.value) {
      errorMessage = error.response.data.error.message.value;
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Create enriched error for client
    const sapError = new Error(errorMessage);
    sapError.response = error.response;
    sapError.statusCode = error.response?.status || 500;
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
    const documentLines = await buildDocumentLines(payload.lines, true);

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
      Rounding: toSapYesNo(payload.header.rounding),
      DocumentAdditionalExpenses: documentAdditionalExpenses,
      ...buildMarketingDocumentAddressPayload(payload.header),
      DocumentLines: documentLines,
    };

    if (payload.header.placeOfSupply) {
      sapPayload.U_PlaceOfSupply = payload.header.placeOfSupply;
    }

    // Add header UDFs if any
    if (payload.header_udfs && Object.keys(payload.header_udfs).length > 0) {
      try {
        const headerUdfDefinitionsByKey = await getUdfDefinitionsByKey('OQUT');
        applyUdfsRobust(sapPayload, payload.header_udfs, headerUdfDefinitionsByKey, false);
        console.log('[Sales Quotation Update] Header UDFs applied successfully');
      } catch (error) {
        console.error('[Sales Quotation Update] Error applying header UDFs:', error.message);
        // Continue even if UDF processing fails - don't block document update
      }
    }

    await sapService.request({
      method: 'patch',
      url: `/Quotations(${docEntry})`,
      data: sapPayload,
    });

    return { message: 'Sales quotation updated successfully', doc_entry: docEntry };
  } catch (error) {
    console.error('❌ SAP Quotation Update Error:', {
      message: error.message,
      sapErrorData: error.response?.data,
      statusCode: error.response?.status,
      errorStack: error.stack,
    });

    // Extract meaningful error message
    let errorMessage = 'Sales quotation update failed.';
    if (error.response?.data?.error?.message?.value) {
      errorMessage = error.response.data.error.message.value;
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Create enriched error for client
    const sapError = new Error(errorMessage);
    sapError.response = error.response;
    sapError.statusCode = error.response?.status || 500;
    throw sapError;
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
