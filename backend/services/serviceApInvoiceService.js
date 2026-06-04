const sapService = require('./sapService');
const serviceApInvoiceDb = require('./serviceApInvoiceDbService');
const apInvoiceService = require('./apInvoiceService');
const hsnCodeDbService = require('./hsnCodeDbService');
const { getUdfDefinitions } = require('./udfMetadataService');
const { isBlankUdfValue } = require('./udfPayloadUtils');

const parseNum = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatDateForSAP = (value) => {
  if (!value) return '';
  return String(value).split('T')[0];
};

const optString = (value) => {
  const text = String(value ?? '').trim();
  return text || undefined;
};

const optNumber = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const yesNo = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['y', 'yes', 'true', '1', 'tyes'].includes(normalized) ? 'tYES' : 'tNO';
};

const normalizeBranchId = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === '-1' || normalized === '0') return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getUdfDefinitionsByKey = async (tableId) => {
  const definitions = await getUdfDefinitions(tableId);
  return new Map(definitions.map((field) => [field.key, field]));
};

const normalizeKey = (value) =>
  String(value || '')
    .replace(/^U_/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

const normalizeForCompare = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const resolveUdfOptionValue = (field, value) => {
  const text = String(value ?? '').trim();
  if (!text || !Array.isArray(field?.options) || !field.options.length) return text;

  const exactValue = field.options.find((option) => normalizeForCompare(option.value) === normalizeForCompare(text));
  if (exactValue) return String(exactValue.value);

  const exactLabel = field.options.find((option) => normalizeForCompare(option.label) === normalizeForCompare(text));
  if (exactLabel) return String(exactLabel.value);

  return text;
};

const coerceUdfValue = (field, value) => {
  if (value === undefined || value === null) return undefined;
  const optionValue = resolveUdfOptionValue(field, value);
  if (String(optionValue).trim() === '') return undefined;

  const maxLength = Number(field?.maxLength);
  const shouldEnforceLength = !['number', 'date', 'time'].includes(String(field?.type || '').toLowerCase());
  if (shouldEnforceLength && Number.isFinite(maxLength) && maxLength > 0 && String(optionValue).length > maxLength) {
    return undefined;
  }

  return optionValue;
};

const setUdfValue = (target, udfDefinitionsByKey, aliases, value) => {
  if (value === undefined) return;

  const normalizedAliases = aliases.map(normalizeKey);
  const matchedKey = Array.from(udfDefinitionsByKey.keys()).find((key) => normalizedAliases.includes(normalizeKey(key)));
  if (!matchedKey) return;

  if (isBlankUdfValue(value)) {
    target[matchedKey] = null;
    return;
  }

  const coercedValue = coerceUdfValue(udfDefinitionsByKey.get(matchedKey), value);
  if (coercedValue !== undefined) target[matchedKey] = coercedValue;
};

const applyExplicitUdfs = (target, values = {}, udfDefinitionsByKey) => {
  Object.entries(values || {}).forEach(([key, value]) => {
    if (!udfDefinitionsByKey.has(key)) return;
    if (isBlankUdfValue(value)) {
      target[key] = null;
      return;
    }
    const coercedValue = coerceUdfValue(udfDefinitionsByKey.get(key), value);
    if (coercedValue !== undefined) target[key] = coercedValue;
  });
};

const LINE_UDF_ALIASES = {
  sac: ['SAC', 'SACCode'],
  loc: ['Loc', 'Location', 'LocationCode'],
  saudaNodeRef: ['SaudaNodeRef', 'SaudaNodhRef', 'SaudaNode'],
  apInvDocKey: ['APInvDocKey', 'APInvDocEntry'],
  apInvDocNum: ['APInvDocNum'],
  apInvLineNum: ['APInvLineNum'],
  rg23DNo: ['RG23DNo', 'RG23DNO'],
  specialRebate: ['SpecialRebate'],
  commision: ['Commision', 'Commission'],
  brokPerQty: ['BrokPerQty'],
  sItem: ['S_Item', 'SItem'],
  sQty: ['S_Qty', 'SQty'],
  sellerBrokerage: ['SellerBrokerage'],
  buyerBrokerage: ['BuyerBrokerage'],
  buyerDelivery: ['BuyerDelivery'],
  sellerDelivery: ['SellerDelivery'],
  buyerQuality: ['BuyerQuality'],
  sellerQuality: ['SellerQuality'],
  buyerPrice: ['BuyerPrice'],
  sellerPrice: ['SellerPrice'],
  buyerSpecialInstruction: ['BuyerSpecialInstruction', 'BuyerSplInst'],
  sellerSpecialInstruction: ['SellerSpecialInstruction', 'SellerSplInst'],
  sellerBrokerageAmtPer: ['SellerBrokerageAmtPer', 'SellBrkAmtPer'],
  sellerBrokeragePercentage: ['SellerBrokeragePercentage', 'SellerBrkPct'],
  buyerBillDiscount: ['BuyerBillDiscount'],
  sellerBillDiscount: ['SellerBillDiscount'],
  stcode: ['STCODE', 'STCode'],
  buyerTermsOfPayment: ['BuyerTermsOfPayment', 'BuyerPayTerms'],
  sellerTermsOfPayment: ['SellerTermsOfPayment', 'SellerPayTerms'],
  freightPurchase: ['FreightPurchase'],
  freightSales: ['FreightSales'],
  freightProvider: ['FreightProvider'],
  freightProviderName: ['FreightProviderName'],
  documentCreated: ['DocumentCreated'],
  brokerageNumber: ['BrokerageNumber', 'BrokerageNo'],
};

const HEADER_UDF_ALIASES = {
  transactionType: ['TransactionType', 'DocType'],
  placeOfSupply: ['PlaceOfSupply', 'PlaceOfSupplyCode'],
  indicator: ['Indicator'],
  bFromDate: ['B_FromDate', 'BFromDate'],
  bToDate: ['B_ToDate', 'BToDate'],
};

const applyKnownLineUdfs = (target, source, lineUdfDefinitionsByKey) => {
  Object.entries(LINE_UDF_ALIASES).forEach(([field, aliases]) => {
    setUdfValue(target, lineUdfDefinitionsByKey, aliases, source[field]);
  });
};

const applyKnownHeaderUdfs = (target, source, headerUdfDefinitionsByKey) => {
  Object.entries(HEADER_UDF_ALIASES).forEach(([field, aliases]) => {
    setUdfValue(target, headerUdfDefinitionsByKey, aliases, source[field]);
  });
};

const resolveSacEntry = async (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  const resolved = await hsnCodeDbService.resolveSACCodeToAbsEntry(normalized);
  return resolved == null ? undefined : resolved;
};

const resolveLocationCode = (line) => {
  const rawCode = String(line.locCode ?? '').trim();
  if (rawCode && /^\d+$/.test(rawCode)) return Number(rawCode);

  const rawLoc = String(line.loc ?? '').trim();
  if (rawLoc && /^\d+$/.test(rawLoc)) return Number(rawLoc);

  return undefined;
};

const validatePayload = async (payload, docEntry = null) => {
  const { header = {}, lines = [] } = payload || {};
  const vendorCode = String(header.vendor || header.customerCode || '').trim();
  if (!vendorCode) throw new Error('Vendor is required');

  const postingDate = formatDateForSAP(header.postingDate);
  if (!postingDate) throw new Error('Posting Date is required');

  const documentDate = formatDateForSAP(header.documentDate);
  if (!documentDate) throw new Error('Document Date is required');

  const dueDate = formatDateForSAP(header.deliveryDate || header.postingDate);
  if (!dueDate) throw new Error('Due Date is required');
  if (dueDate < postingDate) throw new Error('Due Date must be greater than or equal to Posting Date');

  const populatedLines = lines.filter((line) =>
    String(line.description || line.glAccount || line.totalLC || line.unitPrice || '').trim()
  );
  if (!populatedLines.length) throw new Error('At least one service line is required');

  const vendor = await serviceApInvoiceDb.getVendorValidation(vendorCode);
  if (!vendor || vendor.CardType !== 'S' || String(vendor.FrozenFor || '').toUpperCase() === 'Y') {
    throw new Error('Invalid vendor');
  }

  const postingPeriod = await serviceApInvoiceDb.getPostingPeriodValidation(postingDate);
  if (!postingPeriod) throw new Error('Posting Date must be within open posting period');

  const branchesEnabled = await serviceApInvoiceDb.getBranchEnabled();
  if (branchesEnabled && !String(header.branch || '').trim()) {
    throw new Error('Branch is required');
  }

  if (header.salesContractNo && await serviceApInvoiceDb.isDuplicateVendorInvoiceNumber(vendorCode, String(header.salesContractNo).trim(), docEntry)) {
    throw new Error('Duplicate vendor invoice number');
  }

  populatedLines.forEach((line, index) => {
    if (!String(line.description || '').trim()) throw new Error(`Description is required on line ${index + 1}`);
    if (!String(line.glAccount || '').trim()) throw new Error(`G/L Account is required on line ${index + 1}`);
    if (!String(line.taxCode || '').trim()) throw new Error(`Tax Code is required on line ${index + 1}`);
    if (parseNum(line.totalLC || line.unitPrice) <= 0) throw new Error(`Total (LC) is required on line ${index + 1}`);
  });

  for (const line of populatedLines) {
    const taxCode = String(line.taxCode || '').trim();
    const taxCodeRow = await serviceApInvoiceDb.getTaxCodeValidation(taxCode);
    if (!taxCodeRow) throw new Error(`Tax code '${taxCode}' is not valid`);
  }

  return { header, lines: populatedLines };
};

const buildSapPayload = async (payload, includeSeries = true, docEntry = null) => {
  const { header, lines } = await validatePayload(payload, docEntry);
  const [headerUdfDefinitionsByKey, lineUdfDefinitionsByKey] = await Promise.all([
    getUdfDefinitionsByKey('OPCH'),
    getUdfDefinitionsByKey('PCH1'),
  ]);

  const vendorCode = String(header.vendor || header.customerCode || '').trim();
  const isManualSeries = ['manual', '-1'].includes(String(header.series ?? '').trim().toLowerCase());
  const manualDocNum = optNumber(header.docNo || header.nextNumber);
  const series = optNumber(header.series);
  const contactPersonCode = optNumber(header.contactPerson);
  const salesPersonCode = String(header.salesEmployee ?? '').trim() === '-1' ? undefined : optNumber(header.salesEmployee);
  const paymentGroupCode = optNumber(header.paymentTerms);

  if (includeSeries && isManualSeries && manualDocNum === undefined) {
    throw new Error('Document number is required when Series is Manual');
  }

  const sapPayload = {
    DocType: 'dDocument_Service',
    CardCode: vendorCode,
    ...(includeSeries && isManualSeries ? { Series: -1, DocNum: manualDocNum } : {}),
    ...(includeSeries && !isManualSeries && series > 0 ? { Series: series } : {}),
    DocDate: header.postingDate || header.documentDate,
    DocDueDate: header.deliveryDate || header.postingDate || header.documentDate,
    TaxDate: header.documentDate || header.postingDate,
    ContactPersonCode: contactPersonCode,
    SalesPersonCode: salesPersonCode,
    BPLId: normalizeBranchId(header.branch),
    BPL_IDAssignedToInvoice: normalizeBranchId(header.branch),
    PaymentGroupCode: paymentGroupCode,
    NumAtCard: optString(header.salesContractNo || header.customerRefNo),
    Comments: optString(header.remarks || header.otherInstruction || header.comments),
    JournalMemo: optString(header.journalRemark),
    DiscountPercent: header.discount ? parseNum(header.discount) : undefined,
    DocumentLines: [],
  };

  applyExplicitUdfs(sapPayload, payload.header_udfs, headerUdfDefinitionsByKey);
  applyKnownHeaderUdfs(sapPayload, header, headerUdfDefinitionsByKey);

  for (const line of lines) {
    const quantity = parseNum(line.sQty, 0) > 0 ? parseNum(line.sQty) : 1;
    const unitPrice = parseNum(line.unitPrice, 0) > 0
      ? parseNum(line.unitPrice)
      : parseNum(line.totalLC, 0) / quantity;
    const sapLine = {
      AccountCode: String(line.glAccount || '').trim(),
      ItemDescription: String(line.description || '').trim(),
      Quantity: quantity,
      UnitPrice: unitPrice,
      TaxCode: optString(line.taxCode),
      CostingCode: optString(line.distRule),
      WTLiable: yesNo(line.wtaxLiable),
    };

    const sacEntry = await resolveSacEntry(line.sac);
    if (sacEntry !== undefined) sapLine.SACEntry = sacEntry;

    const locationCode = resolveLocationCode(line);
    if (locationCode !== undefined) sapLine.LocationCode = locationCode;

    const baseType = optNumber(line.baseType);
    const baseEntry = optNumber(line.baseEntry);
    const baseLine = optNumber(line.baseLine);
    if (baseType !== undefined && baseEntry !== undefined && baseLine !== undefined) {
      sapLine.BaseType = baseType;
      sapLine.BaseEntry = baseEntry;
      sapLine.BaseLine = baseLine;
    }

    applyExplicitUdfs(sapLine, line.udf, lineUdfDefinitionsByKey);
    applyKnownLineUdfs(sapLine, line, lineUdfDefinitionsByKey);
    sapPayload.DocumentLines.push(sapLine);
  }

  return sapPayload;
};

const submitServiceAPInvoice = async (payload) => {
  const sapPayload = await buildSapPayload(payload, true);
  const response = await sapService.request({
    method: 'post',
    url: '/PurchaseInvoices',
    data: sapPayload,
  });

  return {
    message: 'Service A/P Invoice created successfully',
    doc_num: response.data?.DocNum,
    doc_entry: response.data?.DocEntry,
    DocNum: response.data?.DocNum,
    DocEntry: response.data?.DocEntry,
  };
};

const updateServiceAPInvoice = async (docEntry, payload) => {
  const sapPayload = await buildSapPayload(payload, false, docEntry);
  await sapService.request({
    method: 'patch',
    url: `/PurchaseInvoices(${docEntry})`,
    data: sapPayload,
  });

  return {
    message: 'Service A/P Invoice updated successfully',
    doc_entry: docEntry,
  };
};

module.exports = {
  getReferenceData: serviceApInvoiceDb.getReferenceData,
  getVendorDetails: serviceApInvoiceDb.getVendorDetails,
  getVendorFilterOptions: apInvoiceService.getVendorFilterOptions,
  getDocumentSeries: serviceApInvoiceDb.getDocumentSeries,
  getNextNumber: serviceApInvoiceDb.getNextNumber,
  getServiceAPInvoiceList: serviceApInvoiceDb.getServiceAPInvoiceList,
  getServiceAPInvoice: serviceApInvoiceDb.getServiceAPInvoice,
  submitServiceAPInvoice,
  updateServiceAPInvoice,
  getOpenServicePurchaseQuotations: async (vendorCode) => ({ documents: await serviceApInvoiceDb.getOpenServicePurchaseQuotations(vendorCode) }),
  getOpenServicePurchaseOrders: async (vendorCode) => ({ documents: await serviceApInvoiceDb.getOpenServicePurchaseOrders(vendorCode) }),
  getOpenServiceGRPO: async (vendorCode) => ({ documents: await serviceApInvoiceDb.getOpenServiceGRPO(vendorCode) }),
  getServicePurchaseQuotationForCopy: serviceApInvoiceDb.getServicePurchaseQuotationForCopy,
  getServicePurchaseOrderForCopy: serviceApInvoiceDb.getServicePurchaseOrderForCopy,
  getServiceGRPOForCopy: serviceApInvoiceDb.getServiceGRPOForCopy,
};
