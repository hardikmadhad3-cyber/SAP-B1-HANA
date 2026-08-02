const sapService = require('./sapService');
const serviceArInvoiceDb = require('./serviceArInvoiceDbService');
const arInvoiceService = require('./arInvoiceService');
const hsnCodeDbService = require('./hsnCodeDbService');
const { getUdfDefinitions } = require('./udfMetadataService');
const { isBlankUdfValue, normalizeUdfValue } = require('./udfPayloadUtils');
const authDbService = require('./authDbService');
const { getRequestContext } = require('./requestContextService');

const parseNum = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
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

const buildWithholdingTaxData = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row?.code || row?.WTCode || '').trim())
    .map((row) => ({
      WTCode: String(row.code || row.WTCode || '').trim(),
      TaxableAmount: parseNum(row.taxableAmount, 0),
      WTAmount: parseNum(row.wtaxAmount || row.WTAmount, 0),
      Category: 'I',
    }));

const normalizeBranchId = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === '-1' || normalized === '0') return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveDocumentSeries = async (header, series, isManualSeries) => {
  if (isManualSeries) return { series, branchId: normalizeBranchId(header.branch) };
  if (!(series > 0)) throw new Error('Select a numbering series before adding the document');

  const postingDate = header.postingDate || header.documentDate;
  const availableSeries = await serviceArInvoiceDb.getDocumentSeries(
    postingDate,
    header.transactionType || '',
    header.branch || ''
  );
  const selectedSeries = (Array.isArray(availableSeries) ? availableSeries : availableSeries?.series || [])
    .find((row) => Number(row.Series) === series);

  if (!selectedSeries) {
    throw new Error(`The selected numbering series is not valid for posting date ${postingDate}. Select a series for that financial year and branch.`);
  }

  return {
    series,
    branchId: normalizeBranchId(header.branch) ?? normalizeBranchId(selectedSeries.BPLId),
  };
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

const coerceUdfValue = (field, value, key = '') => {
  if (value === undefined || value === null) return undefined;
  const normalizedValue = normalizeUdfValue(value, field, key || field?.key);
  return normalizedValue === null ? undefined : normalizedValue;
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

  const coercedValue = coerceUdfValue(udfDefinitionsByKey.get(matchedKey), value, matchedKey);
  if (coercedValue !== undefined) target[matchedKey] = coercedValue;
};

const applyExplicitUdfs = (target, values = {}, udfDefinitionsByKey) => {
  Object.entries(values || {}).forEach(([key, value]) => {
    if (!udfDefinitionsByKey.has(key)) return;
    if (isBlankUdfValue(value)) {
      target[key] = null;
      return;
    }
    const coercedValue = coerceUdfValue(udfDefinitionsByKey.get(key), value, key);
    if (coercedValue !== undefined) target[key] = coercedValue;
  });
};

const LINE_UDF_ALIASES = {
  saudaNodeRef: ['SaudaNodeRef', 'SaudaNodhRef', 'SaudaNode'],
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
  transactionType: ['TransactionType', 'TransType', 'DocumentType', 'DocType'],
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

const validatePayload = (payload) => {
  const { header = {}, lines = [] } = payload || {};
  if (!String(header.vendor || header.customerCode || '').trim()) throw new Error('Customer is required');
  if (!String(header.postingDate || '').trim()) throw new Error('Posting Date is required');
  if (!String(header.documentDate || '').trim()) throw new Error('Document Date is required');

  const populatedLines = lines.filter((line) =>
    String(line.description || line.glAccount || line.totalLC || line.unitPrice || '').trim()
  );
  if (!populatedLines.length) throw new Error('At least one service line is required');

  populatedLines.forEach((line, index) => {
    if (!String(line.description || '').trim()) throw new Error(`Description is required on line ${index + 1}`);
    if (!String(line.glAccount || '').trim()) throw new Error(`G/L Account is required on line ${index + 1}`);
    if (!String(line.taxCode || '').trim()) throw new Error(`Tax Code is required on line ${index + 1}`);
    if (parseNum(line.totalLC || line.unitPrice) <= 0) throw new Error(`Total (LC) is required on line ${index + 1}`);
  });

  return { header, lines: populatedLines };
};

const buildSapPayload = async (payload, includeSeries = true) => {
  const { header, lines } = validatePayload(payload);
  const [headerUdfDefinitionsByKey, lineUdfDefinitionsByKey] = await Promise.all([
    getUdfDefinitionsByKey('OINV'),
    getUdfDefinitionsByKey('INV1'),
  ]);

  const customerCode = String(header.vendor || header.customerCode || '').trim();
  const isManualSeries = ['manual', '-1'].includes(String(header.series ?? '').trim().toLowerCase());
  const manualDocNum = optNumber(header.docNo || header.nextNumber);
  const series = optNumber(header.series);
  const contactPersonCode = optNumber(header.contactPerson);
  const salesPersonCode = String(header.salesEmployee ?? '').trim() === '-1' ? undefined : optNumber(header.salesEmployee);
  const paymentGroupCode = optNumber(header.paymentTerms);

  if (includeSeries && isManualSeries && manualDocNum === undefined) {
    throw new Error('Document number is required when Series is Manual');
  }

  const resolvedSeries = includeSeries
    ? await resolveDocumentSeries(header, series, isManualSeries)
    : { series, branchId: normalizeBranchId(header.branch) };

  const sapPayload = {
    DocType: 'dDocument_Service',
    CardCode: customerCode,
    ...(includeSeries && isManualSeries ? { Series: -1, DocNum: manualDocNum } : {}),
    ...(includeSeries && !isManualSeries ? { Series: resolvedSeries.series } : {}),
    DocDate: header.postingDate || header.documentDate,
    DocDueDate: header.deliveryDate || header.postingDate || header.documentDate,
    TaxDate: header.documentDate || header.postingDate,
    ContactPersonCode: contactPersonCode,
    SalesPersonCode: salesPersonCode,
    BPLId: resolvedSeries.branchId,
    BPL_IDAssignedToInvoice: resolvedSeries.branchId,
    PaymentGroupCode: paymentGroupCode,
    NumAtCard: optString(header.salesContractNo || header.customerRefNo),
    Comments: optString(header.remarks || header.otherInstruction || header.comments),
    JournalMemo: optString(header.journalRemark),
    DiscountPercent: header.discount ? parseNum(header.discount) : undefined,
    Rounding: yesNo(header.rounding),
    DocumentLines: [],
  };

  const withholdingTaxData = buildWithholdingTaxData(payload.withholdingTaxRows);
  if (withholdingTaxData.length) {
    sapPayload.WithholdingTaxDataWTXCollection = withholdingTaxData;
  }

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
      DiscountPercent: parseNum(line.discountPercent),
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

const submitServiceARInvoice = async (payload) => {
  const sapPayload = await buildSapPayload(payload, true);
  const response = await sapService.request({
    method: 'post',
    url: '/Invoices',
    data: sapPayload,
  });

  return {
    message: 'Service A/R Invoice created successfully',
    doc_num: response.data?.DocNum,
    doc_entry: response.data?.DocEntry,
    DocNum: response.data?.DocNum,
    DocEntry: response.data?.DocEntry,
  };
};

const updateServiceARInvoice = async (docEntry, payload) => {
  const sapPayload = await buildSapPayload(payload, false);
  await sapService.request({
    method: 'patch',
    url: `/Invoices(${docEntry})`,
    data: sapPayload,
  });

  return {
    message: 'Service A/R Invoice updated successfully',
    doc_entry: docEntry,
  };
};

const getReferenceData = async (companyId, userId) => {
  try {
    if (companyId && userId) {
      try {
        const assignedCompany = await authDbService.getAssignedCompanyForUser(Number(userId), Number(companyId));
        const ctx = getRequestContext();
        if (ctx && assignedCompany && assignedCompany.DbName) {
          ctx.databaseName = String(assignedCompany.DbName).trim();
        }
      } catch (innerErr) {
        console.warn('[serviceArInvoiceService] could not resolve assigned company for user/company:', innerErr.message || innerErr);
      }
    }

    return await serviceArInvoiceDb.getReferenceData();
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails: serviceArInvoiceDb.getCustomerDetails,
  getCustomerFilterOptions: arInvoiceService.getCustomerFilterOptions,
  getDocumentSeries: serviceArInvoiceDb.getDocumentSeries,
  getNextNumber: serviceArInvoiceDb.getNextNumber,
  getServiceARInvoiceList: serviceArInvoiceDb.getServiceARInvoiceList,
  getServiceARInvoice: serviceArInvoiceDb.getServiceARInvoice,
  submitServiceARInvoice,
  updateServiceARInvoice,
  getOpenServiceSalesQuotations: async (customerCode) => ({ documents: await serviceArInvoiceDb.getOpenServiceSalesQuotations(customerCode) }),
  getOpenServiceSalesOrders: async (customerCode) => ({ documents: await serviceArInvoiceDb.getOpenServiceSalesOrders(customerCode) }),
  getOpenServiceDeliveries: async (customerCode) => ({ documents: await serviceArInvoiceDb.getOpenServiceDeliveries(customerCode) }),
  getServiceSalesQuotationForCopy: serviceArInvoiceDb.getServiceSalesQuotationForCopy,
  getServiceSalesOrderForCopy: serviceArInvoiceDb.getServiceSalesOrderForCopy,
  getServiceDeliveryForCopy: serviceArInvoiceDb.getServiceDeliveryForCopy,
};
