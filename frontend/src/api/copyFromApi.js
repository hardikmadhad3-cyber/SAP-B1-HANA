/**
 * Shared Copy From API utility.
 * Each page passes its own `baseUrl` so the same logic hits the right backend.
 *
 * Usage:
 *   import { createCopyFromApi } from './copyFromApi';
 *   const copyApi = createCopyFromApi('/ar-invoice');
 *   const docs = await copyApi.fetchOpenDocuments('salesOrder');
 *   const detail = await copyApi.fetchDocumentForCopy('salesOrder', docEntry);
 */

import client from './client';

// Map docType → { listPath, copyPath }
// listPath  : GET  /<base>/<listPath>
// copyPath  : GET  /<base>/<copyPath>/:docEntry/copy
const ROUTES = {
  quotation:      { list: 'open-sales-quotations', copy: 'quotation' },
  salesQuotation: { list: 'open-sales-quotations', copy: 'quotation' },
  salesOrder:     { list: 'open-sales-orders',     copy: 'sales-order' },
  delivery:       { list: 'open-deliveries',        copy: 'delivery' },
  invoice:        { list: 'open-invoices',          copy: 'invoice' },
  blanket:        { list: 'open-blanket-agreements',copy: 'blanket' },
};

export const createCopyFromApi = (baseUrl) => ({
  /**
   * Fetch the list of open documents for the given docType.
   * Returns the array directly (normalised from whatever key the backend uses).
   */
  fetchOpenDocuments: async (docType, bpCode = null) => {
    const route = ROUTES[docType];
    if (!route) return [];

    const params = bpCode ? { customerCode: bpCode, vendorCode: bpCode } : {};
    const res = await client.get(`${baseUrl}/${route.list}`, { params });
    const d = res.data;
    // Normalise: backend may return { documents }, { orders }, { deliveries } etc.
    return d.documents ?? d.orders ?? d.deliveries ?? d.invoices ?? d.quotations ?? [];
  },

  /**
   * Fetch the full document (header + lines) for copying.
   */
  fetchDocumentForCopy: async (docType, docEntry) => {
    const route = ROUTES[docType];
    if (!route) throw new Error(`Unknown docType: ${docType}`);

    const res = await client.get(`${baseUrl}/${route.copy}/${encodeURIComponent(docEntry)}/copy`);
    return res.data;
  },
});

// ── Pre-built instances for each page ────────────────────────────────────────

export const deliveryCopyFromApi    = createCopyFromApi('/delivery');
export const dcDeliveryCopyFromApi  = createCopyFromApi('/dc-delivery');
export const ncDeliveryCopyFromApi  = createCopyFromApi('/nc-delivery');
export const sodaDeliveryCopyFromApi = createCopyFromApi('/soda-delivery');
export const arInvoiceCopyFromApi   = createCopyFromApi('/ar-invoice');
export const arCreditMemoCopyFromApi = createCopyFromApi('/ar-credit-memo');
export const salesOrderCopyFromApi  = createCopyFromApi('/sales-order');
export const dcSalesOrderCopyFromApi = createCopyFromApi('/dc-sales-order');
export const ncSalesOrderCopyFromApi = createCopyFromApi('/nc-sales-order');
export const sodaSalesOrderCopyFromApi = createCopyFromApi('/soda-sales-order');
export const salesQuotationCopyFromApi = createCopyFromApi('/sales-quotation');

// ── Shared base-type map ──────────────────────────────────────────────────────
export const BASE_TYPE = {
  quotation:      23,
  salesQuotation: 23,
  salesOrder:     17,
  dcSalesOrder:   17,
  ncSalesOrder:   17,
  sodaSalesOrder: 17,
  delivery:       15,
  dcDelivery:     15,
  ncDelivery:     15,
  sodaDelivery:   15,
  purchaseQuotation: 540000006,
  purchaseOrder:  22,
  grpo:           20,
  invoice:        13,
  returns:        14,
  return:         16,
  blanket:        1470000113,
};

// ── Shared line normaliser ────────────────────────────────────────────────────
/**
 * Converts a raw SAP line (from any source document) into the standard
 * frontend line shape used by all document pages.
 */
