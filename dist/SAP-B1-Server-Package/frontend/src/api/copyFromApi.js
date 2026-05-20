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
  fetchOpenDocuments: async (docType, customerCode = null) => {
    const route = ROUTES[docType];
    if (!route) return [];

    const params = customerCode ? { customerCode } : {};
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
export const normaliseDocumentLine = (line, idx, docEntry, baseType, headerBranch = '') => ({
  itemNo:          line.ItemCode        || line.itemNo          || '',
  itemDescription: line.ItemDescription || line.Dscription      || line.itemDescription || '',
  sellerQuality:   line.sellerQuality   || line.SellerQuality   || '',
  buyerQuality:    line.buyerQuality    || line.BuyerQuality    || '',
  quantity:        String(line.Quantity || line.OpenQty || line.quantity || 0),
  unitPrice:       String(line.UnitPrice || line.Price || line.unitPrice || 0),
  sellerPrice:     line.sellerPrice     || line.SellerPrice     || '',
  buyerPrice:      line.buyerPrice      || line.BuyerPrice      || '',
  sellerDelivery:  line.sellerDelivery  || line.SellerDelivery  || '',
  buyerDelivery:   line.buyerDelivery   || line.BuyerDelivery   || '',
  sellerBrokerageAmtPer: line.sellerBrokerageAmtPer || line.SellerBrokerageAmtPer || '',
  sellerBrokeragePercent: line.sellerBrokeragePercent || line.SellerBrokeragePercent || '',
  sellerBrokerage: line.sellerBrokerage || line.SellerBrokerage || '',
  buyerBrokerage:  line.buyerBrokerage  || line.BuyerBrokerage  || '',
  specialRebate:   line.SpecialRebate != null ? String(line.SpecialRebate) : (line.specialRebate != null ? String(line.specialRebate) : ''),
  commission:      line.Commission != null ? String(line.Commission) : (line.commission != null ? String(line.commission) : ''),
  sellerBrokeragePerQty: line.SellerBrokeragePerQty != null ? String(line.SellerBrokeragePerQty) : (line.sellerBrokeragePerQty != null ? String(line.sellerBrokeragePerQty) : ''),
  unitPriceUdf:    line.UnitPriceUdf != null ? String(line.UnitPriceUdf) : (line.unitPriceUdf != null ? String(line.unitPriceUdf) : String(line.UnitPrice || line.Price || line.unitPrice || 0)),
  buyerPaymentTerms: line.buyerPaymentTerms || line.BuyerPaymentTerms || '',
  sellerPaymentTerms: line.sellerPaymentTerms || line.SellerPaymentTerms || '',
  qtySpecialInstruction: line.qtySpecialInstruction || line.QtySpecialInstruction || line.buyerSpecialInstruction || line.BuyerSpecialInstruction || '',
  deliverySpecialInstruction: line.deliverySpecialInstruction || line.DeliverySpecialInstruction || line.sellerSpecialInstruction || line.SellerSpecialInstruction || '',
  buyerSpecialInstruction: line.buyerSpecialInstruction || line.BuyerSpecialInstruction || '',
  sellerSpecialInstruction: line.sellerSpecialInstruction || line.SellerSpecialInstruction || '',
  buyerBillDiscount: line.BuyerBillDiscount != null ? String(line.BuyerBillDiscount) : (line.buyerBillDiscount != null ? String(line.buyerBillDiscount) : ''),
  sellerBillDiscount: line.SellerBillDiscount != null ? String(line.SellerBillDiscount) : (line.sellerBillDiscount != null ? String(line.sellerBillDiscount) : ''),
  sellerItem:      line.sellerItem      || line.SellerItem      || '',
  sellerQty:       line.SellerQty != null ? String(line.SellerQty) : (line.sellerQty != null ? String(line.sellerQty) : ''),
  freightPurchase: line.FreightPurchase != null ? String(line.FreightPurchase) : (line.freightPurchase != null ? String(line.freightPurchase) : ''),
  freightSales:    line.FreightSales != null ? String(line.FreightSales) : (line.freightSales != null ? String(line.freightSales) : ''),
  freightProvider: line.freightProvider || line.FreightProvider || '',
  freightProviderName: line.freightProviderName || line.FreightProviderName || '',
  brokerageNumber: line.brokerageNumber || line.BrokerageNumber || '',
  uomCode:         line.UomCode         || line.unitMsr         || line.uomCode || '',
  uomName:         line.UomName         || line.unitMsr         || line.uomName || line.UomCode || line.uomCode || '',
  hsnCode:         line.HSNCode         || line.hsnCode         || '',
  taxCode:         line.TaxCode         || line.VatGroup        || line.taxCode || '',
  stcode:          line.STCODE          || line.STACode         || line.stcode || line.TaxCode || line.VatGroup || line.taxCode || '',
  whse:            line.WarehouseCode   || line.WhsCode         || line.whse || '',
  stdDiscount:     String(line.DiscountPercent || line.DiscPrcnt || line.stdDiscount || 0),
  total:           line.LineTotal != null ? String(line.LineTotal) : (line.total != null ? String(line.total) : ''),
  distRule:        line.DistributionRule || line.OcrCode || line.distRule || '',
  freeText:        line.FreeText || line.freeText || '',
  countryOfOrigin: line.CountryOfOrigin || line.CountryOrg || line.countryOfOrigin || '',
  openQty:         line.OpenQty != null ? String(line.OpenQty) : (line.openQty != null ? String(line.openQty) : ''),
  deliveredQty:    line.DeliveredQty != null ? String(line.DeliveredQty) : (line.deliveredQty != null ? String(line.deliveredQty) : ''),
  taxAmount:       line.TaxAmount != null ? String(line.TaxAmount) : (line.taxAmount != null ? String(line.taxAmount) : ''),
  documentCreated: line.DocumentCreated || line.documentCreated || '',
  baseEntry:       docEntry             || null,
  baseType,
  baseLine:        line.LineNum         ?? line.lineNum         ?? idx,
  branch:          line.branch          || headerBranch         || '',
});

// ── Shared header normaliser ──────────────────────────────────────────────────
export const normaliseDocumentHeader = (data) => {
  const h = data.header || data;
  return {
    vendor:           h.CardCode   || h.vendor      || h.customer || '',
    name:             h.CardName   || h.name        || '',
    contactPerson:    h.CntctCode  || h.contactPerson || '',
    branch:           String(h.BPL_IDAssignedToInvoice || h.BPLId || h.branch || ''),
    paymentTerms:     String(h.GroupNum || h.paymentTerms || ''),
    placeOfSupply:    h.PlaceOfSupply || h.placeOfSupply || '',
    documentCreated:  h.DocumentCreated || h.CreateDate || h.documentCreated || '',
    otherInstruction: h.Comments   || h.otherInstruction || '',
  };
};
