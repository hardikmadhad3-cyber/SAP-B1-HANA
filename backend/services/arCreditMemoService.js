const sapService = require('./sapService');
const arCreditMemoDb = require('./arCreditMemoDbService');
const salesOrderDb = require('./salesOrderDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');
const { buildMarketingDocumentAddressPayload } = require('./documentAddressPayloadUtils');
const { getUdfDefinitions } = require('./udfMetadataService');
const { applyUdfValues } = require('./udfPayloadUtils');

const normalizeBranchId = (branch) => {
  const normalized = String(branch || '').trim();
  const branchId = Number(normalized);
  return Number.isInteger(branchId) && branchId > 0 ? branchId : undefined;
};

const getSapErrorMessage = (error, fallback = '') => {
  if (error?.response?.data?.error?.message?.value) return error.response.data.error.message.value;
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  return error?.message || fallback;
};

const isNumberingSeriesError = (error) => String(getSapErrorMessage(error)).includes('10000521');
const isManualSeriesSelection = (series) => String(series || '').trim().toLowerCase() === '__sap_manual__';

const resolveARCreditMemoSeries = async (header = {}, lines = [], options = {}) => {
  const selectedSeries = Number(header.series);
  const preferSubmittedSeries = options.preferSubmittedSeries !== false;
  let requestedBranchId = normalizeBranchId(header.branch);

  if (!requestedBranchId) {
    const firstLine = Array.isArray(lines) ? lines[0] || {} : {};
    const warehouseCode = String(
      header.warehouse || firstLine.whse || firstLine.warehouse || firstLine.WarehouseCode || '',
    ).trim();
    if (warehouseCode) {
      const warehouseBranch = await arCreditMemoDb.getWarehouseBranch(warehouseCode);
      requestedBranchId = normalizeBranchId(warehouseBranch?.branchId);
    }
  }

  if (isManualSeriesSelection(header.series)) {
    return {
      series: undefined,
      branchId: requestedBranchId,
    };
  }

  try {
    const seriesRows = await arCreditMemoDb.getDocumentSeries(
      header.postingDate || header.documentDate || null,
      header.transactionType || 'GST Tax Invoice',
      requestedBranchId || '',
    );

    if (!Array.isArray(seriesRows) || !seriesRows.length) {
      return {
        series: Number.isFinite(selectedSeries) && selectedSeries > 0 ? selectedSeries : undefined,
        branchId: requestedBranchId,
      };
    }

    const selectedRow = preferSubmittedSeries && Number.isFinite(selectedSeries) && selectedSeries > 0
      ? seriesRows.find((row) => Number(row.Series) === selectedSeries)
      : null;
    const defaultRow = seriesRows.find((row) => row.IsDefault) || seriesRows[0];
    const resolvedRow = selectedRow || defaultRow;
    const resolved = Number(resolvedRow?.Series);
    const seriesBranchId = normalizeBranchId(resolvedRow?.BPLId);

    if (requestedBranchId && seriesBranchId && requestedBranchId !== seriesBranchId) {
      const mismatchError = new Error('The selected A/R Credit Memo numbering series belongs to a different branch. Select a matching series or branch.');
      mismatchError.code = 'AR_CREDIT_MEMO_SERIES_BRANCH_MISMATCH';
      throw mismatchError;
    }

    return {
      series: Number.isFinite(resolved) && resolved > 0 ? resolved : undefined,
      branchId: requestedBranchId || seriesBranchId,
    };
  } catch (error) {
    if (error.code === 'AR_CREDIT_MEMO_SERIES_BRANCH_MISMATCH') throw error;
    console.warn('[ARCreditMemoService] Could not validate credit memo series; using submitted value.', error.message);
    return {
      series: Number.isFinite(selectedSeries) && selectedSeries > 0 ? selectedSeries : undefined,
      branchId: requestedBranchId,
    };
  }
};

const getAllowedUdfKeys = async (tableId) => {
  const definitions = await getUdfDefinitions(tableId);
  return new Set(definitions.map((field) => field.key));
};

const getUdfDefinitionsByKey = async (tableId) => {
  const definitions = await getUdfDefinitions(tableId);
  return new Map(definitions.map((field) => [field.key, field]));
};