export const unwrapCopyFromDocument = (data) => {
  const source = data || {};
  const document =
    source.sales_quotation ||
    source.salesQuotation ||
    source.sales_order ||
    source.salesOrder ||
    source.purchase_quotation ||
    source.purchaseQuotation ||
    source.purchase_request ||
    source.purchaseRequest ||
    source.purchase_order ||
    source.purchaseOrder ||
    source.ar_invoice ||
    source.arInvoice ||
    source.ap_invoice ||
    source.apInvoice ||
    source.delivery ||
    source.grpo ||
    source.invoice ||
    source.quotation ||
    source.blanket ||
    source.document ||
    source;
  const header = document.header || document;
  const lines =
    document.DocumentLines ||
    document.documentLines ||
    document.lines ||
    source.DocumentLines ||
    source.documentLines ||
    source.lines ||
    [];
  const docEntry =
    document.DocEntry ??
    document.docEntry ??
    document.doc_entry ??
    source.DocEntry ??
    source.docEntry ??
    source.doc_entry ??
    null;

  return { source, document, header, lines: Array.isArray(lines) ? lines : [], docEntry };
};

const normalizeBranchValue = (value) => {
  const normalized = String(value ?? '').trim();
  const lowered = normalized.toLowerCase();
  if (!normalized || lowered === '0' || lowered === '-1' || lowered === 'no branch' || lowered === 'select branch') {
    return '';
  }
  return normalized;
};

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value) !== '') return value;
  }
  return '';
};

const firstString = (...values) => {
  const value = firstValue(...values);
  return value === '' ? '' : String(value);
};

const sapYesNoToBoolean = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (['Y', 'YES', 'TRUE', '1', 'TYES'].includes(normalized)) return true;
  if (['N', 'NO', 'FALSE', '0', 'TNO'].includes(normalized)) return false;
  return Boolean(value);
};

const formatDateForInput = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).split('T')[0];
  return date.toISOString().split('T')[0];
};

const pickUdfs = (source = {}) => Object.entries(source || {}).reduce((acc, [key, value]) => {
  if (String(key).startsWith('U_')) acc[key] = value == null ? '' : String(value);
  return acc;
}, {});

const normalizeUdfMap = (source = {}) => Object.entries(source || {}).reduce((acc, [key, value]) => {
  if (key) acc[key] = value == null ? '' : value;
  return acc;
}, {});

const getLineUdfs = (line = {}) => ({
  ...pickUdfs(line),
  ...normalizeUdfMap(line.line_udfs),
  ...normalizeUdfMap(line.lineUdfs),
  ...normalizeUdfMap(line.udf),
});

