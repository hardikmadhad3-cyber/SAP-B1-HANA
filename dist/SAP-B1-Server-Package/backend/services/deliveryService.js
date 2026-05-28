const sapService = require('./sapService');
const deliveryDb = require('./deliveryDbService');
const salesOrderDb = require('./salesOrderDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');
const { getUdfDefinitions } = require('./udfMetadataService');
const { getActiveCompanyConfig } = require('./companyConfigService');

// ───────── HELPERS ─────────

const formatDateForSAP = (value) => {
  if (!value) return null;
  return String(value).split('T')[0];
};

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const normalizeBranchValue = (value) => {
  const normalized = String(value ?? '').trim();
  const lowered = normalized.toLowerCase();
  if (!normalized || lowered === '0' || lowered === '-1' || lowered === 'no branch' || lowered === 'select branch') {
    return '';
  }

  return normalized;
};

const normalizeBranchId = (branch) => {
  const normalized = normalizeBranchValue(branch);
  return normalized === '' ? -1 : Number(normalized);
};

const normalizeHeaderBranch = (header = {}) => ({
  ...(header || {}),
  branch: normalizeBranchValue(header?.branch),
});

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toRequiredNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toRequiredString = (value, fallback = '') => {
  const normalized = value == null ? '' : String(value).trim();
  return normalized || fallback;
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'y'].includes(String(value || '').trim().toLowerCase());
};

const isUdfValuePresent = (value) => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

const applyUdfs = (target, udfValues = {}, allowedKeys = null, fieldMetadata = null) => {
  Object.entries(udfValues || {}).forEach(([key, value]) => {
    if (!String(key || '').startsWith('U_') || !isUdfValuePresent(value)) return;
    if (allowedKeys && !allowedKeys.has(key)) return;

    if (fieldMetadata) {
      setValidatedDeliveryField(target, fieldMetadata, key, value);
      return;
    }

    target[key] = value;
  });
};

const getAllowedUdfKeys = async (tableId) => {
  const definitions = await getUdfDefinitions(tableId);
  return new Set(definitions.map((field) => field.key));
};

const resolveSalesEmployeeCode = (input, salesEmployees = []) => {
  if (!hasValue(input) || input === '-1' || input === -1) {
    return undefined;
  }

  if (!Number.isNaN(Number(input)) && Number(input) !== -1) {
    return Number(input);
  }

  const normalizedName = String(input || '').trim().toLowerCase();
  const match = salesEmployees.find((employee) => (
    String(employee.SlpName || '').trim().toLowerCase() === normalizedName
  ));

  return match ? Number(match.SlpCode) : undefined;
};

const buildSalesPersonPayload = (employee = {}) => {
  const name = toRequiredString(employee.SlpName || employee.salesEmployeeName || employee.name, '');
  if (!name) {
    const error = new Error('Sales Employee Name is required.');
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    SalesEmployeeName: name,
    Active: toBoolean(employee.Active ?? employee.active ?? true) ? 'tYES' : 'tNO',
  };

  if (hasValue(employee.Memo ?? employee.remarks)) {
    payload.Remarks = String(employee.Memo ?? employee.remarks).trim();
  }

  const commission = toOptionalNumber(employee.Commission ?? employee.commission);
  if (commission !== undefined) {
    payload.CommissionForSalesEmployee = commission;
  }

  return payload;
};

const NUMBER_DATA_TYPES = new Set([
  'bigint',
  'decimal',
  'float',
  'int',
  'money',
  'numeric',
  'real',
  'smallint',
  'smallmoney',
  'tinyint',
]);

const DATE_DATA_TYPES = new Set([
  'date',
  'datetime',
  'datetime2',
  'datetimeoffset',
  'smalldatetime',
  'time',
]);

