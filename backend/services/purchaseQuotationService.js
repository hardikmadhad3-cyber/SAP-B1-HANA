const sapService = require('./sapService');
const purchaseQuotationDb = require('./purchaseQuotationDbService');
const { getDocumentFreightCharges } = require('./freightChargesDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');
const { getUdfDefinitions } = require('./udfMetadataService');
const { isSapUdfKey, normalizeUdfValue, normalizeUdfValues } = require('./udfPayloadUtils');

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
    console.error('[Purchase Quotation Service] Failed to load vendor details:', error);
    throw error;
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

const hasValue = (value) => value !== '' && value !== null && value !== undefined;

const firstValue = (...values) => values.find(hasValue);
const normalizeUdfLookupToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^U_/, '')
    .replace(/[^A-Z0-9]/g, '');

const getLineUdfValue = (line = {}, aliases = []) => {
  const udf = line.udf || {};
  const aliasList = Array.isArray(aliases) ? aliases : [aliases];

  for (const alias of aliasList) {
    if (hasValue(udf[alias])) return udf[alias];
  }

  const aliasTokens = new Set(aliasList.map(normalizeUdfLookupToken).filter(Boolean));
  const match = Object.entries(udf).find(([key, value]) =>
    aliasTokens.has(normalizeUdfLookupToken(key)) && hasValue(value)
  );
  return match ? match[1] : undefined;
};

const PURCHASE_QUOTATION_LINE_UDF_MAPPINGS = [
  { sapFields: ['U_Req_Qty', 'U_ReqQty'], getValue: (line) => firstValue(line.requiredQty, getLineUdfValue(line, ['U_Req_Qty', 'U_ReqQty'])) },
  {
    sapFields: ['U_Cost_Sheet', 'U_COST_SHEET', 'U_COSTSHEET', 'U_CostSheet'],
    getValue: (line) => firstValue(line.U_Cost_Sheet, line.costSheet, getLineUdfValue(line, ['U_Cost_Sheet', 'U_COST_SHEET', 'U_COSTSHEET', 'U_CostSheet'])),
  },
  {
    sapFields: ['U_PackingType', 'U_PACKINGTYPE', 'U_Packing_Type', 'U_PackingStatus', 'U_PACKINGSTATUS'],
    getValue: (line) => firstValue(line.U_PackingType, line.packingType, getLineUdfValue(line, ['U_PackingType', 'U_PACKINGTYPE', 'U_Packing_Type', 'U_PackingStatus', 'U_PACKINGSTATUS'])),
  },
  {
    sapFields: ['U_ContainerType', 'U_CONTAINERTYPE', 'U_Container_Type'],
    getValue: (line) => firstValue(line.U_ContainerType, line.containerType, getLineUdfValue(line, ['U_ContainerType', 'U_CONTAINERTYPE', 'U_Container_Type'])),
  },
  {
    sapFields: ['U_GrossWt', 'U_GROSSWT', 'U_Gross_Wt', 'U_GrossWeight', 'U_GROSSWEIGHT'],
    getValue: (line) => firstValue(line.U_GrossWt, line.grossWt, getLineUdfValue(line, ['U_GrossWt', 'U_GROSSWT', 'U_Gross_Wt', 'U_GrossWeight', 'U_GROSSWEIGHT'])),
  },
  {
    sapFields: ['U_TotalPackage', 'U_TOTALPACKAGE', 'U_Total_Package', 'U_TotalPackge'],
    getValue: (line) => firstValue(line.U_TotalPackage, line.totalPackage, getLineUdfValue(line, ['U_TotalPackage', 'U_TOTALPACKAGE', 'U_Total_Package', 'U_TotalPackge'])),
  },
  {
    sapFields: ['U_TAXCODE', 'U_TaxCode'],
    getValue: (line) => firstValue(line.taxCodeRepeat, getLineUdfValue(line, ['U_TAXCODE', 'U_TaxCode']), line.taxCode),
  },
  {
    sapFields: ['U_PRICE', 'U_Price'],
    getValue: (line) => firstValue(line.price, getLineUdfValue(line, ['U_PRICE', 'U_Price']), line.unitPrice),
  },
  { sapFields: ['U_HSNCode', 'U_HSN'], getValue: (line) => firstValue(line.hsnCode, getLineUdfValue(line, ['U_HSNCode', 'U_HSN'])) },
  { sapFields: ['U_SACCode', 'U_SAC'], getValue: (line) => firstValue(line.sacCode, getLineUdfValue(line, ['U_SACCode', 'U_SAC'])) },
  { sapField: 'U_SPLRBT', getValue: (line) => line.specialRebate },
  { sapField: 'U_COMPRC', getValue: (line) => line.commission },
  { sapField: 'U_S_BrokPerQty', getValue: (line) => line.sellerBrokeragePerQty },
  { sapField: 'U_Unit_Price', getValue: (line) => line.unitPriceUdf },
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
  { sapField: 'U_S_Qty', getValue: (line) => line.sellerQty },
  { sapField: 'U_Freight_pur', getValue: (line) => line.freightPurchase },
  { sapField: 'U_Freight_sales', getValue: (line) => line.freightSales },
  { sapField: 'U_Fr_trans', getValue: (line) => line.freightProvider },
  { sapField: 'U_Fr_trans_name', getValue: (line) => line.freightProviderName },
  { sapField: 'U_BDNum', getValue: (line) => line.brokerageNumber },
  {
    sapFields: ['U_Fix_Brock_B', 'U_Fix_Brok_B', 'U_FIX_BROK_BUYER', 'U_FIXBROKBUYER', 'U_FixBrokBuyer'],
    getValue: (line) => firstValue(line.U_Fix_Brock_B, line.fixBrokBuyer, getLineUdfValue(line, ['U_Fix_Brock_B', 'U_Fix_Brok_B', 'U_FIX_BROK_BUYER', 'U_FIXBROKBUYER', 'U_FixBrokBuyer'])),
  },
  {
    sapFields: ['U_Fix_Brock_S', 'U_Fix_Brok_S', 'U_Fix_Brock_Seller', 'U_FIXBROCKSELLER', 'U_FIXBROKSELLER', 'U_FixBrokSeller'],
    getValue: (line) => firstValue(line.U_Fix_Brock_S, line.fixBrockSeller, getLineUdfValue(line, ['U_Fix_Brock_S', 'U_Fix_Brok_S', 'U_Fix_Brock_Seller', 'U_FIXBROCKSELLER', 'U_FIXBROKSELLER', 'U_FixBrokSeller'])),
  },
];