export const normaliseDocumentLine = (line, idx, docEntry, baseType, headerBranch = '') => ({
  itemServiceType:   firstString(line.ItemType, line.itemServiceType, line.LineType, 'Item'),
  itemNo:          firstString(line.ItemCode, line.AccountCode, line.AcctCode, line.itemNo, line.glAccount),
  itemDescription: firstString(line.ItemDescription, line.Dscription, line.itemDescription),
  requiredDate:    formatDateForInput(firstValue(line.RequiredDate, line.ReqDate, line.requiredDate, line.udf?.U_Required_Date, line.udf?.U_ReqDate)),
  quotedDate:      formatDateForInput(firstValue(line.QuotedDate, line.ShipDate, line.quotedDate, line.udf?.U_Quoted_Date, line.udf?.U_QuoteDate)),
  requiredQty:     firstString(line.RequiredQty, line.RequiredQuantity, line.requiredQty, line.udf?.U_Req_Qty, line.udf?.U_ReqQty),
  sellerQuality:   firstString(line.sellerQuality, line.SellerQuality),
  buyerQuality:    firstString(line.buyerQuality, line.BuyerQuality),
  quantity:        firstString(line.Quantity, line.OpenQty, line.quantity, 0),
  unitPrice:       firstString(line.UnitPrice, line.Price, line.unitPrice, 0),
  discountAmount:  firstString(
    line.discountAmount,
    line.DiscountAmount,
    line.U_Rate,
    line.udf?.U_Rate,
    line.line_udfs?.U_Rate,
    line.lineUdfs?.U_Rate,
  ),
  sellerPrice:     firstString(line.sellerPrice, line.SellerPrice),
  buyerPrice:      firstString(line.buyerPrice, line.BuyerPrice),
  sellerDelivery:  firstString(line.sellerDelivery, line.SellerDelivery),
  buyerDelivery:   firstString(line.buyerDelivery, line.BuyerDelivery),
  sellerBrokerageAmtPer: firstString(line.sellerBrokerageAmtPer, line.SellerBrokerageAmtPer),
  sellerBrokeragePercent: firstString(line.sellerBrokeragePercent, line.SellerBrokeragePercent),
  sellerBrokerage: firstString(line.sellerBrokerage, line.SellerBrokerage),
  buyerBrokerage:  firstString(line.buyerBrokerage, line.BuyerBrokerage),
  commPercent:     firstString(line.commPercent, line.CommissionPercent, line.CommPercent),
  specialRebate:   line.SpecialRebate != null ? String(line.SpecialRebate) : (line.specialRebate != null ? String(line.specialRebate) : ''),
  commission:      line.Commission != null ? String(line.Commission) : (line.commission != null ? String(line.commission) : ''),
  sellerBrokeragePerQty: line.SellerBrokeragePerQty != null ? String(line.SellerBrokeragePerQty) : (line.sellerBrokeragePerQty != null ? String(line.sellerBrokeragePerQty) : ''),
  unitPriceUdf:    line.UnitPriceUdf != null ? String(line.UnitPriceUdf) : (line.unitPriceUdf != null ? String(line.unitPriceUdf) : ''),
  buyerPaymentTerms: firstString(line.buyerPaymentTerms, line.BuyerPaymentTerms),
  sellerPaymentTerms: firstString(line.sellerPaymentTerms, line.SellerPaymentTerm, line.SellerPaymentTerms, line.udf?.U_Seller_Payment_Term, line.udf?.U_Seller_Payment_Terms),
  qtySpecialInstruction: firstString(line.qtySpecialInstruction, line.QtySpecialInstruction, line.sellerSpecialInstruction, line.SellerSpecialInstruction),
  deliverySpecialInstruction: firstString(line.deliverySpecialInstruction, line.DeliverySpecialInstruction, line.buyerSpecialInstruction, line.BuyerSpecialInstruction),
  buyerSpecialInstruction: firstString(line.buyerSpecialInstruction, line.BuyerSpecialInstruction),
  sellerSpecialInstruction: firstString(line.sellerSpecialInstruction, line.SellerSpecialInstruction),
  buyerBillDiscount: line.BuyerBillDiscount != null ? String(line.BuyerBillDiscount) : (line.buyerBillDiscount != null ? String(line.buyerBillDiscount) : ''),
  sellerBillDiscount: line.SellerBillDiscount != null ? String(line.SellerBillDiscount) : (line.sellerBillDiscount != null ? String(line.sellerBillDiscount) : ''),
  sellerItem:      firstString(line.sellerItem, line.SellerItem, line.U_S_Item, line.U_SItem, line.udf?.U_S_Item, line.udf?.U_SItem),
  sellerQty:       line.SellerQty != null ? String(line.SellerQty) : (line.sellerQty != null ? String(line.sellerQty) : ''),
  freightPurchase: line.FreightPurchase != null ? String(line.FreightPurchase) : (line.freightPurchase != null ? String(line.freightPurchase) : ''),
  freightSales:    line.FreightSales != null ? String(line.FreightSales) : (line.freightSales != null ? String(line.freightSales) : ''),
  freightProvider: firstString(line.freightProvider, line.FreightProvider),
  freightProviderName: firstString(line.freightProviderName, line.FreightProviderName),
  brokerageNumber: firstString(line.brokerageNumber, line.BrokerageNumber),
  uomCode:         firstString(line.UoMCode, line.UomCode, line.UOMCode, line.uomCode, line.UomEntry, line.UoMEntry),
  uomName:         firstString(line.UoMName, line.UomName, line.UnitMsr, line.unitMsr, line.MeasureUnit, line.uomName, line.UoMCode, line.UomCode, line.uomCode),
  hsnCode:         firstString(line.HSNCode, line.hsnCode),
  sacCode:         firstString(line.SACCode, line.SacCode, line.sacCode),
  taxCode:         firstString(line.TaxCode, line.VatGroup, line.taxCode),
  taxCodeManuallyOverridden: Boolean(firstString(line.TaxCode, line.VatGroup, line.taxCode)),
  stcode:          firstString(line.STCODE, line.STACode, line.stcode),
  whse:            firstString(line.WarehouseCode, line.WhsCode, line.whse),
  stdDiscount:     firstString(line.DiscountPercent, line.DiscPrcnt, line.stdDiscount, 0),
  total:           line.LineTotal != null ? String(line.LineTotal) : (line.total != null ? String(line.total) : ''),
  distRule:        firstString(line.DistributionRule, line.OcrCode, line.distRule),
  distRule2:       firstString(line.DistributionRule2, line.OcrCode2, line.distRule2),
  distRule3:       firstString(line.DistributionRule3, line.OcrCode3, line.distRule3),
  distRule4:       firstString(line.DistributionRule4, line.OcrCode4, line.distRule4),
  distRule5:       firstString(line.DistributionRule5, line.OcrCode5, line.distRule5),
  freeText:        firstString(line.FreeText, line.freeText),
  countryOfOrigin: firstString(line.CountryOfOrigin, line.CountryOrg, line.countryOfOrigin),
  openQty:         line.OpenQty != null ? String(line.OpenQty) : (line.openQty != null ? String(line.openQty) : ''),
  deliveredQty:    line.DeliveredQty != null ? String(line.DeliveredQty) : (line.deliveredQty != null ? String(line.deliveredQty) : ''),
  taxAmount:       line.TaxAmount != null ? String(line.TaxAmount) : (line.taxAmount != null ? String(line.taxAmount) : ''),
  documentCreated: formatDateForInput(firstValue(line.DocumentCreated, line.documentCreated)),
  baseEntry:       docEntry             || null,
  baseType,
  baseLine:        line.LineNum         ?? line.lineNum         ?? idx,
  loc:             firstString(line.LocCode, line.LocationCode, line.loc, line.Location),
  branch:          normalizeBranchValue(line.branch || line.Branch || headerBranch),
  commissionAmountPerTon: firstString(line.commissionAmountPerTon, line.CommissionAmountPerTon),
  commissionBy:    firstString(line.commissionBy, line.CommissionBy),
  udf:             getLineUdfs(line),
});

