const sapService = require('./sapService');
const db = require('./dbService');
const purchaseOrderDb = require('./purchaseOrderDbService');
const { getDocumentFreightCharges } = require('./freightChargesDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');
const { buildMarketingDocumentListFilterQuery } = require('./documentListUtils');

const PURCHASE_REQUEST_OBJECT_CODE = '1470000113';

const formatDateForInput = (value) => {
  if (!value) return '';
  return String(value).split('T')[0];
};

const formatDocumentStatus = (value) => {
  const normalized = String(value || '').trim();
  if (normalized === 'bost_Open' || normalized === 'O') return 'Open';
  if (normalized === 'bost_Close' || normalized === 'C') return 'Closed';
  if (normalized === 'bost_Paid') return 'Paid';
  return normalized;
};

const toNumberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const cleanObject = (value) => {
  if (Array.isArray(value)) {
    return value.map(cleanObject).filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      const cleanedValue = cleanObject(nestedValue);
      const isEmptyObject =
        cleanedValue &&
        typeof cleanedValue === 'object' &&
        !Array.isArray(cleanedValue) &&
        Object.keys(cleanedValue).length === 0;

      if (
        cleanedValue === undefined ||
        cleanedValue === null ||
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

const safeQuery = async (query, params = {}) => {
  try {
    const result = await db.query(query, params);
    return result.recordset || [];
  } catch (_error) {
    return [];
  }
};

const getReferenceData = async (_companyId) => {
  try {
    const data = await purchaseOrderDb.getReferenceData();
    return {
      ...data,
      contacts: data.contacts || [],
      pay_to_addresses: data.pay_to_addresses || [],
      ship_to_addresses: data.ship_to_addresses || [],
      bill_to_addresses: data.bill_to_addresses || [],
    };
  } catch (error) {
    return {
      company: '',
      company_state: '',
      vendors: [],
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
      bill_to_addresses: [],
      items: [],
      warehouses: [],
      warehouse_addresses: [],
      company_address: {},
      tax_codes: [],
      payment_terms: [],
      shipping_types: [],
      branches: [],
      states: [],
      uom_groups: [],
      decimal_settings: {
        QtyDec: 2,
        PriceDec: 2,
        SumDec: 2,
        RateDec: 2,
        PercentDec: 2,
      },
      warnings: [`Failed to load reference data: ${error.message}`],
    };
  }
};

const getVendorDetails = async (vendorCode) => {
  if (!vendorCode) {
    return {
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
      bill_to_addresses: [],
    };
  }

  const [contacts, addresses] = await Promise.all([
    safeQuery(
      `
        SELECT
          T0.CardCode,
          T0.CntctCode,
          T0.Name,
          T0.FirstName,
          T0.LastName,
          T0.E_MailL AS E_Mail,
          T0.Cellolar AS MobilePhone,
          T0.Tel1 AS Phone1
        FROM OCPR T0
        WHERE T0.CardCode = @vendorCode
        ORDER BY T0.Name
      `,
      { vendorCode }
    ),
    safeQuery(
      `
        SELECT
          T0.CardCode,
          T0.Address,
          T0.AdresType,
          T0.Street,
          T0.StreetNo,
          T0.Block,
          T0.Building,
          T0.Address2,
          T0.Address3,
          T0.City,
          T0.County,
          T0.State,
          T0.ZipCode,
          T0.Country,
          T0.GSTRegnNo AS GSTIN
        FROM CRD1 T0
        WHERE T0.CardCode = @vendorCode
        ORDER BY T0.Address
      `,
      { vendorCode }
    ),
  ]);

  const billToAddresses = addresses.filter(
    (address) => address.AdresType === 'B' || address.AdresType === 'bo_BillTo'
  );
  const shipToAddresses = addresses.filter(
    (address) => address.AdresType === 'S' || address.AdresType === 'bo_ShipTo'
  );

  return {
    contacts,
    pay_to_addresses: billToAddresses,
    ship_to_addresses: shipToAddresses,
    bill_to_addresses: billToAddresses,
  };
};

const getDocumentSeries = async () => {
  const series = await safeQuery(
    `
      SELECT
        T0.Series,
        T0.SeriesName,
        T0.Indicator,
        T0.NextNumber
      FROM NNM1 T0
      WHERE T0.ObjectCode = @objectCode
        AND T0.Locked = 'N'
      ORDER BY T0.SeriesName
    `,
    { objectCode: PURCHASE_REQUEST_OBJECT_CODE }
  );

  return { series };
};

const getNextNumber = async (series) => {
  const rows = await safeQuery(
    `
      SELECT NextNumber
      FROM NNM1
      WHERE Series = @series
        AND ObjectCode = @objectCode
    `,
    { series, objectCode: PURCHASE_REQUEST_OBJECT_CODE }
  );

  return { nextNumber: rows[0]?.NextNumber ?? null };
};

const getStateFromAddress = async (vendorCode, addressCode) => {
  const rows = await safeQuery(
    `
      SELECT State
      FROM CRD1
      WHERE CardCode = @vendorCode
        AND Address = @addressCode
    `,
    { vendorCode, addressCode }
  );

  return { state: rows[0]?.State || '' };
};

const getStateFromWarehouse = async (whsCode) => {
  const rows = await safeQuery(
    `
      SELECT State
      FROM OWHS
      WHERE WhsCode = @whsCode
    `,
    { whsCode }
  );

  return { state: rows[0]?.State || '' };
};

const getItemsForModal = async () => {
  const items = await purchaseOrderDb.getItemsForModal();
  return { items };
};

const getItemHsnMap = async (itemCodes = []) => {
  const uniqueItemCodes = Array.from(
    new Set(itemCodes.map((itemCode) => String(itemCode || '').trim()).filter(Boolean))
  );

  if (!uniqueItemCodes.length) {
    return {};
  }

  const params = uniqueItemCodes.reduce((acc, itemCode, index) => {
    acc[`item${index}`] = itemCode;
    return acc;
  }, {});

  const placeholders = uniqueItemCodes.map((_, index) => `@item${index}`).join(', ');
  const rows = await safeQuery(
    `
      SELECT
        T0.ItemCode,
        CHP.ChapterID AS HSNCode
      FROM OITM T0
      LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
      WHERE T0.ItemCode IN (${placeholders})
    `,
    params
  );

  return rows.reduce((acc, row) => {
    acc[row.ItemCode] = row.HSNCode || '';
    return acc;
  }, {});
};

const mapPurchaseRequestLineToForm = (line = {}, itemHsnMap = {}) => ({
  itemNo: line.ItemCode || '',
  itemDescription: line.ItemDescription || line.Dscription || '',
  hsnCode: itemHsnMap[line.ItemCode] || line.HSNCode || '',
  quantity:
    line.Quantity !== undefined && line.Quantity !== null ? String(line.Quantity) : '',
  unitPrice:
    line.UnitPrice !== undefined && line.UnitPrice !== null
      ? String(line.UnitPrice)
      : line.Price !== undefined && line.Price !== null
        ? String(line.Price)
        : '',
  uomCode: line.UoMCode || line.MeasureUnit || line.unitMsr || '',
  stdDiscount:
    line.DiscountPercent !== undefined && line.DiscountPercent !== null
      ? String(line.DiscountPercent)
      : line.DiscPrcnt !== undefined && line.DiscPrcnt !== null
        ? String(line.DiscPrcnt)
        : '',
  taxCode: line.TaxCode || line.VatGroup || '',
  total:
    line.LineTotal !== undefined && line.LineTotal !== null ? String(line.LineTotal) : '',
  whse: line.WarehouseCode || line.WhsCode || '',
  loc: '',
  branch: '',
  udf: {},
});

const mapPurchaseRequestToForm = (request = {}, itemHsnMap = {}) => ({
  doc_entry: request.DocEntry,
  doc_num: request.DocNum,
  header: {
    vendor: request.CardCode || '',
    name: request.CardName || '',
    contactPerson:
      request.ContactPersonCode !== undefined && request.ContactPersonCode !== null
        ? String(request.ContactPersonCode)
        : request.CntctCode !== undefined && request.CntctCode !== null
          ? String(request.CntctCode)
          : '',
    salesContractNo: request.NumAtCard || '',
    branch:
      request.BPL_IDAssignedToInvoice !== undefined &&
      request.BPL_IDAssignedToInvoice !== null
        ? String(request.BPL_IDAssignedToInvoice)
        : request.BPLID !== undefined && request.BPLID !== null
          ? String(request.BPLID)
          : '',
    warehouse: '',
    docNo: request.DocNum !== undefined && request.DocNum !== null ? String(request.DocNum) : '',
    status: formatDocumentStatus(request.DocumentStatus) || 'Open',
    series: request.Series !== undefined && request.Series !== null ? String(request.Series) : '',
    postingDate: formatDateForInput(request.DocDate),
    deliveryDate: formatDateForInput(request.RequriedDate || request.DocDueDate),
    documentDate: formatDateForInput(request.TaxDate || request.DocDate),
    contractDate: formatDateForInput(request.ContractDate || request.AgreementValidFrom || ''),
    confirmed: String(request.Confirmed || '').trim() === 'tYES',
    journalRemark: request.JournalMemo || request.JrnlMemo || '',
    paymentTerms:
      request.PaymentGroupCode !== undefined && request.PaymentGroupCode !== null
        ? String(request.PaymentGroupCode)
        : request.GroupNum !== undefined && request.GroupNum !== null
          ? String(request.GroupNum)
          : '',
    otherInstruction: request.Comments || '',
    discount:
      request.DiscountPercent !== undefined && request.DiscountPercent !== null
        ? String(request.DiscountPercent)
        : request.DiscPrcnt !== undefined && request.DiscPrcnt !== null
          ? String(request.DiscPrcnt)
          : '',
    freight:
      request.TotalExpenses !== undefined && request.TotalExpenses !== null
        ? String(request.TotalExpenses)
        : request.TotalExpns !== undefined && request.TotalExpns !== null
          ? String(request.TotalExpns)
          : '',
    tax:
      request.VatSum !== undefined && request.VatSum !== null ? String(request.VatSum) : '',
    totalPaymentDue:
      request.DocTotal !== undefined && request.DocTotal !== null ? String(request.DocTotal) : '',
    placeOfSupply: request.PlaceOfSupply || '',
    shipTo: request.Address || '',
    payTo: request.Address2 || '',
  },
  lines:
    Array.isArray(request.DocumentLines) && request.DocumentLines.length
      ? request.DocumentLines.map((line) => mapPurchaseRequestLineToForm(line, itemHsnMap))
      : [],
  header_udfs: {},
});

const mapPurchaseRequestSummary = (request = {}) => ({
  doc_entry: request.DocEntry,
  doc_num: request.DocNum,
  vendor_code: request.CardCode || '',
  vendor_name: request.CardName || '',
  posting_date: formatDateForInput(request.DocDate),
  delivery_date: formatDateForInput(request.RequriedDate || request.DocDueDate),
  status: formatDocumentStatus(request.DocumentStatus),
  total_amount:
    request.DocTotal !== undefined && request.DocTotal !== null ? request.DocTotal : 0,
});

const getPurchaseRequests = async ({
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
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(200, Math.max(1, Number(pageSize) || 25));
  const skip = (normalizedPage - 1) * normalizedPageSize;
  const { whereClauses, params } = buildMarketingDocumentListFilterQuery({
    query,
    openOnly,
    docNum,
    partnerCode: vendorCode,
    partnerName: vendorName,
    status,
    postingDateFrom,
    postingDateTo,
  });

  const countRows = await safeQuery(`
    SELECT COUNT(*) AS total_count
    FROM OPRQ T0
    WHERE ${whereClauses.join('\n      AND ')}
  `, params);

  const totalCount = Number(countRows?.[0]?.total_count || 0);

  const rows = await safeQuery(`
    SELECT
      T0.DocEntry,
      T0.DocNum,
      ISNULL(T0.CardCode, '') AS CardCode,
      ISNULL(T0.CardName, '') AS CardName,
      T0.DocDate,
      COALESCE(T0.RequriedDate, T0.DocDueDate) AS DeliveryDate,
      T0.DocTotal,
      T0.DocStatus,
      (
        SELECT COUNT(*)
        FROM PRQ1 T1
        WHERE T1.DocEntry = T0.DocEntry
      ) AS line_count
    FROM OPRQ T0
    WHERE ${whereClauses.join('\n      AND ')}
    ORDER BY T0.DocEntry DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize });

  return {
    requests: rows.map((request) => ({
      doc_entry: request.DocEntry,
      doc_num: request.DocNum,
      vendor_code: request.CardCode || '',
      vendor_name: request.CardName || '',
      posting_date: formatDateForInput(request.DocDate),
      delivery_date: formatDateForInput(request.DeliveryDate),
      status: formatDocumentStatus(request.DocStatus),
      total_amount: request.DocTotal !== undefined && request.DocTotal !== null ? request.DocTotal : 0,
      line_count: Number(request.line_count || 0),
    })),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalCount,
      totalPages: Math.max(Math.ceil(totalCount / normalizedPageSize), 1),
    },
  };
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

const getOpenPurchaseRequests = async (vendorCode = null) => {
  const rows = await safeQuery(
    `
      SELECT TOP 200
        T0.DocEntry,
        T0.DocNum,
        T0.DocDate,
        T0.RequriedDate AS DocDueDate,
        ISNULL(T0.CardCode, '') AS CardCode,
        ISNULL(T0.CardName, '') AS CardName,
        T0.Comments,
        T0.DocTotal
      FROM OPRQ T0
      WHERE T0.DocStatus = 'O'
        AND T0.CANCELED <> 'Y'
        AND (@vendorCode IS NULL OR ISNULL(T0.CardCode, '') = @vendorCode)
      ORDER BY T0.DocDate DESC, T0.DocNum DESC
    `,
    { vendorCode }
  );

  return { documents: rows };
};

const getPurchaseRequestForCopy = async (docEntry) => {
  const headerRows = await safeQuery(
    `
      SELECT
        T0.DocEntry,
        T0.DocNum,
        T0.DocDate,
        T0.RequriedDate AS DocDueDate,
        T0.TaxDate,
        ISNULL(T0.CardCode, '') AS CardCode,
        ISNULL(T0.CardName, '') AS CardName,
        T0.CntctCode,
        T0.NumAtCard,
        T0.Comments,
        T0.BPLId AS BPLId,
        T0.BPLId AS BPL_IDAssignedToInvoice,
        T0.GroupNum,
        T0.DiscPrcnt,
        T0.TotalExpns AS Freight
      FROM OPRQ T0
      WHERE T0.DocEntry = @docEntry
    `,
    { docEntry }
  );

  if (!headerRows.length) {
    throw new Error(`Purchase Request ${docEntry} not found`);
  }

  const lineRows = await safeQuery(
    `
      SELECT
        T0.LineNum,
        T0.ItemCode,
        T0.Dscription AS ItemDescription,
        T0.OpenQty AS Quantity,
        T0.Price AS UnitPrice,
        T0.DiscPrcnt AS DiscountPercent,
        T0.WhsCode AS WarehouseCode,
        T0.VatGroup AS TaxCode,
        T0.unitMsr AS UomCode,
        CHP.ChapterID AS HSNCode,
        T0.DocEntry AS BaseEntry,
        T0.LineNum AS BaseLine,
        1470000113 AS BaseType
      FROM PRQ1 T0
      LEFT JOIN OITM ITM ON T0.ItemCode = ITM.ItemCode
      LEFT JOIN OCHP CHP ON ITM.ChapterID = CHP.AbsEntry
      WHERE T0.DocEntry = @docEntry
        AND T0.LineStatus = 'O'
        AND T0.OpenQty > 0
      ORDER BY T0.LineNum
    `,
    { docEntry }
  );

  return { ...headerRows[0], DocumentLines: lineRows };
};

const getPurchaseRequestByDocEntry = async (docEntry) => {
  const normalizedDocEntry = Number(docEntry);
  if (!Number.isInteger(normalizedDocEntry) || normalizedDocEntry <= 0) {
    throw new Error('A valid purchase request document entry is required.');
  }

  const response = await sapService.request({
    method: 'get',
    url: `/PurchaseRequests(${normalizedDocEntry})`,
  });

  const purchaseRequest = response.data || {};
  const itemHsnMap = await getItemHsnMap(
    Array.isArray(purchaseRequest.DocumentLines)
      ? purchaseRequest.DocumentLines.map((line) => line.ItemCode)
      : []
  );

  return {
    purchase_request: mapPurchaseRequestToForm(purchaseRequest, itemHsnMap),
  };
};

const buildDocumentLines = (lines = []) =>
  lines
    .filter((line) => String(line.itemNo || '').trim())
    .map((line) =>
      cleanObject({
        ItemCode: line.itemNo,
        ItemDescription: line.itemDescription,
        Quantity: toNumberOrUndefined(line.quantity),
        UnitPrice: toNumberOrUndefined(line.unitPrice),
        Price: toNumberOrUndefined(line.unitPrice),
        DiscountPercent: toNumberOrUndefined(line.stdDiscount),
        TaxCode: line.taxCode,
        WarehouseCode: line.whse,
        UoMCode: line.uomCode,
        ...(line.udf || {}),
      })
    );

const buildPurchaseRequestPayload = ({ header = {}, lines = [], header_udfs = {}, freightCharges = [] }) =>
  cleanObject({
    CardCode: header.vendor,
    NumAtCard: header.salesContractNo,
    DocDate: header.postingDate || header.documentDate,
    RequriedDate: header.deliveryDate || header.postingDate || header.documentDate,
    TaxDate: header.documentDate || header.postingDate,
    ...(header.series && Number(header.series) > 0 ? { Series: Number(header.series) } : {}),
    BPL_IDAssignedToInvoice: header.branch ? Number(header.branch) : undefined,
    PaymentGroupCode: header.paymentTerms ? Number(header.paymentTerms) : undefined,
    Comments: header.otherInstruction,
    JournalMemo: header.journalRemark,
    Confirmed: header.confirmed ? 'tYES' : 'tNO',
    DiscountPercent: toNumberOrUndefined(header.discount),
    ...header_udfs,
    DocumentAdditionalExpenses: buildDocumentAdditionalExpenses(freightCharges),
    DocumentLines: buildDocumentLines(lines),
  });

const validatePurchaseRequestPayload = async ({ lines = [] }) => {
  const itemCodes = Array.from(
    new Set(lines.map((line) => String(line.itemNo || '').trim()).filter(Boolean))
  );

  if (!itemCodes.length) {
    throw new Error('At least one item line is required before submitting the purchase request.');
  }
};

const submitPurchaseRequest = async (payload) => {
  await validatePurchaseRequestPayload(payload);
  const purchaseRequestPayload = buildPurchaseRequestPayload(payload);

  const response = await sapService.request({
    method: 'post',
    url: '/PurchaseRequests',
    data: purchaseRequestPayload,
  });

  return {
    message: 'Purchase request posted successfully.',
    doc_num: response.data?.DocNum,
    doc_entry: response.data?.DocEntry,
    sap_response: response.data,
  };
};

const updatePurchaseRequest = async (docEntry, payload) => {
  await validatePurchaseRequestPayload(payload);
  const purchaseRequestPayload = buildPurchaseRequestPayload(payload);

  const response = await sapService.request({
    method: 'patch',
    url: `/PurchaseRequests(${docEntry})`,
    data: purchaseRequestPayload,
  });

  return {
    message: 'Purchase request updated successfully.',
    doc_num: response.data?.DocNum,
    doc_entry: docEntry,
    sap_response: response.data,
  };
};

const getFreightCharges = async (docEntry) => {
  try {
    const freightCharges = await getDocumentFreightCharges('PRQ3', docEntry);
    return { freightCharges };
  } catch (_error) {
    return { freightCharges: [] };
  }
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getVendorFilterOptions,
  getPurchaseRequests,
  getOpenPurchaseRequests,
  getPurchaseRequestForCopy,
  getPurchaseRequestByDocEntry,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getStateFromWarehouse,
  getItemsForModal,
  submitPurchaseRequest,
  updatePurchaseRequest,
  getFreightCharges,
};