const hasValue = (value) => (
  value !== undefined &&
  value !== null &&
  !(typeof value === 'string' && value.trim() === '')
);

const firstPresent = (...values) => values.find(hasValue);

const yesNo = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['y', 'yes', 'true', '1', 'tyes'].includes(normalized) ? 'tYES' : 'tNO';
};

const AR_CREDIT_MEMO_LINE_UDF_MAPPINGS = [
  { aliases: ['U_Cost_Sheet'], getValue: (line) => line.udf?.U_Cost_Sheet ?? line.U_Cost_Sheet ?? line.costSheet },
  { aliases: ['U_PackingType', 'U_PACKINGTYPE', 'U_Packing_Type', 'U_PackingStatus'], getValue: (line) => line.udf?.U_PackingType ?? line.udf?.U_PACKINGTYPE ?? line.U_PackingType ?? line.packingType },
  { aliases: ['U_ContainerType', 'U_CONTAINERTYPE', 'U_Container_Type'], getValue: (line) => line.udf?.U_ContainerType ?? line.U_ContainerType ?? line.containerType },
  { aliases: ['U_GrossWt', 'U_GROSSWT', 'U_Gross_Wt'], getValue: (line) => line.udf?.U_GrossWt ?? line.U_GrossWt ?? line.grossWt },
  { aliases: ['U_TotalPackage', 'U_TOTALPACKAGE', 'U_Total_Package'], getValue: (line) => line.udf?.U_TotalPackage ?? line.U_TotalPackage ?? line.totalPackage },
  { aliases: ['U_TAXCODE', 'U_TaxCode'], getValue: (line) => firstPresent(line.taxCodeRepeat, line.udf?.U_TAXCODE, line.udf?.U_TaxCode, line.taxCode) },
  { aliases: ['U_PRICE', 'U_Price'], getValue: (line) => firstPresent(line.price, line.udf?.U_PRICE, line.udf?.U_Price) },
  { aliases: ['U_SPLRBT', 'U_SpecialRebate'], getValue: (line) => line.specialRebate },
  { aliases: ['U_COMPRC', 'U_Commision', 'U_Commission'], getValue: (line) => line.commission },
  { aliases: ['U_S_BrokPerQty', 'U_S_BROKPERQTY'], getValue: (line) => line.sellerBrokeragePerQty },
  { aliases: ['U_Brok_Seller', 'U_BROK_SELLER'], getValue: (line) => line.sellerBrokerage },
  { aliases: ['U_Brok_Buyer', 'U_BROK_BUYER'], getValue: (line) => line.buyerBrokerage },
  { aliases: ['U_Buyer_Delivery', 'U_BUYER_DELIVERY'], getValue: (line) => line.buyerDelivery },
  { aliases: ['U_Seller_Delivery', 'U_SELLER_DELIVERY'], getValue: (line) => line.sellerDelivery },
  { aliases: ['U_Buyer_Payment_Terms', 'U_BUYER_PAYMENT_TERMS'], getValue: (line) => line.buyerPaymentTerms },
  { aliases: ['U_Seller_Payment_Term', 'U_Seller_Payment_Terms', 'U_SELLER_PAYMENT_TERM', 'U_SELLER_PAYMENT_TERMS'], getValue: (line) => firstPresent(line.sellerPaymentTermsRepeat, line.sellerPaymentTerms) },
  { aliases: ['U_Buyer_Quality', 'U_BUYER_QUALITY'], getValue: (line) => line.buyerQuality },
  { aliases: ['U_Seller_Quality', 'U_SELLER_QUALITY'], getValue: (line) => line.sellerQuality },
  { aliases: ['U_Buyer_Price', 'U_BUYER_PRICE'], getValue: (line) => line.buyerPrice },
  { aliases: ['U_Seller_Price', 'U_SELLER_PRICE'], getValue: (line) => line.sellerPrice },
  { aliases: ['U_Buyer_SPINS', 'U_BUYER_SPINS'], getValue: (line) => line.buyerSpecialInstruction },
  { aliases: ['U_Seller_SPINS', 'U_SELLER_SPINS'], getValue: (line) => line.sellerSpecialInstruction },
  { aliases: ['U_Sel_Brok_AP', 'U_SEL_BROK_AP'], getValue: (line) => firstPresent(line.sellerBrokerageAmountPer, line.sellerBrokerageAmtPer) },
  { aliases: ['U_Seller_Brok_Per', 'U_SELLER_BROK_PER'], getValue: (line) => firstPresent(line.sellerBrokeragePercentage, line.sellerBrokeragePercent) },
  { aliases: ['U_SELLTCODE', 'U_STCODE'], getValue: (line) => line.stcode },
  { aliases: ['U_S_Item', 'U_S_ITEM'], getValue: (line) => line.sellerItem },
  { aliases: ['U_S_Qty', 'U_S_QTY'], getValue: (line) => line.sellerQty },
  { aliases: ['U_Fix_Brock_B', 'U_Fix_Brok_B', 'U_FIX_BROK_BUYER'], getValue: (line) => firstPresent(line.fixBrokBuyer, line.udf?.U_Fix_Brock_B, line.U_Fix_Brock_B) },
  { aliases: ['U_Fix_Brock_S', 'U_Fix_Brok_S', 'U_Fix_Brock_Seller'], getValue: (line) => firstPresent(line.fixBrockSeller, line.udf?.U_Fix_Brock_S, line.U_Fix_Brock_S) },
];