// ── Shared header normaliser ──────────────────────────────────────────────────
export const normaliseDocumentHeader = (data) => {
  const h = data.header || data;
  const documentRefNo = firstString(
    h.customerRefNo,
    h.salesContractNo,
    h.CustomerRefNo,
    h.VendorRefNo,
    h.NumAtCard
  );

  return {
    vendor:           firstString(h.CardCode, h.customerCode, h.vendor, h.customer),
    name:             firstString(h.CardName, h.customerName, h.name),
    contactPerson:    firstString(h.CntctCode, h.contactPerson),
    branch:           normalizeBranchValue(h.BPL_IDAssignedToInvoice || h.BPLId || h.branch),
    paymentTerms:     firstString(h.GroupNum, h.paymentTermsCode, h.paymentTerms),
    placeOfSupply:    firstString(h.PlaceOfSupply, h.placeOfSupply),
    documentCreated:  formatDateForInput(firstValue(h.DocumentCreated, h.CreateDate, h.documentCreated)),
    postingDate:      formatDateForInput(firstValue(h.postingDate, h.DocDate)),
    deliveryDate:     formatDateForInput(firstValue(h.deliveryDate, h.DocDueDate)),
    documentDate:     formatDateForInput(firstValue(h.documentDate, h.TaxDate)),
    taxInvoiceNo:     firstString(h.taxInvoiceNo, h.TaxInvoiceNo, h.NumAtCard, h.salesContractNo, h.customerRefNo, h.DocNum, h.docNo),
    taxInvoiceDate:   formatDateForInput(firstValue(h.taxInvoiceDate, h.TaxInvoiceDate, h.TaxDate, h.documentDate, h.DocDate)),
    customerRefNo:    documentRefNo,
    salesContractNo:  documentRefNo,
    salesEmployee:    firstString(h.salesEmployee, h.SlpCode),
    purchaser:        firstString(h.purchaser, h.SalesEmployeeName),
    owner:            firstString(h.owner, h.OwnerName),
    shipToCode:       firstString(h.shipToCode, h.ShipToCode),
    shipToAddress:    firstString(h.shipTo, h.shipToAddress, h.Address),
    billToCode:       firstString(h.payToCode, h.billToCode, h.PayToCode),
    billToAddress:    firstString(h.payTo, h.billToAddress, h.Address2),
    shippingType:     firstString(h.shippingType, h.TrnspCode),
    confirmed:        h.confirmed ?? sapYesNoToBoolean(h.Confirmed),
    journalRemark:    firstString(h.journalRemark, h.JrnlMemo),
    discount:         firstString(h.discount, h.DiscPrcnt),
    freight:          firstString(h.freight, h.Freight),
    tax:              firstString(h.tax, h.TaxAmount),
    totalPaymentDue:  firstString(h.totalPaymentDue, h.DocTotal),
    currency:         firstString(h.currency, h.DocCur, 'INR'),
    remarks:          firstString(h.remarks, h.Comments),
    otherInstruction: firstString(h.otherInstruction, h.remarks, h.Comments),
  };
};
