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
export const arInvoiceCopyFromApi   = createCopyFromApi('/ar-invoice');
export const arCreditMemoCopyFromApi = createCopyFromApi('/ar-credit-memo');
export const salesOrderCopyFromApi  = createCopyFromApi('/sales-order');
export const salesQuotationCopyFromApi = createCopyFromApi('/sales-quotation');

// ── Shared base-type map ──────────────────────────────────────────────────────
export const BASE_TYPE = {
  quotation:      23,
  salesQuotation: 23,
  salesOrder:     17,
  delivery:       15,
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

export const normaliseDocumentLine = (line, idx, docEntry, baseType, headerBranch = '') => ({
  itemNo:          firstString(line.ItemCode, line.AccountCode, line.AcctCode, line.itemNo, line.glAccount),
  itemDescription: firstString(line.ItemDescription, line.Dscription, line.itemDescription),
  sellerQuality:   firstString(line.sellerQuality, line.SellerQuality),
  buyerQuality:    firstString(line.buyerQuality, line.BuyerQuality),
  quantity:        firstString(line.Quantity, line.OpenQty, line.quantity, 0),
  unitPrice:       firstString(line.UnitPrice, line.Price, line.unitPrice, 0),
  sellerPrice:     firstString(line.sellerPrice, line.SellerPrice),
  buyerPrice:      firstString(line.buyerPrice, line.BuyerPrice),
  sellerDelivery:  firstString(line.sellerDelivery, line.SellerDelivery),
  buyerDelivery:   firstString(line.buyerDelivery, line.BuyerDelivery),
  sellerBrokerageAmtPer: firstString(line.sellerBrokerageAmtPer, line.SellerBrokerageAmtPer),
  sellerBrokeragePercent: firstString(line.sellerBrokeragePercent, line.SellerBrokeragePercent),
  sellerBrokerage: firstString(line.sellerBrokerage, line.SellerBrokerage),
  buyerBrokerage:  firstString(line.buyerBrokerage, line.BuyerBrokerage),
  specialRebate:   line.SpecialRebate != null ? String(line.SpecialRebate) : (line.specialRebate != null ? String(line.specialRebate) : ''),
  commission:      line.Commission != null ? String(line.Commission) : (line.commission != null ? String(line.commission) : ''),
  sellerBrokeragePerQty: line.SellerBrokeragePerQty != null ? String(line.SellerBrokeragePerQty) : (line.sellerBrokeragePerQty != null ? String(line.sellerBrokeragePerQty) : ''),
  unitPriceUdf:    line.UnitPriceUdf != null ? String(line.UnitPriceUdf) : (line.unitPriceUdf != null ? String(line.unitPriceUdf) : String(line.UnitPrice || line.Price || line.unitPrice || 0)),
  buyerPaymentTerms: firstString(line.buyerPaymentTerms, line.BuyerPaymentTerms),
  sellerPaymentTerms: firstString(line.sellerPaymentTerms, line.SellerPaymentTerms),
  qtySpecialInstruction: firstString(line.qtySpecialInstruction, line.QtySpecialInstruction, line.buyerSpecialInstruction, line.BuyerSpecialInstruction),
  deliverySpecialInstruction: firstString(line.deliverySpecialInstruction, line.DeliverySpecialInstruction, line.sellerSpecialInstruction, line.SellerSpecialInstruction),
  buyerSpecialInstruction: firstString(line.buyerSpecialInstruction, line.BuyerSpecialInstruction),
  sellerSpecialInstruction: firstString(line.sellerSpecialInstruction, line.SellerSpecialInstruction),
  buyerBillDiscount: line.BuyerBillDiscount != null ? String(line.BuyerBillDiscount) : (line.buyerBillDiscount != null ? String(line.buyerBillDiscount) : ''),
  sellerBillDiscount: line.SellerBillDiscount != null ? String(line.SellerBillDiscount) : (line.sellerBillDiscount != null ? String(line.sellerBillDiscount) : ''),
  sellerItem:      firstString(line.sellerItem, line.SellerItem),
  sellerQty:       line.SellerQty != null ? String(line.SellerQty) : (line.sellerQty != null ? String(line.sellerQty) : ''),
  freightPurchase: line.FreightPurchase != null ? String(line.FreightPurchase) : (line.freightPurchase != null ? String(line.freightPurchase) : ''),
  freightSales:    line.FreightSales != null ? String(line.FreightSales) : (line.freightSales != null ? String(line.freightSales) : ''),
  freightProvider: firstString(line.freightProvider, line.FreightProvider),
  freightProviderName: firstString(line.freightProviderName, line.FreightProviderName),
  brokerageNumber: firstString(line.brokerageNumber, line.BrokerageNumber),
  uomCode:         firstString(line.UomCode, line.unitMsr, line.uomCode),
  uomName:         firstString(line.UomName, line.unitMsr, line.uomName, line.UomCode, line.uomCode),
  hsnCode:         firstString(line.HSNCode, line.hsnCode),
  taxCode:         firstString(line.TaxCode, line.VatGroup, line.taxCode),
  stcode:          firstString(line.STCODE, line.STACode, line.stcode, line.TaxCode, line.VatGroup, line.taxCode),
  whse:            firstString(line.WarehouseCode, line.WhsCode, line.whse),
  stdDiscount:     firstString(line.DiscountPercent, line.DiscPrcnt, line.stdDiscount, 0),
  total:           line.LineTotal != null ? String(line.LineTotal) : (line.total != null ? String(line.total) : ''),
  distRule:        firstString(line.DistributionRule, line.OcrCode, line.distRule),
  freeText:        firstString(line.FreeText, line.freeText),
  countryOfOrigin: firstString(line.CountryOfOrigin, line.CountryOrg, line.countryOfOrigin),
  openQty:         line.OpenQty != null ? String(line.OpenQty) : (line.openQty != null ? String(line.openQty) : ''),
  deliveredQty:    line.DeliveredQty != null ? String(line.DeliveredQty) : (line.deliveredQty != null ? String(line.deliveredQty) : ''),
  taxAmount:       line.TaxAmount != null ? String(line.TaxAmount) : (line.taxAmount != null ? String(line.taxAmount) : ''),
  documentCreated: formatDateForInput(firstValue(line.DocumentCreated, line.documentCreated)),
  baseEntry:       docEntry             || null,
  baseType,
  baseLine:        line.LineNum         ?? line.lineNum         ?? idx,
  branch:          normalizeBranchValue(line.branch || line.Branch || headerBranch),
  udf:             { ...pickUdfs(line), ...(line.udf || {}) },
});

// ── Shared header normaliser ──────────────────────────────────────────────────
export const normaliseDocumentHeader = (data) => {
  const h = data.header || data;
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
    customerRefNo:    firstString(h.customerRefNo, h.NumAtCard),
    salesEmployee:    firstString(h.salesEmployee, h.SlpCode),
    purchaser:        firstString(h.purchaser, h.SalesEmployeeName),
    owner:            firstString(h.owner, h.OwnerName),
    shipToCode:       firstString(h.shipToCode, h.ShipToCode),
    shipToAddress:    firstString(h.shipTo, h.shipToAddress, h.Address),
    billToCode:       firstString(h.payToCode, h.billToCode, h.PayToCode),
    billToAddress:    firstString(h.payTo, h.billToAddress, h.Address2),
    shippingType:     firstString(h.shippingType, h.TrnspCode),
    confirmed:        h.confirmed ?? (h.Confirmed === 'Y'),
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