const COUNTRY_ORIGIN_ALIASES = new Map([
  ['INDIA', 'IN'],
  ['IND', 'IN'],
  ['BHARAT', 'IN'],
  ['CHINA', 'CN'],
  ['JAPAN', 'JP'],
  ['GERMANY', 'DE'],
  ['UNITEDARABEMIRATES', 'AE'],
  ['UAE', 'AE'],
  ['UNITEDSTATES', 'US'],
  ['UNITEDSTATESOFAMERICA', 'US'],
  ['USA', 'US'],
  ['US', 'US'],
  ['UNITEDKINGDOM', 'UK'],
  ['GREATBRITAIN', 'UK'],
  ['BRITAIN', 'UK'],
  ['UK', 'UK'],
]);

const normalizeCountryOrgValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, '');

  if (COUNTRY_ORIGIN_ALIASES.has(compact)) return COUNTRY_ORIGIN_ALIASES.get(compact);
  if (/^[A-Z0-9]{1,3}$/.test(compact)) return compact;
  return '';
};

const DELIVERY_LINE_UDF_MAPPINGS = [
  { sapField: 'U_SPLRBT', getValue: (line) => line.specialRebate },
  { sapField: 'U_COMPRC', getValue: (line) => line.commission },
  { sapField: 'U_S_BrokPerQty', getValue: (line) => line.sellerBrokeragePerQty },
  { sapField: 'U_Unit_Price', getValue: (line) => line.unitPriceUdf ?? line.unitPrice },
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

const DELIVERY_LOOKUP_UDF_FIELDS = new Set([
  'U_Buyer_Quality',
  'U_Seller_Quality',
  'U_Buyer_Price',
  'U_Seller_Price',
]);

const coerceValueForSqlType = (value, sqlDataType) => {
  if (!hasValue(value)) return undefined;

  const normalizedType = String(sqlDataType || '').trim().toLowerCase();

  if (NUMBER_DATA_TYPES.has(normalizedType)) {
    return toOptionalNumber(value);
  }

  if (DATE_DATA_TYPES.has(normalizedType)) {
    return formatDateForSAP(value);
  }

  return String(value).trim();
};

const setValidatedDeliveryField = (target, fieldMetadata, fieldName, value) => {
  const sqlDataType = fieldMetadata?.[fieldName];
  if (!sqlDataType) return;

  const coercedValue = coerceValueForSqlType(value, sqlDataType);
  if (coercedValue !== undefined) {
    target[fieldName] = coercedValue;
  }
};

const normalizeLookupToken = (value) => String(value || '').trim().toLowerCase();

const buildDeliveryLookupResolvers = async () => {
  const entries = await Promise.all(
    [...DELIVERY_LOOKUP_UDF_FIELDS].map(async (fieldName) => [
      fieldName,
      await deliveryDb.getLookupValues(fieldName).catch(() => []),
    ])
  );

  return entries.reduce((acc, [fieldName, options]) => {
    const tokens = new Map();

    for (const option of options || []) {
      const value = String(option?.value || '').trim();
      const description = String(option?.description || '').trim();
      const label = String(option?.label || '').trim();
      if (!value) continue;

      [value, description, label].forEach((token) => {
        const normalizedToken = normalizeLookupToken(token);
        if (normalizedToken) {
          tokens.set(normalizedToken, value);
        }
      });
    }

    acc[fieldName] = {
      hasFixedValues: tokens.size > 0,
      tokens,
    };
    return acc;
  }, {});
};

const resolveDeliveryLookupValue = (fieldName, value, lookupResolvers = {}) => {
  if (!DELIVERY_LOOKUP_UDF_FIELDS.has(fieldName) || !hasValue(value)) {
    return value;
  }

  const resolver = lookupResolvers[fieldName];
  if (!resolver?.hasFixedValues) {
    return value;
  }

  const resolvedValue = resolver.tokens.get(normalizeLookupToken(value));
  if (resolvedValue) {
    return resolvedValue;
  }

  console.warn(`[Delivery] Ignoring invalid ${fieldName} lookup value "${value}" because it is not configured for Delivery.`);
  return undefined;
};

const buildDocumentLinePayload = async (line = {}, fieldMetadata = {}, includeLineNum = false, lookupResolvers = {}, allowedLineUdfs = null) => {
  const documentLine = {
    Quantity: toRequiredNumber(line.quantity, 0),
    WarehouseCode: toRequiredString(line.whse, ''),
    DiscountPercent: toRequiredNumber(line.stdDiscount, 0),
  };

  if (includeLineNum && line.lineNum != null && line.lineNum !== '') {
    documentLine.LineNum = Number(line.lineNum);
  }

  if (hasValue(line.baseEntry) && hasValue(line.baseType) && line.baseLine !== undefined && line.baseLine !== null && line.baseLine !== '') {
    documentLine.BaseEntry = Number(line.baseEntry);
    documentLine.BaseType = Number(line.baseType);
    documentLine.BaseLine = Number(line.baseLine);
  } else {
    documentLine.ItemCode = toRequiredString(line.itemNo, '');
    documentLine.Price = toRequiredNumber(line.unitPrice, 0);
  }

  const resolvedUomEntry = await deliveryDb.resolveDeliveryLineUomEntry(
    line.itemNo,
    line.uomEntry ?? line.UoMEntry ?? line.uomCode,
  );
  if (resolvedUomEntry !== null && resolvedUomEntry !== undefined) {
    documentLine.UoMEntry = resolvedUomEntry;
  } else if (hasValue(line.uomCode)) {
    documentLine.UoMCode = String(line.uomCode).trim();
  }

  if (hasValue(line.taxCode)) {
    documentLine.TaxCode = String(line.taxCode).trim();
  }

  if (hasValue(line.distRule)) {
    documentLine.CostingCode = String(line.distRule).trim();
  }

  if (hasValue(line.freeText)) {
    documentLine.FreeText = String(line.freeText).trim();
  }

  const sacEntry = toOptionalNumber(line.sacCode);
  if (sacEntry !== undefined && fieldMetadata?.SACEntry) {
    documentLine.SACEntry = sacEntry;
  }

  const countryOrg = normalizeCountryOrgValue(line.countryOfOrigin);
  if (hasValue(line.countryOfOrigin) && !countryOrg) {
    console.warn(`[Delivery Service] Skipping CountryOrg value because it is not a valid SAP country code: ${line.countryOfOrigin}`);
  }
  setValidatedDeliveryField(documentLine, fieldMetadata, 'CountryOrg', countryOrg);

  for (const mapping of DELIVERY_LINE_UDF_MAPPINGS) {
    const value = resolveDeliveryLookupValue(
      mapping.sapField,
      mapping.getValue(line),
      lookupResolvers,
    );
    setValidatedDeliveryField(documentLine, fieldMetadata, mapping.sapField, value);
  }

  const normalizedLineUdfs = Object.entries(line.udf || {}).reduce((acc, [key, value]) => {
    acc[key] = resolveDeliveryLookupValue(key, value, lookupResolvers);
    return acc;
  }, {});
  applyUdfs(documentLine, normalizedLineUdfs, allowedLineUdfs, fieldMetadata);

  if (line.batches && line.batches.length > 0) {
    documentLine.BatchNumbers = line.batches.map((batch) => ({
      BatchNumber: batch.batchNumber,
      Quantity: Number(batch.quantity),
    }));
  }

  return documentLine;
};

const buildDocumentLinesPayload = async (lines = [], includeLineNum = false) => {
  const [dln1FieldMetadata, lookupResolvers, allowedLineUdfs] = await Promise.all([
    deliveryDb.getDeliveryLineFieldMetadata(),
    buildDeliveryLookupResolvers(),
    getAllowedUdfKeys('DLN1'),
  ]);

  const sourceLines = (lines || []).filter((line) => hasValue(line.itemNo));
  return Promise.all(
    sourceLines.map((line) => buildDocumentLinePayload(line, dln1FieldMetadata, includeLineNum, lookupResolvers, allowedLineUdfs))
  );
};

// ───────── REFERENCE DATA (USING ODBC) ─────────

const getReferenceData = async (companyId) => {
  try {
    const [data, companyConfig] = await Promise.all([
      deliveryDb.getReferenceData(),
      getActiveCompanyConfig(),
    ]);
    const toVendorCode = String(
      companyConfig?.documentDefaults?.salesOrderToVendorCode || '',
    ).trim();

    return {
      ...data,
      defaults: {
        ...(data.defaults || {}),
        toVendorCode,
      },
    };
  } catch (error) {
    return {
      company: '',
      company_state: '',
      vendors: [],
      customers: [],
      items: [],
      warehouses: [],
      warehouse_addresses: [],
      payment_terms: [],
      shipping_types: [],
      branches: [],
      distribution_rules: [],
      tax_codes: [],
      uom_groups: [],
      quality_options: { buyer: [], seller: [] },
      price_options: { buyer: [], seller: [] },
      contacts: [],
      pay_to_addresses: [],
      company_address: {},
      defaults: {
        toVendorCode: '',
      },
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

// ───────── CUSTOMER DETAILS (USING ODBC) ─────────

const getCustomerDetails = async (customerCode) => {
  try {
    const result = await deliveryDb.getCustomerDetails(customerCode);
    return result;
  } catch (error) {
    return {
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
      bill_to_addresses: [],
    };
  }
};

// ───────── DELIVERY LIST (USING ODBC) ─────────

const saveSalesEmployeesSetup = async (employees = []) => {
  if (!Array.isArray(employees)) {
    const error = new Error('Sales employee setup rows must be an array.');
    error.statusCode = 400;
    throw error;
  }

  const saved = [];
  const existingSalesEmployees = await deliveryDb.getSalesEmployees().catch(() => []);
  let nextSalesEmployeeCode = existingSalesEmployees.reduce((maxCode, employee) => {
    const code = toOptionalNumber(employee.SlpCode);
    return code !== undefined && code > maxCode ? code : maxCode;
  }, 0) + 1;

  for (const employee of employees) {
    if (String(employee?.SlpCode) === '-1') {
      continue;
    }

    const name = String(employee?.SlpName || employee?.salesEmployeeName || employee?.name || '').trim();
    if (!name) {
      continue;
    }

    const payload = buildSalesPersonPayload({ ...employee, SlpName: name });
    const slpCode = toOptionalNumber(employee.SlpCode);

    if (slpCode !== undefined && slpCode !== -1) {
      if (!toBoolean(employee.Changed ?? employee.changed ?? false)) {
        continue;
      }

      await sapService.request({
        method: 'PATCH',
        url: `/SalesPersons(${slpCode})`,
        data: payload,
      });

      saved.push({ SlpCode: slpCode, SlpName: name, updated: true });
      continue;
    }

    const newSalesEmployeeCode = nextSalesEmployeeCode;
    nextSalesEmployeeCode += 1;
    payload.SalesEmployeeCode = newSalesEmployeeCode;

    let response;
    try {
      response = await sapService.request({
        method: 'POST',
        url: '/SalesPersons',
        data: payload,
      });
    } catch (error) {
      const minimalPayload = {
        SalesEmployeeCode: newSalesEmployeeCode,
        SalesEmployeeName: payload.SalesEmployeeName,
        Active: payload.Active,
      };

      response = await sapService.request({
        method: 'POST',
        url: '/SalesPersons',
        data: minimalPayload,
      });
    }

    saved.push({
      SlpCode: response.data?.SalesEmployeeCode ?? newSalesEmployeeCode,
      SlpName: name,
      created: true,
    });
  }

  return {
    success: true,
    message: 'Sales employees setup saved.',
    sales_employees: await deliveryDb.getSalesEmployees(),
    saved,
  };
};

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

const getDeliveryList = async ({
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
    const result = await deliveryDb.getDeliveryList({
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
    return {
      deliveries: [],
      pagination: {
        page: Math.max(1, Number(page) || 1),
        pageSize: Math.min(200, Math.max(1, Number(pageSize) || 25)),
        totalCount: 0,
        totalPages: 1,
      },
    };
  }
};

// ───────── GET SINGLE DELIVERY (USING ODBC) ─────────

const getDelivery = async (docEntry) => {
  try {
    const result = await deliveryDb.getDelivery(docEntry);
    return result;
  } catch (error) {
    throw new Error(`Failed to load Delivery: ${error.message}`);
  }
};

// ───────── DOCUMENT SERIES (USING ODBC) ─────────

const getDocumentSeries = async (targetDate = null) => {
  try {
    const result = await deliveryDb.getDocumentSeries(targetDate);
    return result;
  } catch (error) {
    return { series: [] };
  }
};

const getNextNumber = async (series) => {
  try {
    const result = await deliveryDb.getNextNumber(series);
    return result;
  } catch (error) {
    return { nextNumber: null };
  }
};

// ───────── STATE FROM WAREHOUSE (USING ODBC) ─────────

const getStateFromWarehouse = async (whsCode) => {
  try {
    const result = await deliveryDb.getStateFromWarehouse(whsCode);
    return result;
  } catch (error) {
    return { state: '' };
  }
};

// ───────── OPEN SALES ORDERS (USING ODBC) ─────────

const getOpenSalesOrders = async (customerCode = null) => {
  try {
    const result = await deliveryDb.getOpenSalesOrders(customerCode);
    return result;
  } catch (error) {
    return { orders: [] };
  }
};

const getSalesOrderForCopy = async (docEntry) => {
  try {
    const result = await deliveryDb.getSalesOrderForCopy(docEntry);
    return result;
  } catch (error) {
    throw new Error(`Failed to load Sales Order: ${error.message}`);
  }
};

// ───────── GET DELIVERY FOR COPY TO CREDIT MEMO ─────────

const getDeliveryForCopyToCreditMemo = async (docEntry) => {
  try {
    const result = await deliveryDb.getDeliveryForCopyToCreditMemo(docEntry);
    return result;
  } catch (error) {
    throw new Error(`Failed to load Delivery for copy: ${error.message}`);
  }
};

// ───────── BATCHES (USING ODBC) ─────────

const getBatchesByItem = async (itemCode, whsCode) => {
  try {
    const result = await deliveryDb.getBatchesByItem(itemCode, whsCode);
    return result;
  } catch (error) {
    return { batches: [] };
  }
};

// ───────── SUBMIT DELIVERY (USING SERVICE LAYER) ─────────

const submitDelivery = async (payload) => {
  try {
    const { company_id, lines, header_udfs } = payload;
    const header = normalizeHeaderBranch(payload.header);
    const customerCode =
      String(
        header.customerCode ||
        header.customer ||
        header.vendor ||
        ''
      ).trim();
console.log("Payload:", payload );
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
    const [documentLines, allowedHeaderUdfs] = await Promise.all([
      buildDocumentLinesPayload(lines),
      getAllowedUdfKeys('ODLN'),
    ]);
    const salesEmployees = await deliveryDb.getSalesEmployees();
    const salesPersonCode = resolveSalesEmployeeCode(
      header.salesEmployee ?? header.purchaser,
      salesEmployees,
    );
    // Build SAP Service Layer payload
    const sapPayload = {
      CardCode: customerCode,
      DocDate: formatDateForSAP(header.postingDate),
      DocDueDate: formatDateForSAP(header.deliveryDate || header.postingDate),
      TaxDate: formatDateForSAP(header.documentDate),
      Comments: header.otherInstruction || '',
      JournalMemo: header.journalRemark || '',
      NumAtCard: header.salesContractNo || '',
      DiscountPercent: header.discount ? parseFloat(header.discount) : 0,
      DocumentAdditionalExpenses: documentAdditionalExpenses,
      DocumentLines: documentLines,
    };
console.log("SAP Payload:", sapPayload);
    // Add optional fields - only include Series if explicitly provided and valid
    if (header.series && Number(header.series) > 0) {
      sapPayload.Series = parseInt(header.series);
    }
    sapPayload.BPLId = normalizeBranchId(header.branch);
    sapPayload.BPL_IDAssignedToInvoice = normalizeBranchId(header.branch);
    if (header.paymentTerms) sapPayload.PaymentGroupCode = parseInt(header.paymentTerms);
    if (header.freight) sapPayload.TotalExpenses = parseFloat(header.freight);
    sapPayload.Rounding = toBoolean(header.rounding) ? 'tYES' : 'tNO';
    if (salesPersonCode !== undefined) sapPayload.SalesPersonCode = salesPersonCode;

    applyUdfs(sapPayload, header_udfs, allowedHeaderUdfs);

    console.log('[Delivery] Submit payload:', JSON.stringify(sapPayload, null, 2));

    // Post to SAP Service Layer
    const response = await sapService.request({
      method: 'POST',
      url: '/DeliveryNotes',
      data: sapPayload,
    });

    console.log('[Delivery] Submit response:', JSON.stringify(response.data, null, 2));

    const savedDocEntry = response.data.DocEntry;
    try {
      const savedLines = await deliveryDb.getSavedDeliveryQuantities(savedDocEntry);
      const requestedLines = lines
        .filter(l => String(l.itemNo || '').trim())
        .map((line, index) => ({
          lineNum: index,
          itemCode: line.itemNo || '',
          requestedQty: parseFloat(line.quantity) || 0,
          requestedBatchQty: Array.isArray(line.batches)
            ? line.batches.reduce((sum, batch) => sum + (parseFloat(batch.quantity) || 0), 0)
            : 0,
          uomCode: line.uomCode || '',
          warehouse: line.whse || '',
        }));

      const savedSummary = savedLines.map((savedLine) => {
        const requestedLine = requestedLines.find(
          (line) => line.lineNum === savedLine.lineNum || line.itemCode === savedLine.itemCode
        );

        return {
          lineNum: savedLine.lineNum,
          itemCode: savedLine.itemCode,
          warehouse: savedLine.warehouse,
          uomCode: savedLine.uomCode,
          requestedQty: requestedLine?.requestedQty ?? null,
          savedQty: savedLine.quantity,
          savedOpenQty: savedLine.openQty,
          requestedBatchQty: requestedLine?.requestedBatchQty ?? null,
          savedBatchQty: savedLine.batchQuantity,
        };
      });

      console.log(
        `[Delivery] Saved quantity check for DocEntry ${savedDocEntry}:`,
        JSON.stringify(savedSummary, null, 2)
      );
    } catch (logError) {
      console.warn(
        `[Delivery] Could not read saved quantities for DocEntry ${savedDocEntry}: ${logError.message}`
      );
    }

    return {
      success: true,
      message: 'Delivery created successfully.',
      doc_entry: response.data.DocEntry,
      doc_num: response.data.DocNum,
    };
  } catch (error) {
    console.error('[Delivery] Submit failed:', error.message);
    if (error.response?.data) {
      console.error('[Delivery] SAP error response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};

// ───────── UPDATE DELIVERY (USING SERVICE LAYER) ─────────

const updateDelivery = async (docEntry, payload) => {
  try {
    const { lines, header_udfs } = payload;
    const header = normalizeHeaderBranch(payload.header);
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
    const [documentLines, allowedHeaderUdfs] = await Promise.all([
      buildDocumentLinesPayload(lines, true),
      getAllowedUdfKeys('ODLN'),
    ]);
    const salesEmployees = await deliveryDb.getSalesEmployees();
    const salesPersonCode = resolveSalesEmployeeCode(
      header.salesEmployee ?? header.purchaser,
      salesEmployees,
    );

    const sapPayload = {
      Comments: header.otherInstruction || '',
      JournalMemo: header.journalRemark || '',
      DiscountPercent: header.discount ? parseFloat(header.discount) : 0,
      DocumentAdditionalExpenses: documentAdditionalExpenses,
      DocumentLines: documentLines,
    };

    if (header.freight) sapPayload.TotalExpenses = parseFloat(header.freight);
    sapPayload.Rounding = toBoolean(header.rounding) ? 'tYES' : 'tNO';
    if (salesPersonCode !== undefined) sapPayload.SalesPersonCode = salesPersonCode;

    applyUdfs(sapPayload, header_udfs, allowedHeaderUdfs);

    await sapService.request({
      method: 'PATCH',
      url: `/DeliveryNotes(${docEntry})`,
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Delivery updated successfully.',
      doc_entry: docEntry,
    };
  } catch (error) {
    throw error;
  }
};

const getFreightCharges = async (docEntry) => {
  try {
    const freightCharges = await deliveryDb.getFreightCharges(docEntry);
    return { freightCharges };
  } catch (error) {
    console.error('[Delivery Service] Failed to get freight charges:', error);
    return { freightCharges: [] };
  }
};

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

  const option = await deliveryDb.createLookupValue(aliasId, value, description);
  const options = await deliveryDb.getLookupValues(aliasId);

  return { option, options };
};

const getItemsForModal = async (whsCode = '') => {
  try {
    const items = await deliveryDb.getItemsForModal(whsCode);
    return { items };
  } catch (error) {
    console.error('[Delivery Service] Failed to get items for modal:', error);
    return { items: [] };
  }
};

const getUomConversionFactor = async (itemCode, uomCode) => {
  try {
    const result = await deliveryDb.getUomConversionFactor(itemCode, uomCode);
    return result;
  } catch (error) {
    console.error('[Delivery Service] Failed to get UoM conversion factor:', error);
    return {
      inventoryUOM: '',
      uomCode: uomCode,
      baseQty: 1,
      altQty: 1,
      factor: 1
    };
  }
};

// // ───────── EXPORTS ─────────

// module.exports = {
//   getReferenceData,
//   getCustomerDetails,
//   getDeliveryList,
//   getDelivery,
//   submitDelivery,
//   updateDelivery,
//   getDocumentSeries,
//   getNextNumber,
//   getStateFromWarehouse,
//   getOpenSalesOrders,
//   getSalesOrderForCopy,
//   getBatchesByItem,
//   getFreightCharges,
//   validateDeliveryDocument,
// };

// ─── Validation Service Functions ───────────────────────────────────────────────

const validateDeliveryDocument = async (payload) => {
  const header = normalizeHeaderBranch(payload.header);
  const { lines } = payload;
  const errors = [];
  
  // 1. Mandatory fields validation
  if (!header.customerCode) {
    errors.push('Customer Code is required');
  }
  if (!header.postingDate) {
    errors.push('Posting Date is required');
  }
  if (!header.documentDate) {
    errors.push('Document Date is required');
  }
  if (!lines || lines.length === 0) {
    errors.push('At least one document line is required');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  // 2. Branch validation is optional for databases without branch setup.
  if (hasValue(header.branch)) {
    const branchResult = await deliveryDb.validateBranch(header.branch);
    if (!branchResult.isValid) {
      errors.push(...branchResult.errors);
    }
  }
  
  // 3. Series validation
  const seriesResult = await deliveryDb.validateSeries(header.series, header.branch);
  if (!seriesResult.isValid) {
    errors.push(...seriesResult.errors);
  }
  
  // 4. Warehouse-Branch validation for all lines
  for (const line of lines) {
    if (line.whse && header.branch) {
      const whResult = await deliveryDb.validateWarehouseBranch(line.whse, header.branch);
      if (!whResult.isValid) {
        errors.push(...whResult.errors);
      }
    }
  }
  
  // 5. Tax code validation
  const taxResult = deliveryDb.validateTaxCodes(lines);
  if (!taxResult.isValid) {
    errors.push(...taxResult.errors);
  }
  
  // 6. Stock validation
  const stockResult = await deliveryDb.validateStockAvailability(lines);
  if (!stockResult.isValid) {
    errors.push(...stockResult.errors);
  }
  
  // 7. Batch validation
  const batchResult = await deliveryDb.validateBatchSelection(lines);
  if (!batchResult.isValid) {
    errors.push(...batchResult.errors);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  saveSalesEmployeesSetup,
  getCustomerFilterOptions,
  getDeliveryList,
  getDelivery,
  getDocumentSeries,
  getNextNumber,
  getStateFromWarehouse,
  getOpenSalesOrders,
  getSalesOrderForCopy,
  getDeliveryForCopyToCreditMemo,
  getBatchesByItem,
  getItemsForModal,
  getUomConversionFactor,
  getFreightCharges,
  createLookupValue,
  validateDeliveryDocument,
  submitDelivery,
  updateDelivery,
};