const setAllowedLineUdf = (target, allowedLineUdfs, aliases, value) => {
  if (!hasValue(value)) return;
  const key = aliases.find((alias) => allowedLineUdfs.has(alias));
  if (key) target[key] = value;
};

const buildLineUdfPayload = (line = {}, allowedLineUdfs = new Set()) => {
  const udfs = { ...(line.udf || {}) };
  AR_CREDIT_MEMO_LINE_UDF_MAPPINGS.forEach((mapping) => {
    setAllowedLineUdf(udfs, allowedLineUdfs, mapping.aliases, mapping.getValue(line));
  });
  return udfs;
};

// ───────── REFERENCE DATA (USING ODBC) ─────────

const getReferenceData = async (companyId) => {
  try {
    // Use ODBC/Direct SQL for GET operations
    const data = await arCreditMemoDb.getReferenceData();
    if (data.customers && !data.vendors) {
      data.vendors = data.customers;
      delete data.customers;
    
    }
    return data;
  } catch (error) {
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
      gl_accounts: [],
      distribution_rules: [],
      tax_codes: [],
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
    const data = await arCreditMemoDb.getCustomerDetails(customerCode);
    return data;
  } catch (error) {
    console.error('[AR Credit Memo Service] Failed to load customer details:', error);
    throw error;
  }
};

// ───────── AR CREDIT MEMO LIST (USING ODBC) ─────────

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