const PURCHASE_QUOTATION_LABEL_UDF_MAPPINGS = [
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
  { labels: ['Cost-Sheet', 'Cost Sheet'], getValue: (line) => firstValue(line.U_Cost_Sheet, line.costSheet) },
  { labels: ['Packing-Type', 'Packing Type'], getValue: (line) => firstValue(line.U_PackingType, line.packingType) },
  { labels: ['Container Type'], getValue: (line) => firstValue(line.U_ContainerType, line.containerType) },
  { labels: ['GrossWt', 'Gross Weight', 'Gross Wt'], getValue: (line) => firstValue(line.U_GrossWt, line.grossWt) },
  { labels: ['Total-Package', 'Total Package'], getValue: (line) => firstValue(line.U_TotalPackage, line.totalPackage) },
  { labels: ['TaxCode'], getValue: (line) => firstValue(line.taxCodeRepeat, line.taxCode) },
  { labels: ['Price'], getValue: (line) => firstValue(line.price, line.unitPrice) },
  { labels: ['FIX Brok BUYER', 'Fix Brok Buyer'], getValue: (line) => firstValue(line.U_Fix_Brock_B, line.fixBrokBuyer) },
  { labels: ['Fix Brock Seller', 'Fix Brok Seller'], getValue: (line) => firstValue(line.U_Fix_Brock_S, line.fixBrockSeller) },
];

