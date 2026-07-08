const DOCUMENT_REFERENCE_TYPES = [
  { value: '22', label: 'Purchase Order', serviceLayer: 'rot_PurchaseOrder' },
  { value: '17', label: 'Sales Order', serviceLayer: 'rot_SalesOrder' },
  { value: '15', label: 'Delivery', serviceLayer: 'rot_DeliveryNotes' },
  { value: '13', label: 'A/R Invoice', serviceLayer: 'rot_SalesInvoice' },
  { value: '14', label: 'A/R Credit Memo', serviceLayer: 'rot_SalesCreditNote' },
  { value: '23', label: 'Sales Quotation', serviceLayer: 'rot_SalesQuotation' },
  { value: '20', label: 'Goods Receipt PO', serviceLayer: 'rot_PurchaseDeliveryNotes' },
  { value: '18', label: 'A/P Invoice', serviceLayer: 'rot_PurchaseInvoice' },
  { value: '19', label: 'A/P Credit Memo', serviceLayer: 'rot_PurchaseCreditNote' },
  { value: '1470000113', label: 'Purchase Request', serviceLayer: 'rot_PurchaseRequest' },
  { value: '540000006', label: 'Purchase Quotation', serviceLayer: 'rot_PurchaseQuotation' },
];

const normalizeReferenceDocType = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.startsWith('rot_')) return normalized;

  const match = DOCUMENT_REFERENCE_TYPES.find((type) => (
    type.value === normalized ||
    type.label.toLowerCase() === normalized.toLowerCase() ||
    type.serviceLayer.toLowerCase() === normalized.toLowerCase()
  ));
  return match?.serviceLayer || normalized;
};

const toOptionalReferenceNumber = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return undefined;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildDocumentReferencesPayload = (references = []) => {
  if (!Array.isArray(references)) return [];

  return references
    .filter((row) => String(row?.direction || 'to').toLowerCase() !== 'by')
    .map((row) => {
      const referencedObjectType = normalizeReferenceDocType(
        row.transactionType || row.referencedObjectType || row.RefObjType
      );
      const referencedDocEntry = toOptionalReferenceNumber(
        row.docEntry || row.referencedDocEntry || row.RefDocEntr
      );
      const referencedDocNumber = toOptionalReferenceNumber(
        row.docNumber || row.referencedDocNumber || row.RefDocNum
      );
      const externalReferencedDocNumber = String(
        row.extDocNumber || row.externalDocNumber || row.ExtDocNum || ''
      ).trim();

      if (
        !referencedObjectType ||
        (!referencedDocEntry && !referencedDocNumber && !externalReferencedDocNumber)
      ) {
        return null;
      }

      return {
        ReferencedObjectType: referencedObjectType,
        ...(referencedDocEntry !== undefined ? { ReferencedDocEntry: referencedDocEntry } : {}),
        ...(referencedDocNumber !== undefined ? { ReferencedDocNumber: referencedDocNumber } : {}),
        ...(externalReferencedDocNumber
          ? { ExternalReferencedDocNumber: externalReferencedDocNumber }
          : {}),
        ...(row.issueDate ? { IssueDate: row.issueDate } : {}),
        ...(row.remark ? { Remark: row.remark } : {}),
      };
    })
    .filter(Boolean);
};

module.exports = {
  buildDocumentReferencesPayload,
};