const getARCreditMemoList = async ({
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
    const result = await arCreditMemoDb.getARCreditMemoList({
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
      ar_credit_memos: [],
      pagination: {
        page: Math.max(1, Number(page) || 1),
        pageSize: Math.min(200, Math.max(1, Number(pageSize) || 25)),
        totalCount: 0,
        totalPages: 1,
      },
    };
  }
};

const getOpenARCreditMemoDocuments = async () => {
  try {
    const result = await arCreditMemoDb.getARCreditMemoList({
      openOnly: true,
      page: 1,
      pageSize: 100,
    });

    return {
      creditMemos: (result.ar_credit_memos || []).map((row) => ({
        DocEntry: row.doc_entry,
        DocNum: row.doc_num,
        CardCode: row.customer_code,
        CardName: row.customer_name,
        DocDate: row.posting_date,
        DocDueDate: row.delivery_date,
        DocTotal: row.total_amount,
        DocumentStatus: row.status,
      })),
    };
  } catch (_error) {
    return { creditMemos: [] };
  }
};

// ───────── GET SINGLE CREDIT MEMO (USING ODBC) ─────────

const getARCreditMemo = async (docEntry) => {
  try {
    // Use ODBC for reading single credit memo
    const result = await arCreditMemoDb.getARCreditMemo(docEntry);
    return result;
  } catch (error) {
   throw error;
  }
};

// ───────── CREATE CREDIT MEMO (USING SERVICE LAYER) ─────────

const submitARCreditMemo = async (payload) => {
  let lastSapPayload = null;

  try {
    console.log("🔥 [ARCreditMemoService] RECEIVED AR CREDIT MEMO PAYLOAD:", JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.header) {
      throw new Error('Header is required');
    }
    
    console.log("🔍 [ARCreditMemoService] Header vendor:", payload.header.vendor);
    console.log("🔍 [ARCreditMemoService] Header customerCode:", payload.header.customerCode);
    
    // Use vendor or customerCode (frontend sends vendor)
    const customerCode = payload.header.vendor || payload.header.customerCode || payload.header.customer;
    
    if (!customerCode) {
      throw new Error('Customer code is required');
    }
    
    console.log("🔍 [ARCreditMemoService] Using customer code:", customerCode);
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
    const resolvedSeries = await resolveARCreditMemoSeries(payload.header, payload.lines);
    const [allowedHeaderUdfs, allowedLineUdfs, headerUdfDefinitionsByKey] = await Promise.all([
      getAllowedUdfKeys('ORIN'),
      getAllowedUdfKeys('RIN1'),
      getUdfDefinitionsByKey('ORIN'),
    ]);

    // Transform payload to SAP format
    const sapPayload = {
      CardCode: String(customerCode).trim(),

      // Series for auto-numbering - only include if explicitly provided and valid
      ...(resolvedSeries.series ? { Series: resolvedSeries.series } : {}),

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
      ...(resolvedSeries.branchId ? {
        BPLId: resolvedSeries.branchId,
        BPL_IDAssignedToInvoice: resolvedSeries.branchId,
      } : {}),

      PaymentGroupCode: payload.header.paymentTerms ? Number(payload.header.paymentTerms) : undefined,

      // Customer reference
      NumAtCard: payload.header.salesContractNo || payload.header.customerRefNo || undefined,

      // Comments
      Comments: payload.header.otherInstruction || payload.header.comments || undefined,
      DocumentAdditionalExpenses: documentAdditionalExpenses,
      Rounding: yesNo(payload.header.rounding),
      ...buildMarketingDocumentAddressPayload(payload.header),

      DocumentLines: payload.lines.map((l, index) => {
        console.log(`🔍 [ARCreditMemoService] Processing line ${index}:`, l);
        
        const line = {
          ItemCode: l.itemNo,
          Quantity: Number(l.quantity),
          UnitPrice: Number(l.unitPrice),
          WarehouseCode: l.whse || l.warehouse || "01",
          TaxCode: l.taxCode || undefined,
          MeasureUnit: l.uomCode || undefined,
          WTLiable: yesNo(l.wTaxLiable ?? l.wtaxLiable),
          AccountCode: l.glAccount || undefined,
          CostingCode: l.distRule || undefined,
          COGSCostingCode: l.cogsDistRule || l.distRule || undefined,
          CountryOrg: l.countryOfOrigin || undefined,
        };

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

        console.log(`🔍 [ARCreditMemoService] Transformed line ${index}:`, line);
        applyUdfValues(line, buildLineUdfPayload(l, allowedLineUdfs), allowedLineUdfs);
        return line;
      })
    };
    lastSapPayload = sapPayload;

    console.log("🔥 [ARCreditMemoService] SAP AR CREDIT MEMO PAYLOAD:", JSON.stringify(sapPayload, null, 2));

    applyUdfValues(sapPayload, payload.header_udfs, allowedHeaderUdfs, headerUdfDefinitionsByKey);

    let response;
    try {
      response = await sapService.request({
        method: 'post',
        url: '/CreditNotes',
        data: sapPayload,
      });
    } catch (postError) {
      if (!isNumberingSeriesError(postError)) throw postError;

      const fallbackSeries = await resolveARCreditMemoSeries(
        { ...payload.header, series: '' },
        payload.lines,
        { preferSubmittedSeries: false },
      );

      if (!fallbackSeries.series || fallbackSeries.series === sapPayload.Series) throw postError;

      sapPayload.Series = fallbackSeries.series;
      if (fallbackSeries.branchId) {
        sapPayload.BPLId = fallbackSeries.branchId;
        sapPayload.BPL_IDAssignedToInvoice = fallbackSeries.branchId;
      } else {
        delete sapPayload.BPLId;
        delete sapPayload.BPL_IDAssignedToInvoice;
      }
      lastSapPayload = sapPayload;
      console.warn(
        '[ARCreditMemoService] Retrying A/R Credit Memo with default numbering series after SAP rejected submitted series.',
        { series: sapPayload.Series, branchId: sapPayload.BPLId || '' },
      );
      response = await sapService.request({
        method: 'post',
        url: '/CreditNotes',
        data: sapPayload,
      });
    }

    console.log("✅ [ARCreditMemoService] SAP AR CREDIT MEMO RESPONSE:", JSON.stringify(response.data, null, 2));

    return {
      message: 'AR Credit Memo created successfully',
      doc_num: response.data?.DocNum,
      doc_entry: response.data?.DocEntry,
      DocNum: response.data?.DocNum,
      DocEntry: response.data?.DocEntry,
    };
  } catch (error) {
    console.error('❌ [ARCreditMemoService] Failed to create AR credit memo:', error);
    console.error('❌ [ARCreditMemoService] Error details:', error.response?.data);
    console.error('❌ [ARCreditMemoService] Error stack:', error.stack);

    // Extract meaningful error message from SAP
    let errorMessage = 'AR Credit Memo submission failed.';
    errorMessage = getSapErrorMessage(error, errorMessage);

    if (String(errorMessage).includes('10000521') && lastSapPayload) {
      const submittedContext = [
        lastSapPayload.Series ? `Series=${lastSapPayload.Series}` : '',
        lastSapPayload.BPLId ? `BPLId=${lastSapPayload.BPLId}` : '',
      ].filter(Boolean).join(', ');
      if (submittedContext) {
        errorMessage = `${errorMessage} (submitted ${submittedContext})`;
      }
    }

    // Create a new error with the SAP message
    const sapError = new Error(errorMessage);
    sapError.response = error.response;
    throw sapError;
  }
};

// ───────── UPDATE CREDIT MEMO (USING SERVICE LAYER) ─────────

const updateARCreditMemo = async (docEntry, payload) => {
  try {
    console.log("🔥 [ARCreditMemoService] UPDATING AR CREDIT MEMO:", docEntry, JSON.stringify(payload, null, 2));

    // Use vendor or customerCode (frontend sends vendor)
    const customerCode = payload.header.vendor || payload.header.customerCode || payload.header.customer;
    const documentAdditionalExpenses = buildDocumentAdditionalExpenses(payload.freightCharges);
    const [allowedHeaderUdfs, allowedLineUdfs, headerUdfDefinitionsByKey] = await Promise.all([
      getAllowedUdfKeys('ORIN'),
      getAllowedUdfKeys('RIN1'),
      getUdfDefinitionsByKey('ORIN'),
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
      Rounding: yesNo(payload.header.rounding),
      ...buildMarketingDocumentAddressPayload(payload.header),

      DocumentLines: payload.lines.map((l) => {
        const lineNum = l.lineNum ?? l.LineNum;
        const line = {
          ...(lineNum !== undefined && lineNum !== null && lineNum !== '' ? { LineNum: Number(lineNum) } : {}),
          ItemCode: l.itemNo,
          Quantity: Number(l.quantity),
          UnitPrice: Number(l.unitPrice),
          WarehouseCode: l.whse || l.warehouse || "01",
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
        applyUdfValues(line, buildLineUdfPayload(l, allowedLineUdfs), allowedLineUdfs);
        return line;
      })
    };

    applyUdfValues(sapPayload, payload.header_udfs, allowedHeaderUdfs, headerUdfDefinitionsByKey);

    // Use Service Layer for PATCH operations
    const response = await sapService.request({
      method: 'patch',
      url: `/CreditNotes(${docEntry})`,
      data: sapPayload,
    });

    console.log("✅ [ARCreditMemoService] AR CREDIT MEMO UPDATED:", response.data);

    return {
      message: 'AR Credit Memo updated successfully',
      doc_num: response.data?.DocNum,
      doc_entry: response.data?.DocEntry,
    };
  } catch (error) {
    console.error('❌ [ARCreditMemoService] Failed to update AR credit memo:', error);
    console.error('❌ [ARCreditMemoService] Error details:', error.response?.data);
    throw error;
  }
};

// ───────── DOCUMENT SERIES ─────────

const getDocumentSeries = async (targetDate = null, transactionType = '', branch = '') => {
  try {
    const result = await arCreditMemoDb.getDocumentSeries(targetDate, transactionType || 'GST Tax Invoice', branch);
    return { series: result };
  } catch (error) {
    console.error('[AR Credit Memo Service] Failed to load document series:', error);
    return { series: [] };
  }
};

// ───────── NEXT NUMBER ─────────

const getNextNumber = async (series) => {
  try {
    const result = await arCreditMemoDb.getNextNumber(series);
    return result;
  } catch (error) {
    console.error('[AR Credit Memo Service] Failed to get next number:', error);
    return { nextNumber: '' };
  }
};

// ───────── STATE FROM ADDRESS ─────────

const getStateFromAddress = async (cardCode, addressCode) => {
  try {
    const result = await arCreditMemoDb.getStateFromAddress(cardCode, addressCode);
    return result;
  } catch (error) {
    console.error('[AR Credit Memo Service] Failed to get state from address:', error);
    return { state: '' };
  }
};

const getWarehouseState = async (whsCode) => {
  try {
    const result = await arCreditMemoDb.getWarehouseState(whsCode);
    return result;
  } catch (error) {
    console.error('[AR Credit Memo Service] Failed to get warehouse state:', error);
    return { state: '' };
  }
};

const getFreightCharges = async (docEntry) => {
  try {
    const result = await arCreditMemoDb.getFreightCharges(docEntry);
    return { freightCharges: result };
  } catch (error) {
    console.error('[AR Credit Memo Service] Failed to get freight charges:', error);
    return { freightCharges: [] };
  }
};

const getItemsForModal = async () => {
  try {
    const result = await arCreditMemoDb.getItemsForModal();
    return { items: result };
  } catch (error) {
    console.error('[AR Credit Memo Service] Failed to get items for modal:', error);
    return { items: [] };
  }
};

const getBatchesByItem = async (itemCode, whsCode) => {
  try {
    const result = await arCreditMemoDb.getBatchesByItem(itemCode, whsCode);
    return result;
  } catch (error) {
    console.error('[AR Credit Memo Service] Failed to get batches:', error);
    return { batches: [] };
  }
};

const getUomConversionFactor = async (itemCode, uomCode) => {
  try {
    const result = await arCreditMemoDb.getUomConversionFactor(itemCode, uomCode);
    return result;
  } catch (error) {
    console.error('[AR Credit Memo Service] Failed to get UoM conversion factor:', error);
    return {
      inventoryUOM: '',
      uomCode: uomCode,
      baseQty: 1,
      altQty: 1,
      factor: 1
    };
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getARCreditMemoList,
  getOpenARCreditMemoDocuments,
  getARCreditMemo,
  submitARCreditMemo,
  updateARCreditMemo,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getWarehouseState,
  getFreightCharges,
  getItemsForModal,
  getBatchesByItem,
  getUomConversionFactor,
  // getOpenDeliveries:       async () => ({ documents: await arCreditMemoDb.getOpenDeliveries() }),
  // getDeliveryForCopy:      (d) => arCreditMemoDb.getDeliveryForCopy(d),
  getOpenARInvoices:       async (customerCode = null) => ({ documents: await arCreditMemoDb.getOpenARInvoices(customerCode) }),
  getARInvoiceForCopy:     (d) => arCreditMemoDb.getARInvoiceForCopy(d),
  getARCreditMemoForCopy:  (d) => arCreditMemoDb.getARCreditMemoForCopy(d),
  // getOpenSalesOrders:      async () => ({ documents: await arCreditMemoDb.getOpenSalesOrders() }),
  // getSalesOrderForCopy:    (d) => arCreditMemoDb.getSalesOrderForCopy(d),
  // getOpenReturns:          async (customerCode = null) => ({ documents: await arCreditMemoDb.getOpenReturns(customerCode) }),
  // getReturnForCopy:        (d) => arCreditMemoDb.getReturnForCopy(d),
  // getOpenReturnRequests:   async (customerCode = null) => ({ documents: await arCreditMemoDb.getOpenReturnRequests(customerCode) }),
  // getReturnRequestForCopy: (d) => arCreditMemoDb.getReturnRequestForCopy(d),
  // getOpenDownPayments:     async (customerCode = null) => ({ documents: await arCreditMemoDb.getOpenDownPayments(customerCode) }),
  // getDownPaymentForCopy:   (d) => arCreditMemoDb.getDownPaymentForCopy(d),
};