const compactLabel = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const getPurchaseQuotationLineUdfMetadata = async () => {
  const definitions = await getUdfDefinitions('PQT1');
  return {
    keys: new Set(definitions.map((field) => String(field.key || '').trim())),
    labelToKey: definitions.reduce((acc, field) => {
      const key = compactLabel(field.label || field.key);
      if (key && field.key) acc[key] = field.key;
      return acc;
    }, {}),
    tokenToKey: definitions.reduce((acc, field) => {
      [
        field.key,
        field.sapField,
        field.aliasId,
        field.label,
        field.description,
        field.Descr,
      ].forEach((candidate) => {
        const token = normalizeUdfLookupToken(candidate);
        if (token && field.key && !acc[token]) acc[token] = field.key;
      });
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

  const resolveUdfKey = (candidates = []) => {
    const candidateList = Array.isArray(candidates) ? candidates : [candidates];
    return (
      candidateList.find((key) => availableUdfKeys.has(key)) ||
      candidateList
        .map((key) => udfMetadata.tokenToKey?.[normalizeUdfLookupToken(key)])
        .find((key) => key && availableUdfKeys.has(key)) ||
      null
    );
  };

  Object.entries(line.udf || {}).forEach(([key, value]) => {
    if (availableUdfKeys.has(key)) {
      udfs[key] = normalizeUdfValue(value);
    }
  });

  PURCHASE_QUOTATION_LINE_UDF_MAPPINGS.forEach(({ sapField, sapFields, getValue }) => {
    const targetField = resolveUdfKey(sapFields || sapField);
    if (!targetField) return;
    udfs[targetField] = normalizeUdfValue(getValue(line));
  });

  PURCHASE_QUOTATION_LABEL_UDF_MAPPINGS.forEach(({ labels, getValue }) => {
    const sapField = labels
      .map((label) => udfMetadata.labelToKey?.[compactLabel(label)] || resolveUdfKey(label))
      .find(Boolean);
    if (!sapField || !availableUdfKeys.has(sapField) || udfs[sapField] !== undefined) return;
    udfs[sapField] = normalizeUdfValue(getValue(line));
  });

  return udfs;
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
      const preserveNullUdf = isSapUdfKey(key) && cleanedValue === null;
      const isEmptyObject =
        cleanedValue &&
        typeof cleanedValue === 'object' &&
        !Array.isArray(cleanedValue) &&
        Object.keys(cleanedValue).length === 0;

      if (
        cleanedValue === undefined ||
        (cleanedValue === null && !preserveNullUdf) ||
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

const buildDocumentLines = async (lines = []) => {
  const udfMetadata = await getPurchaseQuotationLineUdfMetadata();
  return lines
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
        RequiredDate: line.requiredDate,
        ShipDate: line.quotedDate,
        CostingCode: line.distRule,
        CountryOrg: line.countryOfOrigin,
        LocationCode: toNumberOrUndefined(line.loc),
        AgreementNo: toNumberOrUndefined(line.blanketAgreementNo),
        ...(line.baseType && line.baseEntry != null ? { BaseType: Number(line.baseType) } : {}),
        ...(line.baseEntry != null ? { BaseEntry: Number(line.baseEntry) } : {}),
        ...(line.baseLine != null ? { BaseLine: Number(line.baseLine) } : {}),
      });

      Object.assign(documentLine, buildValidatedLineUdfs(line, udfMetadata));
      return documentLine;
    });
};

const buildPurchaseQuotationPayload = async ({ header = {}, lines = [], header_udfs = {}, freightCharges = [] }) => {
  const sapPayload = cleanObject({
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
    DocumentAdditionalExpenses: buildDocumentAdditionalExpenses(freightCharges),
    DocumentLines: await buildDocumentLines(lines),
  });

  const headerUdfDefinitionsByKey = await getUdfDefinitionsByKey('OPQT');
  Object.assign(sapPayload, normalizeUdfValues(header_udfs, null, headerUdfDefinitionsByKey));
  return sapPayload;
};

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
  const purchaseQuotationPayload = await buildPurchaseQuotationPayload(payload);

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
  const purchaseQuotationPayload = await buildPurchaseQuotationPayload(payload);

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
